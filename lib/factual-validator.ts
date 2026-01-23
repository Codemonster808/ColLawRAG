import { type DocumentChunk } from './types'

export interface FactualValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
  validatedFacts: {
    articles: Array<{ article: string; exists: boolean; source: string }>
    numbers: Array<{ value: string; verified: boolean; source: string }>
    dates: Array<{ date: string; verified: boolean; source: string }>
  }
}

/**
 * Extrae referencias a artículos de un texto
 */
export function extractArticleReferences(text: string): string[] {
  const patterns = [
    /art[íi]culo\s+(\d+[a-z]?)/gi,
    /art\.\s*(\d+[a-z]?)/gi,
    /art\s+(\d+[a-z]?)/gi
  ]
  
  const articles: string[] = []
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      articles.push(match[1].toLowerCase())
    }
  }
  
  return [...new Set(articles)]
}

/**
 * Extrae números y porcentajes mencionados en un texto
 */
export function extractNumbers(text: string): Array<{ value: string; type: 'percentage' | 'number' | 'date' }> {
  const numbers: Array<{ value: string; type: 'percentage' | 'number' | 'date' }> = []
  
  // Porcentajes
  const percentagePattern = /(\d+(?:\.\d+)?)\s*%/gi
  const percentageMatches = text.matchAll(percentagePattern)
  for (const match of percentageMatches) {
    numbers.push({ value: match[1], type: 'percentage' })
  }
  
  // Números grandes (probablemente montos, plazos en días)
  const numberPattern = /\b(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\b/g
  const numberMatches = text.matchAll(numberPattern)
  for (const match of numberMatches) {
    const num = match[1].replace(/\./g, '')
    if (parseInt(num) > 10) { // Ignorar números pequeños
      numbers.push({ value: num, type: 'number' })
    }
  }
  
  // Fechas (años)
  const datePattern = /\b(19|20)\d{2}\b/g
  const dateMatches = text.matchAll(datePattern)
  for (const match of dateMatches) {
    numbers.push({ value: match[0], type: 'date' })
  }
  
  return numbers
}

/**
 * Verifica si un artículo existe en un chunk
 */
export function verifyArticleInChunk(
  article: string,
  chunk: DocumentChunk
): { exists: boolean; matches: number } {
  const content = chunk.content.toLowerCase()
  const metadata = chunk.metadata
  
  // Buscar el artículo en el contenido
  const patterns = [
    new RegExp(`art[íi]culo\\s+${article.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
    new RegExp(`art\\.\\s*${article.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
    new RegExp(`art\\s+${article.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
  ]
  
  let matches = 0
  for (const pattern of patterns) {
    const found = content.match(pattern)
    if (found) {
      matches += found.length
    }
  }
  
  // También verificar metadata
  if (metadata.article) {
    const metaArticle = metadata.article.replace(/\D/g, '').toLowerCase()
    const searchArticle = article.replace(/\D/g, '').toLowerCase()
    if (metaArticle === searchArticle) {
      matches++
    }
  }
  
  return {
    exists: matches > 0,
    matches
  }
}

/**
 * Verifica si un número/porcentaje existe en los chunks
 */
export function verifyNumberInChunks(
  value: string,
  type: 'percentage' | 'number' | 'date',
  chunks: Array<{ chunk: DocumentChunk; score: number }>
): { verified: boolean; sources: string[] } {
  const sources: string[] = []
  
  for (const { chunk } of chunks) {
    const content = chunk.content
    
    if (type === 'percentage') {
      // Buscar porcentaje con tolerancia
      const pattern = new RegExp(`(${value}(?:\\.\\d+)?)\\s*%`, 'i')
      if (pattern.test(content)) {
        sources.push(chunk.metadata.title)
      }
    } else if (type === 'number') {
      // Buscar número (con diferentes formatos)
      const normalizedValue = value.replace(/\./g, '')
      const patterns = [
        new RegExp(`\\b${normalizedValue}\\b`),
        new RegExp(normalizedValue.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1\\.')) // Formato con puntos
      ]
      
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          sources.push(chunk.metadata.title)
          break
        }
      }
    } else if (type === 'date') {
      // Buscar año
      if (content.includes(value)) {
        sources.push(chunk.metadata.title)
      }
    }
  }
  
  return {
    verified: sources.length > 0,
    sources
  }
}

/**
 * Valida factualmente una respuesta contra los chunks recuperados
 */
export function validateFactual(
  answer: string,
  chunks: Array<{ chunk: DocumentChunk; score: number }>
): FactualValidation {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Extraer artículos mencionados
  const articleRefs = extractArticleReferences(answer)
  const validatedArticles: Array<{ article: string; exists: boolean; source: string }> = []
  
  for (const article of articleRefs) {
    let found = false
    let source = ''
    
    for (const chunkWithScore of chunks) {
      const chunk = 'chunk' in chunkWithScore ? chunkWithScore.chunk : chunkWithScore
      const verification = verifyArticleInChunk(article, chunk)
      if (verification.exists) {
        found = true
        source = chunk.metadata.title
        break
      }
    }
    
    validatedArticles.push({
      article,
      exists: found,
      source: found ? source : 'No encontrado'
    })
    
    if (!found) {
      warnings.push(`Artículo ${article} mencionado pero no encontrado en las fuentes proporcionadas`)
    }
  }
  
  // Extraer y validar números/porcentajes
  const numbers = extractNumbers(answer)
  const validatedNumbers: Array<{ value: string; verified: boolean; source: string }> = []
  
  for (const num of numbers) {
    const verification = verifyNumberInChunks(num.value, num.type, chunks)
    validatedNumbers.push({
      value: `${num.value}${num.type === 'percentage' ? '%' : ''}`,
      verified: verification.verified,
      source: verification.sources.join(', ') || 'No encontrado'
    })
    
    if (!verification.verified && num.type === 'percentage') {
      warnings.push(`Porcentaje ${num.value}% mencionado pero no verificado en las fuentes`)
    }
  }
  
  // Validar fechas (años)
  const dates: Array<{ date: string; verified: boolean; source: string }> = []
  const yearRefs = numbers.filter(n => n.type === 'date')
  for (const year of yearRefs) {
    const verification = verifyNumberInChunks(year.value, 'date', chunks)
    dates.push({
      date: year.value,
      verified: verification.verified,
      source: verification.sources.join(', ') || 'No encontrado'
    })
  }
  
  // Determinar si es válido (sin errores críticos)
  const isValid = errors.length === 0 && validatedArticles.every(a => a.exists)
  
  return {
    isValid,
    errors,
    warnings,
    validatedFacts: {
      articles: validatedArticles,
      numbers: validatedNumbers,
      dates
    }
  }
}

/**
 * Genera un reporte de validación factual
 */
export function generateFactualReport(validation: FactualValidation): string {
  const lines: string[] = []
  
  lines.push('=== Validación Factual ===')
  lines.push(`Estado: ${validation.isValid ? '✅ VÁLIDO' : '⚠️ CON ADVERTENCIAS'}`)
  lines.push('')
  
  if (validation.validatedFacts.articles.length > 0) {
    lines.push('Artículos mencionados:')
    for (const art of validation.validatedFacts.articles) {
      const status = art.exists ? '✅' : '❌'
      lines.push(`  ${status} Artículo ${art.article}: ${art.source}`)
    }
    lines.push('')
  }
  
  if (validation.validatedFacts.numbers.length > 0) {
    lines.push('Números/porcentajes mencionados:')
    for (const num of validation.validatedFacts.numbers) {
      const status = num.verified ? '✅' : '⚠️'
      lines.push(`  ${status} ${num.value}: ${num.source}`)
    }
    lines.push('')
  }
  
  if (validation.warnings.length > 0) {
    lines.push('Advertencias:')
    for (const warning of validation.warnings) {
      lines.push(`  ⚠️ ${warning}`)
    }
    lines.push('')
  }
  
  if (validation.errors.length > 0) {
    lines.push('Errores:')
    for (const error of validation.errors) {
      lines.push(`  ❌ ${error}`)
    }
  }
  
  return lines.join('\n')
}

