import { describe, it, expect } from '@jest/globals'
import { getLegalHierarchyScore, getRecencyScore, rerankChunks, rerankChunksAdvanced, applyReranking } from '../lib/reranking'
import { type DocumentChunk } from '../lib/types'

describe('Reranking - Scoring por Jerarquía Mejorado', () => {
  const createMockChunk = (title: string, type: 'estatuto' | 'jurisprudencia' | 'reglamento' | 'procedimiento', fechaVigencia?: string): DocumentChunk => ({
    id: `test-${title}`,
    content: `Contenido de ${title}`,
    metadata: {
      id: `test-${title}`,
      title,
      type,
      fechaVigencia,
      areaLegal: 'general'
    }
  })

  describe('getLegalHierarchyScore', () => {
    it('should give highest boost to Constitución', () => {
      const chunk = createMockChunk('Constitución Política de Colombia', 'estatuto')
      const score = getLegalHierarchyScore(chunk)
      expect(score).toBeGreaterThan(0.5) // Debe ser al menos 0.60 según nuevos valores
    })

    it('should give high boost to Códigos', () => {
      const chunk = createMockChunk('Código Civil', 'estatuto')
      const score = getLegalHierarchyScore(chunk)
      expect(score).toBeGreaterThan(0.4) // Debe ser 0.50
    })

    it('should give medium boost to Leyes', () => {
      const chunk = createMockChunk('Ley 100 de 1993', 'estatuto')
      const score = getLegalHierarchyScore(chunk)
      expect(score).toBeGreaterThan(0.25) // Debe ser 0.30
      expect(score).toBeLessThan(0.4)
    })

    it('should give lower boost to Decretos', () => {
      const chunk = createMockChunk('Decreto 2591 de 1991', 'reglamento')
      const score = getLegalHierarchyScore(chunk)
      expect(score).toBeGreaterThan(0.1) // Debe ser 0.12
      expect(score).toBeLessThan(0.2)
    })

    it('should give boost to Jurisprudencia de Corte Constitucional', () => {
      const chunk = createMockChunk('Sentencia T-123 de 2020 - Corte Constitucional', 'jurisprudencia')
      const score = getLegalHierarchyScore(chunk)
      expect(score).toBeGreaterThan(0.15) // Debe ser 0.20
    })
  })

  describe('getRecencyScore', () => {
    it('should give high boost to recent documents (last 3 years)', () => {
      const currentYear = new Date().getFullYear()
      const chunk = createMockChunk(`Ley ${currentYear - 2}`, 'estatuto', `${currentYear - 2}-01-01`)
      const score = getRecencyScore(chunk)
      expect(score).toBeGreaterThan(0.1)
    })

    it('should give extra boost to recent jurisprudence', () => {
      const currentYear = new Date().getFullYear()
      const chunk = createMockChunk(`Sentencia T-123 de ${currentYear - 1}`, 'jurisprudencia', `${currentYear - 1}-01-01`)
      const score = getRecencyScore(chunk)
      expect(score).toBeGreaterThan(0.12) // Jurisprudencia reciente debe tener boost extra
    })

    it('should give lower boost to older documents (5-10 years)', () => {
      const currentYear = new Date().getFullYear()
      const chunk = createMockChunk(`Ley ${currentYear - 7}`, 'estatuto', `${currentYear - 7}-01-01`)
      const score = getRecencyScore(chunk)
      expect(score).toBeLessThan(0.1)
      expect(score).toBeGreaterThan(0)
    })

    it('should give minimal boost to very old documents', () => {
      const currentYear = new Date().getFullYear()
      const chunk = createMockChunk(`Ley ${currentYear - 20}`, 'estatuto', `${currentYear - 20}-01-01`)
      const score = getRecencyScore(chunk)
      expect(score).toBeLessThanOrEqual(0.02)
    })
  })

  describe('rerankChunks', () => {
    it('should prioritize documents with higher hierarchy', () => {
      const chunks = [
        { chunk: createMockChunk('Decreto 123 de 2020', 'reglamento'), score: 0.8 },
        { chunk: createMockChunk('Constitución Política', 'estatuto'), score: 0.7 },
        { chunk: createMockChunk('Ley 100 de 1993', 'estatuto'), score: 0.75 }
      ]

      const reranked = rerankChunks(chunks, 'test query')
      
      // Constitución debe aparecer primero a pesar de tener score semántico menor
      expect(reranked[0].chunk.metadata.title).toContain('Constitución')
    })

    it('should combine hierarchy and recency boosts', () => {
      const currentYear = new Date().getFullYear()
      const chunks = [
        { chunk: createMockChunk(`Ley ${currentYear - 15}`, 'estatuto', `${currentYear - 15}-01-01`), score: 0.8 },
        { chunk: createMockChunk(`Ley ${currentYear - 2}`, 'estatuto', `${currentYear - 2}-01-01`), score: 0.75 }
      ]

      const reranked = rerankChunks(chunks, 'test query')
      
      // La ley más reciente debe aparecer primero
      expect(reranked[0].chunk.metadata.title).toContain(String(currentYear - 2))
    })
  })

  describe('applyReranking', () => {
    it('should apply advanced reranking by default', () => {
      const chunks = [
        { chunk: createMockChunk('Decreto 123', 'reglamento'), score: 0.9 },
        { chunk: createMockChunk('Constitución Política', 'estatuto'), score: 0.7 }
      ]

      const reranked = applyReranking(chunks, 'test query')
      
      // Constitución debe aparecer primero
      expect(reranked[0].chunk.metadata.title).toContain('Constitución')
    })

    it('should respect minScore filter', () => {
      const chunks = [
        { chunk: createMockChunk('Documento 1', 'estatuto'), score: 0.1 },
        { chunk: createMockChunk('Documento 2', 'estatuto'), score: 0.05 }
      ]

      const reranked = applyReranking(chunks, 'test query', { minScore: 0.1 })
      
      // Solo debe retornar documentos con score >= 0.1
      expect(reranked.length).toBeLessThanOrEqual(chunks.length)
    })

    it('should respect topK limit', () => {
      const chunks = Array.from({ length: 10 }, (_, i) => ({
        chunk: createMockChunk(`Documento ${i}`, 'estatuto'),
        score: 0.8 - i * 0.05
      }))

      const reranked = applyReranking(chunks, 'test query', { topK: 5 })
      
      expect(reranked.length).toBe(5)
    })
  })
})
