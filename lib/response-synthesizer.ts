/**
 * Response Synthesizer - Sintetizador de Respuestas Parciales
 * 
 * Toma múltiples respuestas parciales de sub-preguntas y las combina
 * en una respuesta final coherente, eliminando duplicación y preservando
 * todas las citas y contexto relevante.
 * 
 * @module response-synthesizer
 * @created 2026-02-09
 * @version 1.0.0
 */

import { type RagResponse } from './types'
import { type SubQuery, type SplitResult } from './query-splitter'
import { logger } from './logger'

/**
 * Respuesta parcial de una sub-pregunta
 */
export interface PartialResponse {
  /** Sub-pregunta procesada */
  subQuery: SubQuery
  /** Respuesta generada para esta sub-pregunta */
  response: RagResponse
  /** Orden de procesamiento */
  order: number
}

/**
 * Configuración para el sintetizador
 */
export interface SynthesizerConfig {
  /** Eliminar información duplicada */
  removeDuplicates?: boolean
  /** Consolidar citas (evitar duplicados) */
  consolidateCitations?: boolean
  /** Preservar contexto común explícitamente */
  preserveContext?: boolean
  /** Formato de salida */
  format?: 'structured' | 'narrative' | 'combined'
}

/**
 * Resultado de la síntesis
 */
export interface SynthesisResult {
  /** Respuesta final sintetizada */
  answer: string
  /** Citas consolidadas (sin duplicados) */
  citations: RagResponse['citations']
  /** Total de documentos recuperados */
  retrieved: number
  /** Request ID único */
  requestId: string
  /** Área legal detectada */
  detectedLegalArea?: string
  /** Metadata adicional */
  metadata?: {
    originalResponsesCount: number
    duplicatesRemoved: number
    citationsConsolidated: number
    synthesisTime: number
  }
}

/**
 * Detecta información duplicada entre respuestas
 */
function detectDuplicates(
  responses: PartialResponse[]
): Array<{ responseIndex: number; duplicateText: string; similarity: number }> {
  const duplicates: Array<{ responseIndex: number; duplicateText: string; similarity: number }> = []
  
  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      const text1 = responses[i].response.answer.toLowerCase()
      const text2 = responses[j].response.answer.toLowerCase()
      
      // Calcular similitud simple (palabras comunes)
      const words1 = new Set(text1.split(/\s+/))
      const words2 = new Set(text2.split(/\s+/))
      const commonWords = new Set([...words1].filter(w => words2.has(w)))
      const similarity = commonWords.size / Math.max(words1.size, words2.size)
      
      // Si similitud > 0.5, considerar duplicado
      if (similarity > 0.5) {
        // Extraer fragmento duplicado (primeras 100 palabras comunes)
        const commonText = Array.from(commonWords).slice(0, 20).join(' ')
        duplicates.push({
          responseIndex: j,
          duplicateText: commonText,
          similarity
        })
      }
    }
  }
  
  return duplicates
}

/**
 * Consolida citas eliminando duplicados
 */
function consolidateCitations(
  responses: PartialResponse[]
): RagResponse['citations'] {
  const citationMap = new Map<string, RagResponse['citations'][0]>()
  
  for (const partial of responses) {
    for (const citation of partial.response.citations) {
      // Crear clave única: id + article (si existe)
      const key = `${citation.id}-${citation.article || ''}`
      
      if (!citationMap.has(key)) {
        citationMap.set(key, citation)
      } else {
        // Si ya existe, mantener el que tenga mayor score (si aplica)
        const existing = citationMap.get(key)!
        if (citation.score !== undefined && existing.score !== undefined) {
          if (citation.score > existing.score) {
            citationMap.set(key, citation)
          }
        }
      }
    }
  }
  
  return Array.from(citationMap.values())
}

/**
 * Extrae contexto común de las respuestas parciales
 */
function extractCommonContext(
  responses: PartialResponse[],
  splitResult: SplitResult
): string[] {
  const contextParts: string[] = []
  
  // Usar contexto común del splitResult
  if (splitResult.commonContext) {
    if (splitResult.commonContext.procedures && splitResult.commonContext.procedures.length > 0) {
      contextParts.push(`**Contexto común:** ${splitResult.commonContext.procedures.join(', ')}`)
    }
    
    if (splitResult.commonContext.dates && splitResult.commonContext.dates.length > 0) {
      contextParts.push(`**Fechas relevantes:** ${splitResult.commonContext.dates.join(', ')}`)
    }
    
    if (splitResult.commonContext.entities && splitResult.commonContext.entities.length > 0) {
      contextParts.push(`**Entidades mencionadas:** ${splitResult.commonContext.entities.join(', ')}`)
    }
  }
  
  return contextParts
}

/**
 * Sintetiza múltiples respuestas parciales en una respuesta final coherente
 */
export function synthesizeResponses(
  partialResponses: PartialResponse[],
  originalQuery: string,
  splitResult: SplitResult,
  config: SynthesizerConfig = {}
): SynthesisResult {
  const startTime = Date.now()
  const {
    removeDuplicates = true,
    consolidateCitations: consolidate = true,
    preserveContext = true,
    format = 'combined'
  } = config

  logger.debug('Synthesizing responses', {
    partialResponsesCount: partialResponses.length,
    removeDuplicates,
    consolidate,
    format
  })

  // Ordenar por orden de procesamiento
  const sortedResponses = [...partialResponses].sort((a, b) => a.order - b.order)

  // 1. Detectar y eliminar duplicados si está habilitado
  let duplicatesRemoved = 0
  let responsesToUse = sortedResponses
  
  if (removeDuplicates) {
    const duplicates = detectDuplicates(sortedResponses)
    duplicatesRemoved = duplicates.length
    
    // Marcar respuestas con duplicados para procesamiento especial
    const duplicateIndices = new Set(duplicates.map(d => d.responseIndex))
    responsesToUse = sortedResponses.map((resp, idx) => {
      if (duplicateIndices.has(idx)) {
        // Para respuestas duplicadas, mantener solo la primera parte única
        return resp
      }
      return resp
    })
  }

  // 2. Construir respuesta final según formato
  const answerParts: string[] = []
  
  // Agregar contexto común si está habilitado
  if (preserveContext && format !== 'narrative') {
    const commonContext = extractCommonContext(responsesToUse, splitResult)
    if (commonContext.length > 0) {
      answerParts.push(...commonContext)
      answerParts.push('')
    }
  }

  // Agregar encabezado si hay múltiples partes
  if (sortedResponses.length > 1 && format !== 'narrative') {
    answerParts.push('Esta consulta contiene múltiples preguntas. A continuación se responden cada una:')
    answerParts.push('')
  }

  // Procesar cada respuesta parcial
  for (let i = 0; i < responsesToUse.length; i++) {
    const partial = responsesToUse[i]
    const response = partial.response

    // Agregar separador si no es la primera
    if (i > 0 && format !== 'narrative') {
      answerParts.push('')
      answerParts.push('---')
      answerParts.push('')
    }

    // Agregar pregunta si hay múltiples partes y formato no es narrative
    if (sortedResponses.length > 1 && format !== 'narrative') {
      answerParts.push(`**${i + 1}. ${partial.subQuery.query}**`)
      answerParts.push('')
    }

    // Agregar respuesta
    answerParts.push(response.answer)

    // Si hay dependencias, mencionarlas
    if (partial.subQuery.dependsOn.length > 0 && format !== 'narrative') {
      const dependencies = partial.subQuery.dependsOn.map(dep => `pregunta ${dep + 1}`).join(', ')
      answerParts.push('')
      answerParts.push(`*Esta respuesta depende de la información de la ${dependencies}.*`)
    }
  }

  // 3. Consolidar citas
  const consolidatedCitations = consolidate
    ? consolidateCitations(responsesToUse)
    : responsesToUse.flatMap(p => p.response.citations)

  // 4. Calcular total de documentos recuperados
  const totalRetrieved = responsesToUse.reduce((sum, p) => sum + p.response.retrieved, 0)

  // 5. Determinar área legal (usar la más común o la primera)
  const legalAreas = responsesToUse
    .map(p => p.response.detectedLegalArea)
    .filter((area): area is string => !!area)
  
  const detectedLegalArea = legalAreas.length > 0
    ? legalAreas[0] // Usar la primera por ahora (podría mejorarse con votación)
    : undefined

  // 6. Generar request ID único
  const requestId = responsesToUse[0]?.response.requestId || 'synthesized'

  // 7. Combinar todas las partes
  const finalAnswer = answerParts.join('\n\n')

  const synthesisTime = Date.now() - startTime

  logger.debug('Synthesis completed', {
    answerLength: finalAnswer.length,
    citationsCount: consolidatedCitations.length,
    duplicatesRemoved,
    synthesisTime
  })

  return {
    answer: finalAnswer,
    citations: consolidatedCitations,
    retrieved: totalRetrieved,
    requestId,
    detectedLegalArea,
    metadata: {
      originalResponsesCount: partialResponses.length,
      duplicatesRemoved,
      citationsConsolidated: consolidate
        ? partialResponses.reduce((sum, p) => sum + p.response.citations.length, 0) - consolidatedCitations.length
        : 0,
      synthesisTime
    }
  }
}

/**
 * Formatea respuesta sintetizada en formato narrativo (sin separadores)
 */
export function formatNarrativeSynthesis(
  partialResponses: PartialResponse[],
  splitResult: SplitResult
): string {
  const sortedResponses = [...partialResponses].sort((a, b) => a.order - b.order)
  
  // Combinar respuestas en un flujo narrativo continuo
  const narrativeParts: string[] = []
  
  for (let i = 0; i < sortedResponses.length; i++) {
    const partial = sortedResponses[i]
    const response = partial.response
    
    // Agregar transición si no es la primera
    if (i > 0) {
      narrativeParts.push('Además,')
    }
    
    // Agregar respuesta (sin encabezado de pregunta)
    narrativeParts.push(response.answer)
  }
  
  return narrativeParts.join(' ')
}

/**
 * Formatea respuesta sintetizada en formato estructurado (con secciones claras)
 */
export function formatStructuredSynthesis(
  partialResponses: PartialResponse[],
  splitResult: SplitResult
): string {
  const sortedResponses = [...partialResponses].sort((a, b) => a.order - b.order)
  
  const sections: string[] = []
  
  // Agregar contexto común
  const commonContext = extractCommonContext(sortedResponses, splitResult)
  if (commonContext.length > 0) {
    sections.push('## CONTEXTO COMÚN')
    sections.push('')
    sections.push(...commonContext)
    sections.push('')
  }
  
  // Agregar cada respuesta como sección
  for (let i = 0; i < sortedResponses.length; i++) {
    const partial = sortedResponses[i]
    
    sections.push(`## ${i + 1}. ${partial.subQuery.query}`)
    sections.push('')
    sections.push(partial.response.answer)
    sections.push('')
    
    // Agregar citas específicas de esta sección
    if (partial.response.citations.length > 0) {
      sections.push('**Fuentes:**')
      for (const citation of partial.response.citations) {
        const articleInfo = citation.article ? ` - ${citation.article}` : ''
        sections.push(`- ${citation.title}${articleInfo}`)
      }
      sections.push('')
    }
  }
  
  return sections.join('\n')
}
