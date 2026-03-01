/**
 * FASE 1 - Tarea 1.3: Query Expansion (coloquial → legal)
 * 
 * Expande queries coloquiales del usuario a terminología legal colombiana
 * para mejorar recall en búsqueda BM25 y embeddings.
 * 
 * Objetivo: +20% Recall@5 en queries coloquiales
 */

// Diccionario coloquial → términos legales colombianos
const COLOQUIAL_TO_LEGAL: Record<string, string[]> = {
  // Laboral - Prestaciones
  'liquidación': ['prestaciones sociales', 'cesantías', 'indemnización', 'auxilio de cesantías'],
  'finiquito': ['liquidación laboral', 'prestaciones sociales', 'terminación contrato'],
  'plata al salir': ['liquidación', 'prestaciones sociales', 'cesantías', 'prima de servicios'],
  'cesantías': ['auxilio de cesantías', 'Art. 249 CST', 'prestaciones sociales'],
  'prima': ['prima de servicios', 'Art. 306 CST', 'prestaciones sociales'],
  'vacaciones': ['descanso remunerado', 'Art. 186 CST', 'vacaciones anuales'],
  
  // Laboral - Despido
  'me echaron': ['despido', 'terminación contrato', 'despido sin justa causa'],
  'me botaron': ['despido', 'terminación contrato laboral', 'despido injustificado'],
  'me despidieron': ['terminación contrato', 'despido sin justa causa', 'indemnización'],
  'renunciar': ['renuncia', 'retiro voluntario', 'terminación contrato'],
  
  // Laboral - Jornada
  'horas extras': ['trabajo suplementario', 'Art. 168 CST', 'recargo nocturno'],
  'trabajo de noche': ['jornada nocturna', 'recargo nocturno', 'Art. 168 CST'],
  'dominicales': ['trabajo dominical', 'recargo dominical y festivo', 'Art. 179 CST'],
  'festivos': ['trabajo en festivos', 'recargo dominical y festivo', 'descanso obligatorio'],
  
  // Laboral - Salario
  'sueldo mínimo': ['salario mínimo legal', 'salario mínimo vigente', 'Art. 145 CST'],
  'salario mínimo': ['salario mínimo legal vigente', 'SMLV', 'Art. 145 CST'],
  'pago': ['remuneración', 'salario', 'contraprestación'],
  
  // Pensión y Seguridad Social
  'pensión': ['pensión de vejez', 'régimen pensional', 'Ley 100 de 1993'],
  'pensionarse': ['pensión de vejez', 'requisitos pensión', 'edad pensional'],
  'eps': ['Entidad Promotora de Salud', 'régimen contributivo', 'afiliación salud'],
  'arl': ['Administradora de Riesgos Laborales', 'sistema de riesgos laborales'],
  
  // Civil - Familia
  'divorcio': ['disolución del vínculo matrimonial', 'causales de divorcio', 'Art. 154 CC'],
  'separarse': ['separación de cuerpos', 'divorcio', 'disolución matrimonial'],
  'pensión alimenticia': ['cuota alimentaria', 'alimentos', 'obligación alimentaria'],
  'alimentos': ['cuota alimentaria', 'pensión de alimentos', 'obligación alimentaria'],
  
  // Civil - Contratos
  'contrato': ['negocio jurídico', 'acuerdo de voluntades', 'obligación contractual'],
  'arrendar': ['contrato de arrendamiento', 'locación', 'arrendamiento'],
  'alquiler': ['arrendamiento', 'canon de arrendamiento', 'contrato de arriendo'],
  'vender': ['compraventa', 'enajenación', 'transferencia de dominio'],
  
  // Tributario
  'impuestos': ['tributos', 'obligación tributaria', 'impuesto de renta'],
  'dian': ['Dirección de Impuestos y Aduanas Nacionales', 'autoridad tributaria'],
  'renta': ['impuesto sobre la renta', 'declaración de renta', 'renta líquida'],
  'iva': ['impuesto sobre las ventas', 'IVA', 'tarifa general'],
  'ica': ['impuesto de industria y comercio', 'tributo municipal', 'Decreto 1333'],
  'declaración': ['declaración tributaria', 'declaración de renta', 'obligación fiscal'],
  'exención': ['beneficio tributario', 'exención fiscal', 'no gravado'],
  'retención': ['retención en la fuente', 'agente retenedor', 'retención fiscal'],
  
  // Penal
  'robo': ['hurto', 'apoderamiento', 'delito contra el patrimonio'],
  'hurto': ['delito de hurto', 'Art. 239 CP', 'apoderamiento ilícito'],
  'golpear': ['lesiones personales', 'violencia', 'agresión'],
  'matar': ['homicidio', 'delito contra la vida', 'Art. 103 CP'],
  'estafa': ['delito de estafa', 'fraude', 'Art. 246 CP'],
  'secuestro': ['privación de la libertad', 'secuestro extorsivo', 'Art. 168 CP'],
  
  // Administrativo
  'derecho de petición': ['solicitud administrativa', 'Art. 23 Constitución', 'petición respetuosa'],
  'tutela': ['acción de tutela', 'amparo constitucional', 'protección derechos fundamentales'],
  'demanda': ['acción judicial', 'demanda contenciosa', 'proceso judicial'],
  'recurso': ['recurso de reposición', 'recurso de apelación', 'medio de impugnación'],
  'notificación': ['notificación personal', 'comunicación oficial', 'notificación judicial'],
  
  // Procedimientos
  'plazo': ['término legal', 'término judicial', 'tiempo procesal'],
  'prueba': ['medio probatorio', 'prueba documental', 'prueba testimonial'],
  'sentencia': ['fallo judicial', 'providencia', 'decisión judicial'],
  'apelación': ['recurso de apelación', 'segunda instancia', 'impugnación'],
  
  // Otros
  'abogado': ['profesional del derecho', 'apoderado', 'defensor'],
  'juez': ['funcionario judicial', 'autoridad judicial', 'judicatura'],
  'corte': ['tribunal', 'Corte Suprema', 'Corte Constitucional'],
  'notario': ['notaría', 'escritura pública', 'fe pública'],
  'registro': ['registro civil', 'registro mercantil', 'inscripción registral'],
}

// Sinónimos legales (expansión dentro del dominio legal)
const LEGAL_SYNONYMS: Record<string, string[]> = {
  'trabajador': ['empleado', 'servidor', 'contratista'],
  'empleador': ['patrono', 'contratante', 'empresa'],
  'contrato laboral': ['contrato de trabajo', 'relación laboral', 'vínculo laboral'],
  'terminación': ['finalización', 'extinción', 'cesación'],
  'indemnización': ['compensación', 'reparación', 'resarcimiento'],
  'salario': ['remuneración', 'sueldo', 'honorarios'],
  'jornada laboral': ['horario de trabajo', 'jornada de trabajo', 'tiempo de trabajo'],
}

// Expansión por área legal (boost de términos relevantes)
const AREA_KEYWORDS: Record<string, string[]> = {
  'laboral': ['CST', 'Código Sustantivo del Trabajo', 'contrato de trabajo', 'empleador', 'trabajador'],
  'tributario': ['Estatuto Tributario', 'DIAN', 'impuesto', 'declaración', 'renta'],
  'civil': ['Código Civil', 'obligación', 'contrato', 'patrimonio', 'propiedad'],
  'penal': ['Código Penal', 'delito', 'pena', 'tipo penal', 'conducta punible'],
  'constitucional': ['Constitución', 'derechos fundamentales', 'tutela', 'control de constitucionalidad'],
  'administrativo': ['acto administrativo', 'CPACA', 'derecho de petición', 'contencioso administrativo'],
}

/**
 * Detecta el área legal predominante en una query
 */
export function detectLegalArea(query: string): string | null {
  const lowerQuery = query.toLowerCase()
  
  const scores: Record<string, number> = {
    laboral: 0,
    tributario: 0,
    civil: 0,
    penal: 0,
    constitucional: 0,
    administrativo: 0,
  }
  
  // Scoring basado en keywords de cada área
  for (const [area, keywords] of Object.entries(AREA_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        scores[area] += 1
      }
    }
  }
  
  // Scoring adicional basado en términos coloquiales
  for (const [coloquial, legals] of Object.entries(COLOQUIAL_TO_LEGAL)) {
    if (lowerQuery.includes(coloquial)) {
      // Inferir área por términos legales asociados
      const legalText = legals.join(' ').toLowerCase()
      if (legalText.includes('cst') || legalText.includes('laboral')) scores.laboral += 0.5
      if (legalText.includes('tributario') || legalText.includes('impuesto')) scores.tributario += 0.5
      if (legalText.includes('código civil')) scores.civil += 0.5
      if (legalText.includes('código penal') || legalText.includes('delito')) scores.penal += 0.5
    }
  }
  
  // Retornar área con mayor score (si supera umbral)
  const sortedAreas = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [topArea, topScore] = sortedAreas[0]
  
  return topScore >= 1 ? topArea : null
}

/**
 * Expande una query coloquial a terminología legal
 * 
 * Estrategia:
 * 1. Detectar términos coloquiales y agregar equivalentes legales
 * 2. Agregar sinónimos legales
 * 3. Si se detecta área legal, agregar términos clave del área (boost)
 * 
 * @param query Query original del usuario
 * @returns Query expandida (original + términos adicionales)
 */
export function expandQuery(query: string): string {
  const lowerQuery = query.toLowerCase()
  const expansionTerms: string[] = []
  
  // 1. Expandir términos coloquiales a legales
  for (const [coloquial, legals] of Object.entries(COLOQUIAL_TO_LEGAL)) {
    if (lowerQuery.includes(coloquial)) {
      expansionTerms.push(...legals)
    }
  }
  
  // 2. Agregar sinónimos legales
  for (const [term, synonyms] of Object.entries(LEGAL_SYNONYMS)) {
    if (lowerQuery.includes(term)) {
      expansionTerms.push(...synonyms)
    }
  }
  
  // 3. Boost por área legal detectada
  const detectedArea = detectLegalArea(query)
  if (detectedArea && AREA_KEYWORDS[detectedArea]) {
    // Agregar 2-3 términos clave del área (sin saturar)
    const areaTerms = AREA_KEYWORDS[detectedArea].slice(0, 3)
    expansionTerms.push(...areaTerms)
  }
  
  // Eliminar duplicados y construir query expandida
  const uniqueTerms = [...new Set(expansionTerms)]
  
  // Si no hay expansiones, retornar query original
  if (uniqueTerms.length === 0) {
    return query
  }
  
  // Query expandida: original + términos adicionales (con menor peso)
  // Formato: "query original [términos adicionales separados]"
  // Los términos adicionales se concatenan para que BM25 y embeddings los consideren
  const expandedQuery = `${query} ${uniqueTerms.join(' ')}`
  
  return expandedQuery
}

/**
 * Expande query y retorna metadata útil para debugging/logging
 */
export function expandQueryWithMetadata(query: string): {
  originalQuery: string
  expandedQuery: string
  addedTerms: string[]
  detectedArea: string | null
} {
  const lowerQuery = query.toLowerCase()
  const expansionTerms: string[] = []
  
  // Expandir términos coloquiales
  for (const [coloquial, legals] of Object.entries(COLOQUIAL_TO_LEGAL)) {
    if (lowerQuery.includes(coloquial)) {
      expansionTerms.push(...legals)
    }
  }
  
  // Agregar sinónimos legales
  for (const [term, synonyms] of Object.entries(LEGAL_SYNONYMS)) {
    if (lowerQuery.includes(term)) {
      expansionTerms.push(...synonyms)
    }
  }
  
  // Detectar área
  const detectedArea = detectLegalArea(query)
  if (detectedArea && AREA_KEYWORDS[detectedArea]) {
    const areaTerms = AREA_KEYWORDS[detectedArea].slice(0, 3)
    expansionTerms.push(...areaTerms)
  }
  
  const uniqueTerms = [...new Set(expansionTerms)]
  const expandedQuery = uniqueTerms.length > 0 ? `${query} ${uniqueTerms.join(' ')}` : query
  
  return {
    originalQuery: query,
    expandedQuery,
    addedTerms: uniqueTerms,
    detectedArea,
  }
}
