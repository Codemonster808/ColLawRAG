import { Pinecone } from '@pinecone-database/pinecone'
import { embedText } from './embeddings'
import { type DocumentChunk, type RetrieveFilters } from './types'
import { applyReranking } from './reranking'
import { calculateBM25, hybridScore, deserializeBM25Index, type BM25Index } from './bm25'
import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

const USE_PINECONE = process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX
const USE_RERANKING = process.env.USE_RERANKING !== 'false' // Enabled by default
const USE_BM25 = process.env.USE_BM25 !== 'false' // Enabled by default

// --- Carga de índices con soporte para .gz (Vercel serverless) ---

let cachedLocalIndex: DocumentChunk[] | null = null

/**
 * Carga el índice principal. Intenta primero el JSON descomprimido (local dev),
 * luego el .gz comprimido (Vercel serverless) descomprimiéndolo en memoria.
 */
function loadLocalIndex(): DocumentChunk[] {
  if (cachedLocalIndex) return cachedLocalIndex

  const indexPath = path.join(process.cwd(), 'data', 'index.json')
  const gzPath = indexPath + '.gz'

  // 1. Intentar archivo descomprimido (dev local)
  if (fs.existsSync(indexPath)) {
    console.log('[retrieval] Cargando index.json descomprimido...')
    const start = Date.now()
    cachedLocalIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as DocumentChunk[]
    console.log(`[retrieval] index.json cargado: ${cachedLocalIndex.length} chunks en ${Date.now() - start}ms`)
    return cachedLocalIndex
  }

  // 2. Intentar archivo .gz (Vercel serverless)
  if (fs.existsSync(gzPath)) {
    console.log('[retrieval] Descomprimiendo index.json.gz en memoria...')
    const start = Date.now()
    const compressed = fs.readFileSync(gzPath)
    const decompressed = gunzipSync(compressed)
    cachedLocalIndex = JSON.parse(decompressed.toString('utf-8')) as DocumentChunk[]
    console.log(`[retrieval] index.json.gz descomprimido: ${cachedLocalIndex.length} chunks en ${Date.now() - start}ms`)
    return cachedLocalIndex
  }

  console.warn('[retrieval] No se encontró index.json ni index.json.gz')
  return []
}

let cachedBM25Index: BM25Index | null = null

function loadBM25Index(): BM25Index | null {
  if (cachedBM25Index) return cachedBM25Index

  const bm25Path = path.join(process.cwd(), 'data', 'bm25-index.json')
  const gzPath = bm25Path + '.gz'

  // 1. Intentar archivo descomprimido
  if (fs.existsSync(bm25Path)) {
    try {
      const raw = fs.readFileSync(bm25Path, 'utf-8')
      cachedBM25Index = deserializeBM25Index(raw)
      return cachedBM25Index
    } catch {
      return null
    }
  }

  // 2. Intentar archivo .gz (Vercel serverless)
  if (fs.existsSync(gzPath)) {
    try {
      console.log('[retrieval] Descomprimiendo bm25-index.json.gz en memoria...')
      const start = Date.now()
      const compressed = fs.readFileSync(gzPath)
      const decompressed = gunzipSync(compressed)
      cachedBM25Index = deserializeBM25Index(decompressed.toString('utf-8'))
      console.log(`[retrieval] bm25-index.json.gz descomprimido en ${Date.now() - start}ms`)
      return cachedBM25Index
    } catch {
      return null
    }
  }

  return null
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8)
}

export async function retrieveRelevantChunks(query: string, filters?: RetrieveFilters, topK = 8): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
  const queryEmbedding = await embedText(query)
  
  // Retrieve more chunks initially if re-ranking is enabled (to allow re-ranking to select best)
  const initialTopK = USE_RERANKING ? Math.min(topK * 2, 20) : topK

  let retrieved: Array<{ chunk: DocumentChunk; score: number }> = []

  if (USE_PINECONE) {
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
    const index = pc.index(process.env.PINECONE_INDEX!)

    const res = await index.query({
      topK: initialTopK,
      vector: queryEmbedding,
      includeMetadata: true,
      filter: filters?.type ? { type: { $eq: filters.type } } : undefined
    })

    retrieved = (res.matches || []).map(m => ({
      chunk: {
        id: m.id,
        content: (m.metadata as any)?.content || '',
        metadata: {
          id: (m.metadata as any)?.doc_id,
          title: (m.metadata as any)?.title,
          type: (m.metadata as any)?.type,
          article: (m.metadata as any)?.article,
          chapter: (m.metadata as any)?.chapter,
          section: (m.metadata as any)?.section,
          url: (m.metadata as any)?.url,
          sourcePath: (m.metadata as any)?.sourcePath,
        }
      },
      score: m.score || 0
    }))
  } else {
    // Local/Vercel fallback: load index from .json or .json.gz
    const raw = loadLocalIndex()
    retrieved = raw
      .filter(c => (filters?.type ? c.metadata.type === filters.type : true))
      .map(c => ({ chunk: c, score: cosineSimilarity(queryEmbedding, c.embedding || []) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, initialTopK)
  }

  // Apply BM25 hybrid scoring if enabled and index exists
  const bm25Index = USE_BM25 ? loadBM25Index() : null
  if (bm25Index && retrieved.length > 0) {
    const allBM25Scores = retrieved.map(r =>
      calculateBM25(query, r.chunk.id, bm25Index)
    )
    retrieved = retrieved
      .map((r, i) => ({
        ...r,
        score: hybridScore(r.score, allBM25Scores[i], allBM25Scores, 0.7)
      }))
      .sort((a, b) => b.score - a.score)
  }

  // Apply re-ranking if enabled
  if (USE_RERANKING && retrieved.length > 0) {
    retrieved = applyReranking(retrieved, query, {
      useAdvanced: true,
      minScore: 0.05,
      topK: topK
    })
  } else {
    // Just limit to topK if re-ranking is disabled
    retrieved = retrieved.slice(0, topK)
  }

  return retrieved
} 