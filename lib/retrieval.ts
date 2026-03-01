import { Pinecone } from '@pinecone-database/pinecone'
import { embedText } from './embeddings'
import { type DocumentChunk, type RetrieveFilters } from './types'
import { applyReranking, applyRerankingWithCrossEncoder, rerankWithHFSimilarity, addDerogadaNoteToChunk } from './reranking'
import { calculateBM25, hybridScore, deserializeBM25Index, searchBM25, rrfMerge, type BM25Index } from './bm25'
import { isHNSWAvailable, loadHNSWIndex, searchHNSW, getHNSWIdListPath, RRF_K } from './vector-index'
import { consultarVigencia, inferNormaIdFromTitle } from './norm-vigencia'
import { expandQuery, detectLegalArea } from './query-expansion'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { gunzipSync, createGunzip } from 'node:zlib'
import readline from 'node:readline'

const USE_PINECONE = process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX
const USE_RERANKING = process.env.USE_RERANKING !== 'false' // Enabled by default
const USE_BM25 = process.env.USE_BM25 !== 'false' // Enabled by default
const USE_CROSS_ENCODER = process.env.USE_CROSS_ENCODER === 'true' // CU-06: rerank con HF sentence similarity
const USE_QUERY_EXPANSION = process.env.USE_QUERY_EXPANSION !== 'false' // FASE 1.3: Enabled by default
const USE_METADATA_BOOST = process.env.USE_METADATA_BOOST !== 'false' // FASE 1.4: Enabled by default

// --- Carga de índices con soporte para .gz (Vercel serverless) ---

let cachedLocalIndex: DocumentChunk[] | null = null
let indicesDownloadPromise: Promise<void> | null = null

type IndicesUrls = { indexUrl: string; bm25Url: string; version?: string; updatedAt?: string }

function getIndicesUrlsPath() {
  return path.join(process.cwd(), 'data', 'indices-urls.json')
}

function getTmpIndicesDir() {
  // Serverless friendly. On Vercel this is writable.
  return path.join('/tmp', 'col-law-rag-indices')
}

async function downloadToFile(url: string, outputPath: string) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'ColLawRAG-Runtime' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to download ${url} (${res.status}): ${text.slice(0, 200)}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  await fsp.mkdir(path.dirname(outputPath), { recursive: true })
  await fsp.writeFile(outputPath, buf)
}

async function ensureIndicesAvailableAtRuntime() {
  // Avoid duplicate parallel downloads.
  if (indicesDownloadPromise) return indicesDownloadPromise

  indicesDownloadPromise = (async () => {
    const dataDir = path.join(process.cwd(), 'data')
    const indexGz = path.join(dataDir, 'index.json.gz')
    const bm25Gz = path.join(dataDir, 'bm25-index.json.gz')

    // If either exists in the deployment FS, do nothing.
    if (fs.existsSync(indexGz) && fs.existsSync(bm25Gz)) return

    // If running in serverless and tracing missed the files, fallback to runtime download into /tmp
    const urlsPath = getIndicesUrlsPath()
    if (!fs.existsSync(urlsPath)) {
      console.warn('[retrieval] indices-urls.json not found; cannot download indices at runtime')
      return
    }

    let cfg: IndicesUrls
    try {
      cfg = JSON.parse(await fsp.readFile(urlsPath, 'utf-8')) as IndicesUrls
    } catch (e) {
      console.warn('[retrieval] Failed to parse indices-urls.json:', (e as Error).message)
      return
    }

    if (!cfg?.indexUrl || !cfg?.bm25Url) {
      console.warn('[retrieval] indices-urls.json missing indexUrl/bm25Url; cannot download indices at runtime')
      return
    }

    const tmpDir = getTmpIndicesDir()
    const tmpIndexGz = path.join(tmpDir, 'index.json.gz')
    const tmpBm25Gz = path.join(tmpDir, 'bm25-index.json.gz')

    const hasTmp = fs.existsSync(tmpIndexGz) && fs.existsSync(tmpBm25Gz)
    if (hasTmp) return

    console.log('[retrieval] Indices not present in deployment FS. Downloading to /tmp ...')
    const start = Date.now()
    await Promise.all([
      downloadToFile(cfg.indexUrl, tmpIndexGz),
      downloadToFile(cfg.bm25Url, tmpBm25Gz),
    ])
    console.log(`[retrieval] Indices downloaded to /tmp in ${Date.now() - start}ms`)
  })().finally(() => {
    // allow retries if it failed
    indicesDownloadPromise = null
  })

  return indicesDownloadPromise
}

/**
 * Carga el índice principal. Intenta primero el JSON descomprimido (local dev),
 * luego el .gz comprimido (Vercel serverless) descomprimiéndolo en memoria.
 */
async function loadLocalIndex(): Promise<DocumentChunk[]> {
  if (cachedLocalIndex) return cachedLocalIndex

  const indexPath = path.join(process.cwd(), 'data', 'index.json')
  const gzPath = indexPath + '.gz'
  const tmpGzPath = path.join(getTmpIndicesDir(), 'index.json.gz')

  // 1. Intentar archivo descomprimido (dev local)
  if (fs.existsSync(indexPath)) {
    console.log('[retrieval] Cargando index.json descomprimido...')
    const start = Date.now()
    // Usar Buffer para evitar ERR_STRING_TOO_LONG con índices >512MB
    // Para índices muy grandes (>500MB) usamos lectura línea a línea
    const fileSizeMB = fs.statSync(indexPath).size / (1024 * 1024)
    if (fileSizeMB > 400) {
      console.log(`[retrieval] Índice grande (${fileSizeMB.toFixed(0)}MB), leyendo línea a línea...`)
      const chunks: DocumentChunk[] = []
      const rl = readline.createInterface({ input: fs.createReadStream(indexPath), crlfDelay: Infinity })
      await new Promise<void>((resolve) => {
        rl.on('line', (line: string) => {
          const t = line.trim().replace(/,$/, '')
          if (!t || t === '[' || t === ']') return
          try { chunks.push(JSON.parse(t) as DocumentChunk) } catch {}
        })
        rl.on('close', resolve)
      })
      cachedLocalIndex = chunks
    } else {
      cachedLocalIndex = JSON.parse(fs.readFileSync(indexPath).toString()) as DocumentChunk[]
    }
    console.log(`[retrieval] index.json cargado: ${cachedLocalIndex.length} chunks en ${Date.now() - start}ms`)
    return cachedLocalIndex
  }

  // 2. Intentar archivo .gz (Vercel serverless) — stream parse para no agotar RAM
  if (fs.existsSync(gzPath)) {
    console.log('[retrieval] Leyendo index.json.gz línea a línea (streaming)...')
    const start = Date.now()
    const chunks: DocumentChunk[] = []
    await new Promise<void>((resolve, reject) => {
      const gunzip = createGunzip()
      const input = fs.createReadStream(gzPath)
      const rl = readline.createInterface({ input: input.pipe(gunzip), crlfDelay: Infinity })
      rl.on('line', (line: string) => {
        const t = line.trim().replace(/,$/, '')
        if (!t || t === '[' || t === ']') return
        try { chunks.push(JSON.parse(t) as DocumentChunk) } catch {}
      })
      rl.on('close', resolve)
      rl.on('error', reject)
      input.on('error', reject)
      gunzip.on('error', reject)
    })
    cachedLocalIndex = chunks
    console.log(`[retrieval] index.json.gz cargado: ${cachedLocalIndex.length} chunks en ${Date.now() - start}ms`)
    return cachedLocalIndex
  }

  // 3. CU-07: Intentar Vercel Blob (BLOB_INDEX_URL) para reducir cold start
  const blobIndexUrl = process.env.BLOB_INDEX_URL
  if (blobIndexUrl) {
    try {
      const { get } = await import('@vercel/blob')
      const blob = await get(blobIndexUrl)
      const compressed = Buffer.from(await blob.arrayBuffer())
      const decompressed = gunzipSync(compressed)
      cachedLocalIndex = JSON.parse(decompressed.toString('utf-8')) as DocumentChunk[]
      console.log(`[retrieval] Índice cargado desde Vercel Blob: ${cachedLocalIndex.length} chunks`)
      return cachedLocalIndex
    } catch (e) {
      console.warn('[retrieval] Fallo al cargar índice desde Blob:', (e as Error).message)
    }
  }

  // 4. Intentar .gz en /tmp (runtime download fallback) — stream parse igual que path 2
  if (fs.existsSync(tmpGzPath)) {
    console.log('[retrieval] Leyendo /tmp/index.json.gz línea a línea (streaming)...')
    const start = Date.now()
    const chunks: DocumentChunk[] = []
    await new Promise<void>((resolve, reject) => {
      const gunzip = createGunzip()
      const input = fs.createReadStream(tmpGzPath)
      const rl = readline.createInterface({ input: input.pipe(gunzip), crlfDelay: Infinity })
      rl.on('line', (line: string) => {
        const t = line.trim().replace(/,$/, '')
        if (!t || t === '[' || t === ']') return
        try { chunks.push(JSON.parse(t) as DocumentChunk) } catch {}
      })
      rl.on('close', resolve)
      rl.on('error', reject)
      input.on('error', reject)
      gunzip.on('error', reject)
    })
    cachedLocalIndex = chunks
    console.log(`[retrieval] /tmp/index.json.gz cargado: ${cachedLocalIndex.length} chunks en ${Date.now() - start}ms`)
    return cachedLocalIndex
  }

  console.warn('[retrieval] No se encontró index.json, index.json.gz ni BLOB_INDEX_URL')
  return []
}

let cachedBM25Index: BM25Index | null = null

function loadBM25Index(): BM25Index | null {
  if (cachedBM25Index) return cachedBM25Index

  const bm25Path = path.join(process.cwd(), 'data', 'bm25-index.json')
  const gzPath = bm25Path + '.gz'
  const tmpGzPath = path.join(getTmpIndicesDir(), 'bm25-index.json.gz')

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

  // 3. Intentar /tmp (runtime download fallback)
  if (fs.existsSync(tmpGzPath)) {
    try {
      console.log('[retrieval] Descomprimiendo /tmp/bm25-index.json.gz en memoria...')
      const start = Date.now()
      const compressed = fs.readFileSync(tmpGzPath)
      const decompressed = gunzipSync(compressed)
      cachedBM25Index = deserializeBM25Index(decompressed.toString('utf-8'))
      console.log(`[retrieval] /tmp/bm25-index.json.gz descomprimido en ${Date.now() - start}ms`)
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

/**
 * FASE 1.4: Metadata Boost
 * 
 * Aplica boost a chunks cuya metadata coincide con el área legal detectada.
 * Boost NO es excluyente: chunks de otras áreas se mantienen pero con menor prioridad.
 * 
 * Estrategia:
 * - Si detectedArea coincide con metadata del chunk → boost +15%
 * - Si metadata del chunk menciona término clave del área → boost +10%
 * - Luego re-ordenar por score ajustado
 * 
 * @param retrieved Chunks recuperados con scores originales
 * @param detectedArea Área legal detectada en la query (o null)
 * @returns Chunks con scores ajustados y re-ordenados
 */
function applyMetadataBoost<T extends { chunk: DocumentChunk; score: number }>(
  retrieved: T[],
  detectedArea: string | null
): T[] {
  if (!detectedArea || retrieved.length === 0) {
    return retrieved
  }
  
  // Keywords por área para detectar coincidencias en metadata
  const areaKeywords: Record<string, string[]> = {
    'laboral': ['cst', 'código sustantivo del trabajo', 'trabajo', 'laboral', 'empleado'],
    'tributario': ['estatuto tributario', 'tributario', 'impuesto', 'dian', 'renta'],
    'civil': ['código civil', 'civil', 'contrato', 'propiedad', 'obligación'],
    'penal': ['código penal', 'penal', 'delito', 'pena', 'tipo penal'],
    'constitucional': ['constitución', 'constitucional', 'derechos fundamentales', 'tutela'],
    'administrativo': ['cpaca', 'administrativo', 'acto administrativo', 'contencioso'],
  }
  
  const keywords = areaKeywords[detectedArea.toLowerCase()] || []
  
  // Aplicar boost a cada chunk
  const boosted = retrieved.map(item => {
    const title = item.chunk.metadata?.title?.toLowerCase() || ''
    const type = item.chunk.metadata?.type?.toLowerCase() || ''
    
    let boostFactor = 1.0
    
    // Boost si el título menciona keywords del área
    for (const keyword of keywords) {
      if (title.includes(keyword)) {
        boostFactor = 1.50 // +50% boost (Sprint 3: aumentado de 15% a 50%)
        break
      }
    }
    
    // Boost adicional si el tipo coincide con el área
    if (type === detectedArea.toLowerCase()) {
      boostFactor = Math.max(boostFactor, 1.40) // +40% boost mínimo (Sprint 3: aumentado de 10% a 40%)
    }
    
    return {
      ...item,
      score: item.score * boostFactor,
      _boosted: boostFactor > 1.0 // Flag para debugging
    }
  })
  
  // Re-ordenar por score ajustado (descendente)
  return boosted.sort((a, b) => b.score - a.score)
}

export async function retrieveRelevantChunks(query: string, filters?: RetrieveFilters, topK = 8): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
  // FASE 1.3: Query expansion (coloquial → legal)
  const expandedQuery = USE_QUERY_EXPANSION ? expandQuery(query) : query
  const detectedArea = USE_METADATA_BOOST ? detectLegalArea(query) : null
  
  // Log expansion for debugging (only in development)
  if (process.env.NODE_ENV === 'development' && expandedQuery !== query) {
    console.log(`[retrieval] Query expanded: "${query}" → "${expandedQuery.slice(0, 150)}..."`)
    if (detectedArea) console.log(`[retrieval] Detected area: ${detectedArea}`)
  }
  
  const queryEmbedding = await embedText(expandedQuery)
  
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
    // Local/Vercel: HNSW (FASE_1 1.1) or linear scan; BM25 full corpus + RRF (FASE_1 1.2)
    await ensureIndicesAvailableAtRuntime()
    const raw = await loadLocalIndex()
    const idMap = new Map(raw.map(c => [c.id, c]))
    const k = Math.max(initialTopK * 2, 20)

    let vectorList: Array<{ id: string; score: number }>
    if (isHNSWAvailable()) {
      if (!(globalThis as any).__hnswLoaded) {
        loadHNSWIndex(getHNSWIdListPath()) && ((globalThis as any).__hnswLoaded = true)
      }
      vectorList = searchHNSW(queryEmbedding, k)
    } else {
      vectorList = raw
        .map(c => ({ id: c.id, score: cosineSimilarity(queryEmbedding, c.embedding || []) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
    }

    const bm25Index = USE_BM25 ? loadBM25Index() : null
    if (bm25Index && vectorList.length >= 0) {
      const bm25List = searchBM25(expandedQuery, bm25Index, k)
      const merged = rrfMerge(vectorList, bm25List, RRF_K)
      retrieved = merged
        .slice(0, initialTopK)
        .map(({ id, rrfScore }) => ({ chunk: idMap.get(id)!, score: rrfScore }))
        .filter(r => r.chunk && (filters?.type ? r.chunk.metadata.type === filters.type : true))
    } else {
      retrieved = vectorList
        .slice(0, initialTopK)
        .map(({ id, score }) => ({ chunk: idMap.get(id)!, score }))
        .filter(r => r.chunk && (filters?.type ? r.chunk.metadata.type === filters.type : true))
    }
  }

  // FASE 1.4: Apply metadata boost (non-exclusive)
  if (USE_METADATA_BOOST && detectedArea && retrieved.length > 0) {
    retrieved = applyMetadataBoost(retrieved, detectedArea)
    if (process.env.NODE_ENV === 'development') {
      const boostedCount = retrieved.filter((r: any) => r._boosted).length
      console.log(`[retrieval] Metadata boost applied: ${boostedCount}/${retrieved.length} chunks boosted for area: ${detectedArea}`)
    }
  }

  // Apply re-ranking if enabled
  if (USE_RERANKING && retrieved.length > 0) {
    // I2: Si RERANK_PROVIDER=hf usar cross-encoder real (applyRerankingWithCrossEncoder)
    const RERANK_PROVIDER = process.env.RERANK_PROVIDER || ''
    if (RERANK_PROVIDER === 'hf' && process.env.HUGGINGFACE_API_KEY) {
      // FASE_3 3.1: Cross-encoder real para top-20 chunks
      retrieved = await applyRerankingWithCrossEncoder(retrieved, query, {
        minScore: 0.05,
        topK: topK
      })
    } else {
      // Fallback: reranking con heurísticas (sin cross-encoder)
      retrieved = applyReranking(retrieved, query, {
        useAdvanced: true,
        minScore: 0.05,
        topK: topK * 2
      })
      // CU-06: opcional re-ranking con modelo HF (sentence similarity) para mejor relevancia top-K
      if (USE_CROSS_ENCODER && process.env.HUGGINGFACE_API_KEY && retrieved.length > 0) {
        const toRerank = retrieved.slice(0, 16)
        const rest = retrieved.slice(16)
        try {
          const reranked = await rerankWithHFSimilarity(toRerank, query)
          retrieved = [...reranked, ...rest].slice(0, topK)
        } catch {
          retrieved = retrieved.slice(0, topK)
        }
      } else {
        retrieved = retrieved.slice(0, topK)
      }
    }
  } else {
    retrieved = retrieved.slice(0, topK)
  }

  // Filtrar chunks de normas totalmente derogadas (data/normas-vigencia). Desactivar con USE_VIGENCIA_FILTER=false
  const USE_VIGENCIA_FILTER = process.env.USE_VIGENCIA_FILTER !== 'false'
  if (USE_VIGENCIA_FILTER && retrieved.length > 0) {
    retrieved = filterChunksByVigencia(retrieved)
  }

  // FASE_3 3.4: Añadir NOTA de norma derogada en contenido del chunk para el LLM
  const ADD_DEROGADA_NOTE = process.env.ADD_DEROGADA_NOTE !== 'false'
  if (ADD_DEROGADA_NOTE && retrieved.length > 0) {
    retrieved = retrieved.map(r => ({
      ...r,
      chunk: addDerogadaNoteToChunk(r.chunk)
    }))
  }

  return retrieved
}

/**
 * Filtra chunks cuya norma (inferida por título) está totalmente derogada.
 * Exportado para tests de integración.
 */
export function filterChunksByVigencia<T extends { chunk: DocumentChunk; score: number }>(
  retrieved: T[]
): T[] {
  const filtered: T[] = []
  for (const r of retrieved) {
    const title = r.chunk.metadata?.title
    if (!title || r.chunk.metadata?.type === 'procedimiento') {
      filtered.push(r)
      continue
    }
    const normaId = inferNormaIdFromTitle(title)
    if (!normaId) {
      filtered.push(r)
      continue
    }
    const vigencia = consultarVigencia(normaId)
    if (!vigencia || vigencia.estado !== 'derogada') {
      filtered.push(r)
    }
  }
  return filtered
} 