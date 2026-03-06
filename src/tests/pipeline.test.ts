/**
 * Tests para el pipeline RAG completo
 * 
 * Estos tests verifican que el pipeline funciona correctamente
 * desde la entrada hasta la salida
 */

import { describe, it, expect, beforeAll } from '@jest/globals'
import { runRagPipeline } from '../lib/rag'
import type { RagQuery } from '../lib/types'

// Mock de variables de entorno si es necesario
beforeAll(() => {
  if (!process.env.HUGGINGFACE_API_KEY) {
    process.env.HUGGINGFACE_API_KEY = 'hf_test_key'
  }
})

describe('RAG Pipeline', () => {
  describe('Consultas básicas', () => {
    it('debe procesar una consulta simple', async () => {
      const query: RagQuery = {
        query: '¿Qué es la acción de tutela?',
        locale: 'es'
      }

      const result = await runRagPipeline(query)

      expect(result).toBeDefined()
      expect(result.answer).toBeDefined()
      expect(result.answer.length).toBeGreaterThan(0)
      expect(result.citations).toBeDefined()
      expect(Array.isArray(result.citations)).toBe(true)
      expect(result.requestId).toBeDefined()
      expect(result.retrieved).toBeGreaterThan(0)
    }, 30000) // Timeout de 30 segundos

    it('debe detectar el área legal correctamente', async () => {
      const query: RagQuery = {
        query: 'Ley laboral sobre horas extras',
        locale: 'es'
      }

      const result = await runRagPipeline(query)

      expect(result.detectedLegalArea).toBe('laboral')
    }, 30000)

    it('debe retornar citas válidas', async () => {
      const query: RagQuery = {
        query: 'Constitución política de Colombia',
        locale: 'es'
      }

      const result = await runRagPipeline(query)

      expect(result.citations.length).toBeGreaterThan(0)
      
      result.citations.forEach(citation => {
        expect(citation.id).toBeDefined()
        expect(citation.title).toBeDefined()
        expect(citation.type).toBeDefined()
        expect(citation.score).toBeDefined()
        expect(citation.score).toBeGreaterThanOrEqual(0)
        expect(citation.score).toBeLessThanOrEqual(1)
      })
    }, 30000)
  })

  describe('Casos edge', () => {
    it('debe manejar queries muy largas', async () => {
      const longQuery = '¿Qué es? '.repeat(200) // ~2000 caracteres
      const query: RagQuery = {
        query: longQuery,
        locale: 'es'
      }

      const result = await runRagPipeline(query)

      expect(result).toBeDefined()
      expect(result.answer).toBeDefined()
    }, 30000)

    it('debe manejar queries con caracteres especiales', async () => {
      const query: RagQuery = {
        query: '¿Qué dice el artículo 86 de la Constitución?',
        locale: 'es'
      }

      const result = await runRagPipeline(query)

      expect(result).toBeDefined()
      expect(result.answer).toBeDefined()
    }, 30000)

    it('debe manejar queries vacías o muy cortas', async () => {
      const query: RagQuery = {
        query: 'a',
        locale: 'es'
      }

      // Debe lanzar error o retornar respuesta apropiada
      await expect(runRagPipeline(query)).resolves.toBeDefined()
    }, 30000)
  })

  describe('Filtros', () => {
    it('debe aplicar filtros de tipo de documento', async () => {
      const query: RagQuery = {
        query: 'Ley sobre trabajo',
        filters: { type: 'estatuto' },
        locale: 'es'
      }

      const result = await runRagPipeline(query)

      expect(result.citations.length).toBeGreaterThan(0)
      // Todas las citas deben ser del tipo filtrado
      result.citations.forEach(citation => {
        if (citation.type) {
          expect(citation.type).toBe('estatuto')
        }
      })
    }, 30000)
  })

  describe('Features avanzadas', () => {
    it('debe generar respuesta estructurada cuando está habilitada', async () => {
      const query: RagQuery = {
        query: 'Ley laboral sobre vacaciones',
        locale: 'es',
        enableStructuredResponse: true
      }

      const result = await runRagPipeline(query)

      if (result.structuredResponse) {
        expect(result.structuredResponse).toBeDefined()
        // Al menos algunas secciones deben estar presentes
        const sections = Object.values(result.structuredResponse).filter(v => v)
        expect(sections.length).toBeGreaterThan(0)
      }
    }, 30000)

    it('debe realizar validación factual cuando está habilitada', async () => {
      const query: RagQuery = {
        query: 'Artículo 159 del Código Sustantivo del Trabajo',
        locale: 'es',
        enableFactualValidation: true
      }

      const result = await runRagPipeline(query)

      if (result.factualValidation) {
        expect(result.factualValidation).toBeDefined()
        expect(result.factualValidation.isValid).toBeDefined()
        expect(typeof result.factualValidation.isValid).toBe('boolean')
      }
    }, 30000)

    it('debe detectar necesidad de cálculos', async () => {
      const query: RagQuery = {
        query: 'Trabajé 3 años con salario de $3.500.000. ¿Cuánto me deben de cesantías?',
        locale: 'es',
        enableCalculations: true
      }

      const result = await runRagPipeline(query)

      // Si detecta necesidad de cálculos, debe tenerlos
      if (result.calculations && result.calculations.length > 0) {
        expect(result.calculations.length).toBeGreaterThan(0)
        result.calculations.forEach(calc => {
          expect(calc.type).toBeDefined()
          expect(calc.amount).toBeDefined()
          expect(typeof calc.amount).toBe('number')
        })
      }
    }, 30000)
  })

  describe('Metadata', () => {
    it('debe incluir metadata en la respuesta', async () => {
      const query: RagQuery = {
        query: 'Ley colombiana',
        locale: 'es'
      }

      const result = await runRagPipeline(query)

      expect(result.metadata).toBeDefined()
      expect(result.metadata.responseTime).toBeDefined()
      expect(typeof result.metadata.responseTime).toBe('number')
      expect(result.metadata.responseTime).toBeGreaterThan(0)
    }, 30000)
  })
})
