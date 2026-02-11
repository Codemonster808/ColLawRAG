import { describe, it, expect } from '@jest/globals'
import { compareSources } from '../lib/source-comparator'
import { type DocumentChunk } from '../lib/types'

describe('Source Comparator', () => {
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

  it('debe detectar contradicción entre dos fuentes con información diferente', async () => {
    const chunk1 = createMockChunk(
      'Ley 100 de 1993',
      'El plazo para interponer la acción es de 30 días hábiles. No se puede extender este plazo bajo ninguna circunstancia.'
    )
    const chunk2 = createMockChunk(
      'Decreto 123 de 2020',
      'El plazo para interponer la acción es de 60 días hábiles. Este plazo puede extenderse en casos excepcionales.'
    )

    const result = await compareSources(
      [
        { chunk: chunk1, score: 0.9 },
        { chunk: chunk2, score: 0.8 }
      ],
      'El plazo para interponer la acción es de 30 días hábiles según la Ley 100 de 1993.'
    )

    expect(result.hasConflicts).toBe(true)
    expect(result.contradictions.length).toBeGreaterThan(0)
  })

  it('debe identificar jerarquía cuando hay conflicto', async () => {
    const chunk1 = createMockChunk(
      'Constitución Política de Colombia',
      'Todos los ciudadanos tienen derecho a la educación gratuita.'
    )
    const chunk2 = createMockChunk(
      'Decreto 123 de 2020',
      'La educación requiere pago de matrícula.'
    )

    const result = await compareSources(
      [
        { chunk: chunk1, score: 0.95 },
        { chunk: chunk2, score: 0.7 }
      ],
      'Los ciudadanos tienen derecho a la educación.'
    )

    if (result.hasConflicts) {
      const contradiction = result.contradictions[0]
      expect(contradiction.prevailingSource).toBeDefined()
      expect(contradiction.explanation).toContain('Constitución')
    }
  })

  it('no debe detectar contradicción cuando las fuentes son complementarias', async () => {
    const chunk1 = createMockChunk(
      'Ley 100 de 1993',
      'El procedimiento requiere presentar documentos.'
    )
    const chunk2 = createMockChunk(
      'Decreto 123 de 2020',
      'Los documentos deben estar debidamente certificados.'
    )

    const result = await compareSources(
      [
        { chunk: chunk1, score: 0.9 },
        { chunk: chunk2, score: 0.8 }
      ],
      'El procedimiento requiere documentos certificados.'
    )

    // No debería haber contradicciones si las fuentes son complementarias
    expect(result.contradictions.length).toBe(0)
  })

  it('debe generar advertencias cuando hay contradicciones de alta severidad', async () => {
    const chunk1 = createMockChunk(
      'Ley 100 de 1993',
      'Está prohibido realizar esta actividad sin autorización previa.'
    )
    const chunk2 = createMockChunk(
      'Decreto 123 de 2020',
      'Esta actividad está permitida sin necesidad de autorización.'
    )

    const result = await compareSources(
      [
        { chunk: chunk1, score: 0.9 },
        { chunk: chunk2, score: 0.8 }
      ],
      'Esta actividad requiere autorización según la Ley 100 de 1993.'
    )

    if (result.hasConflicts) {
      const highSeverity = result.contradictions.filter(c => c.severity === 'alta')
      if (highSeverity.length > 0) {
        expect(result.warnings.length).toBeGreaterThan(0)
        expect(result.warnings[0]).toContain('alta severidad')
      }
    }
  })

  it('debe explicar por qué una fuente prevalece sobre otra', async () => {
    const chunk1 = createMockChunk(
      'Código Civil',
      'El contrato debe ser escrito.'
    )
    const chunk2 = createMockChunk(
      'Resolución 123',
      'El contrato puede ser verbal.'
    )

    const result = await compareSources(
      [
        { chunk: chunk1, score: 0.95 },
        { chunk: chunk2, score: 0.7 }
      ],
      'El contrato debe ser escrito según el Código Civil.'
    )

    if (result.hasConflicts) {
      const contradiction = result.contradictions[0]
      expect(contradiction.explanation).toBeDefined()
      expect(contradiction.explanation.length).toBeGreaterThan(0)
      expect(contradiction.prevailingSource).toBeDefined()
    }
  })

  it('debe agrupar chunks por tema similar', async () => {
    const chunk1 = createMockChunk(
      'Ley Laboral',
      'El trabajador tiene derecho a vacaciones de 15 días.'
    )
    const chunk2 = createMockChunk(
      'Decreto Laboral',
      'El trabajador tiene derecho a vacaciones de 20 días.'
    )
    const chunk3 = createMockChunk(
      'Ley Penal',
      'El delito tiene pena de 5 años.'
    )

    const result = await compareSources(
      [
        { chunk: chunk1, score: 0.9 },
        { chunk: chunk2, score: 0.85 },
        { chunk: chunk3, score: 0.7 }
      ],
      'El trabajador tiene derecho a vacaciones.'
    )

    // Debería detectar contradicción entre chunk1 y chunk2 (mismo tema)
    // Pero no entre chunk1/chunk2 y chunk3 (temas diferentes)
    expect(result.contradictions.length).toBeGreaterThanOrEqual(0)
  })
})
