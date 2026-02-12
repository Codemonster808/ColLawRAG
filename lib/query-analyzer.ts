/**
 * Utilidades para analizar consultas y extraer metadata
 */

/**
 * Detecta el área legal de una consulta
 */
export function detectLegalArea(query: string): string | undefined {
  const lowerQuery = query.toLowerCase()
  
  // Áreas legales comunes en Colombia
  const areas: Record<string, string[]> = {
    'constitucional': ['constitución', 'constitucional', 'derechos fundamentales', 'tutela', 'acción de tutela'],
    'laboral': ['laboral', 'trabajo', 'empleado', 'empleador', 'contrato de trabajo', 'horas extras', 'vacaciones', 'cesantías'],
    'seguridad_social': ['pensión', 'salud', 'eps', 'arl', 'seguridad social', 'afp', 'embargable'],
    'tributario': ['impuesto', 'renta', 'iva', 'retefuente', 'dian', 'factura', 'tributario'],
    'comercial': ['sociedad', 'empresa', 'comercio', 'contrato', 'compraventa', 'arrendamiento'],
    'civil': ['derecho civil', 'propiedad', 'sucesión', 'divorcio', 'patrimonio'],
    'penal': ['penal', 'delito', 'cárcel', 'prisión', 'homicidio', 'robo'],
    'administrativo': ['administrativo', 'licencia', 'permiso', 'trámite', 'procedimiento administrativo'],
    'familia': ['familia', 'matrimonio', 'divorcio', 'alimentos', 'patria potestad'],
    'procesal': ['proceso', 'demanda', 'sentencia', 'recurso', 'apelación', 'casación']
  }
  
  for (const [area, keywords] of Object.entries(areas)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      return area
    }
  }
  
  return undefined
}

/**
 * Detecta la complejidad de una consulta
 */
export function detectComplexity(query: string): 'simple' | 'medium' | 'complex' {
  const wordCount = query.split(/\s+/).length
  const hasMultipleQuestions = (query.match(/\?/g) || []).length > 1
  const hasConjunctions = /\b(y|o|pero|aunque|además|también|sin embargo)\b/i.test(query)
  const hasConditionals = /\b(si|cuando|mientras|aunque|siempre que)\b/i.test(query)
  
  // Consultas complejas: múltiples preguntas, muchas palabras, condicionales
  if (hasMultipleQuestions || wordCount > 30 || (hasConjunctions && hasConditionals)) {
    return 'complex'
  }
  
  // Consultas simples: pocas palabras, una sola pregunta
  if (wordCount < 10 && !hasConjunctions) {
    return 'simple'
  }
  
  // Por defecto, media complejidad
  return 'medium'
}

/**
 * Calcula precisión de citas basado en respuesta y chunks
 */
export function calculateCitationPrecision(
  answer: string,
  citations: Array<{ id: string; title: string }>
): {
  totalCitations: number
  validCitations: number
  precision: number
  invalidCitations: Array<{ citation: string; reason: string }>
} {
  // Extraer referencias [1], [2], etc.
  const citationPattern = /\[(\d+)\]/g
  const matches = answer.matchAll(citationPattern)
  const citationNumbers = Array.from(matches, m => parseInt(m[1], 10))
  
  const totalCitations = citationNumbers.length
  const validCitations = citationNumbers.filter(num => num > 0 && num <= citations.length).length
  const invalidCitations: Array<{ citation: string; reason: string }> = []
  
  for (const num of citationNumbers) {
    if (num <= 0 || num > citations.length) {
      invalidCitations.push({
        citation: `[${num}]`,
        reason: num <= 0 ? 'Cita fuera de rango (índice inválido)' : `Cita fuera de rango (solo hay ${citations.length} fuentes)`
      })
    }
  }
  
  const precision = totalCitations > 0 ? validCitations / totalCitations : 1.0
  
  return {
    totalCitations,
    validCitations,
    precision,
    invalidCitations
  }
}
