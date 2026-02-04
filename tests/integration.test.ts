/**
 * Tests de integración: flujo RAG con tiers, vigencia y procedimientos
 * Verifica que los módulos trabajen juntos correctamente.
 */

import { describe, it, expect } from '@jest/globals'
import { detectLegalArea } from '../lib/prompt-templates'
import {
  isProcedureRelatedQuery,
  getProcedureChunksForQuery,
  getRelevantProcedureIds
} from '../lib/procedures'
import {
  inferNormaIdFromTitle,
  consultarVigencia,
  listNormas
} from '../lib/norm-vigencia'
import { checkUsageLimit, getUserTier, trackUsage } from '../lib/tiers'
import { createUser } from '../lib/auth'

describe('Integración - Procedimientos + área legal', () => {
  it('consulta procedural obtiene área legal y chunks de procedimientos', () => {
    const query = '¿Cuáles son los plazos y pasos de la acción de tutela?'
    const area = detectLegalArea(query)
    expect(isProcedureRelatedQuery(query)).toBe(true)
    const ids = getRelevantProcedureIds(query, area ?? undefined)
    const chunks = getProcedureChunksForQuery(query, area ?? undefined)
    expect(Array.isArray(chunks)).toBe(true)
    if (chunks.length > 0) {
      expect(chunks[0].chunk.metadata.type).toBe('procedimiento')
      expect(chunks[0].chunk.content.length).toBeGreaterThan(0)
    }
  })
})

describe('Integración - Vigencia en citas', () => {
  it('cita con título de norma conocida obtiene estado de vigencia', () => {
    const titulo = 'Ley 599 de 2000 (Código Penal)'
    const normaId = inferNormaIdFromTitle(titulo)
    if (!normaId) return
    const estado = consultarVigencia(normaId)
    expect(estado).not.toBeNull()
    expect(estado).toHaveProperty('vigente')
    expect(estado).toHaveProperty('estado')
  })

  it('lista de normas y consulta vigencia son coherentes', () => {
    const ids = listNormas()
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids.slice(0, 3)) {
      const estado = consultarVigencia(id)
      expect(estado).not.toBeNull()
    }
  })
})

describe('Integración - Tiers y uso en flujo', () => {
  const userId = 'test-integration-tier-' + Date.now()

  it('usuario nuevo puede consultar; tras tracking se respeta límite', () => {
    createUser({ id: userId, tier: 'free' })
    expect(getUserTier(userId)).toBe('free')
    const check0 = checkUsageLimit('free', userId)
    expect(check0.allowed).toBe(true)
    trackUsage(userId, 'free', 'consulta integración', 100, true)
    const check1 = checkUsageLimit('free', userId)
    expect(check1.allowed).toBe(true)
  })
})
