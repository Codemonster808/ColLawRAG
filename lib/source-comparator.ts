import { type DocumentChunk } from './types'
import { getLegalHierarchyScore } from './reranking'
import { consultarVigencia, inferNormaIdFromTitle } from './norm-vigencia'

export interface Contradiction {
  source1: {
    chunk: DocumentChunk
    statement: string
    hierarchyScore: number
  }
  source2: {
    chunk: DocumentChunk
    statement: string
    hierarchyScore: number
  }
  topic: string
  severity: 'alta' | 'media' | 'baja'
  prevailingSource: 'source1' | 'source2' | 'indeterminado'
  explanation: string
}

export interface SourceComparisonResult {
  contradictions: Contradiction[]
  warnings: string[]
  hasConflicts: boolean
}

/**
 * Detecta contradicciones entre chunks recuperados
 * Compara información sobre el mismo tema y identifica conflictos
 */
export async function compareSources(
  chunks: Array<{ chunk: DocumentChunk; score: number }>,
  answer: string
): Promise<SourceComparisonResult> {
  const contradictions: Contradiction[] = []
  const warnings: string[] = []

  // Agrupar chunks por tema similar (usando embeddings o keywords)
  const topicGroups = groupChunksByTopic(chunks)

  // Comparar chunks dentro de cada grupo
  for (const group of topicGroups) {
    if (group.length < 2) continue

    // Comparar cada par de chunks en el grupo
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const chunk1 = group[i]
        const chunk2 = group[j]

        const contradiction = await detectContradiction(
          chunk1.chunk,
          chunk2.chunk,
          answer
        )

        if (contradiction) {
          contradictions.push(contradiction)
        }
      }
    }
  }

  // Generar advertencias basadas en contradicciones encontradas
  if (contradictions.length > 0) {
    const highSeverity = contradictions.filter(c => c.severity === 'alta')
    if (highSeverity.length > 0) {
      warnings.push(
        `⚠️ Se detectaron ${highSeverity.length} contradicción(es) de alta severidad entre las fuentes consultadas. Se recomienda verificar la información con un abogado especializado.`
      )
    }

    const mediumSeverity = contradictions.filter(c => c.severity === 'media')
    if (mediumSeverity.length > 0) {
      warnings.push(
        `⚠️ Se encontraron ${mediumSeverity.length} diferencia(s) entre las fuentes que requieren atención.`
      )
    }
  }

  return {
    contradictions,
    warnings,
    hasConflicts: contradictions.length > 0
  }
}

/**
 * Agrupa chunks por tema similar
 * Usa keywords y similitud de contenido para agrupar
 */
function groupChunksByTopic(
  chunks: Array<{ chunk: DocumentChunk; score: number }>
): Array<Array<{ chunk: DocumentChunk; score: number }>> {
  const groups: Array<Array<{ chunk: DocumentChunk; score: number }>> = []
  const processed = new Set<number>()

  for (let i = 0; i < chunks.length; i++) {
    if (processed.has(i)) continue

    const group: Array<{ chunk: DocumentChunk; score: number }> = [chunks[i]]
    processed.add(i)

    // Buscar chunks similares
    const keywords1 = extractKeywords(chunks[i].chunk.content)
    const title1 = chunks[i].chunk.metadata.title.toLowerCase()

    for (let j = i + 1; j < chunks.length; j++) {
      if (processed.has(j)) continue

      const keywords2 = extractKeywords(chunks[j].chunk.content)
      const title2 = chunks[j].chunk.metadata.title.toLowerCase()

      // Verificar similitud de tema
      const similarity = calculateTopicSimilarity(keywords1, keywords2, title1, title2)

      if (similarity > 0.3) {
        group.push(chunks[j])
        processed.add(j)
      }
    }

    if (group.length > 0) {
      groups.push(group)
    }
  }

  return groups
}

/**
 * Extrae keywords relevantes del contenido
 */
function extractKeywords(content: string): Set<string> {
  const keywords = new Set<string>()
  const lowerContent = content.toLowerCase()

  // Palabras legales comunes
  const legalTerms = [
    'artículo', 'art', 'norma', 'ley', 'decreto', 'resolución',
    'derecho', 'obligación', 'prohibición', 'requisito', 'procedimiento',
    'plazo', 'término', 'sanción', 'pena', 'multa', 'responsabilidad',
    'contrato', 'acuerdo', 'convenio', 'tutela', 'acción', 'recurso'
  ]

  for (const term of legalTerms) {
    if (lowerContent.includes(term)) {
      keywords.add(term)
    }
  }

  // Extraer números (artículos, plazos, etc.)
  const numbers = lowerContent.match(/\b\d+\b/g)
  if (numbers) {
    numbers.forEach(n => keywords.add(n))
  }

  return keywords
}

/**
 * Calcula similitud de tema entre dos chunks
 */
function calculateTopicSimilarity(
  keywords1: Set<string>,
  keywords2: Set<string>,
  title1: string,
  title2: string
): number {
  // Similitud de keywords
  const keywords1Array = Array.from(keywords1)
  const keywords2Array = Array.from(keywords2)
  const intersection = new Set(keywords1Array.filter(k => keywords2.has(k)))
  const union = new Set([...keywords1Array, ...keywords2Array])
  const keywordSimilarity = union.size > 0 ? intersection.size / union.size : 0

  // Similitud de títulos (palabras comunes)
  const titleWords1 = new Set(title1.split(/\s+/))
  const titleWords2 = new Set(title2.split(/\s+/))
  const titleWords1Array = Array.from(titleWords1)
  const titleWords2Array = Array.from(titleWords2)
  const titleIntersection = new Set(titleWords1Array.filter(w => titleWords2.has(w)))
  const titleUnion = new Set([...titleWords1Array, ...titleWords2Array])
  const titleSimilarity = titleUnion.size > 0 ? titleIntersection.size / titleUnion.size : 0

  // Combinar similitudes (peso 70% keywords, 30% título)
  return keywordSimilarity * 0.7 + titleSimilarity * 0.3
}

/**
 * Detecta contradicción entre dos chunks
 */
async function detectContradiction(
  chunk1: DocumentChunk,
  chunk2: DocumentChunk,
  answer: string
): Promise<Contradiction | null> {
  // Extraer afirmaciones clave de cada chunk
  const statements1 = extractStatements(chunk1.content)
  const statements2 = extractStatements(chunk2.content)

  // Comparar afirmaciones
  for (const stmt1 of statements1) {
    for (const stmt2 of statements2) {
      const contradiction = await compareStatements(
        stmt1,
        stmt2,
        chunk1,
        chunk2
      )

      if (contradiction) {
        return contradiction
      }
    }
  }

  return null
}

/**
 * Extrae afirmaciones clave del contenido
 */
function extractStatements(content: string): string[] {
  const statements: string[] = []
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20)

  // Filtrar oraciones que contienen información normativa
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase()
    if (
      lower.includes('debe') ||
      lower.includes('debe ser') ||
      lower.includes('está prohibido') ||
      lower.includes('no puede') ||
      lower.includes('requiere') ||
      lower.includes('obligatorio') ||
      lower.includes('procedimiento') ||
      lower.includes('plazo') ||
      lower.match(/\b\d+\s*(días|meses|años)\b/)
    ) {
      statements.push(sentence.trim())
    }
  }

  return statements.slice(0, 5) // Limitar a 5 afirmaciones más relevantes
}

/**
 * Compara dos afirmaciones para detectar contradicción
 */
async function compareStatements(
  statement1: string,
  statement2: string,
  chunk1: DocumentChunk,
  chunk2: DocumentChunk
): Promise<Contradiction | null> {
  // Detectar contradicciones simples
  const contradiction = detectSimpleContradiction(statement1, statement2)

  if (!contradiction) {
    return null
  }

  // Calcular jerarquía de cada fuente
  const hierarchy1 = getLegalHierarchyScore(chunk1)
  const hierarchy2 = getLegalHierarchyScore(chunk2)

  // Verificar vigencia
  const vigencia1 = await consultarVigencia(inferNormaIdFromTitle(chunk1.metadata.title))
  const vigencia2 = await consultarVigencia(inferNormaIdFromTitle(chunk2.metadata.title))

  // Determinar severidad
  const severity = determineSeverity(contradiction, hierarchy1, hierarchy2, vigencia1, vigencia2)

  // Determinar fuente que prevalece
  const prevailingSource = determinePrevailingSource(
    hierarchy1,
    hierarchy2,
    vigencia1,
    vigencia2
  )

  // Generar explicación
  const explanation = generateExplanation(
    chunk1,
    chunk2,
    hierarchy1,
    hierarchy2,
    vigencia1,
    vigencia2,
    prevailingSource
  )

  // Extraer tema común
  const topic = extractCommonTopic(statement1, statement2)

  return {
    source1: {
      chunk: chunk1,
      statement: statement1,
      hierarchyScore: hierarchy1
    },
    source2: {
      chunk: chunk2,
      statement: statement2,
      hierarchyScore: hierarchy2
    },
    topic,
    severity,
    prevailingSource,
    explanation
  }
}

/**
 * Detecta contradicción simple entre dos afirmaciones
 */
function detectSimpleContradiction(stmt1: string, stmt2: string): boolean {
  const lower1 = stmt1.toLowerCase()
  const lower2 = stmt2.toLowerCase()

  // Contradicciones directas
  const contradictions = [
    { pattern1: /\bdebe\b/, pattern2: /\bno debe\b/ },
    { pattern1: /\bprohibido\b/, pattern2: /\bpermitido\b/ },
    { pattern1: /\bobligatorio\b/, pattern2: /\bopcional\b/ },
    { pattern1: /\brequiere\b/, pattern2: /\bno requiere\b/ },
    { pattern1: /\bplazo de (\d+)/, pattern2: /\bplazo de (\d+)/ }
  ]

  for (const { pattern1, pattern2 } of contradictions) {
    const match1 = lower1.match(pattern1)
    const match2 = lower2.match(pattern2)

    if (match1 && match2) {
      // Si hay números, verificar que sean diferentes
      if (match1[1] && match2[1] && match1[1] !== match2[1]) {
        return true
      }
      if (!match1[1] && !match2[1]) {
        return true
      }
    }
  }

  // Contradicciones de números (plazos, montos, etc.)
  const numbers1 = lower1.match(/\b(\d+)\s*(días|meses|años|horas)\b/g)
  const numbers2 = lower2.match(/\b(\d+)\s*(días|meses|años|horas)\b/g)

  if (numbers1 && numbers2) {
    const values1 = numbers1.map(n => parseInt(n.match(/\d+/)![0]))
    const values2 = numbers2.map(n => parseInt(n.match(/\d+/)![0]))

    // Si hay valores diferentes para el mismo concepto, es una contradicción
    if (values1.length > 0 && values2.length > 0) {
      const avg1 = values1.reduce((a, b) => a + b, 0) / values1.length
      const avg2 = values2.reduce((a, b) => a + b, 0) / values2.length

      if (Math.abs(avg1 - avg2) > avg1 * 0.5) {
        return true
      }
    }
  }

  return false
}

/**
 * Determina severidad de la contradicción
 */
function determineSeverity(
  contradiction: boolean,
  hierarchy1: number,
  hierarchy2: number,
  vigencia1: any,
  vigencia2: any
): 'alta' | 'media' | 'baja' {
  if (!contradiction) return 'baja'

  // Alta severidad: diferencias significativas en jerarquía o vigencia
  const hierarchyDiff = Math.abs(hierarchy1 - hierarchy2)
  const vigencia1Active = vigencia1?.estado === 'vigente' || vigencia1?.vigente === true
  const vigencia2Active = vigencia2?.estado === 'vigente' || vigencia2?.vigente === true

  if (hierarchyDiff > 0.3 || (vigencia1Active && !vigencia2Active) || (!vigencia1Active && vigencia2Active)) {
    return 'alta'
  }

  // Media severidad: diferencias moderadas
  if (hierarchyDiff > 0.15) {
    return 'media'
  }

  return 'baja'
}

/**
 * Determina qué fuente prevalece según jerarquía y vigencia
 */
function determinePrevailingSource(
  hierarchy1: number,
  hierarchy2: number,
  vigencia1: any,
  vigencia2: any
): 'source1' | 'source2' | 'indeterminado' {
  const vigencia1Active = vigencia1?.estado === 'vigente' || vigencia1?.vigente === true
  const vigencia2Active = vigencia2?.estado === 'vigente' || vigencia2?.vigente === true

  // Si una está vigente y la otra no, prevalece la vigente
  if (vigencia1Active && !vigencia2Active) return 'source1'
  if (vigencia2Active && !vigencia1Active) return 'source2'

  // Si ambas están vigentes o ambas no, usar jerarquía
  if (hierarchy1 > hierarchy2) return 'source1'
  if (hierarchy2 > hierarchy1) return 'source2'

  return 'indeterminado'
}

/**
 * Genera explicación de por qué una fuente prevalece
 */
function generateExplanation(
  chunk1: DocumentChunk,
  chunk2: DocumentChunk,
  hierarchy1: number,
  hierarchy2: number,
  vigencia1: any,
  vigencia2: any,
  prevailingSource: 'source1' | 'source2' | 'indeterminado'
): string {
  const title1 = chunk1.metadata.title
  const title2 = chunk2.metadata.title

  if (prevailingSource === 'indeterminado') {
    return `Ambas fuentes (${title1} y ${title2}) tienen jerarquía similar y vigencia equivalente. Se recomienda consultar con un abogado especializado para determinar cuál norma aplica en el caso específico.`
  }

  const prevailing = prevailingSource === 'source1' ? chunk1 : chunk2
  const other = prevailingSource === 'source1' ? chunk2 : chunk1
  const prevailingHierarchy = prevailingSource === 'source1' ? hierarchy1 : hierarchy2
  const otherHierarchy = prevailingSource === 'source1' ? hierarchy2 : hierarchy1
  const prevailingVigencia = prevailingSource === 'source1' ? vigencia1 : vigencia2
  const otherVigencia = prevailingSource === 'source1' ? vigencia2 : vigencia1

  const reasons: string[] = []

  // Razón por jerarquía
  if (prevailingHierarchy > otherHierarchy) {
    const hierarchyType = getHierarchyType(prevailing.metadata.title)
    reasons.push(
      `${prevailing.metadata.title} tiene mayor jerarquía normativa (${hierarchyType}) que ${other.metadata.title} según la pirámide normativa colombiana.`
    )
  }

  // Razón por vigencia
  const prevailingActive = prevailingVigencia?.estado === 'vigente' || prevailingVigencia?.vigente === true
  const otherActive = otherVigencia?.estado === 'vigente' || otherVigencia?.vigente === true

  if (prevailingActive && !otherActive) {
    reasons.push(
      `${prevailing.metadata.title} está vigente, mientras que ${other.metadata.title} ${otherVigencia?.derogadaPor ? `fue derogada por ${otherVigencia.derogadaPor}` : 'no está vigente'}.`
    )
  }

  if (reasons.length === 0) {
    return `Según la jerarquía normativa y vigencia, ${prevailing.metadata.title} prevalece sobre ${other.metadata.title}.`
  }

  return reasons.join(' ') + ` Por lo tanto, ${prevailing.metadata.title} prevalece sobre ${other.metadata.title}.`
}

/**
 * Obtiene el tipo de jerarquía de un documento
 */
function getHierarchyType(title: string): string {
  const lower = title.toLowerCase()
  if (lower.includes('constitución') || lower.includes('constitucion')) return 'Constitución Política'
  if (lower.includes('código') || lower.includes('codigo')) return 'Código'
  if (lower.includes('ley orgánica') || lower.includes('ley organica')) return 'Ley Orgánica'
  if (lower.includes('ley estatutaria')) return 'Ley Estatutaria'
  if (lower.includes('ley')) return 'Ley'
  if (lower.includes('decreto ley') || lower.includes('decreto-ley')) return 'Decreto con fuerza de ley'
  if (lower.includes('decreto')) return 'Decreto reglamentario'
  if (lower.includes('resolución') || lower.includes('resolucion')) return 'Resolución'
  if (lower.includes('jurisprudencia')) return 'Jurisprudencia'
  return 'Norma'
}

/**
 * Extrae tema común de dos afirmaciones
 */
function extractCommonTopic(stmt1: string, stmt2: string): string {
  const words1 = new Set(stmt1.toLowerCase().split(/\s+/))
  const words2 = new Set(stmt2.toLowerCase().split(/\s+/))
  const words1Array = Array.from(words1)
  const common = words1Array.filter(w => words2.has(w) && w.length > 4)

  if (common.length > 0) {
    return common.slice(0, 3).join(' ')
  }

  return 'Información normativa'
}
