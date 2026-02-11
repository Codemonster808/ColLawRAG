import { type DocumentChunk } from './types'
import { consultarVigencia, inferNormaIdFromTitle } from './norm-vigencia'

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
    
    // Penalización por documentos derogados o no vigentes
    let vigenciaPenalty = 0
    try {
      const normaId = inferNormaIdFromTitle(chunk.metadata.title)
      if (normaId) {
        const vigencia = consultarVigencia(normaId)
        if (vigencia && !vigencia.vigente) {
          // Penalizar documentos no vigentes o derogados
          vigenciaPenalty = -0.10
        }
      }
    } catch (error) {
      // Ignorar errores en consulta de vigencia
    }
    
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
    
    // Score final con todos los boosts y penalizaciones
    const finalScore = normalizedScore + hierarchyBoost + recencyBoost + keywordBoost + vigenciaPenalty
    
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

