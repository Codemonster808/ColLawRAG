/**
 * Tests para el sistema de tiers (límites, tracking, parámetros)
 * Usa BD en memoria (COLLAWRAG_TEST_DB=:memory: en setup)
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import {
  TIER_LIMITS,
  canMakeQuery,
  getTierLimits,
  hasFeature,
  getUserTier,
  checkUsageLimit,
  trackUsage,
  adjustQueryForTier,
  type UserTier
} from '../lib/tiers'
import { createUser, updateUserTier } from '../lib/auth'

describe('Tiers - Límites y parámetros', () => {
  describe('TIER_LIMITS', () => {
    it('free tiene límite de consultas mensuales', () => {
      expect(TIER_LIMITS.free.maxQueriesPerMonth).toBe(10)
    })
    it('premium tiene consultas ilimitadas', () => {
      expect(TIER_LIMITS.premium.maxQueriesPerMonth).toBe(-1)
    })
    it('premium incluye cálculos y procedimientos', () => {
      expect(TIER_LIMITS.premium.includeCalculations).toBe(true)
      expect(TIER_LIMITS.premium.includeProcedures).toBe(true)
    })
  })

  describe('canMakeQuery', () => {
    it('permite cuando bajo el límite (free)', () => {
      expect(canMakeQuery('free', 0).allowed).toBe(true)
      expect(canMakeQuery('free', 9).allowed).toBe(true)
    })
    it('rechaza cuando alcanza el límite (free)', () => {
      const r = canMakeQuery('free', 10)
      expect(r.allowed).toBe(false)
      expect(r.reason).toMatch(/límite|10/)
    })
    it('siempre permite premium', () => {
      expect(canMakeQuery('premium', 0).allowed).toBe(true)
      expect(canMakeQuery('premium', 999).allowed).toBe(true)
    })
  })

  describe('getTierLimits', () => {
    it('retorna límites del tier', () => {
      const free = getTierLimits('free')
      expect(free.maxCitationsPerQuery).toBe(5)
      const premium = getTierLimits('premium')
      expect(premium.maxCitationsPerQuery).toBe(15)
    })
  })

  describe('hasFeature', () => {
    it('free no tiene includeCalculations', () => {
      expect(hasFeature('free', 'includeCalculations')).toBe(false)
    })
    it('premium tiene includeCalculations', () => {
      expect(hasFeature('premium', 'includeCalculations')).toBe(true)
    })
    it('maxQueriesPerMonth como número (free tiene límite > 0)', () => {
      expect(hasFeature('free', 'maxQueriesPerMonth')).toBe(true)
      // premium tiene -1 (ilimitado); hasFeature considera number > 0, así que false
      expect(hasFeature('premium', 'maxQueriesPerMonth')).toBe(false)
    })
  })

  describe('adjustQueryForTier', () => {
    it('limita topK y maxContextChars según tier', () => {
      const free = adjustQueryForTier('free', { topK: 20, maxContextChars: 10000 })
      expect(free.topK).toBeLessThanOrEqual(5)
      expect(free.maxContextChars).toBeLessThanOrEqual(3000)
      const premium = adjustQueryForTier('premium', { topK: 20, maxContextChars: 10000 })
      expect(premium.topK).toBeLessThanOrEqual(15)
      expect(premium.maxContextChars).toBeLessThanOrEqual(8000)
    })
    it('respeta includeCalculations por tier', () => {
      const free = adjustQueryForTier('free', { includeCalculations: true })
      expect(free.includeCalculations).toBe(false)
      const premium = adjustQueryForTier('premium', { includeCalculations: true })
      expect(premium.includeCalculations).toBe(true)
    })
  })
})

describe('Tiers - Persistencia (DB en memoria)', () => {
  const testUserId = 'test-tier-user-' + Date.now()

  beforeEach(() => {
    createUser({ id: testUserId, tier: 'free' })
  })

  describe('getUserTier', () => {
    it('retorna tier del usuario', () => {
      expect(getUserTier(testUserId)).toBe('free')
    })
    it('retorna premium tras actualizar', () => {
      updateUserTier(testUserId, 'premium')
      expect(getUserTier(testUserId)).toBe('premium')
    })
    it('retorna free para usuario inexistente (fail-safe)', () => {
      expect(getUserTier('no-existe-xyz')).toBe('free')
    })
  })

  describe('checkUsageLimit y trackUsage', () => {
    it('permite consultas hasta el límite free', () => {
      expect(checkUsageLimit('free', testUserId).allowed).toBe(true)
      trackUsage(testUserId, 'free', 'query 1', 100, true)
      trackUsage(testUserId, 'free', 'query 2', 100, true)
      expect(checkUsageLimit('free', testUserId).allowed).toBe(true)
    })
    it('rechaza cuando se supera el límite mensual (free)', () => {
      for (let i = 0; i < 10; i++) {
        trackUsage(testUserId, 'free', `query ${i}`, 50, true)
      }
      const check = checkUsageLimit('free', testUserId)
      expect(check.allowed).toBe(false)
      expect(check.reason).toMatch(/10|limite|límite/)
    })
    it('premium nunca rechaza por límite', () => {
      const premiumId = 'test-premium-' + Date.now()
      createUser({ id: premiumId, tier: 'premium' })
      for (let i = 0; i < 15; i++) {
        trackUsage(premiumId, 'premium', `q ${i}`, 50, true)
      }
      expect(checkUsageLimit('premium', premiumId).allowed).toBe(true)
    })
  })
})
