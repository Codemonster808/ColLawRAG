import { type DocumentChunk } from './types'
import { consultarVigencia, inferNormaIdFromTitle } from './norm-vigencia'

// FASE_3 3.2: Pesos del score final (cross-encoder principal; heurísticas secundarias)
const WEIGHT_CROSS_ENCODER = 0.70
const WEIGHT_HIERARCHY = 0.15
const WEIGHT_RECENCY = 0.10
const WEIGHT_VIGENCIA = 0.05
const MAX_HIERARCHY_RAW = 0.60
const MAX_RECENCY_RAW = 0.15
const RERANK_TOP_N = 20

const RERANK_MODEL = process.env.RERANK_MODEL || 'BAAI/bge-reranker-v2-m3'
const RERANK_PROVIDER = process.env.RERANK_PROVIDER || ''

// FASE_3 3.3: Cache y truncamiento para optimizar latencia
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos
const MAX_TEXT_LENGTH = 512 // Truncar textos para reducir latencia API
const BATCH_SIZE = 20 // Batch de 20 pares (ya limitado por RERANK_TOP_N)

// FASE_3 3.4: Penalización normas derogadas
const PENALTY_DEROGADA_TOTAL = -0.30 // Penalización por norma totalmente derogada

// FASE_3 3.3: Cache simple para cross-encoder scores (5 min TTL)
interface CacheEntry {
  scores: number[]
  timestamp: number
}
const crossEncoderCache = new Map<string, CacheEntry>()

function getCacheKey(query: string, chunkIds: string[]): string {
  return `${query.slice(0, 100)}__${chunkIds.slice(0, 5).join('_')}`
}

function getCachedScores(cacheKey: string): number[] | null {
  const entry = crossEncoderCache.get(cacheKey)
  if (!entry) return null
  
  const now = Date.now()
  if (now - entry.timestamp > CACHE_TTL_MS) {
    crossEncoderCache.delete(cacheKey)
    return null
  }
  
  return entry.scores
}

function setCachedScores(cacheKey: string, scores: number[]): void {
  crossEncoderCache.set(cacheKey, {
    scores,
    timestamp: Date.now()
  })
  
  // Cleanup: eliminar entradas viejas si el cache crece mucho
  if (crossEncoderCache.size > 100) {
    const now = Date.now()
    for (const [key, entry] of crossEncoderCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL_MS) {
        crossEncoderCache.delete(key)
      }
    }
  }
}

export interface RerankedChunk {
  chunk: DocumentChunk
  score: number
  originalScore: number
  hierarchyBoost: number
  recencyBoost: number
  finalScore: number
}

/**
 * Jerarquía legal colombiana con boost values (MEJORADO 2026-02-09)
 * 
 * Multiplicadores aplicados:
 * - Constitución: x2.0 (máxima jerarquía)
 * - Leyes: x1.5 (alta jerarquía)
 * - Decretos: x1.2 (reducido)
 * - Jurisprudencia reciente: x1.3 (aumentado)
 */
const LEGAL_HIERARCHY_BOOST: Record<string, number> = {
  constitucion: 0.60,        // Aumentado de 0.30 a 0.60 (x2.0)
  codigo: 0.50,              // Aumentado de 0.25 a 0.50 (x2.0, similar a constitución)
  ley_organica: 0.44,        // Aumentado de 0.22 a 0.44 (x2.0)
  ley_estatutaria: 0.44,     // Aumentado de 0.22 a 0.44 (x2.0)
  ley: 0.30,                 // Aumentado de 0.20 a 0.30 (x1.5)
  decreto_ley: 0.22,         // Aumentado de 0.18 a 0.22 (x1.2)
  decreto: 0.12,             // Aumentado de 0.10 a 0.12 (x1.2)
  resolucion: 0.05,          // Sin cambio
  jurisprudencia_corte_constitucional: 0.20,  // Aumentado de 0.15 a 0.20 (x1.3)
  jurisprudencia_corte_suprema: 0.16,         // Aumentado de 0.12 a 0.16 (x1.3)
  jurisprudencia_consejo_estado: 0.16,        // Aumentado de 0.12 a 0.16 (x1.3)
  jurisprudencia: 0.10,      // Aumentado de 0.08 a 0.10 (x1.25)
  concepto: 0.03,            // Sin cambio
  default: 0
}

/**
 * Determina el nivel de jerarquía legal de un documento
 * Retorna un score de boost basado en la pirámide normativa colombiana
 */
export function getLegalHierarchyScore(chunk: DocumentChunk): number {
  const title = chunk.metadata.title.toLowerCase()
  const content = chunk.content.toLowerCase().slice(0, 500) // Solo revisar inicio
  const type = chunk.metadata.type
  
  // Constitución tiene máxima jerarquía
  if (title.includes('constitución') || title.includes('constitucion')) {
    return LEGAL_HIERARCHY_BOOST.constitucion
  }
  
  // Códigos (Civil, Penal, Laboral, Comercio, etc.)
  if (title.includes('código') || title.includes('codigo')) {
    return LEGAL_HIERARCHY_BOOST.codigo
  }
  
  // Leyes orgánicas y estatutarias (mayor jerarquía que leyes ordinarias)
  if (title.includes('ley orgánica') || title.includes('ley organica')) {
    return LEGAL_HIERARCHY_BOOST.ley_organica
  }
  if (title.includes('ley estatutaria')) {
    return LEGAL_HIERARCHY_BOOST.ley_estatutaria
  }
  
  // Leyes ordinarias
  if (title.match(/\bley\s+\d+/) || (type === 'estatuto' && title.includes('ley'))) {
    return LEGAL_HIERARCHY_BOOST.ley
  }
  
  // Decretos con fuerza de ley
  if (title.includes('decreto ley') || title.includes('decreto-ley')) {
    return LEGAL_HIERARCHY_BOOST.decreto_ley
  }
  
  // Decretos reglamentarios
  if (title.includes('decreto') || type === 'reglamento') {
    return LEGAL_HIERARCHY_BOOST.decreto
  }
  
  // Resoluciones
  if (title.includes('resolución') || title.includes('resolucion')) {
    return LEGAL_HIERARCHY_BOOST.resolucion
  }
  
  // Jurisprudencia - diferenciar por corte
  if (type === 'jurisprudencia') {
    if (title.includes('corte constitucional') || content.includes('corte constitucional')) {
      return LEGAL_HIERARCHY_BOOST.jurisprudencia_corte_constitucional
    }
    if (title.includes('corte suprema') || content.includes('corte suprema de justicia')) {
      return LEGAL_HIERARCHY_BOOST.jurisprudencia_corte_suprema
    }
    if (title.includes('consejo de estado') || content.includes('consejo de estado')) {
      return LEGAL_HIERARCHY_BOOST.jurisprudencia_consejo_estado
    }
    return LEGAL_HIERARCHY_BOOST.jurisprudencia
  }
  
  // Conceptos y circulares
  if (title.includes('concepto') || title.includes('circular')) {
    return LEGAL_HIERARCHY_BOOST.concepto
  }
  
  // Por defecto
  return LEGAL_HIERARCHY_BOOST.default
}

/**
 * Obtiene el nombre de la jerarquía para logging/debug
 */
export function getLegalHierarchyName(chunk: DocumentChunk): string {
  const score = getLegalHierarchyScore(chunk)
  for (const [name, value] of Object.entries(LEGAL_HIERARCHY_BOOST)) {
    if (value === score) return name
  }
  return 'default'
}

/**
 * Calcula un boost basado en la recencia del documento y vigencia
 * Documentos más recientes y vigentes tienen mayor relevancia
 * MEJORADO 2026-02-09: Considera fecha de vigencia explícitamente
 */
export function getRecencyScore(chunk: DocumentChunk): number {
  const currentYear = new Date().getFullYear()
  let year: number | null = null
  
  // 1. Intentar obtener año de fechaVigencia en metadata
  if (chunk.metadata.fechaVigencia) {
    const vigenciaMatch = chunk.metadata.fechaVigencia.match(/(\d{4})/)
    if (vigenciaMatch) {
      year = parseInt(vigenciaMatch[1])
    }
  }
  
  // 2. Si no hay fechaVigencia, buscar en el título
  if (year === null) {
    const title = chunk.metadata.title
    const yearMatch = title.match(/(19|20)\d{2}/)
    if (yearMatch) {
      year = parseInt(yearMatch[0])
    }
  }
  
  // 3. Si encontramos un año, calcular boost basado en recencia
  if (year !== null) {
    const age = currentYear - year
    
    // Documentos de los últimos 3 años: boost máximo (x1.3 para jurisprudencia)
    if (age <= 3) {
      // Boost adicional para jurisprudencia reciente
      if (chunk.metadata.type === 'jurisprudencia') {
        return 0.15 // Boost alto para jurisprudencia reciente
      }
      return 0.12 // Boost alto para otros documentos recientes
    }
    
    // Documentos de 3-5 años: boost alto
    if (age <= 5) {
      if (chunk.metadata.type === 'jurisprudencia') {
        return 0.10
      }
      return 0.08
    }
    
    // Documentos de 5-10 años: boost medio
    if (age <= 10) {
      return 0.05
    }
    
    // Documentos de 10-15 años: boost bajo
    if (age <= 15) {
      return 0.02
    }
    
    // Documentos más antiguos: sin boost (o boost negativo muy pequeño)
    return 0
  }
  
  // 4. Si no hay información de fecha, verificar vigencia usando norm-vigencia
  // Consultar sistema de vigencia para determinar si el documento está vigente
  try {
    const normaId = inferNormaIdFromTitle(chunk.metadata.title)
    if (normaId) {
      const vigencia = consultarVigencia(normaId)
      if (vigencia && vigencia.vigente) {
        // Si está vigente, dar boost pequeño
        return 0.02
      } else {
        // Si no está vigente o está derogada, reducir score (boost negativo)
        return -0.05
      }
    }
  } catch (error) {
    // Si hay error consultando vigencia, asumir que es actual
    // (no queremos bloquear el scoring por errores en el sistema de vigencia)
  }
  
  // Por defecto, asumir que es actual (boost pequeño)
  return 0.02
}

/**
 * Cross-encoder real vía API HF (FASE_3 3.1). Aplica solo a top-20 chunks.
 * FASE_3 3.3: Con cache (5 min), batching (20 pares) y truncamiento (512 chars).
 * Retorna scores normalizados 0-1 o null si no está disponible.
 */
async function getCrossEncoderScores(
  query: string,
  chunks: Array<{ chunk: DocumentChunk; score: number }>
): Promise<number[] | null> {
  if (chunks.length === 0 || !process.env.HUGGINGFACE_API_KEY || RERANK_PROVIDER !== 'hf') return null
  
  // FASE_3 3.3: Batch de 20 pares (limitar a BATCH_SIZE)
  const toRank = chunks.slice(0, Math.min(BATCH_SIZE, RERANK_TOP_N))
  const chunkIds = toRank.map(r => r.chunk.id)
  
  // FASE_3 3.3: Check cache (5 min TTL)
  const cacheKey = getCacheKey(query, chunkIds)
  const cachedScores = getCachedScores(cacheKey)
  if (cachedScores) {
    return cachedScores
  }
  
  // FASE_3 3.3: Truncar textos para reducir latencia API
  const queryShort = query.slice(0, MAX_TEXT_LENGTH)
  const texts = toRank.map(r => r.chunk.content.slice(0, MAX_TEXT_LENGTH))
  
  try {
    const { HfInference } = await import('@huggingface/inference')
    const hf = new HfInference(process.env.HUGGINGFACE_API_KEY)
    const scores = await hf.sentenceSimilarity({
      model: RERANK_MODEL,
      inputs: { source_sentence: queryShort, sentences: texts }
    }) as number[]
    
    if (!Array.isArray(scores) || scores.length !== toRank.length) return null
    
    // Normalizar scores a rango 0-1
    const min = Math.min(...scores)
    const max = Math.max(...scores)
    const range = max - min || 1
    const normalizedScores = scores.map(s => (s - min) / range)
    
    // FASE_3 3.3: Guardar en cache
    setCachedScores(cacheKey, normalizedScores)
    
    return normalizedScores
  } catch {
    return null
  }
}

/**
 * Re-ranking simple basado en scoring combinado (FASE_3 3.2: sin normalización incorrecta)
 * Combina: score original (0-1) + jerarquía + recencia con pesos recalibrados
 */
export function rerankChunks(
  chunks: Array<{ chunk: DocumentChunk; score: number }>,
  query: string
): Array<{ chunk: DocumentChunk; score: number }> {
  const reranked: RerankedChunk[] = chunks.map(({ chunk, score }) => {
    const hierarchyBoost = getLegalHierarchyScore(chunk)
    const recencyBoost = getRecencyScore(chunk)
    const vigenciaNorm = Math.max(0, Math.min(1, (recencyBoost + 0.05) / 0.2))
    const baseNorm = Math.max(0, Math.min(1, score))
    const finalScore =
      WEIGHT_CROSS_ENCODER * baseNorm +
      WEIGHT_HIERARCHY * (hierarchyBoost / MAX_HIERARCHY_RAW) +
      WEIGHT_RECENCY * (Math.max(0, recencyBoost) / MAX_RECENCY_RAW) +
      WEIGHT_VIGENCIA * vigenciaNorm
    return {
      chunk,
      score: finalScore,
      originalScore: score,
      hierarchyBoost,
      recencyBoost,
      finalScore
    }
  })
  reranked.sort((a, b) => b.finalScore - a.finalScore)
  return reranked.map(({ chunk, finalScore }) => ({ chunk, score: finalScore }))
}

/**
 * Re-ranking avanzado con cross-encoder real (FASE_3 3.1) y heurísticas recalibradas (3.2).
 * Score final = 0.70 cross_encoder + 0.15 hierarchy + 0.10 recency + 0.05 vigencia.
 * Sin normalización (score+1)/2; Constitución no domina (peso hierarchy cap 0.15).
 */
export async function rerankChunksAdvancedAsync(
  chunks: Array<{ chunk: DocumentChunk; score: number }>,
  query: string
): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
  const crossScores = await getCrossEncoderScores(query, chunks)
  const queryLower = query.toLowerCase()
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2)

  const reranked: RerankedChunk[] = chunks.map(({ chunk, score }, i) => {
    const hierarchyBoost = getLegalHierarchyScore(chunk)
    const recencyBoost = getRecencyScore(chunk)
    let vigenciaNorm = 0.5
    let penaltyDerogada = 0 // FASE_3 3.4: Penalización por norma derogada
    
    try {
      const normaId = inferNormaIdFromTitle(chunk.metadata.title)
      if (normaId) {
        const vigencia = consultarVigencia(normaId)
        if (vigencia) {
          vigenciaNorm = vigencia.vigente ? 1 : 0
          // FASE_3 3.4: Aplicar penalización si está totalmente derogada
          if (vigencia.estado === 'derogada') {
            penaltyDerogada = PENALTY_DEROGADA_TOTAL
          }
        }
      }
    } catch {
      vigenciaNorm = 0.5
    }
    
    const retrievalNorm = Math.max(0, Math.min(1, score))
    const crossNorm = crossScores && i < crossScores.length ? crossScores[i] : retrievalNorm
    const hierarchyNorm = Math.min(1, hierarchyBoost / MAX_HIERARCHY_RAW)
    const recencyNorm = Math.max(0, recencyBoost) / MAX_RECENCY_RAW

    let keywordBoost = 0
    const titleLower = chunk.metadata.title.toLowerCase()
    const contentLower = chunk.content.toLowerCase()
    for (const term of queryTerms) {
      if (titleLower.includes(term)) keywordBoost += 0.02
      else if (contentLower.includes(term)) keywordBoost += 0.01
    }
    const articleMatch = query.match(/art[íi]culo\s+(\d+)/i)
    if (articleMatch && chunk.metadata.article) {
      const chunkArticle = chunk.metadata.article.replace(/\D/g, '')
      if (chunkArticle === articleMatch[1]) keywordBoost += 0.05
    }
    
    // FASE_3 3.4: Score final incluye penalización por norma derogada
    const finalScore =
      WEIGHT_CROSS_ENCODER * crossNorm +
      WEIGHT_HIERARCHY * hierarchyNorm +
      WEIGHT_RECENCY * Math.min(1, recencyNorm) +
      WEIGHT_VIGENCIA * vigenciaNorm +
      Math.min(0.05, keywordBoost) +
      penaltyDerogada // Penalización -0.30 si derogada
    
    return {
      chunk,
      score: finalScore,
      originalScore: score,
      hierarchyBoost,
      recencyBoost,
      finalScore
    }
  })
  reranked.sort((a, b) => b.finalScore - a.finalScore)
  return reranked.map(({ chunk, finalScore }) => ({ chunk, score: finalScore }))
}

/**
 * Re-ranking avanzado (síncrono): usa solo heurísticas con pesos recalibrados.
 * Para cross-encoder real usar applyReranking que llama a la versión async.
 */
export function rerankChunksAdvanced(
  chunks: Array<{ chunk: DocumentChunk; score: number }>,
  query: string
): Array<{ chunk: DocumentChunk; score: number }> {
  return chunks.map(({ chunk, score }) => {
    const hierarchyBoost = getLegalHierarchyScore(chunk)
    const recencyBoost = getRecencyScore(chunk)
    const retrievalNorm = Math.max(0, Math.min(1, score))
    const hierarchyNorm = Math.min(1, hierarchyBoost / MAX_HIERARCHY_RAW)
    const recencyNorm = Math.max(0, recencyBoost) / MAX_RECENCY_RAW
    let vigenciaNorm = 0.5
    let penaltyDerogada = 0 // FASE_3 3.4: Penalización por norma derogada
    
    try {
      const normaId = inferNormaIdFromTitle(chunk.metadata.title)
      if (normaId) {
        const vigencia = consultarVigencia(normaId)
        if (vigencia) {
          vigenciaNorm = vigencia.vigente ? 1 : 0
          // FASE_3 3.4: Aplicar penalización si está totalmente derogada
          if (vigencia.estado === 'derogada') {
            penaltyDerogada = PENALTY_DEROGADA_TOTAL
          }
        }
      }
    } catch {
      vigenciaNorm = 0.5
    }
    
    // FASE_3 3.4: Score final incluye penalización por norma derogada
    const finalScore =
      WEIGHT_CROSS_ENCODER * retrievalNorm +
      WEIGHT_HIERARCHY * hierarchyNorm +
      WEIGHT_RECENCY * Math.min(1, recencyNorm) +
      WEIGHT_VIGENCIA * vigenciaNorm +
      penaltyDerogada // Penalización -0.30 si derogada
    
    return { chunk, score: finalScore }
  }).sort((a, b) => b.score - a.score)
}

/**
 * Filtra chunks por relevancia mínima y vigencia
 */
export function filterChunksByRelevance(
  chunks: Array<{ chunk: DocumentChunk; score: number }>,
  minScore: number = 0.1
): Array<{ chunk: DocumentChunk; score: number }> {
  return chunks.filter(({ score }) => score >= minScore)
}

/**
 * Aplica re-ranking y filtrado completo (síncrono; usa heurísticas con pesos FASE_3 3.2).
 * Para cross-encoder real usar applyRerankingWithCrossEncoder (async) desde retrieval.
 */
export function applyReranking(
  chunks: Array<{ chunk: DocumentChunk; score: number }>,
  query: string,
  options: {
    useAdvanced?: boolean
    minScore?: number
    topK?: number
  } = {}
): Array<{ chunk: DocumentChunk; score: number }> {
  const { useAdvanced = true, minScore = 0.05, topK } = options
  let reranked = useAdvanced
    ? rerankChunksAdvanced(chunks, query)
    : rerankChunks(chunks, query)
  reranked = filterChunksByRelevance(reranked, minScore)
  if (topK !== undefined) reranked = reranked.slice(0, topK)
  return reranked
}

/**
 * Re-ranking con cross-encoder real (FASE_3 3.1). Usar desde retrieval cuando RERANK_PROVIDER=hf.
 * Aplica solo a top-20 chunks; combina con pesos 0.70 cross + 0.15 hierarchy + 0.10 recency + 0.05 vigencia.
 */
export async function applyRerankingWithCrossEncoder(
  chunks: Array<{ chunk: DocumentChunk; score: number }>,
  query: string,
  options: { minScore?: number; topK?: number } = {}
): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
  const { minScore = 0.05, topK } = options
  let reranked = await rerankChunksAdvancedAsync(chunks, query)
  reranked = filterChunksByRelevance(reranked, minScore)
  if (topK !== undefined) reranked = reranked.slice(0, topK)
  return reranked
}

/**
 * FASE_3 3.4: Añade NOTA de norma derogada al contenido del chunk para que el LLM la vea.
 * Modifica el contenido del chunk in-place agregando una advertencia al inicio.
 * 
 * @param chunk Chunk a modificar
 * @returns Chunk modificado con NOTA si la norma está derogada
 */
export function addDerogadaNoteToChunk(chunk: DocumentChunk): DocumentChunk {
  try {
    const normaId = inferNormaIdFromTitle(chunk.metadata.title)
    if (!normaId) return chunk
    
    const vigencia = consultarVigencia(normaId)
    if (!vigencia) return chunk
    
    // NOTA para norma totalmente derogada
    if (vigencia.estado === 'derogada') {
      const derogadaPor = (vigencia as any).derogadaPor ? ` por ${(vigencia as any).derogadaPor}` : ''
      const derogadaDesde = (vigencia as any).derogadaDesde ? ` desde ${(vigencia as any).derogadaDesde}` : ''
      const nota = `⚠️ NOTA: Esta norma está DEROGADA${derogadaPor}${derogadaDesde}. No aplica a casos actuales.\n\n`
      
      return {
        ...chunk,
        content: nota + chunk.content
      }
    }
    
    // NOTA para norma parcialmente derogada
    if (vigencia.estado === 'parcialmente_derogada') {
      const nota = `⚠️ NOTA: Esta norma está PARCIALMENTE DEROGADA. Algunos artículos pueden no estar vigentes. Verificar vigencia específica.\n\n`
      
      return {
        ...chunk,
        content: nota + chunk.content
      }
    }
    
    return chunk
  } catch {
    return chunk
  }
}

/** Máximo de caracteres por chunk a enviar al modelo de similitud (límite de contexto) */
const HF_SIMILARITY_MAX_CHARS = 512

/**
 * Re-ranking con modelo de similitud de Hugging Face (sentence similarity).
 * CU-06: Cross-encoder real / modelo de relevancia para +5-10% en top-K.
 * Se activa con USE_CROSS_ENCODER=true y HUGGINGFACE_API_KEY.
 * Si falla la API, se devuelve el orden original.
 */
export async function rerankWithHFSimilarity(
  chunks: Array<{ chunk: DocumentChunk; score: number }>,
  query: string
): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
  if (chunks.length === 0) return []
  const key = process.env.HUGGINGFACE_API_KEY
  if (!key) return chunks
  const model = process.env.HF_RERANK_MODEL || 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2'
  try {
    const { HfInference } = await import('@huggingface/inference')
    const hf = new HfInference(key)
    const source = query.slice(0, HF_SIMILARITY_MAX_CHARS)
    const sentences = chunks.map(r => r.chunk.content.slice(0, HF_SIMILARITY_MAX_CHARS))
    const scores = await hf.sentenceSimilarity({
      model,
      inputs: { source_sentence: source, sentences }
    }) as number[]
    if (!Array.isArray(scores) || scores.length !== chunks.length) return chunks
    const withScores = chunks.map((r, i) => ({ ...r, score: scores[i] ?? r.score }))
    withScores.sort((a, b) => b.score - a.score)
    return withScores
  } catch {
    return chunks
  }
}

