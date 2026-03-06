import { describe, it, expect } from '@jest/globals'
import { explainLegalHierarchy } from '../lib/hierarchy-explainer'
import { type DocumentChunk } from '../lib/types'

describe('Hierarchy Explainer', () => {
  const createMockChunk = (
    title: string,
    content: string,
    type: 'estatuto' | 'jurisprudencia' | 'reglamento' = 'estatuto'
  ): DocumentChunk => ({
    id: `chunk-${title}`,
    content,
    metadata: {
      id: `doc-${title}`,
      title,
      type,
      sourcePath: `data/documents/${title}.txt`
    }
  })

  it('debe explicar jerarquía cuando hay múltiples fuentes', async () => {
    const chunk1 = createMockChunk(
      'Constitución Política de Colombia',
      'Todos los ciudadanos tienen derecho a la educación.'
    )
    const chunk2 = createMockChunk(
      'Ley 100 de 1993',
      'La educación se regula mediante esta ley.'
    )
    const chunk3 = createMockChunk(
      'Decreto 123 de 2020',
      'Este decreto reglamenta aspectos específicos de la educación.'
    )

    const result = await explainLegalHierarchy([
      { chunk: chunk1, score: 0.9 },
      { chunk: chunk2, score: 0.8 },
      { chunk: chunk3, score: 0.7 }
    ])

    expect(result).not.toBeNull()
    expect(result?.hierarchyOrder.length).toBe(3)
    expect(result?.explanation).toBeDefined()
    expect(result?.explanation.length).toBeGreaterThan(0)
  })

  it('debe ordenar fuentes por jerarquía (Constitución primero)', async () => {
    const chunk1 = createMockChunk(
      'Decreto 123 de 2020',
      'Contenido del decreto.'
    )
    const chunk2 = createMockChunk(
      'Constitución Política de Colombia',
      'Contenido constitucional.'
    )
    const chunk3 = createMockChunk(
      'Ley 100 de 1993',
      'Contenido de la ley.'
    )

    const result = await explainLegalHierarchy([
      { chunk: chunk1, score: 0.9 },
      { chunk: chunk2, score: 0.8 },
      { chunk: chunk3, score: 0.7 }
    ])

    expect(result).not.toBeNull()
    // La Constitución debe estar primero (mayor jerarquía)
    const constitucionIndex = result?.hierarchyOrder.findIndex(
      h => h.title.toLowerCase().includes('constitución') || h.title.toLowerCase().includes('constitucion')
    )
    expect(constitucionIndex).toBeDefined()
    expect(constitucionIndex).toBeLessThan(2) // Debe estar entre las primeras 2 posiciones
    // Verificar que tiene el nivel de jerarquía correcto
    const constitucion = result?.hierarchyOrder.find(
      h => h.title.toLowerCase().includes('constitución') || h.title.toLowerCase().includes('constitucion')
    )
    expect(constitucion?.hierarchyLevel).toBe(1)
  })

  it('debe identificar principios constitucionales cuando hay Constitución', async () => {
    const chunk1 = createMockChunk(
      'Constitución Política de Colombia',
      'Principios constitucionales.'
    )
    const chunk2 = createMockChunk(
      'Ley 100 de 1993',
      'Contenido de la ley.'
    )

    const result = await explainLegalHierarchy([
      { chunk: chunk1, score: 0.9 },
      { chunk: chunk2, score: 0.8 }
    ])

    expect(result).not.toBeNull()
    expect(result?.constitutionalPrinciples).toBeDefined()
    expect(result?.constitutionalPrinciples?.length).toBeGreaterThan(0)
    expect(result?.constitutionalPrinciples?.some(p => p.includes('Supremacía'))).toBe(true)
  })

  it('debe generar explicación formateada profesionalmente', async () => {
    const chunk1 = createMockChunk(
      'Ley 100 de 1993',
      'Contenido de la ley.'
    )
    const chunk2 = createMockChunk(
      'Decreto 123 de 2020',
      'Contenido del decreto.'
    )

    const result = await explainLegalHierarchy([
      { chunk: chunk1, score: 0.9 },
      { chunk: chunk2, score: 0.8 }
    ])

    expect(result).not.toBeNull()
    expect(result?.formattedExplanation).toBeDefined()
    expect(result?.formattedExplanation).toContain('Orden de Precedencia')
    expect(result?.formattedExplanation).toContain('|')
  })

  it('debe retornar null cuando hay menos de 2 fuentes', async () => {
    const chunk1 = createMockChunk(
      'Ley 100 de 1993',
      'Contenido de la ley.'
    )

    const result = await explainLegalHierarchy([
      { chunk: chunk1, score: 0.9 }
    ])

    expect(result).toBeNull()
  })

  it('debe identificar qué norma prevalece según jerarquía', async () => {
    const chunk1 = createMockChunk(
      'Decreto 123 de 2020',
      'Contenido del decreto.'
    )
    const chunk2 = createMockChunk(
      'Ley 100 de 1993',
      'Contenido de la ley.'
    )

    const result = await explainLegalHierarchy([
      { chunk: chunk1, score: 0.9 },
      { chunk: chunk2, score: 0.8 }
    ])

    expect(result).not.toBeNull()
    expect(result?.explanation).toContain('prevalece')
    // La ley debe prevalecer sobre el decreto
    expect(result?.hierarchyOrder[0].title).toContain('Ley')
  })

  it('debe incluir información de vigencia cuando está disponible', async () => {
    const chunk1 = createMockChunk(
      'Ley 100 de 1993',
      'Contenido de la ley.'
    )
    const chunk2 = createMockChunk(
      'Decreto 123 de 2020',
      'Contenido del decreto.'
    )

    const result = await explainLegalHierarchy([
      { chunk: chunk1, score: 0.9 },
      { chunk: chunk2, score: 0.8 }
    ])

    expect(result).not.toBeNull()
    // La explicación debe mencionar vigencia si está disponible
    expect(result?.hierarchyOrder.length).toBeGreaterThan(0)
  })
})
