/**
 * Sistema de autenticación y métricas de uso con persistencia SQLite
 * Reemplaza la implementación en memoria para funcionar en producción
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
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

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = process.env.COLLAWRAG_TEST_DB ?? path.join(DB_DIR, 'users.db')

// Asegurar que el directorio existe (no necesario para :memory:)
if (DB_PATH !== ':memory:' && !fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    
    // Crear tabla de usuarios si no existe
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        tier TEXT NOT NULL DEFAULT 'free',
        created_at INTEGER NOT NULL,
        last_query_at INTEGER,
        queries_this_month INTEGER NOT NULL DEFAULT 0,
        total_queries INTEGER NOT NULL DEFAULT 0
      );
      
      CREATE INDEX IF NOT EXISTS idx_tier ON users(tier);
      CREATE INDEX IF NOT EXISTS idx_last_query_at ON users(last_query_at);
    `)
    
    // Crear tabla de logs de consultas si no existe
    db.exec(`
      CREATE TABLE IF NOT EXISTS query_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        query TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        response_time INTEGER NOT NULL,
        success INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_id ON query_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON query_logs(timestamp);
    `)
  }
  return db
}

/**
 * Crea un nuevo usuario (free tier por defecto)
 */
export function createUser(params: {
  id: string
  email?: string
  tier?: UserTier
}): User {
  try {
    const database = getDb()
    const now = Date.now()
    const tier = params.tier || 'free'
    
    database.prepare(`
      INSERT OR REPLACE INTO users (id, email, tier, created_at, queries_this_month, total_queries)
      VALUES (?, ?, ?, ?, 0, 0)
    `).run(params.id, params.email || null, tier, now)
    
    return {
      id: params.id,
      email: params.email,
      tier,
      createdAt: new Date(now),
      queriesThisMonth: 0,
      totalQueries: 0
    }
  } catch (error) {
    console.error('[auth] Error creating user:', error)
    throw error
  }
}

/**
 * Obtiene un usuario por ID
 */
export function getUser(userId: string): User | null {
  try {
    const database = getDb()
    const row = database.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any
    
    if (!row) return null
    
    return {
      id: row.id,
      email: row.email || undefined,
      tier: row.tier as UserTier,
      createdAt: new Date(row.created_at),
      lastQueryAt: row.last_query_at ? new Date(row.last_query_at) : undefined,
      queriesThisMonth: row.queries_this_month,
      totalQueries: row.total_queries
    }
  } catch (error) {
    console.error('[auth] Error getting user:', error)
    return null
  }
}

/**
 * Autentica un usuario por ID (simplificado)
 * En producción, esto debería validar tokens, sesiones, etc.
 */
export function authenticateUser(userIdOrToken: string): User | null {
  // Si es un ID de usuario directo, retornar el usuario
  const user = getUser(userIdOrToken)
  if (user) {
    return user
  }
  
  // En producción, aquí se validaría un token JWT, sesión, etc.
  // Por ahora, crear un usuario temporal si no existe
  return createUser({ id: userIdOrToken, tier: 'free' })
}

/**
 * Actualiza el tier de un usuario
 */
export function updateUserTier(userId: string, tier: UserTier): boolean {
  try {
    const database = getDb()
    const result = database.prepare('UPDATE users SET tier = ? WHERE id = ?').run(tier, userId)
    return result.changes > 0
  } catch (error) {
    console.error('[auth] Error updating user tier:', error)
    return false
  }
}

/**
 * Obtiene el número de consultas del mes actual para un usuario
 * Resetea el contador si es un nuevo mes
 */
function getQueriesThisMonth(userId: string): number {
  try {
    const database = getDb()
    const user = getUser(userId)
    if (!user) return 0
    
    const now = new Date()
    const lastQueryAt = user.lastQueryAt
    
    // Si no hay última consulta o es un mes diferente, resetear contador
    if (!lastQueryAt) {
      return 0
    }
    
    const lastMonth = lastQueryAt.getMonth()
    const lastYear = lastQueryAt.getFullYear()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    
    // Si es un nuevo mes, resetear contador
    if (lastMonth !== currentMonth || lastYear !== currentYear) {
      database.prepare('UPDATE users SET queries_this_month = 0 WHERE id = ?').run(userId)
      return 0
    }
    
    return user.queriesThisMonth
  } catch (error) {
    console.error('[auth] Error getting queries this month:', error)
    return 0
  }
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
  try {
    const database = getDb()
    const now = Date.now()
    const nowDate = new Date(now)
    
    // Obtener usuario actual
    const user = getUser(params.userId)
    if (!user) {
      // Crear usuario si no existe
      createUser({ id: params.userId })
    }
    
    // Resetear contador mensual si es un nuevo mes
    const lastQueryAt = user?.lastQueryAt
    let queriesThisMonth = user?.queriesThisMonth || 0
    
    if (lastQueryAt) {
      const lastMonth = lastQueryAt.getMonth()
      const lastYear = lastQueryAt.getFullYear()
      const currentMonth = nowDate.getMonth()
      const currentYear = nowDate.getFullYear()
      
      if (lastMonth !== currentMonth || lastYear !== currentYear) {
        queriesThisMonth = 0
      }
    }
    
    // Incrementar contadores
    queriesThisMonth++
    const totalQueries = (user?.totalQueries || 0) + 1
    
    // Actualizar usuario
    database.prepare(`
      UPDATE users 
      SET queries_this_month = ?, 
          total_queries = ?, 
          last_query_at = ?
      WHERE id = ?
    `).run(queriesThisMonth, totalQueries, now, params.userId)
    
    // Registrar en log
    database.prepare(`
      INSERT INTO query_logs (user_id, query, timestamp, response_time, success)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      params.userId,
      params.query.substring(0, 1000), // Limitar longitud de query
      now,
      params.responseTime,
      params.success ? 1 : 0
    )
  } catch (error) {
    console.error('[auth] Error logging query:', error)
  }
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
  try {
    const user = getUser(userId)
    if (!user) return null
    
    // Asegurar que queriesThisMonth está actualizado (resetear si es nuevo mes)
    const queriesThisMonth = getQueriesThisMonth(userId)
    
    return {
      queriesThisMonth,
      totalQueries: user.totalQueries,
      tier: user.tier,
      lastQueryAt: user.lastQueryAt
    }
  } catch (error) {
    console.error('[auth] Error getting user stats:', error)
    return null
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
}): Array<{
  userId: string
  query: string
  timestamp: Date
  responseTime: number
  success: boolean
}> {
  try {
    const database = getDb()
    let query = 'SELECT * FROM query_logs WHERE 1=1'
    const args: any[] = []
    
    if (params.userId) {
      query += ' AND user_id = ?'
      args.push(params.userId)
    }
    
    if (params.startDate) {
      query += ' AND timestamp >= ?'
      args.push(params.startDate.getTime())
    }
    
    if (params.endDate) {
      query += ' AND timestamp <= ?'
      args.push(params.endDate.getTime())
    }
    
    query += ' ORDER BY timestamp DESC'
    
    if (params.limit) {
      query += ' LIMIT ?'
      args.push(params.limit)
    }
    
    const rows = database.prepare(query).all(...args) as any[]
    
    return rows.map(row => ({
      userId: row.user_id,
      query: row.query,
      timestamp: new Date(row.timestamp),
      responseTime: row.response_time,
      success: row.success === 1
    }))
  } catch (error) {
    console.error('[auth] Error getting query logs:', error)
    return []
  }
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
  try {
    const database = getDb()
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()
    
    // Total de usuarios
    const totalUsersRow = database.prepare('SELECT COUNT(*) as count FROM users').get() as any
    const totalUsers = totalUsersRow?.count || 0
    
    // Total de queries
    const totalQueriesRow = database.prepare('SELECT COUNT(*) as count FROM query_logs').get() as any
    const totalQueries = totalQueriesRow?.count || 0
    
    // Queries hoy
    const queriesTodayRow = database.prepare('SELECT COUNT(*) as count FROM query_logs WHERE timestamp >= ?').get(todayTimestamp) as any
    const queriesToday = queriesTodayRow?.count || 0
    
    // Promedio de tiempo de respuesta
    const avgResponseRow = database.prepare('SELECT AVG(response_time) as avg FROM query_logs').get() as any
    const averageResponseTime = avgResponseRow?.avg || 0
    
    // Tasa de éxito
    const successRow = database.prepare('SELECT COUNT(*) as count FROM query_logs WHERE success = 1').get() as any
    const successCount = successRow?.count || 0
    const successRate = totalQueries > 0 ? successCount / totalQueries : 0
    
    // Distribución por tier
    const tierRows = database.prepare('SELECT tier, COUNT(*) as count FROM users GROUP BY tier').all() as any[]
    const tierDistribution: Record<UserTier, number> = {
      free: 0,
      premium: 0
    }
    
    for (const row of tierRows) {
      tierDistribution[row.tier as UserTier] = row.count
    }
    
    return {
      totalUsers,
      totalQueries,
      queriesToday,
      averageResponseTime,
      successRate,
      tierDistribution
    }
  } catch (error) {
    console.error('[auth] Error getting system metrics:', error)
    return {
      totalUsers: 0,
      totalQueries: 0,
      queriesToday: 0,
      averageResponseTime: 0,
      successRate: 0,
      tierDistribution: { free: 0, premium: 0 }
    }
  }
}

/**
 * Consultas por día (últimos N días) para gráficos
 */
export function getQueriesPerDay(lastDays: number): Array<{ date: string; count: number }> {
  try {
    const database = getDb()
    const start = new Date()
    start.setDate(start.getDate() - lastDays)
    start.setHours(0, 0, 0, 0)
    const startTs = start.getTime()

    const rows = database.prepare(`
      SELECT date(timestamp/1000, 'unixepoch', 'localtime') as day, COUNT(*) as count
      FROM query_logs WHERE timestamp >= ?
      GROUP BY day ORDER BY day ASC
    `).all(startTs) as Array<{ day: string; count: number }>

    return rows.map(r => ({ date: r.day, count: r.count }))
  } catch (error) {
    console.error('[auth] Error getting queries per day:', error)
    return []
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
