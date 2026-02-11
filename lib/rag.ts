import { v4 as uuidv4 } from 'uuid'
import { retrieveRelevantChunks } from './retrieval'
import { generateAnswerSpanish } from './generation'
import { filterSensitivePII } from './pii'
import { type RagQuery, type RagResponse, type DocumentChunk } from './types'
import { detectLegalArea, detectComplexity } from './prompt-templates'
import { logger } from './logger'
import { isProcedureRelatedQuery, getProcedureChunksForQuery } from './procedures'
import { consultarVigencia, inferNormaIdFromTitle } from './norm-vigencia'
import { shouldUseRecursiveRag, runRecursiveRag, type RecursiveRagConfig } from './rag-recursive'
import { extractApplicableNorms } from './norm-extractor'
import { validateLogicCoherence, generateCoherenceFeedback } from './logic-validator'

// Lazy load heavy modules to optimize cold starts
// These are only imported when actually needed
type FactualValidator = typeof import('./factual-validator')
type ResponseStructure = typeof import('./response-structure')
type LegalCalculator = typeof import('./legal-calculator')
type CitationValidator = typeof import('./citation-validator')

// Import type for calculations
import type { CalculationResult } from './legal-calculator'

/**
 * Detecta si una consulta requiere cálculos legales
 */
function detectCalculationNeeds(query: string, answer: string): {
  needsCalculation: boolean
  calculationType?: 'prestaciones' | 'horas_extras' | 'recargo_dominical' | 'indemnizacion' | 'general'
  extractedParams?: Record<string, any>
} {
  const lowerQuery = query.toLowerCase()
  const lowerAnswer = answer.toLowerCase()
  
  // Detectar menciones de cálculos
  const calculationKeywords = {
    prestaciones: /\b(cesant[ií]as|vacaciones|prima|prestaciones\s+sociales)\b/,
    horas_extras: /\b(horas\s+extras|horas\s+adicionales|recargo\s+25%)\b/,
    recargo_dominical: /\b(dominical|festivo|recargo\s+75%|trabajo\s+domingo|domingos)\b/,
    indemnizacion: /\b(indemnizaci[oó]n|despido\s+sin\s+justa\s+causa|despido\s+injustificado)\b/
  }
  
  for (const [type, pattern] of Object.entries(calculationKeywords)) {
    if (pattern.test(lowerQuery) || pattern.test(lowerAnswer)) {
      // Extraer parámetros mejorados
      const extractedParams: Record<string, any> = {}
      
      // Salario: múltiples formatos
      const salarioPatterns = [
        /(?:salario|sueldo|devengado)\s+(?:de\s+)?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?)/i,
        /\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s+(?:mensual|mensuales)/i,
        /(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s+(?:pesos|COP)/i
      ]
      
      for (const pattern of salarioPatterns) {
        const match = query.match(pattern)
        if (match) {
          extractedParams.salarioMensual = parseFloat(match[1].replace(/\./g, '').replace(',', '.'))
          break
        }
      }
      
      // Años y meses trabajados
      const anosMatch = query.match(/(\d+)\s+a[ñn]os/i)
      const mesesMatch = query.match(/(\d+)\s+meses/i)
      if (anosMatch) {
        const anos = parseInt(anosMatch[1])
        extractedParams.anosTrabajados = anos
        extractedParams.mesesTrabajados = anos * 12
        // Buscar meses adicionales
        const mesesAdicionalesMatch = query.match(/(\d+)\s+meses/i)
        if (mesesAdicionalesMatch) {
          extractedParams.mesesTrabajados += parseInt(mesesAdicionalesMatch[1])
          extractedParams.mesesAdicionales = parseInt(mesesAdicionalesMatch[1])
        }
      } else if (mesesMatch) {
        extractedParams.mesesTrabajados = parseInt(mesesMatch[1])
      }
      
      // Días trabajados (aproximado)
      if (extractedParams.mesesTrabajados) {
        extractedParams.diasTrabajados = extractedParams.mesesTrabajados * 30
      }
      
      // Horas extras - múltiples patrones
      const horasPatterns = [
        /(\d+)\s+horas\s+(?:extras|adicionales)/i,
        /trabaj[ae]\s+(\d+)\s+horas\s+(?:extras|adicionales)/i,
        /promedio\s+de\s+(\d+)\s+horas\s+diarias/i,
        /(\d+)\s+horas\s+diarias/i
      ]
      
      for (const pattern of horasPatterns) {
        const match = query.match(pattern)
        if (match) {
          const horas = parseInt(match[1])
          // Si son más de 8 horas diarias, calcular extras
          if (horas > 8) {
            extractedParams.horasExtras = (horas - 8) * 6 * 4 // (horas extras diarias) * días/semana * semanas/mes
            extractedParams.horasDiarias = horas
          }
          break
        }
      }
      
      // Horas dominicales - múltiples patrones
      const dominicalPatterns = [
        /(?:domingos?|festivos?)\s+(?:trabaj[ae]|labor[ae])\s+(\d+)/i,
        /trabaj[ae]\s+los\s+domingos/i,
        /domingos?\s+sin\s+pagar/i,
        /recargo\s+dominical/i
      ]
      
      for (const pattern of dominicalPatterns) {
        const match = query.match(pattern)
        if (match) {
          // Si hay número específico, usarlo; si no, estimar
          if (match[1]) {
            extractedParams.horasDominicales = parseInt(match[1])
          } else {
            // Estimar: si trabajó domingos, asumir 8 horas por domingo, ~4 domingos/mes
            extractedParams.horasDominicales = 8 * 4
            extractedParams.domingosTrabajados = true
          }
          break
        }
      }
      
      // Detectar si menciona trabajo dominical sin pago
      if (query.match(/domingos?\s+sin\s+(?:pagar|recargo)/i)) {
        extractedParams.domingosSinPago = true
        if (!extractedParams.horasDominicales) {
          extractedParams.horasDominicales = 8 * 4 // Estimación conservadora
        }
      }
      
      return {
        needsCalculation: true,
        calculationType: type as any,
        extractedParams: Object.keys(extractedParams).length > 0 ? extractedParams : undefined
      }
    }
  }
  
  return { needsCalculation: false }
}

/**
 * Ejecuta cálculos legales según el tipo detectado
 * Nota: Las funciones de cálculo se cargan dinámicamente cuando se necesitan
 */
async function performCalculations(
  calculationType: string,
  extractedParams: Record<string, any>
): Promise<CalculationResult[]> {
  const results: CalculationResult[] = []
  
  try {
    // Lazy load legal calculator module
    const { 
      calculateAllPrestaciones, 
      calculateHorasExtras, 
      calculateRecargoDominical,
      calculateIndemnizacionDespido 
    } = await import('./legal-calculator') as LegalCalculator
    
    if (calculationType === 'prestaciones' && extractedParams.salarioMensual && extractedParams.mesesTrabajados) {
      const prestaciones = calculateAllPrestaciones({
        salarioMensual: extractedParams.salarioMensual,
        mesesTrabajados: extractedParams.mesesTrabajados,
        diasTrabajados: extractedParams.mesesTrabajados * 30,
        interesesCesantias: extractedParams.interesesCesantias
      })
      
      results.push(prestaciones.cesantias)
      results.push(prestaciones.vacaciones)
      results.push(prestaciones.primaServicios)
    } else if (calculationType === 'horas_extras' && extractedParams.salarioMensual && extractedParams.horasExtras) {
      const horasExtras = calculateHorasExtras({
        salarioMensual: extractedParams.salarioMensual,
        horasExtras: extractedParams.horasExtras
      })
      results.push(horasExtras)
    } else if (calculationType === 'recargo_dominical' && extractedParams.salarioMensual && extractedParams.horasDominicales) {
      const recargo = calculateRecargoDominical({
        salarioMensual: extractedParams.salarioMensual,
        horasDominicales: extractedParams.horasDominicales
      })
      results.push(recargo)
    } else if (calculationType === 'indemnizacion' && extractedParams.salarioMensual && extractedParams.anosTrabajados) {
      const indemnizacion = calculateIndemnizacionDespido({
        salarioMensual: extractedParams.salarioMensual,
        anosTrabajados: extractedParams.anosTrabajados,
        mesesAdicionales: extractedParams.mesesAdicionales
      })
      results.push(indemnizacion)
    }
  } catch (error) {
    logger.error('Error en cálculos', error, { calculationType })
  }
  
  return results
}

export async function runRagPipeline(params: RagQuery): Promise<RagResponse> {
  const startTime = Date.now()
  const {
    query,
    filters,
    locale = 'es',
    enableFactualValidation = process.env.ENABLE_FACTUAL_VALIDATION !== 'false',
    enableStructuredResponse = process.env.ENABLE_STRUCTURED_RESPONSE === 'true',
    enableCalculations = process.env.ENABLE_CALCULATIONS === 'true',
    enableCitationValidation = process.env.ENABLE_CITATION_VALIDATION === 'true',
    legalArea: providedLegalArea,
    userId
  } = params

  const requestId = uuidv4()
  
  logger.logPipelineStep('Pipeline start', requestId, { queryLength: query.length, userId })

  // 0. Detectar si debe usarse RAG recursivo para consultas multi-parte
  const enableRecursiveRag = process.env.ENABLE_RECURSIVE_RAG !== 'false'
  if (enableRecursiveRag) {
    const recursiveConfig: RecursiveRagConfig = {
      enabled: true,
      minConfidence: parseFloat(process.env.RECURSIVE_RAG_MIN_CONFIDENCE || '0.6'),
      maxSubQueries: parseInt(process.env.RECURSIVE_RAG_MAX_SUBQUERIES || '5', 10),
      preserveContext: process.env.RECURSIVE_RAG_PRESERVE_CONTEXT !== 'false'
    }

    if (shouldUseRecursiveRag(query, recursiveConfig)) {
      logger.logPipelineStep('Using recursive RAG for multi-part query', requestId, {
        minConfidence: recursiveConfig.minConfidence,
        maxSubQueries: recursiveConfig.maxSubQueries
      })

      try {
        const recursiveResult = await runRecursiveRag(params, recursiveConfig)
        
        // Si el procesamiento recursivo fue exitoso, retornar la respuesta sintetizada
        if (recursiveResult.isRecursive && recursiveResult.finalResponse) {
          logger.logPipelineStep('Recursive RAG completed successfully', requestId, {
            subQueriesProcessed: recursiveResult.metadata.subQueriesCount,
            processingTime: recursiveResult.metadata.processingTime
          })
          return recursiveResult.finalResponse
        }
        
        // Si no se procesó recursivamente, continuar con pipeline normal
        logger.logPipelineStep('Recursive RAG not used, falling back to normal pipeline', requestId)
      } catch (error) {
        logger.error('Error in recursive RAG, falling back to normal pipeline', error as Error, {
          requestId
        })
        // Continuar con pipeline normal si hay error
      }
    }
  }

  // 1. Detectar área legal si no se proporciona
  const detectedLegalArea = providedLegalArea || detectLegalArea(query)
  logger.logPipelineStep('Legal area detected', requestId, { legalArea: detectedLegalArea })

  // 1.5 Detectar complejidad de la consulta para ajustar parámetros
  // Detectar complejidad basada en la consulta (sin necesidad de retrieval previo)
  // Hacemos un retrieval pequeño inicial solo para estimar disponibilidad de fuentes
  const quickRetrieval = await retrieveRelevantChunks(query, filters, 5)
  const detectedComplexity = detectComplexity(query, quickRetrieval.length)
  
  // Top-K adaptativo según complejidad
  const adaptiveTopK = detectedComplexity === 'alta' ? 16 : detectedComplexity === 'media' ? 12 : 8
  logger.logPipelineStep('Complexity detected', requestId, { 
    complexity: detectedComplexity, 
    adaptiveTopK,
    quickRetrievalCount: quickRetrieval.length
  })

  // 2. Retrieval completo con re-ranking usando top-K adaptativo
  logger.logPipelineStep('Retrieving chunks', requestId)
  const retrieved = await retrieveRelevantChunks(query, filters, adaptiveTopK)
  logger.logPipelineStep('Chunks retrieved', requestId, { 
    count: retrieved.length, 
    scores: retrieved.map(r => r.score.toFixed(3)),
    complexity: detectedComplexity
  })

  if (retrieved.length === 0) {
    return {
      answer: 'No se encontraron documentos relevantes para tu consulta. Por favor, reformula tu pregunta o verifica que haya documentos indexados en el sistema.',
      citations: [],
      retrieved: 0,
      requestId,
      detectedLegalArea
    }
  }

  // 2.5 Extraer normas aplicables de la consulta y chunks
  const enableNormExtraction = process.env.ENABLE_NORM_EXTRACTION !== 'false'
  let applicableNorms: any = null
  if (enableNormExtraction) {
    logger.logPipelineStep('Extracting applicable norms', requestId)
    const normExtraction = extractApplicableNorms(query, retrieved)
    applicableNorms = normExtraction
    logger.logPipelineStep('Norms extracted', requestId, {
      total: normExtraction.total,
      vigentes: normExtraction.vigentes,
      noVigentes: normExtraction.noVigentes,
      articles: normExtraction.articles.length
    })
  }

  // 2.6 Inyectar procedimientos (data/procedures/) si la consulta es procedural
  let chunksForGeneration = retrieved
  let procedureChunks: Array<{ chunk: DocumentChunk; score: number }> = []
  if (isProcedureRelatedQuery(query)) {
    procedureChunks = getProcedureChunksForQuery(query, detectedLegalArea)
    if (procedureChunks.length > 0) {
      // Prepend procedure chunks (máx. 2) para que el modelo vea plazos y etapas
      const maxProcedureChunks = 2
      const toPrepend = procedureChunks.slice(0, maxProcedureChunks)
      chunksForGeneration = [...toPrepend, ...retrieved].slice(0, 10) // mantener límite razonable
      logger.logPipelineStep('Procedure context injected', requestId, { count: toPrepend.length })
    }
  }

  // 3. Generación con prompts mejorados (ya integrado en generateAnswerSpanish)
  logger.logPipelineStep('Generating answer', requestId)
  // Habilitar validación HNAC por defecto (puede desactivarse con ENFORCE_HNAC=false)
  const enforceHNAC = process.env.ENFORCE_HNAC !== 'false'
  const answer = await generateAnswerSpanish({
    query,
    chunks: chunksForGeneration,
    legalArea: detectedLegalArea,
    includeWarnings: true,
    requestId,
    complexity: detectedComplexity,
    enforceHNAC // Forzar estructura HNAC (Hechos, Normas, Análisis, Conclusión)
  })
  logger.logPipelineStep('Answer generated', requestId, { answerLength: answer.length })

  // 4. Filtrar PII
  const safeAnswer = filterSensitivePII(answer || '')

  // 5. Validación factual (opcional) - Lazy loaded
  let factualValidation
  if (enableFactualValidation) {
    logger.logPipelineStep('Running factual validation', requestId)
    const { validateFactual } = await import('./factual-validator') as FactualValidator
    factualValidation = validateFactual(safeAnswer, retrieved)
    logger.logPipelineStep('Factual validation completed', requestId, {
      isValid: factualValidation.isValid,
      warningsCount: factualValidation.warnings.length,
      articlesValidated: factualValidation.validatedFacts.articles.length
    })
    
    // Si hay errores críticos, agregar advertencia a la respuesta
    if (!factualValidation.isValid && factualValidation.errors.length > 0) {
      logger.warn('Factual validation errors detected', {
        requestId,
        errors: factualValidation.errors
      })
    }
  }

  // 5.5 Validación de citas (opcional) - Lazy loaded
  let citationValidation
  if (enableCitationValidation) {
    logger.logPipelineStep('Running citation validation', requestId)
    const { validateCitations } = await import('./citation-validator') as CitationValidator
    citationValidation = validateCitations(safeAnswer, retrieved)
    logger.logPipelineStep('Citation validation completed', requestId, {
      totalCitations: citationValidation.totalCitations,
      validCitations: citationValidation.validCitations,
      precision: citationValidation.precision
    })
    
    // Advertir si hay citas inválidas
    if (citationValidation.invalidCitations.length > 0) {
      logger.warn('Invalid citations detected', {
        requestId,
        invalidCitations: citationValidation.invalidCitations.map(c => c.citationRef)
      })
    }
  }

  // 6. Estructuración de respuesta (opcional) - Lazy loaded
  let structuredResponse
  if (enableStructuredResponse) {
    logger.logPipelineStep('Structuring response', requestId)
    const { structureResponse } = await import('./response-structure') as ResponseStructure
    structuredResponse = structureResponse(safeAnswer, retrieved)
    const validation = structuredResponse.analisisJuridico && structuredResponse.conclusion
      ? { isValid: true, missingSections: [] }
      : { isValid: false, missingSections: [] }
    
    if (!validation.isValid) {
      logger.logPipelineStep('Structured response missing sections, using original format', requestId)
    } else {
      logger.logPipelineStep('Response successfully structured', requestId)
    }
  }

  // 7. Detección y ejecución de cálculos (opcional) - Lazy loaded
  let calculations
  if (enableCalculations) {
    logger.logPipelineStep('Detecting calculation needs', requestId)
    const calcNeeds = detectCalculationNeeds(query, safeAnswer)
    
    if (calcNeeds.needsCalculation && calcNeeds.extractedParams) {
      logger.logPipelineStep('Calculation needed', requestId, { 
        calculationType: calcNeeds.calculationType 
      })
      calculations = await performCalculations(calcNeeds.calculationType!, calcNeeds.extractedParams)
      
      if (calculations.length > 0) {
        logger.logPipelineStep('Calculations performed', requestId, { 
          count: calculations.length 
        })
      }
    } else if (calcNeeds.needsCalculation) {
      logger.logPipelineStep('Calculation needed but parameters not extracted', requestId)
    }
  }

  // 8. Procedimientos inyectados (ya cargados en 2.5 si la consulta era procedural)
  const procedures = procedureChunks.length > 0
    ? procedureChunks.map(p => ({
        id: p.chunk.id,
        nombre: p.chunk.metadata.title,
        tipo: p.chunk.metadata.type,
        resumen: p.chunk.content.slice(0, 500) + (p.chunk.content.length > 500 ? '...' : '')
      }))
    : undefined

  // 9. Preparar citas (desde chunksForGeneration para incluir procedimientos si se inyectaron)
  const citations = chunksForGeneration.map((r) => ({
    id: r.chunk.metadata.id || r.chunk.id,
    title: r.chunk.metadata.title,
    type: r.chunk.metadata.type,
    url: r.chunk.metadata.url,
    article: r.chunk.metadata.article,
    score: r.score,
  }))

  // 9.5 Validación de vigencia (normas derogadas o parcialmente derogadas)
  const vigenciaWarnings: string[] = []
  const vigenciaByNorma: Array<{ normaId: string; title: string; estado: string; derogadaPor?: string; derogadaDesde?: string }> = []
  for (const c of citations) {
    if (c.type === 'procedimiento') continue
    const normaId = inferNormaIdFromTitle(c.title)
    if (!normaId) continue
    const vigencia = consultarVigencia(normaId)
    if (!vigencia || vigencia.vigente && vigencia.estado === 'vigente') continue
    if (vigencia.estado === 'derogada') {
      vigenciaWarnings.push(`La norma "${c.title}" está derogada${'derogadaPor' in vigencia && vigencia.derogadaPor ? ` por ${vigencia.derogadaPor}` : ''}${'derogadaDesde' in vigencia && vigencia.derogadaDesde ? ` desde ${vigencia.derogadaDesde}` : ''}.`)
      vigenciaByNorma.push({
        normaId,
        title: c.title,
        estado: 'derogada',
        derogadaPor: 'derogadaPor' in vigencia ? vigencia.derogadaPor : undefined,
        derogadaDesde: 'derogadaDesde' in vigencia ? vigencia.derogadaDesde : undefined
      })
    } else if (vigencia.estado === 'parcialmente_derogada') {
      vigenciaWarnings.push(`La norma "${c.title}" tiene artículos derogados o modificados; verifique vigencia específica.`)
      vigenciaByNorma.push({ normaId, title: c.title, estado: 'parcialmente_derogada' })
    }
  }
  if (vigenciaWarnings.length > 0) {
    logger.logPipelineStep('Vigencia warnings', requestId, { count: vigenciaWarnings.length })
  }

  // 10. Calcular tiempo de respuesta
  const responseTime = Date.now() - startTime

  // 11. Construir respuesta final
  const response: RagResponse = {
    answer: safeAnswer,
    citations,
    retrieved: chunksForGeneration.length,
    requestId,
    detectedLegalArea,
    metadata: {
      responseTime,
      complexity: 'media' // Podría detectarse automáticamente
    }
  }
  
  // Agregar procedimientos si están disponibles
  if (procedures && procedures.length > 0) {
    (response as any).procedures = procedures
  }

  // Agregar campos opcionales
  if (structuredResponse) {
    response.structuredResponse = {
      hechosRelevantes: structuredResponse.hechosRelevantes,
      normasAplicables: structuredResponse.normasAplicables,
      analisisJuridico: structuredResponse.analisisJuridico,
      conclusion: structuredResponse.conclusion,
      recomendacion: structuredResponse.recomendacion
    }
  }

  if (factualValidation) {
    response.factualValidation = {
      isValid: factualValidation.isValid,
      warnings: factualValidation.warnings,
      validatedFacts: {
        articles: factualValidation.validatedFacts.articles,
        numbers: factualValidation.validatedFacts.numbers
      }
    }
  }

  if (citationValidation) {
    response.citationValidation = {
      totalCitations: citationValidation.totalCitations,
      validCitations: citationValidation.validCitations,
      precision: citationValidation.precision,
      invalidCitations: citationValidation.invalidCitations.map(c => ({
        ref: c.citationRef,
        error: c.errorMessage
      }))
    }
  }

  if (calculations && calculations.length > 0) {
    response.calculations = calculations.map(calc => ({
      type: calc.type,
      amount: calc.amount,
      formula: calc.formula,
      breakdown: calc.breakdown
    }))
  }

  if (vigenciaWarnings.length > 0) {
    response.vigenciaValidation = {
      warnings: vigenciaWarnings,
      byNorma: vigenciaByNorma
    }
    // Añadir advertencia al final de la respuesta para que sea visible al usuario
    response.answer = response.answer.trimEnd() + '\n\n⚠️ **Vigencia:** ' + vigenciaWarnings.join(' ')
  }

  // Agregar normas aplicables si están disponibles
  if (applicableNorms && applicableNorms.total > 0) {
    (response as any).applicableNorms = {
      normas: applicableNorms.normas.map((n: any) => ({
        normaId: n.normaId,
        title: n.title,
        type: n.type,
        articles: n.articles.map((a: any) => ({
          numero: a.numero,
          normaId: a.normaId,
          normaTitle: a.normaTitle
        })),
        hierarchyScore: n.hierarchyScore,
        vigencia: n.vigencia
      })),
      total: applicableNorms.total,
      vigentes: applicableNorms.vigentes,
      noVigentes: applicableNorms.noVigentes
    }
  }

  logger.logPipelineStep('Pipeline complete', requestId, {
    responseTime: `${responseTime}ms`,
    answerLength: safeAnswer.length,
    citationsCount: citations.length,
    hasStructuredResponse: !!structuredResponse,
    hasFactualValidation: !!factualValidation,
    hasCalculations: !!(calculations && calculations.length > 0),
    applicableNormsCount: applicableNorms?.total || 0
  })
  
  logger.logMetric('pipeline_response_time', responseTime, 'ms', { requestId })

  return response
} 