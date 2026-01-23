import { Pinecone } from '@pinecone-database/pinecone'
import { embedText } from './embeddings'
import { type DocumentChunk, type RetrieveFilters } from './types'
import { applyReranking } from './reranking'
import fs from 'node:fs'
import path from 'node:path'

const USE_PINECONE = process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX
const USE_RERANKING = process.env.USE_RERANKING !== 'false' // Enabled by default

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
    // Local fallback: load data/index.json built by ingest
    const indexPath = path.join(process.cwd(), 'data', 'index.json')
    const raw = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as DocumentChunk[] : []
    retrieved = raw
      .filter(c => (filters?.type ? c.metadata.type === filters.type : true))
      .map(c => ({ chunk: c, score: cosineSimilarity(queryEmbedding, c.embedding || []) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, initialTopK)
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