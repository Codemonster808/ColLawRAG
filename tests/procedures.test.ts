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
  buildProcedureTimeline,
  formatProcedureWithTimeline,
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

  it('buildProcedureTimeline devuelve timeline y documentosPorEtapa', () => {
    const proc: ProcedureDetail = {
      id: 'test',
      nombre: 'Test',
      etapas: [
        { nombre: 'Inicio', orden: 1, plazos: { dias: 0 }, documentos: ['Doc A'] },
        { nombre: 'Etapa 2', orden: 2, plazos: { dias: 5 }, documentos: ['Doc B', 'Doc C'] }
      ]
    }
    const { timeline, documentosPorEtapa } = buildProcedureTimeline(proc)
    expect(timeline).toContain('Timeline')
    expect(timeline).toContain('Inicio')
    expect(timeline).toContain('Etapa 2')
    expect(documentosPorEtapa).toHaveLength(2)
    expect(documentosPorEtapa[0].diasAcumulados).toBe(0)
    expect(documentosPorEtapa[1].diasAcumulados).toBe(5)
    expect(documentosPorEtapa[0].documentos).toEqual(['Doc A'])
    expect(documentosPorEtapa[1].documentos).toEqual(['Doc B', 'Doc C'])
  })

  it('formatProcedureWithTimeline incluye Timeline y Documentos requeridos por etapa', () => {
    const proc: ProcedureDetail = {
      id: 'test',
      nombre: 'Test',
      etapas: [
        { nombre: 'Etapa 1', orden: 1, plazos: { dias: 10 }, documentos: ['Solicitud'] }
      ]
    }
    const text = formatProcedureWithTimeline(proc)
    expect(text).toContain('Timeline')
    expect(text).toContain('Documentos requeridos por etapa')
    expect(text).toContain('Etapa 1')
    expect(text).toContain('Solicitud')
  })

  it('getProcedureChunksForQuery incluye timeline y documentos en contenido para tutela', () => {
    const chunks = getProcedureChunksForQuery('plazos de la acción de tutela')
    if (chunks.length === 0) return
    const content = chunks[0].chunk.content
    expect(content).toMatch(/Timeline|timeline/i)
    expect(content).toMatch(/Documentos requeridos por etapa|documentos/i)
  })
})
