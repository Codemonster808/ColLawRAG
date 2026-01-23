/**
 * Sistema básico de autenticación y métricas de uso
 * En producción, esto debería usar un sistema de autenticación robusto (Auth0, Firebase Auth, etc.)
 */

import { type UserTier } from './tiers'

export interface User {
  id: string
  email?: string
  tier: UserTier
  createdAt: Date
  lastQueryAt?: Date
  queriesThisMonth: number
  totalQueries: number
}

// Simulación de base de datos en memoria (en producción usar DB real)
const users: Map<string, User> = new Map()
const queryLogs: Array<{
  userId: string
  query: string
  timestamp: Date
  responseTime: number
  success: boolean
}> = []

/**
 * Crea un nuevo usuario (free tier por defecto)
 */
export function createUser(params: {
  id: string
  email?: string
  tier?: UserTier
}): User {
  const user: User = {
    id: params.id,
    email: params.email,
    tier: params.tier || 'free',
    createdAt: new Date(),
    queriesThisMonth: 0,
    totalQueries: 0
  }
  
  users.set(user.id, user)
  return user
}

/**
 * Obtiene un usuario por ID
 */
export function getUser(userId: string): User | null {
  return users.get(userId) || null
}

/**
 * Actualiza el tier de un usuario
 */
export function updateUserTier(userId: string, tier: UserTier): boolean {
  const user = users.get(userId)
  if (!user) return false
  
  user.tier = tier
  users.set(userId, user)
  return true
}

/**
 * Registra una consulta realizada por un usuario
 */
export function logQuery(params: {
  userId: string
  query: string
  responseTime: number
  success: boolean
}): void {
  const user = users.get(params.userId)
  if (!user) return
  
  // Resetear contador mensual si es un nuevo mes
  const now = new Date()
  const lastQueryMonth = user.lastQueryAt 
    ? new Date(user.lastQueryAt).getMonth()
    : -1
  const currentMonth = now.getMonth()
  
  if (lastQueryMonth !== currentMonth) {
    user.queriesThisMonth = 0
  }
  
  user.queriesThisMonth++
  user.totalQueries++
  user.lastQueryAt = now
  
  users.set(user.id, user)
  
  // Registrar en log
  queryLogs.push({
    userId: params.userId,
    query: params.query,
    timestamp: now,
    responseTime: params.responseTime,
    success: params.success
  })
}

/**
 * Obtiene estadísticas de uso de un usuario
 */
export function getUserStats(userId: string): {
  queriesThisMonth: number
  totalQueries: number
  tier: UserTier
  lastQueryAt?: Date
} | null {
  const user = users.get(userId)
  if (!user) return null
  
  return {
    queriesThisMonth: user.queriesThisMonth,
    totalQueries: user.totalQueries,
    tier: user.tier,
    lastQueryAt: user.lastQueryAt
  }
}

/**
 * Obtiene logs de consultas (útil para analytics)
 */
export function getQueryLogs(params: {
  userId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
}): typeof queryLogs {
  let filtered = [...queryLogs]
  
  if (params.userId) {
    filtered = filtered.filter(log => log.userId === params.userId)
  }
  
  if (params.startDate) {
    filtered = filtered.filter(log => log.timestamp >= params.startDate!)
  }
  
  if (params.endDate) {
    filtered = filtered.filter(log => log.timestamp <= params.endDate!)
  }
  
  if (params.limit) {
    filtered = filtered.slice(0, params.limit)
  }
  
  return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

/**
 * Obtiene métricas agregadas del sistema
 */
export function getSystemMetrics(): {
  totalUsers: number
  totalQueries: number
  queriesToday: number
  averageResponseTime: number
  successRate: number
  tierDistribution: Record<UserTier, number>
} {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const queriesToday = queryLogs.filter(log => log.timestamp >= today)
  const successfulQueries = queryLogs.filter(log => log.success)
  
  const tierDistribution: Record<UserTier, number> = {
    free: 0,
    premium: 0
  }
  
  for (const user of users.values()) {
    tierDistribution[user.tier]++
  }
  
  const totalResponseTime = queryLogs.reduce((sum, log) => sum + log.responseTime, 0)
  const averageResponseTime = queryLogs.length > 0 
    ? totalResponseTime / queryLogs.length 
    : 0
  
  const successRate = queryLogs.length > 0
    ? successfulQueries.length / queryLogs.length
    : 0
  
  return {
    totalUsers: users.size,
    totalQueries: queryLogs.length,
    queriesToday: queriesToday.length,
    averageResponseTime,
    successRate,
    tierDistribution
  }
}

/**
 * Autenticación básica por API key (para desarrollo)
 * En producción, usar JWT o OAuth
 */
export function authenticateByApiKey(apiKey: string): User | null {
  // En producción, esto debería verificar contra una base de datos
  // Por ahora, asumimos que el API key es el userId
  return getUser(apiKey) || null
}

