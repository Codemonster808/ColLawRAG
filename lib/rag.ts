import { v4 as uuidv4 } from 'uuid'
import { retrieveRelevantChunks } from './retrieval'
import { generateAnswerSpanish } from './generation'
import { filterSensitivePII } from './pii'
import { type RagQuery, type RagResponse } from './types'
import { detectLegalArea } from './prompt-templates'
import { validateFactual } from './factual-validator'
import { structureResponse, formatStructuredResponse } from './response-structure'
import { 
  calculateAllPrestaciones, 
  calculateHorasExtras, 
  calculateRecargoDominical,
  calculateIndemnizacionDespido,
  type CalculationResult 
} from './legal-calculator'

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
 */
function performCalculations(
  calculationType: string,
  extractedParams: Record<string, any>
): CalculationResult[] {
  const results: CalculationResult[] = []
  
  try {
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
    console.error('[rag] Error en cálculos:', error)
  }
  
  return results
}

export async function runRagPipeline(params: RagQuery): Promise<RagResponse> {
  const startTime = Date.now()
  const {
    query,
    filters,
    locale = 'es',
    enableFactualValidation = process.env.ENABLE_FACTUAL_VALIDATION === 'true',
    enableStructuredResponse = process.env.ENABLE_STRUCTURED_RESPONSE === 'true',
    enableCalculations = process.env.ENABLE_CALCULATIONS === 'true',
    legalArea: providedLegalArea,
    userId
  } = params

  const requestId = uuidv4()
  
  console.log('[rag] Pipeline start', { requestId, queryLength: query.length, userId })

  // 1. Detectar área legal si no se proporciona
  const detectedLegalArea = providedLegalArea || detectLegalArea(query)
  console.log('[rag] Legal area detected:', detectedLegalArea)

  // 2. Retrieval con re-ranking (ya integrado en retrieveRelevantChunks)
  console.log('[rag] Retrieving chunks...')
  const retrieved = await retrieveRelevantChunks(query, filters, 8)
  console.log('[rag] Retrieved chunks:', retrieved.length, 'scores:', retrieved.map(r => r.score.toFixed(3)))

  if (retrieved.length === 0) {
    return {
      answer: 'No se encontraron documentos relevantes para tu consulta. Por favor, reformula tu pregunta o verifica que haya documentos indexados en el sistema.',
      citations: [],
      retrieved: 0,
      requestId,
      detectedLegalArea
    }
  }

  // 3. Generación con prompts mejorados (ya integrado en generateAnswerSpanish)
  console.log('[rag] Generating answer...')
  const answer = await generateAnswerSpanish({
    query,
    chunks: retrieved,
    legalArea: detectedLegalArea,
    includeWarnings: true
  })
  console.log('[rag] Answer generated, length:', answer.length)

  // 4. Filtrar PII
  const safeAnswer = filterSensitivePII(answer || '')

  // 5. Validación factual (opcional)
  let factualValidation
  if (enableFactualValidation) {
    console.log('[rag] Running factual validation...')
    factualValidation = validateFactual(safeAnswer, retrieved)
    console.log('[rag] Factual validation:', {
      isValid: factualValidation.isValid,
      warnings: factualValidation.warnings.length,
      articlesValidated: factualValidation.validatedFacts.articles.length
    })
    
    // Si hay errores críticos, agregar advertencia a la respuesta
    if (!factualValidation.isValid && factualValidation.errors.length > 0) {
      console.warn('[rag] Factual validation errors detected:', factualValidation.errors)
    }
  }

  // 6. Estructuración de respuesta (opcional)
  let structuredResponse
  if (enableStructuredResponse) {
    console.log('[rag] Structuring response...')
    structuredResponse = structureResponse(safeAnswer, retrieved)
    const validation = structuredResponse.analisisJuridico && structuredResponse.conclusion
      ? { isValid: true, missingSections: [] }
      : { isValid: false, missingSections: [] }
    
    if (!validation.isValid) {
      console.log('[rag] Structured response missing some sections, using original format')
    } else {
      console.log('[rag] Response successfully structured')
    }
  }

  // 7. Detección y ejecución de cálculos (opcional)
  let calculations
  if (enableCalculations) {
    console.log('[rag] Detecting calculation needs...')
    const calcNeeds = detectCalculationNeeds(query, safeAnswer)
    
    if (calcNeeds.needsCalculation && calcNeeds.extractedParams) {
      console.log('[rag] Calculation needed:', calcNeeds.calculationType)
      calculations = performCalculations(calcNeeds.calculationType!, calcNeeds.extractedParams)
      
      if (calculations.length > 0) {
        console.log('[rag] Calculations performed:', calculations.length)
        // Agregar cálculos a la respuesta si es premium o si está habilitado
        // (En producción, esto dependería del tier del usuario)
      }
    } else if (calcNeeds.needsCalculation) {
      console.log('[rag] Calculation needed but parameters not extracted from query')
    }
  }

  // 8. Detectar necesidad de procedimientos y agregarlos
  let procedures: any[] | undefined
  if (enableCalculations) { // Reutilizar flag de cálculos para procedimientos también
    const procedureKeywords = {
      laboral: /\b(procedimiento|pasos|trámite|reclamar|demandar|accionar|tutela|cumplimiento)\b/i,
      general: /\b(cómo|qué hacer|pasos a seguir|proceso|trámite)\b/i
    }
    
    const lowerQuery = query.toLowerCase()
    const needsProcedure = procedureKeywords.laboral.test(lowerQuery) || 
                          procedureKeywords.general.test(lowerQuery)
    
    if (needsProcedure && detectedLegalArea === 'laboral') {
      try {
        const fs = await import('fs')
        const path = await import('path')
        const proceduresPath = path.join(process.cwd(), 'data', 'procedures', 'laboral.json')
        
        if (fs.existsSync(proceduresPath)) {
          const proceduresData = JSON.parse(fs.readFileSync(proceduresPath, 'utf-8'))
          const proceduresList = proceduresData.procedures || []
          
          // Buscar procedimientos relevantes basados en la query
          const relevantProcedures = proceduresList.filter((proc: any) => {
            if (!proc || typeof proc !== 'object') return false
            const procText = JSON.stringify(proc).toLowerCase()
            const queryTerms = query.toLowerCase().split(/\s+/)
            return queryTerms.some(term => term.length > 3 && procText.includes(term))
          })
          
          if (relevantProcedures.length > 0) {
            procedures = relevantProcedures.slice(0, 3) // Máximo 3 procedimientos
            console.log('[rag] Procedures found:', procedures.length)
          }
        }
      } catch (error) {
        console.warn('[rag] Error loading procedures:', error)
      }
    }
  }

  // 9. Preparar citas
  const citations = retrieved.map((r) => ({
    id: r.chunk.metadata.id || r.chunk.id,
    title: r.chunk.metadata.title,
    type: r.chunk.metadata.type,
    url: r.chunk.metadata.url,
    article: r.chunk.metadata.article,
    score: r.score,
  }))

  // 10. Calcular tiempo de respuesta
  const responseTime = Date.now() - startTime

  // 11. Construir respuesta final
  const response: RagResponse = {
    answer: safeAnswer,
    citations,
    retrieved: retrieved.length,
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

  if (calculations && calculations.length > 0) {
    response.calculations = calculations.map(calc => ({
      type: calc.type,
      amount: calc.amount,
      formula: calc.formula,
      breakdown: calc.breakdown
    }))
  }

  console.log('[rag] Pipeline complete', {
    requestId,
    responseTime: `${responseTime}ms`,
    answerLength: safeAnswer.length,
    citationsCount: citations.length,
    hasStructuredResponse: !!structuredResponse,
    hasFactualValidation: !!factualValidation,
    hasCalculations: !!(calculations && calculations.length > 0)
  })

  return response
} 