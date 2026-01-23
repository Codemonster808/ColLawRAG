import { type DocumentChunk } from './types'

export type LegalArea = 
  | 'laboral' 
  | 'comercial' 
  | 'civil' 
  | 'penal' 
  | 'administrativo' 
  | 'tributario' 
  | 'constitucional'
  | 'general'

export interface PromptContext {
  query: string
  chunks: Array<{ chunk: DocumentChunk; score: number }>
  legalArea?: LegalArea
  maxCitations: number
  includeWarnings: boolean
  complexity: 'baja' | 'media' | 'alta'
}

/**
 * Detecta el área legal de una consulta
 */
export function detectLegalArea(query: string): LegalArea {
  const lowerQuery = query.toLowerCase()
  
  // Laboral
  if (lowerQuery.match(/\b(trabajo|empleado|empleador|contrato laboral|prestaciones|cesant[ií]as|vacaciones|despido|horas extras|jornada|salario)\b/)) {
    return 'laboral'
  }
  
  // Comercial
  if (lowerQuery.match(/\b(comercio|sociedad|empresa|contrato comercial|compraventa|arrendamiento comercial)\b/)) {
    return 'comercial'
  }
  
  // Civil
  if (lowerQuery.match(/\b(contrato civil|propiedad|sucesi[oó]n|divorcio|patrimonio|obligaciones)\b/)) {
    return 'civil'
  }
  
  // Penal
  if (lowerQuery.match(/\b(delito|pena|c[oó]digo penal|crimen|homicidio|robo|fraude)\b/)) {
    return 'penal'
  }
  
  // Administrativo
  if (lowerQuery.match(/\b(acto administrativo|recurso|tutela|cumplimiento|entidad p[uú]blica|licencia)\b/)) {
    return 'administrativo'
  }
  
  // Tributario
  if (lowerQuery.match(/\b(impuesto|renta|iva|dian|declaraci[oó]n tributaria|retenci[oó]n)\b/)) {
    return 'tributario'
  }
  
  // Constitucional
  if (lowerQuery.match(/\b(constituci[oó]n|derechos fundamentales|acci[oó]n de tutela|corte constitucional)\b/)) {
    return 'constitucional'
  }
  
  return 'general'
}

/**
 * Genera advertencias legales según la complejidad
 */
export function generateLegalWarnings(complexity: 'baja' | 'media' | 'alta', legalArea: LegalArea): string {
  const warnings: string[] = []
  
  if (complexity === 'alta') {
    warnings.push('⚠️ ADVERTENCIA: Esta consulta involucra aspectos legales complejos que pueden requerir análisis específico de tu caso.')
    warnings.push('⚠️ Se recomienda consultar con un abogado especializado para obtener asesoría personalizada.')
  } else if (complexity === 'media') {
    warnings.push('⚠️ Esta información es de carácter general y puede no aplicarse a tu situación específica.')
  }
  
  if (legalArea === 'laboral' || legalArea === 'penal') {
    warnings.push('⚠️ Los plazos legales son críticos. Verifica los términos de prescripción aplicables a tu caso.')
  }
  
  if (legalArea === 'tributario') {
    warnings.push('⚠️ La normativa tributaria cambia frecuentemente. Verifica la vigencia de las normas citadas.')
  }
  
  return warnings.length > 0 ? '\n\n' + warnings.join('\n') : ''
}

/**
 * Genera el prompt del sistema especializado por área legal
 */
export function generateSystemPrompt(legalArea: LegalArea, maxCitations: number): string {
  const areaPrompts: Record<LegalArea, string> = {
    laboral: `Eres un abogado laboralista especializado en derecho del trabajo colombiano. Tu expertise incluye:
- Código Sustantivo del Trabajo y sus decretos reglamentarios
- Jurisprudencia de la Corte Constitucional y Corte Suprema en materia laboral
- Prestaciones sociales, jornadas laborales, y relaciones laborales
- Procedimientos ante el Ministerio del Trabajo y jurisdicción laboral`,
    
    comercial: `Eres un abogado comercialista especializado en derecho comercial colombiano. Tu expertise incluye:
- Código de Comercio y leyes comerciales especiales
- Sociedades comerciales y contratos mercantiles
- Jurisprudencia comercial de la Corte Suprema
- Regulación de entidades financieras y superintendencias`,
    
    civil: `Eres un abogado civilista especializado en derecho civil colombiano. Tu expertise incluye:
- Código Civil y leyes civiles
- Contratos, propiedad, y sucesiones
- Responsabilidad civil y obligaciones
- Jurisprudencia civil de la Corte Suprema`,
    
    penal: `Eres un abogado penalista especializado en derecho penal colombiano. Tu expertise incluye:
- Código Penal y leyes penales especiales
- Procedimiento penal y garantías procesales
- Jurisprudencia penal de la Corte Suprema
- Sistema de responsabilidad penal`,
    
    administrativo: `Eres un abogado administrativista especializado en derecho administrativo colombiano. Tu expertise incluye:
- Actos administrativos y procedimientos administrativos
- Acciones constitucionales (tutela, cumplimiento, populares)
- Jurisprudencia del Consejo de Estado y Corte Constitucional
- Contratación estatal y función pública`,
    
    tributario: `Eres un abogado tributario especializado en derecho tributario colombiano. Tu expertise incluye:
- Estatuto Tributario y normas tributarias
- Jurisprudencia del Consejo de Estado en materia tributaria
- Procedimientos ante la DIAN
- Planeación tributaria y cumplimiento`,
    
    constitucional: `Eres un abogado constitucionalista especializado en derecho constitucional colombiano. Tu expertise incluye:
- Constitución Política y bloque de constitucionalidad
- Jurisprudencia de la Corte Constitucional
- Acciones constitucionales y mecanismos de protección
- Control de constitucionalidad`,
    
    general: `Eres un abogado especializado en la normativa colombiana con conocimiento integral del ordenamiento jurídico.`
  }
  
  const basePrompt = areaPrompts[legalArea]
  
  return `${basePrompt}

INSTRUCCIONES CRÍTICAS:
1. Estructura tu respuesta como un dictamen legal profesional con las siguientes secciones:
   - HECHOS RELEVANTES: Identifica los hechos clave de la consulta
   - NORMAS APLICABLES: Cita las normas legales relevantes con referencias [1], [2], etc.
   - ANÁLISIS JURÍDICO: Aplica las normas a los hechos específicos
   - CONCLUSIÓN: Resume la respuesta legal
   - RECOMENDACIÓN: Proporciona pasos concretos a seguir (si aplica)

2. CITAS: Solo puedes citar fuentes del 1 al ${maxCitations}. NUNCA cites fuera de este rango.
   - Si necesitas más fuentes, indica que la información disponible es limitada
   - Cada cita debe ser relevante y precisa

3. PRECISIÓN:
   - Verifica que los artículos citados existan realmente en las fuentes
   - Si mencionas números o porcentajes, deben ser exactos según las fuentes
   - Si hay contradicciones entre fuentes, menciónalas explícitamente

4. LENGUAJE:
   - Usa español jurídico claro y preciso
   - Evita jerga innecesaria pero mantén precisión técnica
   - Sé específico: menciona plazos exactos, documentos necesarios, entidades competentes

5. LIMITACIONES:
   - Si la información disponible es insuficiente, indícalo claramente
   - No inventes información que no esté en las fuentes proporcionadas
   - Si el caso requiere análisis específico, recomienda asesoría profesional`
}

/**
 * Genera el prompt del usuario con contexto estructurado
 */
export function generateUserPrompt(context: PromptContext): string {
  const { query, chunks, maxCitations, includeWarnings, complexity, legalArea } = context
  
  // Construir contexto con límite explícito de citas
  let contextBlocks = ''
  for (let i = 0; i < chunks.length && i < maxCitations; i++) {
    const r = chunks[i]
    const articleInfo = r.chunk.metadata.article 
      ? ` — ${r.chunk.metadata.article}` 
      : ''
    const chapterInfo = r.chunk.metadata.chapter 
      ? ` (${r.chunk.metadata.chapter})` 
      : ''
    const block = `Fuente [${i + 1}] (${r.chunk.metadata.title}${articleInfo}${chapterInfo}):\n${r.chunk.content}`
    contextBlocks += (i > 0 ? '\n\n' : '') + block
  }
  
  // Advertencia sobre límite de citas si hay más chunks disponibles
  const citationWarning = chunks.length > maxCitations
    ? `\n\n⚠️ NOTA: Solo se proporcionan las primeras ${maxCitations} fuentes más relevantes. Hay ${chunks.length - maxCitations} fuentes adicionales disponibles pero no están incluidas en este contexto.`
    : ''
  
  // Advertencias legales
  const warnings = includeWarnings && legalArea 
    ? generateLegalWarnings(complexity, legalArea)
    : ''
  
  return `CONSULTA LEGAL:
${query}

CONTEXTO LEGAL DISPONIBLE (${chunks.length} fuentes, usando primeras ${Math.min(chunks.length, maxCitations)}):
${contextBlocks}${citationWarning}

INSTRUCCIONES:
Responde como un abogado profesional especializado en ${legalArea || 'derecho colombiano'}, estructurando tu respuesta según el formato indicado.${warnings}

IMPORTANTE: Solo puedes citar fuentes del 1 al ${Math.min(chunks.length, maxCitations)}. Si necesitas más información, indica que la consulta requiere análisis adicional con más fuentes legales.`
}

/**
 * Detecta la complejidad de una consulta
 */
export function detectComplexity(query: string, chunksCount: number): 'baja' | 'media' | 'alta' {
  const lowerQuery = query.toLowerCase()
  
  // Indicadores de alta complejidad
  const highComplexityIndicators = [
    /\b(múltiples|varios|diferentes|complejo|conflicto|contradicci[oó]n)\b/,
    /\b(procedimiento|proceso|demanda|recurso|apelaci[oó]n)\b/,
    /\b(plazo|término|prescripci[oó]n|caducidad)\b/,
    /\?.*\?/ // Múltiples preguntas
  ]
  
  // Indicadores de media complejidad
  const mediumComplexityIndicators = [
    /\b(cómo|qué hacer|proceder|pasos)\b/,
    /\b(derecho|obligaci[oó]n|requisito)\b/
  ]
  
  const hasHighComplexity = highComplexityIndicators.some(pattern => pattern.test(lowerQuery))
  const hasMediumComplexity = mediumComplexityIndicators.some(pattern => pattern.test(lowerQuery))
  
  // Si hay pocas fuentes, aumenta la complejidad percibida
  const sourceComplexity = chunksCount < 5 ? 1 : chunksCount < 8 ? 0.5 : 0
  
  if (hasHighComplexity || sourceComplexity > 0.5) {
    return 'alta'
  }
  
  if (hasMediumComplexity || sourceComplexity > 0) {
    return 'media'
  }
  
  return 'baja'
}

/**
 * Genera prompts completos para el modelo de generación
 */
export function generatePrompts(context: PromptContext): {
  systemPrompt: string
  userPrompt: string
} {
  const legalArea = context.legalArea || detectLegalArea(context.query)
  const complexity = context.complexity || detectComplexity(context.query, context.chunks.length)
  
  const updatedContext = {
    ...context,
    legalArea,
    complexity
  }
  
  return {
    systemPrompt: generateSystemPrompt(legalArea, context.maxCitations),
    userPrompt: generateUserPrompt(updatedContext)
  }
}

