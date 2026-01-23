import { type DocumentChunk } from './types'

export interface CitationValidation {
  citationRef: string        // "[1]", "[2]", etc.
  isValid: boolean           // Existe en el contexto?
  sourceTitle: string | null // Título de la fuente
  articleMatch: boolean      // El artículo citado existe?
  confidence: number         // 0-1 score
  expectedIndex?: number     // Índice esperado en el array de chunks
  actualIndex?: number       // Índice real encontrado
  errorMessage?: string       // Mensaje de error si es inválida
}

export interface EvaluationResult {
  totalCitations: number
  validCitations: number
  precision: number          // validCitations / totalCitations
  invalidCitations: CitationValidation[]
  validCitationsList: CitationValidation[]
}

/**
 * Extrae todas las referencias de citas del formato [1], [2], etc. de un texto
 */
export function extractCitationRefs(text: string): string[] {
  const citationRegex = /\[(\d+)\]/g
  const matches = text.matchAll(citationRegex)
  const refs = Array.from(matches, m => `[${m[1]}]`)
  // Eliminar duplicados y ordenar
  return [...new Set(refs)].sort((a, b) => {
    const numA = parseInt(a.slice(1, -1))
    const numB = parseInt(b.slice(1, -1))
    return numA - numB
  })
}

/**
 * Valida que una referencia de cita [N] corresponda a un chunk válido
 */
function validateCitationRef(
  citationRef: string,
  chunks: Array<{ chunk: DocumentChunk; score: number }>
): CitationValidation {
  const match = citationRef.match(/\[(\d+)\]/)
  if (!match) {
    return {
      citationRef,
      isValid: false,
      sourceTitle: null,
      articleMatch: false,
      confidence: 0,
      errorMessage: 'Formato de cita inválido'
    }
  }

  const index = parseInt(match[1]) - 1 // [1] -> índice 0, [2] -> índice 1, etc.

  if (index < 0 || index >= chunks.length) {
    return {
      citationRef,
      isValid: false,
      sourceTitle: null,
      articleMatch: false,
      confidence: 0,
      expectedIndex: index,
      errorMessage: `Cita fuera de rango: ${citationRef} (hay ${chunks.length} fuentes disponibles)`
    }
  }

  const chunk = chunks[index].chunk
  return {
    citationRef,
    isValid: true,
    sourceTitle: chunk.metadata.title,
    articleMatch: true, // Por ahora asumimos que si existe el chunk, el artículo es válido
    confidence: 1.0,
    expectedIndex: index,
    actualIndex: index
  }
}

/**
 * Valida que los artículos mencionados en el texto existan en los chunks citados
 */
function validateArticleMentions(
  answer: string,
  citationValidation: CitationValidation,
  chunks: Array<{ chunk: DocumentChunk; score: number }>
): CitationValidation {
  if (!citationValidation.isValid || citationValidation.expectedIndex === undefined) {
    return citationValidation
  }

  const chunk = chunks[citationValidation.expectedIndex].chunk
  const content = chunk.content.toLowerCase()
  const metadata = chunk.metadata

  // Buscar menciones de artículos en el texto cerca de la cita
  // Patrones: "Artículo X", "Art. X", "artículo X", etc.
  const articleRegex = /(?:art[íi]culo|art\.?)\s+(\d+[a-z]?)/gi
  const articleMatches = Array.from(answer.matchAll(articleRegex))

  if (articleMatches.length === 0) {
    // No se mencionan artículos específicos, considerar válido
    return { ...citationValidation, articleMatch: true, confidence: 1.0 }
  }

  // Verificar si los artículos mencionados existen en el contenido del chunk
  let foundArticles = 0
  for (const match of articleMatches) {
    const articleNum = match[1]
    // Buscar el artículo en el contenido
    const articlePattern = new RegExp(
      `(?:art[íi]culo|art\\.?)\\s+${articleNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'i'
    )
    if (articlePattern.test(content)) {
      foundArticles++
    }
  }

  const articleMatch = foundArticles > 0
  const confidence = articleMatch ? 1.0 : 0.5 // Reducir confianza si no se encuentra el artículo

  return {
    ...citationValidation,
    articleMatch,
    confidence,
    errorMessage: articleMatch ? undefined : `Artículo mencionado no encontrado en ${metadata.title}`
  }
}

/**
 * Valida todas las citas en una respuesta RAG
 */
export function validateCitations(
  answer: string,
  chunks: Array<{ chunk: DocumentChunk; score: number }>
): EvaluationResult {
  const citationRefs = extractCitationRefs(answer)
  
  if (citationRefs.length === 0) {
    return {
      totalCitations: 0,
      validCitations: 0,
      precision: 1.0, // Sin citas es técnicamente preciso (aunque no ideal)
      invalidCitations: [],
      validCitationsList: []
    }
  }

  const validations: CitationValidation[] = citationRefs.map(ref => {
    const validation = validateCitationRef(ref, chunks)
    return validateArticleMentions(answer, validation, chunks)
  })

  const validCitations = validations.filter(v => v.isValid && v.articleMatch)
  const invalidCitations = validations.filter(v => !v.isValid || !v.articleMatch)

  return {
    totalCitations: citationRefs.length,
    validCitations: validCitations.length,
    precision: citationRefs.length > 0 ? validCitations.length / citationRefs.length : 0,
    invalidCitations,
    validCitationsList: validCitations
  }
}

/**
 * Genera un reporte legible de la validación
 */
export function generateValidationReport(result: EvaluationResult): string {
  const lines: string[] = []
  
  lines.push('=== Reporte de Validación de Citas ===')
  lines.push(`Total de citas encontradas: ${result.totalCitations}`)
  lines.push(`Citas válidas: ${result.validCitations}`)
  lines.push(`Precisión: ${(result.precision * 100).toFixed(1)}%`)
  lines.push('')

  if (result.invalidCitations.length > 0) {
    lines.push('Citas inválidas:')
    result.invalidCitations.forEach(invalid => {
      lines.push(`  - ${invalid.citationRef}: ${invalid.errorMessage || 'No válida'}`)
      if (invalid.sourceTitle) {
        lines.push(`    Fuente: ${invalid.sourceTitle}`)
      }
    })
    lines.push('')
  }

  if (result.validCitationsList.length > 0) {
    lines.push('Citas válidas:')
    result.validCitationsList.forEach(valid => {
      lines.push(`  - ${valid.citationRef}: ${valid.sourceTitle || 'N/A'}`)
    })
  }

  return lines.join('\n')
}

