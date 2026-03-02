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
  const lowerQuery = (query ?? '').toLowerCase()
  
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
 * Genera advertencias legales según la complejidad y el área legal
 */
export function generateLegalWarnings(complexity: 'baja' | 'media' | 'alta', legalArea: LegalArea): string {
  const warnings: string[] = []

  // Advertencias por complejidad (existentes)
  if (complexity === 'alta') {
    warnings.push('⚠️ ADVERTENCIA: Esta consulta involucra aspectos legales complejos que pueden requerir análisis específico de tu caso.')
    warnings.push('⚠️ Se recomienda consultar con un abogado especializado para obtener asesoría personalizada.')
  } else if (complexity === 'media') {
    warnings.push('⚠️ Esta información es de carácter general y puede no aplicarse a tu situación específica.')
  }

  // Advertencias específicas por área legal (refinadas y ampliadas)
  switch (legalArea) {
    case 'laboral':
      warnings.push('⚠️ LABORAL - PLAZOS CRÍTICOS:')
      warnings.push('   • Prescripción de derechos laborales: 3 años desde la terminación del contrato')
      warnings.push('   • Fuero de maternidad: 4 meses antes y 6 después del parto')
      warnings.push('   • Preaviso de terminación: mínimo 30 días (contratos término fijo)')
      warnings.push('   • Consulta con un abogado laboralista antes de firmar cualquier documento de terminación')
      break
      
    case 'penal':
      warnings.push('⚠️ PENAL - GARANTÍAS PROCESALES:')
      warnings.push('   • Derecho a guardar silencio y a tener un abogado defensor')
      warnings.push('   • Prescripción de la acción penal: varía según el delito (5-20 años)')
      warnings.push('   • Término de captura: máximo 36 horas para presentación ante juez de control')
      warnings.push('   • URGENTE: Si estás bajo investigación penal, busca un abogado penalista de inmediato')
      break
      
    case 'tributario':
      warnings.push('⚠️ TRIBUTARIO - CAMBIOS FRECUENTES:')
      warnings.push('   • La normativa tributaria se reforma constantemente (anualmente)')
      warnings.push('   • Plazos DIAN: vencimientos por último dígito del NIT, calendario tributario anual')
      warnings.push('   • Términos de corrección: 1 año para declaraciones de renta, 2 años para solicitar devoluciones')
      warnings.push('   • Sanciones por extemporaneidad: desde 5% hasta 200% del impuesto')
      warnings.push('   • Verifica siempre la vigencia de las normas tributarias citadas')
      break
      
    case 'civil':
      warnings.push('⚠️ CIVIL - PRESCRIPCIÓN Y CADUCIDAD:')
      warnings.push('   • Prescripción ordinaria: 10 años (acciones reales sobre bienes inmuebles)')
      warnings.push('   • Prescripción de obligaciones: 3 años (acciones ejecutivas), 5 años (ordinarias)')
      warnings.push('   • Prescripción de responsabilidad civil extracontractual: 2 años desde el daño')
      warnings.push('   • En procesos de familia: términos especiales para divorcio, sucesiones, alimentos')
      warnings.push('   • Confirma los plazos aplicables a tu caso específico con un abogado civilista')
      break
      
    case 'administrativo':
      warnings.push('⚠️ ADMINISTRATIVO - TÉRMINOS PERENTORIOS:')
      warnings.push('   • Derecho de petición: respuesta en 15 días hábiles (general), 10 días (consultas)')
      warnings.push('   • Silencio administrativo positivo: opera a los 3 meses si la ley no dice lo contrario')
      warnings.push('   • Recurso de reposición: 10 días hábiles siguientes a la notificación del acto')
      warnings.push('   • Recurso de apelación: 10 días hábiles (o en subsidio con la reposición)')
      warnings.push('   • Demanda contencioso administrativa: 4 meses (actos generales), 30 días (tributarios)')
      warnings.push('   • Acción de nulidad simple: 5 años desde publicación del acto')
      warnings.push('   • NO DEJAR VENCER PLAZOS: son fatales y causan pérdida del derecho')
      break
      
    case 'constitucional':
      warnings.push('⚠️ CONSTITUCIONAL - INMEDIATEZ Y SUBSIDIARIEDAD:')
      warnings.push('   • Acción de tutela: debe presentarse en "término razonable" (usualmente 6 meses)')
      warnings.push('   • Principio de inmediatez: entre más tiempo pase desde la vulneración, menor procedencia')
      warnings.push('   • Respuesta del juez: máximo 10 días desde presentación de la tutela')
      warnings.push('   • Impugnación: 3 días hábiles desde notificación de la sentencia')
      warnings.push('   • Subsidiariedad: solo procede si no hay otro medio de defensa judicial (salvo perjuicio irremediable)')
      warnings.push('   • Cumplimiento de sentencia: 48 horas para iniciar cumplimiento de la orden')
      warnings.push('   • Si hay urgencia o peligro inminente, presenta la tutela de inmediato')
      break
      
    case 'comercial':
      warnings.push('⚠️ COMERCIAL - PLAZOS REGISTRALES Y CONTRACTUALES:')
      warnings.push('   • Registro de sociedades: 30 días desde escritura pública para efectos tributarios')
      warnings.push('   • Oposición a registro de marca: 30 días hábiles desde publicación en Gaceta')
      warnings.push('   • Prescripción de acciones cambiarias: 1-3 años según el título valor')
      warnings.push('   • Término de liquidación obligatoria de sociedades: varía según causal')
      warnings.push('   • Contratos comerciales: términos de entrega, penalidades y cláusulas de vencimiento son perentorios')
      warnings.push('   • Verifica términos de registro ante Cámara de Comercio y SIC')
      break
      
    case 'general':
      warnings.push('⚠️ ADVERTENCIAS GENERALES:')
      warnings.push('   • Verifica siempre la vigencia actual de las normas citadas')
      warnings.push('   • Los plazos procesales son fatales: su vencimiento causa pérdida del derecho')
      warnings.push('   • Esta información es orientativa, no sustituye asesoría jurídica personalizada')
      warnings.push('   • Consulta con un abogado especializado antes de tomar decisiones legales importantes')
      break
      
    default:
      break
  }

  return warnings.length > 0 ? '\n\n' + warnings.join('\n') : ''
}

/**
 * Genera el prompt del sistema especializado por área legal
 * FASE_4 4.2: Comprimido a ≤350 tokens; 4.4: ejemplo HNAC corto con secciones claras
 */
export function generateSystemPrompt(legalArea: LegalArea, maxCitations: number, complexity: 'baja' | 'media' | 'alta' = 'media'): string {
  const areaOneLine: Record<LegalArea, string> = {
    laboral: 'Eres abogado laboralista colombiano (CST, prestaciones, jurisprudencia laboral).',
    comercial: 'Eres abogado comercialista colombiano (Código de Comercio, sociedades, contratos).',
    civil: 'Eres abogado civilista colombiano (Código Civil, contratos, sucesiones).',
    penal: 'Eres abogado penalista colombiano (Código Penal, garantías procesales).',
    administrativo: 'Eres abogado administrativista colombiano (actos administrativos, tutela, Consejo de Estado).',
    tributario: 'Eres abogado tributario colombiano (Estatuto Tributario, DIAN).',
    constitucional: 'Eres abogado constitucionalista colombiano (CP, Corte Constitucional).',
    general: 'Eres abogado especializado en normativa colombiana.'
  }
  const base = areaOneLine[legalArea]
  const complexNote = complexity === 'alta' ? ' Consultas complejas: responde por partes, prioriza jerarquía Constitución > Ley > Decreto.' : ''
  const example = `
Ejemplo de formato (usa estos títulos exactos):
**HECHOS RELEVANTES:** [hechos clave de la consulta.]
**NORMAS APLICABLES:** [normas con citas [1], [2].]
**ANÁLISIS JURÍDICO:** [aplicación de normas a hechos.]
**CONCLUSIÓN:** [conclusión jurídica clara.]
**RECOMENDACIÓN:** [pasos concretos si aplica.]`
  return `${base}${complexNote}

Responde SIEMPRE con las secciones anteriores en este orden. Solo cita fuentes [1] a [${maxCitations}]. No inventes artículos que no estén en el contexto.${example}`
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
    const block = `Fuente [${i + 1}] (${r.chunk.metadata?.title}${articleInfo}${chapterInfo}):\n${r.chunk.content}`
    contextBlocks += (i > 0 ? '\n\n' : '') + block
  }
  
  // Advertencia sobre límite de citas si hay más chunks disponibles
  const citationWarning = chunks.length > maxCitations
    ? `\n\n⚠️ NOTA: Solo se proporcionan las primeras ${maxCitations} fuentes más relevantes. Hay ${chunks.length - maxCitations} fuentes adicionales disponibles pero no están incluidas en este contexto.`
    : ''

  // Lista de artículos disponibles en las fuentes (para reducir alucinaciones)
  const availableArticles = chunks
    .slice(0, maxCitations)
    .map(r => r.chunk.metadata.article)
    .filter(Boolean)
  const articlesList = availableArticles.length > 0
    ? `\n\n📋 ARTÍCULOS DISPONIBLES EN LAS FUENTES (solo cita estos): ${[...new Set(availableArticles)].join(', ')}`
    : ''
  
  // Advertencias legales
  const warnings = includeWarnings && legalArea 
    ? generateLegalWarnings(complexity, legalArea)
    : ''
  
  // Instrucciones adicionales para consultas complejas
  const complexInstructions = complexity === 'alta' ? `

INSTRUCCIONES ESPECIALES PARA CONSULTA COMPLEJA:
- Si la consulta tiene múltiples partes o preguntas, responde cada una de forma estructurada
- Si es una consulta comparativa, organiza la respuesta comparando punto por punto
- Si es una consulta procedimental, detalla TODOS los pasos, plazos y requisitos en orden
- Si hay información contradictoria entre fuentes, explícala y prioriza según jerarquía legal
- Si la consulta requiere información de múltiples áreas, integra la información de forma coherente
- Asegúrate de cubrir TODOS los aspectos mencionados en la consulta` : ''
  
  return `CONSULTA LEGAL:
${query}

CONTEXTO LEGAL DISPONIBLE (${chunks.length} fuentes, usando primeras ${Math.min(chunks.length, maxCitations)}):
${contextBlocks}${citationWarning}

INSTRUCCIONES:
Responde como un abogado profesional especializado en ${legalArea || 'derecho colombiano'}, estructurando tu respuesta según el formato indicado.${warnings}${complexInstructions}

IMPORTANTE: Solo puedes citar fuentes del 1 al ${Math.min(chunks.length, maxCitations)}. Solo menciona artículos que aparezcan en el contexto; no inventes normas. Si necesitas más información, indica que la consulta requiere análisis adicional con más fuentes legales.${articlesList}`
}

/**
 * Detecta la complejidad de una consulta con análisis más sofisticado
 * FASE 0 - Tarea 0.2: Refactorizado para no requerir chunksCount (elimina doble retrieval)
 */
export function detectComplexity(query: string): 'baja' | 'media' | 'alta' {
  const lowerQuery = (query ?? '').toLowerCase()
  
  // Contador de indicadores de complejidad
  let complexityScore = 0
  
  // Indicadores de alta complejidad (peso 2)
  const highComplexityIndicators = [
    /\b(múltiples|varios|diferentes|complejo|conflicto|contradicci[oó]n|comparar|comparaci[oó]n)\b/,
    /\b(procedimiento\s+completo|proceso\s+completo|demanda|recurso|apelaci[oó]n|impugnaci[oó]n)\b/,
    /\b(plazo|término|prescripci[oó]n|caducidad|vencimiento)\b/,
    /\?.*\?/, // Múltiples preguntas
    /\b(incluyendo|además|también|así como|y\s+(requisitos|plazos|efectos|recursos))\b/, // Consultas multi-parte
    /\b(versus|vs\.|contra|frente a|diferencia entre)\b/, // Consultas comparativas
    /\b(todos los|todas las|completo|integral|exhaustivo)\b/, // Consultas que requieren información completa
    /\b(jurisprudencia|sentencia|fallo|criterio|doctrina)\b/, // Requiere análisis jurisprudencial
  ]
  
  // Indicadores de media complejidad (peso 1)
  const mediumComplexityIndicators = [
    /\b(cómo|qué hacer|proceder|pasos|requisitos)\b/,
    /\b(derecho|obligaci[oó]n|requisito|documento)\b/,
    /\b(cuándo|dónde|quién|cuál es el)\b/,
  ]
  
  // Contar indicadores de alta complejidad
  highComplexityIndicators.forEach(pattern => {
    if (pattern.test(lowerQuery)) {
      complexityScore += 2
    }
  })
  
  // Contar indicadores de media complejidad
  mediumComplexityIndicators.forEach(pattern => {
    if (pattern.test(lowerQuery)) {
      complexityScore += 1
    }
  })
  
  // Detectar consultas comparativas (muy complejas)
  if (/\b(comparar|comparaci[oó]n|versus|vs\.|diferencia|diferencias|similitud|similitudes)\b/.test(lowerQuery)) {
    complexityScore += 3
  }
  
  // Detectar consultas procedimentales completas
  if (/\b(procedimiento\s+completo|proceso\s+completo|pasos\s+completos|etapas)\b/.test(lowerQuery)) {
    complexityScore += 2
  }
  
  // Detectar múltiples preguntas en una sola consulta
  const questionCount = (lowerQuery.match(/\?/g) || []).length
  if (questionCount > 1) {
    complexityScore += 2
  }
  
  // Detectar consultas que requieren múltiples áreas legales
  const legalAreas = ['laboral', 'comercial', 'civil', 'penal', 'administrativo', 'tributario', 'constitucional']
  const areasMentioned = legalAreas.filter(area => {
    const patterns: Record<string, RegExp[]> = {
      laboral: [/\b(trabajo|empleado|contrato laboral|prestaciones)\b/],
      comercial: [/\b(comercio|sociedad|empresa|contrato comercial)\b/],
      civil: [/\b(contrato civil|propiedad|sucesi[oó]n|divorcio)\b/],
      penal: [/\b(delito|pena|c[oó]digo penal|crimen)\b/],
      administrativo: [/\b(acto administrativo|recurso|tutela|entidad p[uú]blica)\b/],
      tributario: [/\b(impuesto|renta|iva|dian)\b/],
      constitucional: [/\b(constituci[oó]n|derechos fundamentales|acci[oó]n de tutela)\b/],
    }
    return patterns[area]?.some(pattern => pattern.test(lowerQuery)) || false
  })
  
  if (areasMentioned.length > 1) {
    complexityScore += 2 // Consultas multi-área son más complejas
  }
  
  // FASE 0 - Tarea 0.2: Eliminado ajuste por chunksCount para evitar doble retrieval
  // Anteriormente: const sourceComplexity = chunksCount < 5 ? 2 : chunksCount < 8 ? 1 : 0
  // La complejidad ahora se basa SOLO en características de la query
  
  // Longitud de la consulta (consultas largas suelen ser más complejas)
  if (query.length > 200) {
    complexityScore += 1
  }
  if (query.length > 400) {
    complexityScore += 1
  }
  
  // Clasificar según score
  if (complexityScore >= 5) {
    return 'alta'
  }
  
  if (complexityScore >= 2) {
    return 'media'
  }
  
  return 'baja'
}

/**
 * Genera prompts completos para el modelo de generación
 * FASE 0 - Tarea 0.2: Actualizado para usar detectComplexity sin chunksCount
 */
export function generatePrompts(context: PromptContext): {
  systemPrompt: string
  userPrompt: string
} {
  const legalArea = context.legalArea || detectLegalArea(context.query)
  const complexity = context.complexity || detectComplexity(context.query)
  
  const updatedContext = {
    ...context,
    legalArea,
    complexity
  }
  
  return {
    systemPrompt: generateSystemPrompt(legalArea, context.maxCitations, complexity),
    userPrompt: generateUserPrompt(updatedContext)
  }
}

