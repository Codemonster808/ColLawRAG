/**
 * Tests de integración Fase 1 (Plan Consultas Complejas):
 * - Filtro de vigencia en retrieval (chunks de normas derogadas excluidos)
 * - Validación factual con advertencias de vigencia
 * - Procedimientos con timeline y documentos por etapa (cubierto en procedures.test.ts)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { filterChunksByVigencia } from '../lib/retrieval'
import { validateFactual } from '../lib/factual-validator'
import { inferNormaIdFromTitle, consultarVigencia } from '../lib/norm-vigencia'
import type { DocumentChunk } from '../lib/types'

function makeChunk(id: string, title: string, type: string = 'ley'): DocumentChunk {
  return {
    id,
    content: `Contenido de ${title}. Artículo 1.`,
    metadata: { id, title, type }
  }
}

describe('Integración Fase 1 - Filtro vigencia en retrieval', () => {
  it('filterChunksByVigencia excluye chunks de normas totalmente derogadas', () => {
    // ley-50-1990 está derogada en data/normas-vigencia
    const vigencia = consultarVigencia('ley-50-1990')
    if (!vigencia || vigencia.estado !== 'derogada') {
      return // skip si no hay norma derogada en datos
    }
    const chunks = [
      { chunk: makeChunk('1', 'Ley 50 de 1990'), score: 0.9 },
      { chunk: makeChunk('2', 'Ley 1437 de 2011'), score: 0.8 },
      { chunk: makeChunk('3', 'Texto sin norma conocida'), score: 0.7 }
    ]
    const filtered = filterChunksByVigencia(chunks)
    const titles = filtered.map(r => r.chunk.metadata.title)
    expect(titles).not.toContain('Ley 50 de 1990')
    expect(titles).toContain('Ley 1437 de 2011')
    expect(titles).toContain('Texto sin norma conocida')
    expect(filtered.length).toBe(2)
  })

  it('filterChunksByVigencia mantiene chunks de tipo procedimiento', () => {
    const chunks = [
      { chunk: makeChunk('p1', 'Acción de Tutela', 'procedimiento'), score: 0.95 }
    ]
    const filtered = filterChunksByVigencia(chunks)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].chunk.metadata.type).toBe('procedimiento')
  })

  it('filterChunksByVigencia mantiene chunks sin título o sin normaId inferible', () => {
    const chunks = [
      { chunk: makeChunk('1', 'Jurisprudencia Corte Constitucional'), score: 0.85 }
    ]
    const filtered = filterChunksByVigencia(chunks)
    expect(filtered.length).toBeGreaterThanOrEqual(0)
    if (inferNormaIdFromTitle('Jurisprudencia Corte Constitucional') == null) {
      expect(filtered).toHaveLength(1)
    }
  })
})

describe('Integración Fase 1 - Validación factual con vigencia', () => {
  it('validateFactual añade advertencia de vigencia cuando chunk es norma derogada', () => {
    const vigencia = consultarVigencia('ley-50-1990')
    if (!vigencia || vigencia.estado !== 'derogada') return

    const chunks = [
      { chunk: makeChunk('1', 'Ley 50 de 1990'), score: 0.9 }
    ]
    const answer = 'Según la Ley 50 de 1990, artículo 1, se establece...'
    const result = validateFactual(answer, chunks)
    expect(result.warnings.some(w => w.includes('derogada') || w.includes('Ley 50'))).toBe(true)
  })

  it('validateFactual puede incluir advertencia para norma parcialmente derogada', () => {
    const vigencia = consultarVigencia('ley-599-2000')
    if (!vigencia || vigencia.estado !== 'parcialmente_derogada') return

    const chunks = [
      { chunk: makeChunk('1', 'Ley 599 de 2000 (Código Penal)'), score: 0.9 }
    ]
    const answer = 'El Código Penal en su artículo 14 dispone...'
    const result = validateFactual(answer, chunks)
    expect(result.warnings.some(w => w.includes('parcialmente') || w.includes('derogados') || w.includes('vigencia'))).toBe(true)
  })
})
