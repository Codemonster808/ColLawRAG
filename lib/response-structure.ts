import { type DocumentChunk } from './types'

export interface StructuredResponse {
  hechosRelevantes?: string
  normasAplicables?: string
  analisisJuridico?: string
  conclusion?: string
  recomendacion?: string
  advertencias?: string[]
}

/**
 * Intenta estructurar una respuesta libre en formato de dictamen legal
 */
export function structureResponse(
  answer: string,
  chunks: Array<{ chunk: DocumentChunk; score: number }>
): StructuredResponse {
  const structured: StructuredResponse = {}
  
  // Intentar detectar secciones en la respuesta
  const hechosMatch = answer.match(/(?:HECHOS|HECHOS RELEVANTES|SITUACI[OÓ]N)[:\s]+(.*?)(?=\n\n|NORMAS|AN[ÁA]LISIS|CONCLUSI[OÓ]N|RECOMENDACI[OÓ]N|$)/is)
  if (hechosMatch) {
    structured.hechosRelevantes = hechosMatch[1].trim()
  }
  
  const normasMatch = answer.match(/(?:NORMAS|NORMAS APLICABLES|MARCO LEGAL)[:\s]+(.*?)(?=\n\n|AN[ÁA]LISIS|CONCLUSI[OÓ]N|RECOMENDACI[OÓ]N|$)/is)
  if (normasMatch) {
    structured.normasAplicables = normasMatch[1].trim()
  }
  
  const analisisMatch = answer.match(/(?:AN[ÁA]LISIS|AN[ÁA]LISIS JUR[ÍI]DICO|APLICACI[OÓ]N)[:\s]+(.*?)(?=\n\n|CONCLUSI[OÓ]N|RECOMENDACI[OÓ]N|$)/is)
  if (analisisMatch) {
    structured.analisisJuridico = analisisMatch[1].trim()
  }
  
  const conclusionMatch = answer.match(/(?:CONCLUSI[OÓ]N|CONCLUSIONES)[:\s]+(.*?)(?=\n\n|RECOMENDACI[OÓ]N|$)/is)
  if (conclusionMatch) {
    structured.conclusion = conclusionMatch[1].trim()
  }
  
  const recomendacionMatch = answer.match(/(?:RECOMENDACI[OÓ]N|RECOMENDACIONES|PASOS)[:\s]+(.*?)$/is)
  if (recomendacionMatch) {
    structured.recomendacion = recomendacionMatch[1].trim()
  }
  
  // Si no se detectaron secciones, intentar dividir por párrafos
  if (!structured.hechosRelevantes && !structured.normasAplicables) {
    const paragraphs = answer.split(/\n\n+/).filter(p => p.trim().length > 0)
    
    if (paragraphs.length >= 2) {
      // Primer párrafo podría ser hechos o contexto
      structured.hechosRelevantes = paragraphs[0].trim()
      
      // Último párrafo podría ser conclusión o recomendación
      if (paragraphs.length >= 3) {
        structured.conclusion = paragraphs[paragraphs.length - 1].trim()
        structured.analisisJuridico = paragraphs.slice(1, -1).join('\n\n').trim()
      } else {
        structured.analisisJuridico = paragraphs.slice(1).join('\n\n').trim()
      }
    }
  }
  
  return structured
}

/**
 * Formatea una respuesta estructurada en texto legible
 */
export function formatStructuredResponse(structured: StructuredResponse): string {
  const sections: string[] = []
  
  if (structured.hechosRelevantes) {
    sections.push(`**HECHOS RELEVANTES:**\n${structured.hechosRelevantes}`)
  }
  
  if (structured.normasAplicables) {
    sections.push(`**NORMAS APLICABLES:**\n${structured.normasAplicables}`)
  }
  
  if (structured.analisisJuridico) {
    sections.push(`**ANÁLISIS JURÍDICO:**\n${structured.analisisJuridico}`)
  }
  
  if (structured.conclusion) {
    sections.push(`**CONCLUSIÓN:**\n${structured.conclusion}`)
  }
  
  if (structured.recomendacion) {
    sections.push(`**RECOMENDACIÓN:**\n${structured.recomendacion}`)
  }
  
  if (structured.advertencias && structured.advertencias.length > 0) {
    sections.push(`**ADVERTENCIAS:**\n${structured.advertencias.map(a => `⚠️ ${a}`).join('\n')}`)
  }
  
  return sections.join('\n\n')
}

/**
 * Valida que una respuesta estructurada tenga las secciones mínimas
 */
export function validateStructuredResponse(structured: StructuredResponse): {
  isValid: boolean
  missingSections: string[]
} {
  const required = ['analisisJuridico', 'conclusion']
  const missing: string[] = []
  
  for (const section of required) {
    if (!structured[section as keyof StructuredResponse]) {
      missing.push(section)
    }
  }
  
  return {
    isValid: missing.length === 0,
    missingSections: missing
  }
}

