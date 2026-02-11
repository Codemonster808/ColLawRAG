/**
 * Extractor de Normas Aplicables
 * 
 * Identifica explícitamente normas aplicables en consultas, extrae artículos
 * específicos mencionados, prioriza por jerarquía legal y valida vigencia.
 * 
 * @module norm-extractor
 * @created 2026-02-09
 * @version 1.0.0
 */

import { inferNormaIdFromTitle, consultarVigencia, loadNorma, type NormaVigencia } from './norm-vigencia'
import { getLegalHierarchyScore } from './reranking'
import { type DocumentChunk } from './types'

/**
 * Artículo específico mencionado en la consulta
 */
export interface ExtractedArticle {
  /** Número del artículo */
  numero: string
  /** Norma a la que pertenece */
  normaId: string
  /** Título de la norma */
  normaTitle: string
  /** Inciso o parágrafo mencionado (si aplica) */
  inciso?: string
  /** Literal mencionado (si aplica) */
  literal?: string
}

/**
 * Norma aplicable identificada
 */
export interface ApplicableNorm {
  /** Identificador único de la norma */
  normaId: string
  /** Título completo de la norma */
  title: string
  /** Tipo de norma */
  type: 'constitucion' | 'codigo' | 'ley' | 'decreto' | 'jurisprudencia' | 'resolucion' | 'otro'
  /** Artículos específicos mencionados */
  articles: ExtractedArticle[]
  /** Score de jerarquía legal (mayor = más importante) */
  hierarchyScore: number
  /** Estado de vigencia */
  vigencia: {
    vigente: boolean
    estado: string
    derogadaPor?: string
    derogadaDesde?: string
  } | null
  /** Confianza en la identificación (0-1) */
  confidence: number
}

/**
 * Resultado de la extracción de normas aplicables
 */
export interface NormExtractionResult {
  /** Normas identificadas, ordenadas por jerarquía y relevancia */
  normas: ApplicableNorm[]
  /** Total de normas identificadas */
  total: number
  /** Normas vigentes */
  vigentes: number
  /** Normas derogadas o no vigentes */
  noVigentes: number
  /** Artículos específicos extraídos */
  articles: ExtractedArticle[]
}

/**
 * Patrones para identificar normas en texto
 */
const NORM_PATTERNS = {
  // Leyes: "Ley 100 de 1993", "Ley 599 de 2000"
  ley: /\b(?:ley|ley\s+orgánica|ley\s+estatutaria)\s+(\d+)\s+de\s+(\d{4})\b/gi,
  
  // Decretos: "Decreto 2591 de 1991", "Decreto Ley 123 de 2020"
  decreto: /\b(?:decreto(?:\s+ley)?)\s+(\d+)\s+de\s+(\d{4})\b/gi,
  
  // Códigos: "Código Penal", "Código Civil", "Código de Procedimiento Civil"
  codigo: /\b(?:código|codigo)\s+(?:penal|civil|laboral|comercio|procedimiento\s+(?:civil|penal|laboral|administrativo))\b/gi,
  
  // Constitución: "Constitución Política", "Constitución de 1991"
  constitucion: /\b(?:constitución|constitucion)\s+(?:política|politica|de\s+\d{4})?\b/gi,
  
  // Artículos: "Artículo 5", "Art. 123", "art. 45"
  articulo: /\b(?:artículo|articulo|art\.?)\s+(\d+)(?:\s+(?:inciso|numeral|literal)\s+([a-z0-9]+))?\b/gi,
  
  // Resoluciones: "Resolución 123 de 2020"
  resolucion: /\b(?:resolución|resolucion)\s+(\d+)\s+de\s+(\d{4})\b/gi
}

/**
 * Mapeo de tipos de norma a identificadores
 */
const NORM_TYPE_MAP: Record<string, ApplicableNorm['type']> = {
  'constitución': 'constitucion',
  'constitucion': 'constitucion',
  'código': 'codigo',
  'codigo': 'codigo',
  'ley': 'ley',
  'decreto': 'decreto',
  'resolución': 'resolucion',
  'resolucion': 'resolucion',
  'sentencia': 'jurisprudencia',
  'jurisprudencia': 'jurisprudencia'
}

/**
 * Extrae normas mencionadas en una consulta
 */
export function extractNormsFromQuery(query: string): ApplicableNorm[] {
  const normas: Map<string, ApplicableNorm> = new Map()
  const queryLower = query.toLowerCase()
  
  // 1. Extraer Leyes
  const leyMatches = Array.from(query.matchAll(NORM_PATTERNS.ley))
  for (const match of leyMatches) {
    const numero = match[1]
    const año = match[2]
    const normaId = `ley-${numero}-${año}`
    const title = `Ley ${numero} de ${año}`
    
    if (!normas.has(normaId)) {
      const vigencia = consultarVigencia(normaId)
      const hierarchyScore = getHierarchyScoreForType('ley')
      
      normas.set(normaId, {
        normaId,
        title,
        type: 'ley',
        articles: [],
        hierarchyScore,
        vigencia: vigencia ? {
          vigente: vigencia.vigente,
          estado: vigencia.estado,
          derogadaPor: 'derogadaPor' in vigencia ? vigencia.derogadaPor : undefined,
          derogadaDesde: 'derogadaDesde' in vigencia ? vigencia.derogadaDesde : undefined
        } : null,
        confidence: 0.9 // Alta confianza para menciones explícitas
      })
    }
  }
  
  // 2. Extraer Decretos
  const decretoMatches = Array.from(query.matchAll(NORM_PATTERNS.decreto))
  for (const match of decretoMatches) {
    const numero = match[1]
    const año = match[2]
    const normaId = `decreto-${numero}-${año}`
    const title = `Decreto ${numero} de ${año}`
    
    if (!normas.has(normaId)) {
      const vigencia = consultarVigencia(normaId)
      const hierarchyScore = getHierarchyScoreForType('decreto')
      
      normas.set(normaId, {
        normaId,
        title,
        type: 'decreto',
        articles: [],
        hierarchyScore,
        vigencia: vigencia ? {
          vigente: vigencia.vigente,
          estado: vigencia.estado,
          derogadaPor: 'derogadaPor' in vigencia ? vigencia.derogadaPor : undefined,
          derogadaDesde: 'derogadaDesde' in vigencia ? vigencia.derogadaDesde : undefined
        } : null,
        confidence: 0.9
      })
    }
  }
  
  // 3. Extraer Códigos
  const codigoMatches = Array.from(query.matchAll(NORM_PATTERNS.codigo))
  for (const match of codigoMatches) {
    const codigoName = match[0]
    const normaId = inferNormaIdFromTitle(codigoName)
    
    if (normaId && !normas.has(normaId)) {
      const norma = loadNorma(normaId)
      const vigencia = consultarVigencia(normaId)
      const hierarchyScore = getHierarchyScoreForType('codigo')
      
      normas.set(normaId, {
        normaId,
        title: norma?.nombre || codigoName,
        type: 'codigo',
        articles: [],
        hierarchyScore,
        vigencia: vigencia ? {
          vigente: vigencia.vigente,
          estado: vigencia.estado,
          derogadaPor: 'derogadaPor' in vigencia ? vigencia.derogadaPor : undefined,
          derogadaDesde: 'derogadaDesde' in vigencia ? vigencia.derogadaDesde : undefined
        } : null,
        confidence: 0.85
      })
    }
  }
  
  // 4. Extraer Constitución
  const constitucionMatch = query.match(NORM_PATTERNS.constitucion)
  if (constitucionMatch) {
    const normaId = 'constitucion-1991'
    if (!normas.has(normaId)) {
      const vigencia = consultarVigencia(normaId)
      const hierarchyScore = getHierarchyScoreForType('constitucion')
      
      normas.set(normaId, {
        normaId,
        title: 'Constitución Política de Colombia',
        type: 'constitucion',
        articles: [],
        hierarchyScore,
        vigencia: vigencia ? {
          vigente: vigencia.vigente,
          estado: vigencia.estado,
          derogadaPor: 'derogadaPor' in vigencia ? vigencia.derogadaPor : undefined,
          derogadaDesde: 'derogadaDesde' in vigencia ? vigencia.derogadaDesde : undefined
        } : null,
        confidence: 0.95
      })
    }
  }
  
  // 5. Extraer artículos específicos
  const articuloMatches = Array.from(query.matchAll(NORM_PATTERNS.articulo))
  for (const match of articuloMatches) {
    const numero = match[1]
    const inciso = match[2]
    
    // Intentar asociar artículo a una norma mencionada
    // Si hay múltiples normas, asociar a la más relevante
    let associatedNorma: ApplicableNorm | null = null
    let maxScore = 0
    
    for (const norma of normas.values()) {
      // Si el artículo está cerca de la mención de la norma, asociarlo
      const normaIndex = queryLower.indexOf(norma.title.toLowerCase())
      const articuloIndex = queryLower.indexOf(`artículo ${numero}`)
      
      if (normaIndex !== -1 && articuloIndex !== -1) {
        const distance = Math.abs(articuloIndex - normaIndex)
        if (distance < 200 && norma.hierarchyScore > maxScore) {
          associatedNorma = norma
          maxScore = norma.hierarchyScore
        }
      }
    }
    
    // Si no se asoció, crear una entrada genérica
    if (!associatedNorma && normas.size > 0) {
      // Asociar a la norma con mayor jerarquía
      associatedNorma = Array.from(normas.values())
        .sort((a, b) => b.hierarchyScore - a.hierarchyScore)[0]
    }
    
    if (associatedNorma) {
      associatedNorma.articles.push({
        numero,
        normaId: associatedNorma.normaId,
        normaTitle: associatedNorma.title,
        inciso: inciso || undefined
      })
    }
  }
  
  return Array.from(normas.values())
}

/**
 * Obtiene el score de jerarquía para un tipo de norma
 */
function getHierarchyScoreForType(type: ApplicableNorm['type']): number {
  // Usar los mismos valores que en reranking.ts
  const hierarchyScores: Record<ApplicableNorm['type'], number> = {
    constitucion: 0.60,
    codigo: 0.50,
    ley: 0.30,
    decreto: 0.12,
    jurisprudencia: 0.20,
    resolucion: 0.05,
    otro: 0
  }
  
  return hierarchyScores[type] || 0
}

/**
 * Extrae normas aplicables de una consulta y las prioriza
 */
export function extractApplicableNorms(
  query: string,
  chunks?: Array<{ chunk: DocumentChunk; score: number }>
): NormExtractionResult {
  // 1. Extraer normas de la consulta
  const normasFromQuery = extractNormsFromQuery(query)
  
  // 2. Si hay chunks, extraer normas mencionadas en los documentos recuperados
  const normasFromChunks: Map<string, ApplicableNorm> = new Map()
  
  if (chunks) {
    for (const { chunk } of chunks) {
      const title = chunk.metadata.title
      const normaId = inferNormaIdFromTitle(title)
      
      if (normaId && !normasFromQuery.find(n => n.normaId === normaId)) {
        if (!normasFromChunks.has(normaId)) {
          const vigencia = consultarVigencia(normaId)
          const type = inferNormTypeFromTitle(title)
          const hierarchyScore = getHierarchyScoreForType(type)
          
          normasFromChunks.set(normaId, {
            normaId,
            title,
            type,
            articles: extractArticlesFromChunk(chunk),
            hierarchyScore,
            vigencia: vigencia ? {
              vigente: vigencia.vigente,
              estado: vigencia.estado,
              derogadaPor: 'derogadaPor' in vigencia ? vigencia.derogadaPor : undefined,
              derogadaDesde: 'derogadaDesde' in vigencia ? vigencia.derogadaDesde : undefined
            } : null,
            confidence: 0.7 // Confianza media para normas inferidas de chunks
          })
        }
      }
    }
  }
  
  // 3. Combinar normas de consulta y chunks
  const allNormas = [...normasFromQuery, ...Array.from(normasFromChunks.values())]
  
  // 4. Priorizar por jerarquía y confianza
  const sortedNormas = allNormas.sort((a, b) => {
    // Primero por jerarquía (mayor = mejor)
    if (Math.abs(a.hierarchyScore - b.hierarchyScore) > 0.01) {
      return b.hierarchyScore - a.hierarchyScore
    }
    // Luego por confianza
    return b.confidence - a.confidence
  })
  
  // 5. Extraer todos los artículos
  const allArticles: ExtractedArticle[] = []
  for (const norma of sortedNormas) {
    allArticles.push(...norma.articles)
  }
  
  // 6. Calcular estadísticas
  const vigentes = sortedNormas.filter(n => n.vigencia?.vigente).length
  const noVigentes = sortedNormas.length - vigentes
  
  return {
    normas: sortedNormas,
    total: sortedNormas.length,
    vigentes,
    noVigentes,
    articles: allArticles
  }
}

/**
 * Infiere el tipo de norma desde el título
 */
function inferNormTypeFromTitle(title: string): ApplicableNorm['type'] {
  const titleLower = title.toLowerCase()
  
  if (titleLower.includes('constitución') || titleLower.includes('constitucion')) {
    return 'constitucion'
  }
  if (titleLower.includes('código') || titleLower.includes('codigo')) {
    return 'codigo'
  }
  if (titleLower.match(/\bley\s+\d+/)) {
    return 'ley'
  }
  if (titleLower.match(/\bdecreto\s+\d+/)) {
    return 'decreto'
  }
  if (titleLower.includes('resolución') || titleLower.includes('resolucion')) {
    return 'resolucion'
  }
  if (titleLower.includes('sentencia') || titleLower.includes('jurisprudencia')) {
    return 'jurisprudencia'
  }
  
  return 'otro'
}

/**
 * Extrae artículos mencionados en un chunk
 */
function extractArticlesFromChunk(chunk: DocumentChunk): ExtractedArticle[] {
  const articles: ExtractedArticle[] = []
  
  // Si el chunk tiene metadata de artículo, usarlo
  if (chunk.metadata.article) {
    const normaId = inferNormaIdFromTitle(chunk.metadata.title) || 'unknown'
    articles.push({
      numero: chunk.metadata.article.replace(/\D/g, ''),
      normaId,
      normaTitle: chunk.metadata.title,
      inciso: chunk.metadata.articleHierarchy?.includes('Inciso') ? 
        chunk.metadata.articleHierarchy.split('Inciso')[1]?.trim() : undefined
    })
  }
  
  // También buscar artículos en el contenido
  const articuloMatches = Array.from(chunk.content.matchAll(NORM_PATTERNS.articulo))
  for (const match of articuloMatches) {
    const numero = match[1]
    const inciso = match[2]
    const normaId = inferNormaIdFromTitle(chunk.metadata.title) || 'unknown'
    
    // Evitar duplicados
    if (!articles.find(a => a.numero === numero && a.normaId === normaId)) {
      articles.push({
        numero,
        normaId,
        normaTitle: chunk.metadata.title,
        inciso: inciso || undefined
      })
    }
  }
  
  return articles
}

/**
 * Valida vigencia de todas las normas extraídas
 */
export function validateNormsVigencia(normas: ApplicableNorm[]): ApplicableNorm[] {
  return normas.map(norma => {
    if (!norma.vigencia) {
      const vigencia = consultarVigencia(norma.normaId)
      if (vigencia) {
        norma.vigencia = {
          vigente: vigencia.vigente,
          estado: vigencia.estado,
          derogadaPor: 'derogadaPor' in vigencia ? vigencia.derogadaPor : undefined,
          derogadaDesde: 'derogadaDesde' in vigencia ? vigencia.derogadaDesde : undefined
        }
      }
    }
    return norma
  })
}
