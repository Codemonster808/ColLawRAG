/**
 * RAG Recursivo - Orquestador para consultas multi-parte
 * 
 * Detecta consultas que contienen múltiples preguntas o temas y las procesa
 * de forma recursiva, ejecutando el pipeline RAG para cada sub-pregunta
 * y sintetizando las respuestas parciales en una respuesta final coherente.
 * 
 * @module rag-recursive
 * @created 2026-02-09
 * @version 1.0.0
 */

import { analyzeQuery, type QueryAnalysis } from './query-decomposer'
import { splitQuery, type SplitResult, type SubQuery } from './query-splitter'
import { runRagPipeline } from './rag'
import { type RagQuery, type RagResponse } from './types'
import { logger } from './logger'
import { synthesizeResponses as synthesizeResponsesAdvanced, type SynthesizerConfig } from './response-synthesizer'

/**
 * Configuración para el orquestador recursivo
 */
export interface RecursiveRagConfig {
  /** Habilitar procesamiento recursivo (por defecto: true) */
  enabled?: boolean
  /** Umbral de confianza mínimo para considerar consulta multi-parte (0-1) */
  minConfidence?: number
  /** Máximo número de sub-preguntas a procesar */
  maxSubQueries?: number
  /** Mantener contexto común entre sub-preguntas */
  preserveContext?: boolean
}

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
 * Resultado del procesamiento recursivo
 */
export interface RecursiveRagResult {
  /** Si la consulta fue procesada recursivamente */
  isRecursive: boolean
  /** Análisis de la consulta original */
  analysis?: QueryAnalysis
  /** Resultado de la descomposición */
  splitResult?: SplitResult
  /** Respuestas parciales de cada sub-pregunta */
  partialResponses?: PartialResponse[]
  /** Respuesta final sintetizada */
  finalResponse: RagResponse
  /** Metadata del procesamiento */
  metadata: {
    subQueriesCount: number
    processingTime: number
    contextPreserved: boolean
  }
}

/**
 * Detecta si una consulta debe procesarse de forma recursiva
 */
export function shouldUseRecursiveRag(
  query: string,
  config: RecursiveRagConfig = {}
): boolean {
  const { enabled = true, minConfidence = 0.6 } = config

  if (!enabled) {
    return false
  }

  try {
    const analysis = analyzeQuery(query)
    
    // Si no es multi-parte, no usar recursivo
    if (!analysis.isMultiPart) {
      return false
    }

    // Si la confianza es menor al umbral, no usar recursivo
    if (analysis.confidence < minConfidence) {
      logger.debug('Query is multi-part but confidence below threshold', {
        confidence: analysis.confidence,
        minConfidence,
        complexity: analysis.complexity
      })
      return false
    }

    // Si tiene múltiples partes claras, usar recursivo
    if (analysis.parts.length >= 2) {
      return true
    }

    return false
  } catch (error) {
    logger.warn('Error analyzing query for recursive RAG', { error: (error as Error).message })
    return false
  }
}

/**
 * Procesa una consulta de forma recursiva
 */
export async function runRecursiveRag(
  originalQuery: RagQuery,
  config: RecursiveRagConfig = {}
): Promise<RecursiveRagResult> {
  const startTime = Date.now()
  const {
    enabled = true,
    minConfidence = 0.6,
    maxSubQueries = 5,
    preserveContext = true
  } = config

  const requestId = originalQuery.userId || 'recursive-rag'

  logger.logPipelineStep('Recursive RAG start', requestId, {
    query: originalQuery.query,
    enabled,
    minConfidence
  })

  // 1. Verificar si debe usarse recursivo
  if (!shouldUseRecursiveRag(originalQuery.query, config)) {
    logger.logPipelineStep('Query does not require recursive processing', requestId)
    
    // Procesar como consulta normal
    const normalResponse = await runRagPipeline(originalQuery)
    
    return {
      isRecursive: false,
      finalResponse: normalResponse,
      metadata: {
        subQueriesCount: 0,
        processingTime: Date.now() - startTime,
        contextPreserved: false
      }
    }
  }

  // 2. Analizar y descomponer la consulta
  logger.logPipelineStep('Analyzing query for decomposition', requestId)
  const analysis = analyzeQuery(originalQuery.query)
  const splitResult = splitQuery(originalQuery.query)

  logger.logPipelineStep('Query decomposed', requestId, {
    isMultiPart: analysis.isMultiPart,
    complexity: analysis.complexity,
    confidence: analysis.confidence,
    subQueriesCount: splitResult.subQueries.length,
    hasDependencies: splitResult.dependencies.length > 0
  })

  // 3. Limitar número de sub-preguntas
  const subQueriesToProcess = splitResult.subQueries.slice(0, maxSubQueries)
  
  if (splitResult.subQueries.length > maxSubQueries) {
    logger.warn('Too many sub-queries, limiting', {
      requestId,
      total: splitResult.subQueries.length,
      max: maxSubQueries
    })
  }

  // 4. Procesar cada sub-pregunta
  const partialResponses: PartialResponse[] = []
  const commonContext = splitResult.commonContext

  logger.logPipelineStep('Processing sub-queries', requestId, {
    count: subQueriesToProcess.length
  })

  for (let i = 0; i < subQueriesToProcess.length; i++) {
    const subQuery = subQueriesToProcess[i]
    
    logger.logPipelineStep(`Processing sub-query ${i + 1}/${subQueriesToProcess.length}`, requestId, {
      query: subQuery.query,
      order: subQuery.order,
      dependsOn: subQuery.dependsOn
    })

    // Construir query para esta sub-pregunta
    // Enriquecer con contexto común si está habilitado
    let enrichedQuery = subQuery.query
    
    if (preserveContext && commonContext) {
      // Agregar contexto común a la sub-pregunta si no está presente
      const contextParts: string[] = []
      
      if (commonContext.procedures && commonContext.procedures.length > 0) {
        contextParts.push(`(en el contexto de: ${commonContext.procedures.join(', ')})`)
      }
      
      if (commonContext.dates && commonContext.dates.length > 0) {
        contextParts.push(`(fecha: ${commonContext.dates.join(', ')})`)
      }
      
      if (commonContext.entities && commonContext.entities.length > 0) {
        contextParts.push(`(entidad: ${commonContext.entities.join(', ')})`)
      }
      
      if (contextParts.length > 0) {
        enrichedQuery = `${subQuery.query} ${contextParts.join(' ')}`
      }
    }

    // Ejecutar pipeline RAG para esta sub-pregunta
    const subQueryParams: RagQuery = {
      ...originalQuery,
      query: enrichedQuery,
      // Usar el mismo requestId para tracking
      userId: `${requestId}-sub${i}`
    }

    try {
      const subResponse = await runRagPipeline(subQueryParams)
      
      partialResponses.push({
        subQuery,
        response: subResponse,
        order: i
      })

      logger.logPipelineStep(`Sub-query ${i + 1} completed`, requestId, {
        answerLength: subResponse.answer.length,
        citationsCount: subResponse.citations.length,
        retrieved: subResponse.retrieved
      })
    } catch (error) {
      logger.error(`Error processing sub-query ${i + 1}`, error as Error, {
        requestId,
        subQuery: subQuery.query
      })
      
      // Continuar con las demás sub-preguntas aunque una falle
      partialResponses.push({
        subQuery,
        response: {
          answer: `No se pudo generar respuesta para esta parte de la consulta: ${subQuery.query}`,
          citations: [],
          retrieved: 0,
          requestId: `${requestId}-sub${i}-error`,
          detectedLegalArea: originalQuery.legalArea
        },
        order: i
      })
    }
  }

  // 5. Sintetizar respuestas parciales usando el sintetizador avanzado
  logger.logPipelineStep('Synthesizing partial responses', requestId, {
    partialResponsesCount: partialResponses.length
  })

  const synthesizerConfig: SynthesizerConfig = {
    removeDuplicates: true,
    consolidateCitations: true,
    preserveContext: preserveContext,
    format: 'combined'
  }

  const synthesisResult = synthesizeResponsesAdvanced(
    partialResponses,
    originalQuery.query,
    splitResult,
    synthesizerConfig
  )

  // Convertir SynthesisResult a RagResponse
  const finalResponse: RagResponse = {
    answer: synthesisResult.answer,
    citations: synthesisResult.citations,
    retrieved: synthesisResult.retrieved,
    requestId: synthesisResult.requestId,
    detectedLegalArea: synthesisResult.detectedLegalArea,
    metadata: {
      complexity: 'alta',
      responseTime: synthesisResult.metadata?.synthesisTime || 0
    }
  }

  const processingTime = Date.now() - startTime

  logger.logPipelineStep('Recursive RAG completed', requestId, {
    processingTime,
    subQueriesProcessed: partialResponses.length,
    finalAnswerLength: finalResponse.answer.length,
    finalCitationsCount: finalResponse.citations.length
  })

  return {
    isRecursive: true,
    analysis,
    splitResult,
    partialResponses,
    finalResponse,
    metadata: {
      subQueriesCount: partialResponses.length,
      processingTime,
      contextPreserved: preserveContext
    }
  }
}

// La función synthesizeResponses ha sido movida a response-synthesizer.ts
// Se usa synthesizeResponsesAdvanced importada de ese módulo

/**
 * Función principal para ejecutar RAG con detección automática de recursividad
 */
export async function runRagWithRecursion(
  query: RagQuery,
  config: RecursiveRagConfig = {}
): Promise<RagResponse> {
  const recursiveResult = await runRecursiveRag(query, config)
  return recursiveResult.finalResponse
}
