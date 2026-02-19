/**
 * Sistema de tiers para modelo freemium
 * Conectado con lib/auth.ts para persistencia en SQLite
 */

import { getUser, getUserStats, logQuery, createUser } from './auth'

export type UserTier = 'free' | 'premium'

export interface TierLimits {
  maxQueriesPerMonth: number
  maxCitationsPerQuery: number
  includeCalculations: boolean
  includeProcedures: boolean
  includeStructuredResponse: boolean
  maxContextLength: number
  prioritySupport: boolean
}

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: {
    maxQueriesPerMonth: 10,
    maxCitationsPerQuery: 5,
    includeCalculations: false,
    includeProcedures: false,
    includeStructuredResponse: false,
    maxContextLength: 3000,
    prioritySupport: false
  },
  premium: {
    maxQueriesPerMonth: -1, // Ilimitado
    maxCitationsPerQuery: 15,
    includeCalculations: true,
    includeProcedures: true,
    includeStructuredResponse: true,
    maxContextLength: 8000,
    prioritySupport: true
  }
}

/**
 * Verifica si un usuario puede realizar una consulta según su tier
 */
export function canMakeQuery(
  tier: UserTier,
  queriesThisMonth: number
): { allowed: boolean; reason?: string } {
  const limits = TIER_LIMITS[tier]
  
  if (limits.maxQueriesPerMonth === -1) {
    return { allowed: true }
  }
  
  if (queriesThisMonth >= limits.maxQueriesPerMonth) {
    return {
      allowed: false,
      reason: `Has alcanzado el límite de ${limits.maxQueriesPerMonth} consultas mensuales. Actualiza a Premium para consultas ilimitadas.`
    }
  }
  
  return { allowed: true }
}

/**
 * Obtiene los límites de un tier específico
 */
export function getTierLimits(tier: UserTier): TierLimits {
  return TIER_LIMITS[tier]
}

/**
 * Verifica si una feature está disponible para un tier
 */
export function hasFeature(tier: UserTier, feature: keyof TierLimits): boolean {
  return TIER_LIMITS[tier][feature] === true || 
         (typeof TIER_LIMITS[tier][feature] === 'number' && TIER_LIMITS[tier][feature] as number > 0)
}

/**
 * Obtiene el tier de un usuario desde la base de datos. Async cuando DATABASE_URL (Postgres).
 */
export async function getUserTier(userId: string): Promise<UserTier> {
  try {
    const user = await getUser(userId)
    return user?.tier || 'free'
  } catch (error) {
    console.error('[tiers] Error getting user tier:', error)
    return 'free'
  }
}

/**
 * Verifica límites de uso para un usuario (consulta DB). Async cuando DATABASE_URL (Postgres).
 */
export async function checkUsageLimit(tier: UserTier, userId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const limits = TIER_LIMITS[tier]
    if (limits.maxQueriesPerMonth === -1) return { allowed: true }
    const stats = await getUserStats(userId)
    const queriesThisMonth = stats?.queriesThisMonth || 0
    if (queriesThisMonth >= limits.maxQueriesPerMonth) {
      return {
        allowed: false,
        reason: `Has alcanzado el límite de ${limits.maxQueriesPerMonth} consultas mensuales. Actualiza a Premium para consultas ilimitadas.`
      }
    }
    return { allowed: true }
  } catch (error) {
    console.error('[tiers] Error checking usage limit:', error)
    return { allowed: true }
  }
}

/**
 * Trackea el uso de un usuario (actualiza DB). Async cuando DATABASE_URL (Postgres).
 */
export async function trackUsage(userId: string, tier: UserTier, query?: string, responseTime?: number, success?: boolean): Promise<void> {
  try {
    const user = await getUser(userId)
    if (!user) await createUser({ id: userId, tier })
    await logQuery({
      userId,
      query: query ?? 'tracked',
      responseTime: responseTime ?? 0,
      success: success !== undefined ? success : true
    })
  } catch (error) {
    console.error('[tiers] Error tracking usage:', error)
  }
}

/**
 * Ajusta los parámetros de una consulta según el tier del usuario
 */
export function adjustQueryForTier(
  tier: UserTier,
  params: {
    topK?: number
    maxContextChars?: number
    includeCalculations?: boolean
    includeProcedures?: boolean
    includeStructuredResponse?: boolean
  }
): {
  topK: number
  maxContextChars: number
  includeCalculations: boolean
  includeProcedures: boolean
  includeStructuredResponse: boolean
} {
  const limits = TIER_LIMITS[tier]
  
  return {
    topK: Math.min(params.topK || 8, limits.maxCitationsPerQuery),
    maxContextChars: Math.min(params.maxContextChars || 4000, limits.maxContextLength),
    includeCalculations: params.includeCalculations !== undefined 
      ? params.includeCalculations && limits.includeCalculations 
      : limits.includeCalculations,
    includeProcedures: params.includeProcedures !== undefined 
      ? params.includeProcedures && limits.includeProcedures 
      : limits.includeProcedures,
    includeStructuredResponse: params.includeStructuredResponse !== undefined 
      ? params.includeStructuredResponse && limits.includeStructuredResponse 
      : limits.includeStructuredResponse
  }
}
