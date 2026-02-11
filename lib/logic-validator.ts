/**
 * Validador de Coherencia Lógica
 * 
 * Valida que las respuestas legales sean lógicamente coherentes:
 * - No hay contradicciones entre afirmaciones
 * - Las conclusiones se derivan lógicamente de los hechos y normas
 * - No hay información conflictiva entre diferentes fuentes
 * - Las citas son consistentes con el contenido
 * 
 * @module logic-validator
 * @created 2026-02-09
 * @version 1.0.0
 */

import { type DocumentChunk } from './types'
import { extractApplicableNorms, type ApplicableNorm } from './norm-extractor'

/**
 * Tipo de inconsistencia detectada
 */
export type InconsistencyType = 
  | 'contradiction'           // Afirmaciones contradictorias
  | 'logical_fallacy'         // Falacia lógica en el razonamiento
  | 'citation_mismatch'       // Cita no coincide con contenido
  | 'norm_conflict'           // Conflicto entre normas citadas
  | 'temporal_inconsistency' // Inconsistencia temporal (fechas, plazos)
  | 'hierarchy_violation'     // Violación de jerarquía legal

/**
 * Inconsistencia detectada
 */
export interface Inconsistency {
  /** Tipo de inconsistencia */
  type: InconsistencyType
  /** Descripción de la inconsistencia */
  description: string
  /** Severidad (0-1, mayor = más grave) */
  severity: number
  /** Fragmentos de texto relacionados */
  fragments: string[]
  /** Sugerencia para resolver */
  suggestion?: string
}

/**
 * Resultado de la validación de coherencia
 */
export interface LogicValidationResult {
  /** Si la respuesta es coherente */
  isCoherent: boolean
  /** Score de coherencia (0-1, mayor = más coherente) */
  coherenceScore: number
  /** Inconsistencias detectadas */
  inconsistencies: Inconsistency[]
  /** Advertencias menores */
  warnings: string[]
  /** Metadata de la validación */
  metadata: {
    contradictionsCount: number
    logicalFallaciesCount: number
    citationMismatchesCount: number
    normConflictsCount: number
  }
}

/**
 * Palabras y frases que indican contradicciones
 */
const CONTRADICTION_INDICATORS = [
  /pero\s+sin\s+embargo/gi,
  /por\s+un\s+lado.*por\s+otro\s+lado/gi,
  /aunque.*sin\s+embargo/gi,
  /no\s+obstante.*pero/gi,
  /contradice|contradicci[oó]n/gi,
  /incompatible|incompatibilidad/gi
]

/**
 * Palabras que indican falacias lógicas comunes
 */
const LOGICAL_FALLACY_INDICATORS = [
  /siempre\s+es\s+as[ií]|nunca\s+es/gi,  // Generalización excesiva
  /todos\s+los\s+casos|ning[úu]n\s+caso/gi, // Absolutismo
  /por\s+lo\s+tanto.*pero/gi,  // Contradicción en conclusión
  /debe\s+ser.*no\s+puede\s+ser/gi  // Obligación contradictoria
]

/**
 * Valida coherencia lógica de una respuesta
 */
export function validateLogicCoherence(
  answer: string,
  chunks: Array<{ chunk: DocumentChunk; score: number }>,
  query: string
): LogicValidationResult {
  const inconsistencies: Inconsistency[] = []
  const warnings: string[] = []
  
  const answerLower = answer.toLowerCase()
  const queryLower = query.toLowerCase()
  
  // 1. Detectar contradicciones explícitas
  for (const pattern of CONTRADICTION_INDICATORS) {
    const matches = answer.match(pattern)
    if (matches) {
      inconsistencies.push({
        type: 'contradiction',
        description: `Se detectó una posible contradicción: "${matches[0]}"`,
        severity: 0.7,
        fragments: matches,
        suggestion: 'Revisar si las afirmaciones son realmente contradictorias o si se refieren a situaciones diferentes'
      })
    }
  }
  
  // 2. Detectar falacias lógicas
  for (const pattern of LOGICAL_FALLACY_INDICATORS) {
    const matches = answer.match(pattern)
    if (matches) {
      inconsistencies.push({
        type: 'logical_fallacy',
        description: `Posible falacia lógica detectada: "${matches[0]}"`,
        severity: 0.6,
        fragments: matches,
        suggestion: 'Evitar generalizaciones absolutas y verificar que las conclusiones se derivan lógicamente de los hechos'
      })
    }
  }
  
  // 3. Validar coherencia entre citas y contenido
  const citationMismatches = validateCitationConsistency(answer, chunks)
  inconsistencies.push(...citationMismatches)
  
  // 4. Validar coherencia entre normas aplicables
  const normConflicts = validateNormConsistency(answer, chunks, query)
  inconsistencies.push(...normConflicts)
  
  // 5. Validar coherencia temporal (plazos, fechas)
  const temporalIssues = validateTemporalConsistency(answer)
  inconsistencies.push(...temporalIssues)
  
  // 6. Validar jerarquía legal
  const hierarchyIssues = validateLegalHierarchy(answer, chunks)
  inconsistencies.push(...hierarchyIssues)
  
  // Calcular score de coherencia
  const baseScore = 1.0
  const penaltyPerInconsistency = 0.15
  const totalPenalty = inconsistencies.reduce((sum, inc) => sum + (inc.severity * penaltyPerInconsistency), 0)
  const coherenceScore = Math.max(0, baseScore - totalPenalty)
  
  // Agregar advertencias menores
  if (answer.length < 100) {
    warnings.push('La respuesta es muy corta, podría necesitar más contexto')
  }
  
  if (!answer.includes('artículo') && queryLower.includes('artículo')) {
    warnings.push('La consulta menciona artículos pero la respuesta no los cita explícitamente')
  }
  
  return {
    isCoherent: coherenceScore >= 0.7 && inconsistencies.length === 0,
    coherenceScore,
    inconsistencies,
    warnings,
    metadata: {
      contradictionsCount: inconsistencies.filter(i => i.type === 'contradiction').length,
      logicalFallaciesCount: inconsistencies.filter(i => i.type === 'logical_fallacy').length,
      citationMismatchesCount: inconsistencies.filter(i => i.type === 'citation_mismatch').length,
      normConflictsCount: inconsistencies.filter(i => i.type === 'norm_conflict').length
    }
  }
}

/**
 * Valida consistencia entre citas mencionadas y chunks
 */
function validateCitationConsistency(
  answer: string,
  chunks: Array<{ chunk: DocumentChunk; score: number }>
): Inconsistency[] {
  const inconsistencies: Inconsistency[] = []
  
  // Extraer títulos de normas mencionadas en la respuesta
  const mentionedTitles = new Set<string>()
  const titlePattern = /(?:Ley|Decreto|Código|Constitución|Resolución)\s+[\w\s]+/gi
  const titleMatches = answer.match(titlePattern)
  if (titleMatches) {
    titleMatches.forEach(title => mentionedTitles.add(title.toLowerCase()))
  }
  
  // Verificar que las normas mencionadas están en los chunks
  for (const title of mentionedTitles) {
    const foundInChunks = chunks.some(({ chunk }) => 
      chunk.metadata.title.toLowerCase().includes(title) || 
      title.includes(chunk.metadata.title.toLowerCase())
    )
    
    if (!foundInChunks) {
      inconsistencies.push({
        type: 'citation_mismatch',
        description: `Se menciona "${title}" en la respuesta pero no aparece en los documentos recuperados`,
        severity: 0.5,
        fragments: [title],
        suggestion: 'Verificar que la norma mencionada está correctamente citada y disponible en la base de conocimiento'
      })
    }
  }
  
  return inconsistencies
}

/**
 * Valida consistencia entre normas aplicables
 */
function validateNormConsistency(
  answer: string,
  chunks: Array<{ chunk: DocumentChunk; score: number }>,
  query: string
): Inconsistency[] {
  const inconsistencies: Inconsistency[] = []
  
  try {
    const normExtraction = extractApplicableNorms(query, chunks)
    
    // Verificar si hay normas con jerarquías conflictivas mencionadas juntas
    const normas = normExtraction.normas
    
    // Si hay Constitución y Decreto, verificar que no se contradicen
    const constitucion = normas.find(n => n.type === 'constitucion')
    const decreto = normas.find(n => n.type === 'decreto')
    
    if (constitucion && decreto) {
      // Verificar si la respuesta sugiere que el decreto prevalece sobre la constitución
      const answerLower = answer.toLowerCase()
      if (answerLower.includes(decreto.title.toLowerCase()) && 
          answerLower.includes('prevalece') &&
          !answerLower.includes('constitución')) {
        inconsistencies.push({
          type: 'hierarchy_violation',
          description: `La respuesta podría sugerir que un Decreto prevalece sobre la Constitución, lo cual viola la jerarquía legal`,
          severity: 0.8,
          fragments: [decreto.title, constitucion.title],
          suggestion: 'Recordar que la Constitución tiene máxima jerarquía y los decretos no pueden contradecirla'
        })
      }
    }
    
    // Verificar si hay normas derogadas siendo citadas como vigentes
    for (const norma of normas) {
      if (norma.vigencia && !norma.vigencia.vigente) {
        const answerLower = answer.toLowerCase()
        if (answerLower.includes(norma.title.toLowerCase()) && 
            !answerLower.includes('derogada') && 
            !answerLower.includes('vigente')) {
          inconsistencies.push({
            type: 'norm_conflict',
            description: `La norma "${norma.title}" está derogada pero se cita sin mencionar su estado`,
            severity: 0.7,
            fragments: [norma.title],
            suggestion: `Mencionar que "${norma.title}" está derogada y verificar la norma vigente que la reemplaza`
          })
        }
      }
    }
  } catch (error) {
    // Si hay error en la extracción, no agregar inconsistencia (fallback graceful)
  }
  
  return inconsistencies
}

/**
 * Valida coherencia temporal (plazos, fechas)
 */
function validateTemporalConsistency(answer: string): Inconsistency[] {
  const inconsistencies: Inconsistency[] = []
  
  // Extraer fechas mencionadas
  const datePattern = /\b(\d{1,2})\s+(?:días|semanas|meses|años)\b/gi
  const dates = answer.match(datePattern)
  
  if (dates && dates.length > 1) {
    // Verificar si hay plazos contradictorios
    const plazos: number[] = []
    for (const date of dates) {
      const match = date.match(/(\d+)\s+(días|semanas|meses|años)/i)
      if (match) {
        const numero = parseInt(match[1])
        const unidad = match[2].toLowerCase()
        let dias = 0
        if (unidad === 'días' || unidad === 'dias') dias = numero
        else if (unidad === 'semanas') dias = numero * 7
        else if (unidad === 'meses') dias = numero * 30
        else if (unidad === 'años') dias = numero * 365
        plazos.push(dias)
      }
    }
    
    // Si hay plazos muy diferentes para el mismo concepto, podría ser inconsistente
    if (plazos.length > 1) {
      const min = Math.min(...plazos)
      const max = Math.max(...plazos)
      if (max > min * 3) {
        inconsistencies.push({
          type: 'temporal_inconsistency',
          description: `Se mencionan plazos muy diferentes (${min} días vs ${max} días) que podrían ser inconsistentes`,
          severity: 0.5,
          fragments: dates,
          suggestion: 'Verificar que los plazos mencionados se refieren a situaciones o procedimientos diferentes'
        })
      }
    }
  }
  
  return inconsistencies
}

/**
 * Valida que no se viole la jerarquía legal
 */
function validateLegalHierarchy(
  answer: string,
  chunks: Array<{ chunk: DocumentChunk; score: number }>
): Inconsistency[] {
  const inconsistencies: Inconsistency[] = []
  
  const answerLower = answer.toLowerCase()
  
  // Verificar si se menciona que un decreto deroga una ley (incorrecto)
  if (answerLower.includes('decreto') && answerLower.includes('deroga') && answerLower.includes('ley')) {
    inconsistencies.push({
      type: 'hierarchy_violation',
      description: 'Un Decreto no puede derogar una Ley (viola jerarquía legal)',
      severity: 0.9,
      fragments: ['decreto', 'deroga', 'ley'],
      suggestion: 'Verificar la jerarquía legal: solo una Ley puede derogar otra Ley, los Decretos no pueden derogar Leyes'
    })
  }
  
  // Verificar si se menciona que una resolución deroga una ley o decreto
  if (answerLower.includes('resolución') && answerLower.includes('deroga') && 
      (answerLower.includes('ley') || answerLower.includes('decreto'))) {
    inconsistencies.push({
      type: 'hierarchy_violation',
      description: 'Una Resolución no puede derogar una Ley o Decreto (viola jerarquía legal)',
      severity: 0.9,
      fragments: ['resolución', 'deroga'],
      suggestion: 'Verificar la jerarquía legal: las Resoluciones tienen menor jerarquía que Leyes y Decretos'
    })
  }
  
  return inconsistencies
}

/**
 * Genera feedback para mejorar la coherencia
 */
export function generateCoherenceFeedback(result: LogicValidationResult): string {
  if (result.isCoherent) {
    return 'La respuesta es lógicamente coherente.'
  }
  
  const feedback: string[] = []
  
  if (result.inconsistencies.length > 0) {
    feedback.push(`Se detectaron ${result.inconsistencies.length} inconsistencia(s):`)
    
    for (const inc of result.inconsistencies.slice(0, 3)) { // Limitar a 3 para no saturar
      feedback.push(`- ${inc.description}`)
      if (inc.suggestion) {
        feedback.push(`  Sugerencia: ${inc.suggestion}`)
      }
    }
  }
  
  if (result.warnings.length > 0) {
    feedback.push('Advertencias:')
    result.warnings.forEach(w => feedback.push(`- ${w}`))
  }
  
  return feedback.join('\n')
}
