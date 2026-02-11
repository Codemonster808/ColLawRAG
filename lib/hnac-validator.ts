/**
 * Validador de estructura HNAC (Hechos, Normas, Análisis, Conclusión)
 * Para forzar que todas las respuestas sigan el formato de dictamen legal profesional
 */

export interface HNACStructure {
  hechos?: string
  normas?: string
  analisis?: string
  conclusion?: string
  recomendacion?: string
}

export interface HNACValidationResult {
  isValid: boolean
  structure: HNACStructure
  missingSections: string[]
  quality: 'excelente' | 'buena' | 'regular' | 'insuficiente'
  score: number // 0-100
}

/**
 * Valida y extrae estructura HNAC de una respuesta
 */
export function validateHNACStructure(answer: string): HNACValidationResult {
  const structure: HNACStructure = {}
  const missingSections: string[] = []
  
  // Estrategia: Dividir por secciones usando marcadores claros
  // Buscar secciones usando múltiples estrategias
  
  // Estrategia 1: Buscar secciones con formato **SECCIÓN:**
  const sectionMarkers: Array<{ key: keyof HNACStructure; patterns: RegExp[] }> = [
    { key: 'hechos', patterns: [/\*\*HECHOS\s+RELEVANTES\*\*[:\s]*/i, /HECHOS\s+RELEVANTES[:\s]*/i] },
    { key: 'normas', patterns: [/\*\*NORMAS\s+APLICABLES\*\*[:\s]*/i, /NORMAS\s+APLICABLES[:\s]*/i] },
    { key: 'analisis', patterns: [/\*\*AN[ÁA]LISIS\s+JUR[ÍI]DICO\*\*[:\s]*/i, /AN[ÁA]LISIS\s+JUR[ÍI]DICO[:\s]*/i] },
    { key: 'conclusion', patterns: [/\*\*CONCLUSI[OÓ]N\*\*[:\s]*/i, /CONCLUSI[OÓ]N[:\s]*/i] },
    { key: 'recomendacion', patterns: [/\*\*RECOMENDACI[OÓ]N\*\*[:\s]*/i, /RECOMENDACI[OÓ]N[:\s]*/i] },
  ]
  
  // Encontrar posiciones de cada sección
  const sectionPositions: Array<{ key: keyof HNACStructure; start: number; end?: number }> = []
  
  for (const { key, patterns } of sectionMarkers) {
    for (const pattern of patterns) {
      const match = answer.match(pattern)
      if (match && match.index !== undefined) {
        sectionPositions.push({ key, start: match.index + match[0].length })
        break
      }
    }
  }
  
  // Ordenar por posición
  sectionPositions.sort((a, b) => a.start - b.start)
  
  // Extraer contenido de cada sección
  for (let i = 0; i < sectionPositions.length; i++) {
    const current = sectionPositions[i]
    const next = sectionPositions[i + 1]
    
    const start = current.start
    const end = next ? next.start : answer.length
    
    const content = answer.substring(start, end).trim()
    
    // Remover marcadores de siguiente sección si están al inicio
    const cleanedContent = content.replace(/^\*\*(?:NORMAS|AN[ÁA]LISIS|CONCLUSI[OÓ]N|RECOMENDACI[OÓ]N)\*\*[:\s]*/i, '').trim()
    
    if (cleanedContent.length > 0) {
      structure[current.key] = cleanedContent
    }
  }
  
  // Identificar secciones faltantes (requeridas: hechos, normas, analisis, conclusion)
  if (!structure.hechos || structure.hechos.length < 20) {
    missingSections.push('hechos')
  }
  if (!structure.normas || structure.normas.length < 20) {
    missingSections.push('normas')
  }
  if (!structure.analisis || structure.analisis.length < 30) {
    missingSections.push('analisis')
  }
  if (!structure.conclusion || structure.conclusion.length < 20) {
    missingSections.push('conclusion')
  }
  
  // Calcular score de calidad (0-100)
  let score = 0
  const sectionWeights = {
    hechos: 15,
    normas: 25,
    analisis: 35,
    conclusion: 20,
    recomendacion: 5, // Opcional pero mejora calidad
  }
  
  if (structure.hechos && structure.hechos.length >= 20) {
    score += sectionWeights.hechos
    if (structure.hechos.length >= 100) score += 5 // Bonus por detalle
  }
  
  if (structure.normas && structure.normas.length >= 20) {
    score += sectionWeights.normas
    // Bonus si tiene citas [1], [2], etc.
    if (/\d+/.test(structure.normas)) score += 5
  }
  
  if (structure.analisis && structure.analisis.length >= 30) {
    score += sectionWeights.analisis
    if (structure.analisis.length >= 200) score += 5 // Bonus por análisis detallado
  }
  
  if (structure.conclusion && structure.conclusion.length >= 20) {
    score += sectionWeights.conclusion
  }
  
  if (structure.recomendacion && structure.recomendacion.length >= 10) {
    score += sectionWeights.recomendacion
  }
  
  // Determinar calidad
  let quality: 'excelente' | 'buena' | 'regular' | 'insuficiente'
  if (score >= 90 && missingSections.length === 0) {
    quality = 'excelente'
  } else if (score >= 70 && missingSections.length <= 1) {
    quality = 'buena'
  } else if (score >= 50 && missingSections.length <= 2) {
    quality = 'regular'
  } else {
    quality = 'insuficiente'
  }
  
  const isValid = missingSections.length === 0 && score >= 70
  
  return {
    isValid,
    structure,
    missingSections,
    quality,
    score
  }
}

/**
 * Genera mensaje de error para re-generación cuando la estructura no es válida
 */
export function generateHNACErrorFeedback(validation: HNACValidationResult): string {
  const feedback: string[] = []
  
  if (validation.missingSections.length > 0) {
    feedback.push(`FALTAN SECCIONES REQUERIDAS: ${validation.missingSections.map(s => s.toUpperCase()).join(', ')}`)
  }
  
  if (validation.score < 70) {
    feedback.push(`CALIDAD INSUFICIENTE: Score ${validation.score}/100. Se requiere mínimo 70.`)
  }
  
  if (validation.quality === 'insuficiente') {
    feedback.push('La respuesta no cumple con el formato de dictamen legal profesional requerido.')
  }
  
  feedback.push('FORMATO REQUERIDO:')
  feedback.push('1. **HECHOS RELEVANTES**: Identificación clara de los hechos (mínimo 20 caracteres)')
  feedback.push('2. **NORMAS APLICABLES**: Normas y jurisprudencia con citas [1], [2], etc. (mínimo 20 caracteres)')
  feedback.push('3. **ANÁLISIS JURÍDICO**: Aplicación de normas a hechos (mínimo 30 caracteres)')
  feedback.push('4. **CONCLUSIÓN**: Conclusión jurídica clara (mínimo 20 caracteres)')
  feedback.push('5. **RECOMENDACIÓN**: Pasos concretos a seguir (opcional pero recomendado)')
  
  return feedback.join('\n')
}

/**
 * Mejora la extracción de secciones usando múltiples estrategias
 */
export function extractHNACSections(answer: string): HNACStructure {
  const validation = validateHNACStructure(answer)
  
  // Si la validación encontró estructura, usarla
  if (validation.structure.hechos || validation.structure.normas || validation.structure.analisis) {
    return validation.structure
  }
  
  // Fallback: dividir por párrafos y asignar por posición
  const paragraphs = answer.split(/\n\n+/).filter(p => p.trim().length > 0)
  
  const structure: HNACStructure = {}
  
  if (paragraphs.length >= 2) {
    // Primer párrafo: hechos o contexto
    structure.hechos = paragraphs[0].trim()
    
    // Último párrafo: conclusión
    if (paragraphs.length >= 3) {
      structure.conclusion = paragraphs[paragraphs.length - 1].trim()
      
      // Párrafos intermedios: normas y análisis
      const middleParagraphs = paragraphs.slice(1, -1)
      if (middleParagraphs.length >= 2) {
        // Buscar párrafo con citas [1], [2] para normas
        const normasIndex = middleParagraphs.findIndex(p => /\[\d+\]/.test(p))
        if (normasIndex >= 0) {
          structure.normas = middleParagraphs[normasIndex].trim()
          structure.analisis = middleParagraphs.filter((_, i) => i !== normasIndex).join('\n\n').trim()
        } else {
          // Dividir mitad y mitad
          const midPoint = Math.floor(middleParagraphs.length / 2)
          structure.normas = middleParagraphs.slice(0, midPoint).join('\n\n').trim()
          structure.analisis = middleParagraphs.slice(midPoint).join('\n\n').trim()
        }
      } else {
        structure.analisis = middleParagraphs.join('\n\n').trim()
      }
    } else {
      structure.analisis = paragraphs.slice(1).join('\n\n').trim()
    }
  } else if (paragraphs.length === 1) {
    // Si solo hay un párrafo, intentar dividirlo
    const text = paragraphs[0]
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    if (sentences.length >= 4) {
      const quarter = Math.floor(sentences.length / 4)
      structure.hechos = sentences.slice(0, quarter).join('. ').trim()
      structure.normas = sentences.slice(quarter, quarter * 2).join('. ').trim()
      structure.analisis = sentences.slice(quarter * 2, quarter * 3).join('. ').trim()
      structure.conclusion = sentences.slice(quarter * 3).join('. ').trim()
    } else {
      // Último recurso: asignar todo como análisis
      structure.analisis = text.trim()
    }
  }
  
  return structure
}
