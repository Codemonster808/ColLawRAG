/**
 * Tests para el sistema de vigencia de normas
 * (advertencias en respuesta, consulta de estado, inferencia de normaId)
 */

import { describe, it, expect } from '@jest/globals'
import {
  loadNorma,
  listNormas,
  consultarVigencia,
  inferNormaIdFromTitle,
  type NormaVigencia,
  type EstadoVigencia
} from '../lib/norm-vigencia'

describe('Vigencia - Carga y listado', () => {
  it('listNormas retorna ids de normas en data/normas-vigencia', () => {
    const ids = listNormas()
    expect(Array.isArray(ids)).toBe(true)
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.every(id => typeof id === 'string' && id.length > 0)).toBe(true)
    expect(ids.some(id => id.startsWith('ley-') || id.startsWith('decreto-'))).toBe(true)
  })

  it('loadNorma retorna null para id inexistente', () => {
    expect(loadNorma('ley-99999-9999')).toBeNull()
  })

  it('loadNorma retorna norma con estructura correcta para id existente', () => {
    const ids = listNormas()
    if (ids.length === 0) return
    const norma = loadNorma(ids[0])
    expect(norma).not.toBeNull()
    expect(norma).toHaveProperty('normaId')
    expect(norma).toHaveProperty('nombre')
    expect(norma).toHaveProperty('vigenteDesde')
    expect(norma).toHaveProperty('estado')
    expect(['vigente', 'derogada', 'parcialmente_derogada']).toContain((norma as NormaVigencia).estado)
  })
})

describe('Vigencia - consultarVigencia', () => {
  it('retorna null para norma inexistente', () => {
    expect(consultarVigencia('ley-99999-9999')).toBeNull()
  })

  it('retorna estado vigente para norma vigente en fecha actual', () => {
    const ids = listNormas()
    const vigente = ids.find(id => {
      const n = loadNorma(id)
      return n?.estado === 'vigente'
    })
    if (!vigente) return
    const estado = consultarVigencia(vigente)
    expect(estado).not.toBeNull()
    expect((estado as EstadoVigencia).vigente).toBe(true)
    expect((estado as EstadoVigencia).estado).toBe('vigente')
  })

  it('retorna estado con vigenteDesde coherente', () => {
    const ids = listNormas()
    if (ids.length === 0) return
    const norma = loadNorma(ids[0]) as NormaVigencia
    const antesVigencia = consultarVigencia(norma.normaId, '1900-01-01')
    expect(antesVigencia).not.toBeNull()
    if ((antesVigencia as EstadoVigencia).vigente === false) {
      expect((antesVigencia as EstadoVigencia).estado).toBe('derogada')
    }
  })
})

describe('Vigencia - inferNormaIdFromTitle', () => {
  it('infiere ley-599-2000 desde "Ley 599 de 2000"', () => {
    const ids = listNormas()
    if (!ids.includes('ley-599-2000')) return
    expect(inferNormaIdFromTitle('Ley 599 de 2000 (Código Penal)')).toBe('ley-599-2000')
  })

  it('infiere desde "Código Penal" cuando existe en mapa', () => {
    const ids = listNormas()
    if (!ids.includes('ley-599-2000')) return
    expect(inferNormaIdFromTitle('Código Penal colombiano')).toBe('ley-599-2000')
  })

  it('retorna null para título vacío o sin match', () => {
    expect(inferNormaIdFromTitle('')).toBeNull()
    expect(inferNormaIdFromTitle('Texto sin norma conocida')).toBeNull()
  })
})
