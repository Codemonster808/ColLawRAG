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
 * Obtiene el tier de un usuario desde la base de datos
 */
export function getUserTier(userId: string): UserTier {
  try {
    const user = getUser(userId)
    return user?.tier || 'free'
  } catch (error) {
    console.error('[tiers] Error getting user tier:', error)
    return 'free'
  }
}

/**
 * Verifica límites de uso para un usuario (consulta DB)
 */
export function checkUsageLimit(tier: UserTier, userId: string): { allowed: boolean; reason?: string } {
  try {
    const limits = TIER_LIMITS[tier]
    
    if (limits.maxQueriesPerMonth === -1) {
      return { allowed: true }
    }
    
    // Consultar queriesThisMonth desde base de datos
    const stats = getUserStats(userId)
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
    // En caso de error, permitir la request
    return { allowed: true }
  }
}

/**
 * Trackea el uso de un usuario (actualiza DB)
 */
export function trackUsage(userId: string, tier: UserTier, query?: string, responseTime?: number, success?: boolean): void {
  try {
    // Asegurar que el usuario existe
    const user = getUser(userId)
    if (!user) {
      // Crear usuario si no existe
      createUser({ id: userId, tier })
    }
    
    // Si se proporcionan detalles de la consulta, usar logQuery
    if (query !== undefined && responseTime !== undefined && success !== undefined) {
      logQuery({
        userId,
        query,
        responseTime,
        success
      })
    } else {
      // Solo actualizar contador mensual (más ligero)
      // logQuery ya maneja el incremento de contadores, pero podemos hacerlo explícito aquí
      const stats = getUserStats(userId)
      const now = new Date()
      const lastQueryAt = stats?.lastQueryAt
      
      // Resetear contador si es nuevo mes
      let queriesThisMonth = stats?.queriesThisMonth || 0
      if (lastQueryAt) {
        const lastMonth = lastQueryAt.getMonth()
        const lastYear = lastQueryAt.getFullYear()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()
        
        if (lastMonth !== currentMonth || lastYear !== currentYear) {
          queriesThisMonth = 0
        }
      }
      
      // Incrementar contador (logQuery lo hará cuando se llame con detalles)
      queriesThisMonth++
      
      // Actualizar en DB (usar logQuery con valores mínimos si no tenemos detalles)
      logQuery({
        userId,
        query: query || 'tracked',
        responseTime: responseTime || 0,
        success: success !== undefined ? success : true
      })
    }
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
