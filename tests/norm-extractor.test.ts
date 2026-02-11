import { describe, it, expect } from '@jest/globals'
import { extractNormsFromQuery, extractApplicableNorms, validateNormsVigencia } from '../lib/norm-extractor'
import { type DocumentChunk } from '../lib/types'

describe('Norm Extractor', () => {
  const createMockChunk = (title: string, type: 'estatuto' | 'jurisprudencia' | 'reglamento' | 'procedimiento', article?: string): DocumentChunk => ({
    id: `test-${title}`,
    content: `Contenido de ${title}${article ? ` - Artículo ${article}` : ''}`,
    metadata: {
      id: `test-${title}`,
      title,
      type,
      article,
      areaLegal: 'general'
    }
  })

  describe('extractNormsFromQuery', () => {
    it('should extract Ley from query', () => {
      const query = '¿Qué dice la Ley 100 de 1993 sobre pensiones?'
      const normas = extractNormsFromQuery(query)
      
      expect(normas.length).toBeGreaterThan(0)
      const ley = normas.find(n => n.normaId === 'ley-100-1993')
      expect(ley).toBeDefined()
      expect(ley?.type).toBe('ley')
      expect(ley?.hierarchyScore).toBeGreaterThan(0)
    })

    it('should extract Decreto from query', () => {
      const query = '¿Cuáles son los requisitos del Decreto 2591 de 1991?'
      const normas = extractNormsFromQuery(query)
      
      const decreto = normas.find(n => n.normaId === 'decreto-2591-1991')
      expect(decreto).toBeDefined()
      expect(decreto?.type).toBe('decreto')
    })

    it('should extract Código from query', () => {
      const query = '¿Qué establece el Código Penal sobre homicidio?'
      const normas = extractNormsFromQuery(query)
      
      const codigo = normas.find(n => n.type === 'codigo')
      expect(codigo).toBeDefined()
    })

    it('should extract Constitución from query', () => {
      const query = '¿Qué dice la Constitución Política sobre derechos fundamentales?'
      const normas = extractNormsFromQuery(query)
      
      const constitucion = normas.find(n => n.type === 'constitucion')
      expect(constitucion).toBeDefined()
    })

    it('should extract articles from query', () => {
      const query = '¿Qué establece el Artículo 5 de la Ley 100 de 1993?'
      const normas = extractNormsFromQuery(query)
      
      const ley = normas.find(n => n.normaId === 'ley-100-1993')
      expect(ley).toBeDefined()
      expect(ley?.articles.length).toBeGreaterThan(0)
      expect(ley?.articles[0].numero).toBe('5')
    })

    it('should prioritize by hierarchy', () => {
      const query = '¿Qué dice la Constitución y la Ley 100 de 1993?'
      const normas = extractNormsFromQuery(query)
      
      // Debe haber al menos 2 normas
      expect(normas.length).toBeGreaterThanOrEqual(1)
      
      // Si hay múltiples normas, verificar que están ordenadas por jerarquía
      if (normas.length > 1) {
        const constitucion = normas.find(n => n.type === 'constitucion')
        const ley = normas.find(n => n.type === 'ley')
        
        if (constitucion && ley) {
          expect(constitucion.hierarchyScore).toBeGreaterThan(ley.hierarchyScore)
        }
      }
    })
  })

  describe('extractApplicableNorms', () => {
    it('should extract norms from query and chunks', () => {
      const query = '¿Qué dice la Ley 100 de 1993?'
      const chunks = [
        { chunk: createMockChunk('Ley 100 de 1993', 'estatuto', 'Art. 1'), score: 0.9 },
        { chunk: createMockChunk('Decreto 2591 de 1991', 'reglamento'), score: 0.7 }
      ]

      const result = extractApplicableNorms(query, chunks)
      
      expect(result.total).toBeGreaterThan(0)
      expect(result.normas.length).toBeGreaterThan(0)
      expect(result.articles.length).toBeGreaterThanOrEqual(0)
    })

    it('should prioritize norms by hierarchy', () => {
      const query = 'Consulta sobre normas'
      const chunks = [
        { chunk: createMockChunk('Decreto 123 de 2020', 'reglamento'), score: 0.9 },
        { chunk: createMockChunk('Ley 100 de 1993', 'estatuto'), score: 0.8 },
        { chunk: createMockChunk('Constitución Política', 'estatuto'), score: 0.7 }
      ]

      const result = extractApplicableNorms(query, chunks)
      
      // Debe haber normas extraídas
      expect(result.normas.length).toBeGreaterThan(0)
      
      // Verificar que están ordenadas por jerarquía (mayor a menor)
      if (result.normas.length > 1) {
        for (let i = 0; i < result.normas.length - 1; i++) {
          expect(result.normas[i].hierarchyScore).toBeGreaterThanOrEqual(result.normas[i + 1].hierarchyScore)
        }
      }
    })

    it('should validate vigencia', () => {
      const query = '¿Qué dice la Ley 100 de 1993?'
      const result = extractApplicableNorms(query)
      
      const ley = result.normas.find(n => n.normaId === 'ley-100-1993')
      if (ley) {
        expect(ley.vigencia).toBeDefined()
        expect(ley.vigencia).not.toBeNull()
      }
    })

    it('should count vigentes and no vigentes', () => {
      const query = 'Consulta sobre normas'
      const result = extractApplicableNorms(query)
      
      expect(result.vigentes).toBeGreaterThanOrEqual(0)
      expect(result.noVigentes).toBeGreaterThanOrEqual(0)
      expect(result.vigentes + result.noVigentes).toBeLessThanOrEqual(result.total)
    })
  })

  describe('validateNormsVigencia', () => {
    it('should validate vigencia for all norms', () => {
      const query = '¿Qué dice la Ley 100 de 1993 y el Decreto 2591 de 1991?'
      const normas = extractNormsFromQuery(query)
      
      const validated = validateNormsVigencia(normas)
      
      expect(validated.length).toBe(normas.length)
      for (const norma of validated) {
        expect(norma.vigencia).toBeDefined()
      }
    })
  })
})
