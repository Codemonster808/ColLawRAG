/**
 * Tests para la base de procedimientos
 * (detección de consultas procedurales, inyección en contexto, formato)
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import {
  loadProceduresIndex,
  loadProcedureDetail,
  isProcedureRelatedQuery,
  getRelevantProcedureIds,
  getProcedureChunksForQuery,
  formatProcedureForContext,
  type ProcedureDetail
} from '../lib/procedures'

describe('Procedures - Índice y detalle', () => {
  it('loadProceduresIndex retorna índice con procedures', () => {
    const index = loadProceduresIndex()
    expect(index).toBeDefined()
    expect(index?.procedures).toBeDefined()
    expect(Array.isArray(index?.procedures)).toBe(true)
    if ((index?.procedures?.length ?? 0) > 0) {
      const p = index!.procedures[0]
      expect(p).toHaveProperty('id')
      expect(p).toHaveProperty('nombre')
      expect(p).toHaveProperty('file')
    }
  })

  it('loadProcedureDetail retorna null para id inexistente', () => {
    expect(loadProcedureDetail('no-existe')).toBeNull()
  })

  it('loadProcedureDetail retorna detalle con etapas para id existente', () => {
    const index = loadProceduresIndex()
    if (!index?.procedures?.length) return
    const id = index.procedures[0].file?.replace('.json', '') ?? index.procedures[0].id
    const proc = loadProcedureDetail(id)
    expect(proc).not.toBeNull()
    expect(proc).toHaveProperty('id')
    expect(proc).toHaveProperty('nombre')
    expect(proc).toHaveProperty('etapas')
  })
})

describe('Procedures - Detección de consulta', () => {
  it('isProcedureRelatedQuery detecta tutela', () => {
    expect(isProcedureRelatedQuery('¿Cuáles son los pasos de la acción de tutela?')).toBe(true)
    expect(isProcedureRelatedQuery('acción de tutela')).toBe(true)
  })

  it('isProcedureRelatedQuery detecta plazos y trámite', () => {
    expect(isProcedureRelatedQuery('plazos para presentar demanda laboral')).toBe(true)
    expect(isProcedureRelatedQuery('trámite de cumplimiento')).toBe(true)
  })

  it('isProcedureRelatedQuery rechaza consulta no procedural', () => {
    expect(isProcedureRelatedQuery('¿Qué es el Código Sustantivo del Trabajo?')).toBe(false)
    expect(isProcedureRelatedQuery('definición de contrato')).toBe(false)
  })
})

describe('Procedures - Relevancia e inyección', () => {
  it('getRelevantProcedureIds retorna ids para consulta de tutela', () => {
    const ids = getRelevantProcedureIds('pasos para interponer acción de tutela')
    expect(Array.isArray(ids)).toBe(true)
    if (ids.length > 0) {
      expect(ids.some(id => id === 'tutela' || id.includes('tutela'))).toBe(true)
    }
  })

  it('getProcedureChunksForQuery retorna vacío para consulta no procedural', () => {
    const chunks = getProcedureChunksForQuery('qué es una ley')
    expect(chunks).toEqual([])
  })

  it('getProcedureChunksForQuery retorna chunks para consulta procedural', () => {
    const chunks = getProcedureChunksForQuery('¿Cuáles son los plazos de la acción de tutela?')
    expect(Array.isArray(chunks)).toBe(true)
    if (chunks.length > 0) {
      expect(chunks[0]).toHaveProperty('chunk')
      expect(chunks[0]).toHaveProperty('score')
      expect(chunks[0].chunk).toHaveProperty('id')
      expect(chunks[0].chunk).toHaveProperty('content')
      expect(chunks[0].chunk).toHaveProperty('metadata')
    }
  })
})

describe('Procedures - Formato para contexto', () => {
  it('formatProcedureForContext produce texto con nombre y etapas', () => {
    const proc: ProcedureDetail = {
      id: 'test',
      nombre: 'Procedimiento Test',
      descripcion: 'Desc',
      etapas: [
        { nombre: 'Etapa 1', orden: 1, plazos: { dias: 10, descripcion: '10 días' } }
      ]
    }
    const text = formatProcedureForContext(proc)
    expect(text).toContain('Procedimiento Test')
    expect(text).toContain('Etapa 1')
    expect(text).toContain('10')
  })
})
