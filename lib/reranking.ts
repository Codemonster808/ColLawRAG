import { type DocumentChunk } from './types'

export interface RerankedChunk {
  chunk: DocumentChunk
  score: number
  originalScore: number
  hierarchyBoost: number
  recencyBoost: number
  finalScore: number
}

/**
 * Jerarquía legal colombiana con boost values
 */
const LEGAL_HIERARCHY_BOOST: Record<string, number> = {
  constitucion: 0.30,
  codigo: 0.25,
  ley_organica: 0.22,
  ley_estatutaria: 0.22,
  ley: 0.20,
  decreto_ley: 0.18,
  decreto: 0.10,
  resolucion: 0.05,
  jurisprudencia_corte_constitucional: 0.15,
  jurisprudencia_corte_suprema: 0.12,
  jurisprudencia_consejo_estado: 0.12,
  jurisprudencia: 0.08,
  concepto: 0.03,
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
 * Calcula un boost basado en la recencia del documento
 * Documentos más recientes tienen mayor relevancia
 */
export function getRecencyScore(chunk: DocumentChunk): number {
  // Por ahora, asumimos que todos los documentos son actuales
  // En el futuro, esto debería usar metadata.fechaVigencia o fechaPublicacion
  
  // Si el documento tiene información de año en el título o metadata
  const title = chunk.metadata.title
  const yearMatch = title.match(/(19|20)\d{2}/)
  
  if (yearMatch) {
    const year = parseInt(yearMatch[0])
    const currentYear = new Date().getFullYear()
    const age = currentYear - year
    
    // Documentos de los últimos 5 años: boost máximo
    if (age <= 5) {
      return 0.1
    }
    // Documentos de 5-10 años: boost medio
    if (age <= 10) {
      return 0.05
    }
    // Documentos más antiguos: sin boost
  }
  
  // Si no hay información de fecha, asumir que es actual (boost pequeño)
  return 0.02
}

/**
 * Re-ranking simple basado en scoring combinado
 * Combina: similitud semántica + jerarquía legal + recencia
 */
export function rerankChunks(
  chunks: Array<{ chunk: DocumentChunk; score: number }>,
  query: string
): Array<{ chunk: DocumentChunk; score: number }> {
  const reranked: RerankedChunk[] = chunks.map(({ chunk, score }) => {
    const hierarchyBoost = getLegalHierarchyScore(chunk)
    const recencyBoost = getRecencyScore(chunk)
    
    // Score final = score original + boosts
    // Normalizamos el score original a 0-1 si es necesario
    const normalizedScore = Math.max(0, Math.min(1, (score + 1) / 2)) // Asumiendo scores entre -1 y 1
    const finalScore = normalizedScore + hierarchyBoost + recencyBoost
    
    return {
      chunk,
      score: finalScore,
      originalScore: score,
      hierarchyBoost,
      recencyBoost,
      finalScore
    }
  })
  
  // Ordenar por score final descendente
  reranked.sort((a, b) => b.finalScore - a.finalScore)
  
  // Retornar en formato original
  return reranked.map(({ chunk, finalScore }) => ({
    chunk,
    score: finalScore
  }))
}

/**
 * Re-ranking avanzado con cross-encoder (simulado)
 * En producción, esto debería usar un modelo cross-encoder real
 * Por ahora, usamos heurísticas mejoradas
 */
export function rerankChunksAdvanced(
  chunks: Array<{ chunk: DocumentChunk; score: number }>,
  query: string
): Array<{ chunk: DocumentChunk; score: number }> {
  const queryLower = query.toLowerCase()
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2)
  
  const reranked: RerankedChunk[] = chunks.map(({ chunk, score }) => {
    const hierarchyBoost = getLegalHierarchyScore(chunk)
    const recencyBoost = getRecencyScore(chunk)
    
    // Boost por matching de términos clave en título
    let keywordBoost = 0
    const titleLower = chunk.metadata.title.toLowerCase()
    const contentLower = chunk.content.toLowerCase()
    
    for (const term of queryTerms) {
      if (titleLower.includes(term)) {
        keywordBoost += 0.05 // Término en título es muy relevante
      } else if (contentLower.includes(term)) {
        keywordBoost += 0.02 // Término en contenido es relevante
      }
    }
    
    // Boost por artículo específico mencionado en query
    const articleMatch = query.match(/art[íi]culo\s+(\d+)/i)
    if (articleMatch && chunk.metadata.article) {
      const queryArticle = articleMatch[1]
      const chunkArticle = chunk.metadata.article.replace(/\D/g, '')
      if (chunkArticle === queryArticle) {
        keywordBoost += 0.15 // Match exacto de artículo
      }
    }
    
    // Normalizar score original
    const normalizedScore = Math.max(0, Math.min(1, (score + 1) / 2))
    
    // Score final con todos los boosts
    const finalScore = normalizedScore + hierarchyBoost + recencyBoost + keywordBoost
    
    return {
      chunk,
      score: finalScore,
      originalScore: score,
      hierarchyBoost,
      recencyBoost,
      finalScore
    }
  })
  
  // Ordenar por score final
  reranked.sort((a, b) => b.finalScore - a.finalScore)
  
  return reranked.map(({ chunk, finalScore }) => ({
    chunk,
    score: finalScore
  }))
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
 * Aplica re-ranking y filtrado completo
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
  
  // Aplicar re-ranking
  let reranked = useAdvanced
    ? rerankChunksAdvanced(chunks, query)
    : rerankChunks(chunks, query)
  
  // Filtrar por score mínimo
  reranked = filterChunksByRelevance(reranked, minScore)
  
  // Limitar a topK si se especifica
  if (topK !== undefined) {
    reranked = reranked.slice(0, topK)
  }
  
  return reranked
}

