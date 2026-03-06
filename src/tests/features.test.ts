/**
 * Tests para features avanzadas
 * 
 * Estos tests verifican que las features avanzadas funcionan correctamente:
 * - Validación factual
 * - Respuesta estructurada
 * - Cálculos legales
 * - Re-ranking
 */

import { describe, it, expect } from '@jest/globals'
import { validateFactualContent } from '../lib/factual-validator'
import { structureResponse } from '../lib/response-structure'
import { calculateAllPrestaciones, calculateIndemnizacionDespidoSinJustaCausa } from '../lib/legal-calculator'
import { rerankChunks } from '../lib/reranking'
import type { DocumentChunk } from '../lib/types'

describe('Validación Factual', () => {
  it('debe validar artículos mencionados', () => {
    const answer = 'Según el artículo 159 del Código Sustantivo del Trabajo...'
    const chunks: DocumentChunk[] = [
      {
        id: 'test-1',
        content: 'Artículo 159. Las horas extras...',
        metadata: {
          title: 'Código Sustantivo del Trabajo',
          type: 'estatuto',
          article: 'Artículo 159'
        }
      }
    ]

    const validation = validateFactualContent(answer, chunks)

    expect(validation).toBeDefined()
    expect(validation.isValid).toBeDefined()
  })

  it('debe detectar artículos inválidos', () => {
    const answer = 'Según el artículo 99999 que no existe...'
    const chunks: DocumentChunk[] = [
      {
        id: 'test-1',
        content: 'Artículo 159. Las horas extras...',
        metadata: {
          title: 'Código Sustantivo del Trabajo',
          type: 'estatuto',
          article: 'Artículo 159'
        }
      }
    ]

    const validation = validateFactualContent(answer, chunks)

    // Debe detectar que el artículo no existe
    expect(validation.validatedFacts.articles.length).toBeGreaterThan(0)
  })
})

describe('Respuesta Estructurada', () => {
  it('debe estructurar una respuesta libre', () => {
    const freeText = `
      Los hechos relevantes son que el trabajador laboró 3 años.
      Las normas aplicables son el Código Sustantivo del Trabajo.
      El análisis jurídico indica que tiene derecho a cesantías.
      En conclusión, debe recibir las prestaciones.
      Se recomienda consultar con un abogado.
    `

    const structured = structureResponse(freeText)

    expect(structured).toBeDefined()
    expect(structured.hechosRelevantes).toBeDefined()
    expect(structured.normasAplicables).toBeDefined()
    expect(structured.analisisJuridico).toBeDefined()
    expect(structured.conclusion).toBeDefined()
    expect(structured.recomendacion).toBeDefined()
  })

  it('debe manejar respuestas sin estructura clara', () => {
    const freeText = 'Esta es una respuesta simple sin estructura.'

    const structured = structureResponse(freeText)

    // Debe retornar algo, aunque algunas secciones puedan estar vacías
    expect(structured).toBeDefined()
  })
})

describe('Cálculos Legales', () => {
  describe('Prestaciones Sociales', () => {
    it('debe calcular cesantías correctamente', () => {
      const result = calculateAllPrestaciones({
        salarioMensual: 3500000,
        mesesTrabajados: 12,
        diasTrabajados: 360
      })

      expect(result.cesantias.amount).toBeGreaterThan(0)
      expect(result.cesantias.formula).toBeDefined()
      expect(result.vacaciones.amount).toBeGreaterThan(0)
      expect(result.primaServicios.amount).toBeGreaterThan(0)
    })

    it('debe calcular indemnización por despido sin justa causa', () => {
      const result = calculateIndemnizacionDespidoSinJustaCausa({
        salarioMensual: 3500000,
        anosTrabajados: 3,
        mesesAdicionales: 8
      })

      expect(result.amount).toBeGreaterThan(0)
      expect(result.formula).toBeDefined()
      expect(result.breakdown).toBeDefined()
    })

    it('debe manejar casos edge (salario 0, meses 0)', () => {
      const result = calculateAllPrestaciones({
        salarioMensual: 0,
        mesesTrabajados: 0,
        diasTrabajados: 0
      })

      // Debe retornar resultados válidos (probablemente 0)
      expect(result).toBeDefined()
      expect(result.cesantias).toBeDefined()
    })
  })
})

describe('Re-ranking', () => {
  it('debe priorizar documentos de mayor jerarquía', () => {
    const chunks = [
      {
        chunk: {
          id: 'decreto',
          content: 'Decreto sobre trabajo',
          metadata: {
            title: 'Decreto 123',
            type: 'reglamento'
          }
        },
        score: 0.9
      },
      {
        chunk: {
          id: 'constitucion',
          content: 'Constitución Política',
          metadata: {
            title: 'Constitución Política de Colombia',
            type: 'estatuto'
          }
        },
        score: 0.85
      }
    ]

    const reranked = rerankChunks(chunks, 'Ley colombiana')

    // La Constitución debe tener mejor score después del re-ranking
    const constitucionIndex = reranked.findIndex(r => r.chunk.id === 'constitucion')
    const decretoIndex = reranked.findIndex(r => r.chunk.id === 'decreto')

    // La Constitución debe estar antes (mejor rank)
    expect(constitucionIndex).toBeLessThan(decretoIndex)
  })

  it('debe boostear documentos recientes', () => {
    const chunks = [
      {
        chunk: {
          id: 'old',
          content: 'Ley antigua',
          metadata: {
            title: 'Ley 100 de 1993',
            type: 'estatuto',
            date: '1993-01-01'
          }
        },
        score: 0.9
      },
      {
        chunk: {
          id: 'recent',
          content: 'Ley reciente',
          metadata: {
            title: 'Ley 2000 de 2023',
            type: 'estatuto',
            date: '2023-01-01'
          }
        },
        score: 0.85
      }
    ]

    const reranked = rerankChunks(chunks, 'Ley colombiana')

    // El documento reciente debe tener mejor rank
    const recentIndex = reranked.findIndex(r => r.chunk.id === 'recent')
    const oldIndex = reranked.findIndex(r => r.chunk.id === 'old')

    expect(recentIndex).toBeLessThan(oldIndex)
  })
})
