import { type DocumentChunk } from './types'
import { getLegalHierarchyScore } from './reranking'
import { consultarVigencia, inferNormaIdFromTitle } from './norm-vigencia'

export interface HierarchyExplanation {
  explanation: string
  hierarchyOrder: Array<{
    title: string
    type: string
    hierarchyLevel: number
    hierarchyScore: number
    vigencia?: {
      estado: string
      derogadaPor?: string
    }
  }>
  constitutionalPrinciples?: string[]
  formattedExplanation: string
}

/**
 * Explica la jerarquía legal cuando hay múltiples fuentes
 * Genera texto explicativo sobre por qué una norma prevalece
 * Incluye referencias a principios constitucionales
 */
export async function explainLegalHierarchy(
  chunks: Array<{ chunk: DocumentChunk; score: number }>
): Promise<HierarchyExplanation | null> {
  if (chunks.length < 2) {
    return null // No hay múltiples fuentes para comparar
  }

  // Ordenar chunks por jerarquía
  const hierarchyData = await Promise.all(
    chunks.map(async ({ chunk, score }) => {
      const hierarchyScore = getLegalHierarchyScore(chunk)
      const normaId = inferNormaIdFromTitle(chunk.metadata.title)
      const vigencia = normaId ? consultarVigencia(normaId) : null

      return {
        chunk,
        score,
        hierarchyScore,
        vigencia: vigencia as any, // Tipo dinámico de consultarVigencia
        type: getHierarchyType(chunk.metadata.title),
        hierarchyLevel: getHierarchyLevel(chunk.metadata.title)
      }
    })
  )

  // Ordenar por jerarquía (mayor a menor)
  hierarchyData.sort((a, b) => {
    // Primero por vigencia (vigentes primero)
    const aVigente = a.vigencia?.estado === 'vigente' || a.vigencia?.vigente === true
    const bVigente = b.vigencia?.estado === 'vigente' || b.vigencia?.vigente === true

    if (aVigente && !bVigente) return -1
    if (!aVigente && bVigente) return 1

    // Luego por jerarquía
    if (b.hierarchyScore !== a.hierarchyScore) {
      return b.hierarchyScore - a.hierarchyScore
    }

    // Finalmente por score de relevancia
    return b.score - a.score
  })

  // Generar explicación
  const explanation = await generateHierarchyExplanation(hierarchyData)
  const formattedExplanation = formatHierarchyExplanation(hierarchyData, explanation)

  // Identificar principios constitucionales relevantes
  const constitutionalPrinciples = identifyConstitutionalPrinciples(hierarchyData)

  return {
    explanation,
    hierarchyOrder: hierarchyData.map(({ chunk, hierarchyScore, type, vigencia }) => ({
      title: chunk.metadata.title,
      type,
      hierarchyLevel: getHierarchyLevel(chunk.metadata.title),
      hierarchyScore,
      vigencia: vigencia
        ? {
            estado: (vigencia as any).estado || ((vigencia as any).vigente ? 'vigente' : 'no vigente'),
            derogadaPor: 'derogadaPor' in vigencia ? (vigencia as any).derogadaPor : undefined
          }
        : undefined
    })),
    constitutionalPrinciples,
    formattedExplanation
  }
}

/**
 * Genera explicación textual de la jerarquía
 */
async function generateHierarchyExplanation(
  hierarchyData: Array<{
    chunk: DocumentChunk
    hierarchyScore: number
    type: string
    vigencia: any
  }>
): Promise<string> {
  if (hierarchyData.length === 0) return ''

  const parts: string[] = []

  // Explicar la pirámide normativa
  parts.push('## Jerarquía Normativa Aplicable\n')
  parts.push(
    'Según la pirámide normativa colombiana establecida en el artículo 4° de la Constitución Política, el orden de prelación es el siguiente:\n'
  )

  // Listar las fuentes en orden de jerarquía
  for (let i = 0; i < hierarchyData.length; i++) {
    const { chunk, hierarchyScore, type, vigencia } = hierarchyData[i]
    const vigenciaStatus = vigencia?.estado === 'vigente' || vigencia?.vigente === true
      ? 'vigente'
      : vigencia?.estado || 'no verificada'

    parts.push(
      `${i + 1}. **${chunk.metadata.title}** (${type})`
    )

    if (!vigenciaStatus || vigenciaStatus !== 'vigente') {
      parts.push(`   - ⚠️ Estado: ${vigenciaStatus}`)
      if (vigencia?.derogadaPor) {
        parts.push(`   - Derogada por: ${vigencia.derogadaPor}`)
      }
    }

    parts.push(`   - Nivel de jerarquía: ${getHierarchyLevelName(getHierarchyLevel(chunk.metadata.title))}`)
    parts.push('')
  }

  // Explicar qué fuente prevalece
  const highest = hierarchyData[0]
  const highestVigente = highest.vigencia?.estado === 'vigente' || highest.vigencia?.vigente === true

  if (highestVigente) {
    parts.push(
      `**Norma que prevalece:** ${highest.chunk.metadata.title}\n`
    )
    parts.push(
      `Esta norma tiene la mayor jerarquía normativa (${getHierarchyLevelName(getHierarchyLevel(highest.chunk.metadata.title))}) y está vigente, por lo que prevalece sobre las demás fuentes consultadas.`
    )
  } else {
    // Buscar la primera vigente
    const firstVigente = hierarchyData.find(
      d => d.vigencia?.estado === 'vigente' || d.vigencia?.vigente === true
    )

    if (firstVigente) {
      parts.push(
        `**Norma que prevalece:** ${firstVigente.chunk.metadata.title}\n`
      )
      parts.push(
        `Aunque ${highest.chunk.metadata.title} tiene mayor jerarquía, esta norma no está vigente. Por lo tanto, ${firstVigente.chunk.metadata.title} prevalece por ser la norma vigente de mayor jerarquía.`
      )
    } else {
      parts.push(
        `⚠️ **Advertencia:** Ninguna de las fuentes consultadas está verificada como vigente. Se recomienda verificar la vigencia actual de estas normas antes de aplicarlas.`
      )
    }
  }

  return parts.join('\n')
}

/**
 * Formatea la explicación de jerarquía de forma clara y profesional
 */
function formatHierarchyExplanation(
  hierarchyData: Array<{
    chunk: DocumentChunk
    hierarchyScore: number
    type: string
  }>,
  explanation: string
): string {
  const sections: string[] = []

  // Encabezado
  sections.push('### 📚 Orden de Precedencia Normativa\n')

  // Tabla de jerarquía
  sections.push('| Orden | Norma | Tipo | Nivel de Jerarquía |')
  sections.push('|-------|-------|------|-------------------|')

  for (let i = 0; i < hierarchyData.length; i++) {
    const { chunk, type } = hierarchyData[i]
    const level = getHierarchyLevel(chunk.metadata.title)
    const levelName = getHierarchyLevelName(level)

    sections.push(`| ${i + 1} | ${chunk.metadata.title} | ${type} | ${levelName} |`)
  }

  sections.push('')

  // Explicación textual
  sections.push(explanation)

  return sections.join('\n')
}

/**
 * Identifica principios constitucionales relevantes según las fuentes
 */
function identifyConstitutionalPrinciples(
  hierarchyData: Array<{
    chunk: DocumentChunk
    hierarchyScore: number
  }>
): string[] {
  const principles: string[] = []

  // Verificar si hay Constitución
  const hasConstitution = hierarchyData.some(
    d => d.chunk.metadata.title.toLowerCase().includes('constitución') ||
         d.chunk.metadata.title.toLowerCase().includes('constitucion')
  )

  if (hasConstitution) {
    principles.push('Principio de Supremacía Constitucional (Art. 4° C.P.)')
  }

  // Verificar jerarquía entre normas
  const hasLey = hierarchyData.some(
    d => d.chunk.metadata.title.match(/\bley\s+\d+/i) ||
         (d.chunk.metadata.type === 'estatuto' && d.chunk.metadata.title.toLowerCase().includes('ley'))
  )

  const hasDecreto = hierarchyData.some(
    d => d.chunk.metadata.title.toLowerCase().includes('decreto')
  )

  if (hasLey && hasDecreto) {
    principles.push('Principio de Legalidad (Art. 6° C.P.) - Las leyes prevalecen sobre decretos reglamentarios')
  }

  // Verificar si hay jurisprudencia constitucional
  const hasJurisprudenciaCC = hierarchyData.some(
    d => d.chunk.metadata.type === 'jurisprudencia' &&
         (d.chunk.metadata.title.toLowerCase().includes('corte constitucional') ||
          d.chunk.content.toLowerCase().includes('corte constitucional'))
  )

  if (hasJurisprudenciaCC) {
    principles.push('Doctrina Constitucional - La jurisprudencia de la Corte Constitucional interpreta y desarrolla la Constitución')
  }

  // Principio de vigencia
  const hasVigente = hierarchyData.some(
    d => d.chunk.metadata.fechaVigencia || d.chunk.metadata.title.match(/\d{4}/)
  )

  if (hasVigente) {
    principles.push('Principio de Vigencia - Solo las normas vigentes pueden aplicarse')
  }

  return principles
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
  if (lower.match(/\bley\s+\d+/)) return 'Ley'
  if (lower.includes('decreto ley') || lower.includes('decreto-ley')) return 'Decreto con fuerza de ley'
  if (lower.includes('decreto')) return 'Decreto reglamentario'
  if (lower.includes('resolución') || lower.includes('resolucion')) return 'Resolución'
  if (lower.includes('jurisprudencia')) return 'Jurisprudencia'
  return 'Norma'
}

/**
 * Obtiene el nivel numérico de jerarquía (1 = más alto, 10 = más bajo)
 */
function getHierarchyLevel(title: string): number {
  const lower = title.toLowerCase()
  if (lower.includes('constitución') || lower.includes('constitucion')) return 1
  if (lower.includes('código') || lower.includes('codigo')) return 2
  if (lower.includes('ley orgánica') || lower.includes('ley organica')) return 3
  if (lower.includes('ley estatutaria')) return 3
  if (lower.match(/\bley\s+\d+/)) return 4
  if (lower.includes('decreto ley') || lower.includes('decreto-ley')) return 5
  if (lower.includes('decreto')) return 6
  if (lower.includes('jurisprudencia') && lower.includes('corte constitucional')) return 4
  if (lower.includes('jurisprudencia')) return 7
  if (lower.includes('resolución') || lower.includes('resolucion')) return 8
  return 9
}

/**
 * Obtiene el nombre del nivel de jerarquía
 */
function getHierarchyLevelName(level: number): string {
  const levels: Record<number, string> = {
    1: 'Máxima (Constitución)',
    2: 'Muy Alta (Código)',
    3: 'Alta (Ley Orgánica/Estatutaria)',
    4: 'Alta (Ley/Jurisprudencia CC)',
    5: 'Media-Alta (Decreto-Ley)',
    6: 'Media (Decreto)',
    7: 'Media-Baja (Jurisprudencia)',
    8: 'Baja (Resolución)',
    9: 'Muy Baja (Otros)'
  }
  return levels[level] || 'No clasificado'
}
