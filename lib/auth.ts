/**
 * Sistema de autenticación y métricas de uso.
 * Persistencia: SQLite (local) o Neon Postgres cuando DATABASE_URL está definido (CU-03).
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { type UserTier } from './tiers'
import * as pg from './db-postgres'

const usePostgres = typeof process !== 'undefined' && !!process.env.DATABASE_URL

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
        legal_area TEXT,
        complexity TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_id ON query_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON query_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_legal_area ON query_logs(legal_area);
    `)
    
    // Crear tabla de métricas de calidad si no existe
    db.exec(`
      CREATE TABLE IF NOT EXISTS quality_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_log_id INTEGER NOT NULL,
        citation_precision REAL,
        total_citations INTEGER,
        valid_citations INTEGER,
        response_length INTEGER,
        chunks_retrieved INTEGER,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (query_log_id) REFERENCES query_logs(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_query_log_id ON quality_metrics(query_log_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp_qm ON quality_metrics(timestamp);
    `)
    
    // Crear tabla de feedback de usuarios si no existe
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_log_id INTEGER,
        user_id TEXT,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (query_log_id) REFERENCES query_logs(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_query_log_feedback ON user_feedback(query_log_id);
      CREATE INDEX IF NOT EXISTS idx_user_feedback ON user_feedback(user_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp_feedback ON user_feedback(timestamp);
    `)
    
    // Crear tabla de A/B testing si no existe
    db.exec(`
      CREATE TABLE IF NOT EXISTS ab_tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_name TEXT NOT NULL,
        variant TEXT NOT NULL,
        user_id TEXT,
        query_log_id INTEGER,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (query_log_id) REFERENCES query_logs(id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_test_name ON ab_tests(test_name);
      CREATE INDEX IF NOT EXISTS idx_user_ab ON ab_tests(user_id);
    `)
  }
  return db
}

/**
 * Crea un nuevo usuario (free tier por defecto). Async cuando DATABASE_URL (Postgres).
 */
function createUserSync(params: { id: string; email?: string; tier?: UserTier }): User {
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

export async function createUser(params: { id: string; email?: string; tier?: UserTier }): Promise<User> {
  if (usePostgres) return pg.pgCreateUser(params)
  return Promise.resolve(createUserSync(params))
}

/**
 * Obtiene un usuario por ID. Async cuando DATABASE_URL (Postgres).
 */
function getUserSync(userId: string): User | null {
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

export async function getUser(userId: string): Promise<User | null> {
  if (usePostgres) {
    const row = await pg.pgGetUser(userId)
    return row ? pg.mapRowToUser(row) : null
  }
  return Promise.resolve(getUserSync(userId))
}

/**
 * Autentica un usuario por ID (simplificado). Async cuando DATABASE_URL (Postgres).
 */
export async function authenticateUser(userIdOrToken: string): Promise<User | null> {
  const user = await getUser(userIdOrToken)
  if (user) return user
  return createUser({ id: userIdOrToken, tier: 'free' })
}

/**
 * Actualiza el tier de un usuario. Async cuando DATABASE_URL (Postgres).
 */
function updateUserTierSync(userId: string, tier: UserTier): boolean {
  try {
    const database = getDb()
    const result = database.prepare('UPDATE users SET tier = ? WHERE id = ?').run(tier, userId)
    return result.changes > 0
  } catch (error) {
    console.error('[auth] Error updating user tier:', error)
    return false
  }
}

export async function updateUserTier(userId: string, tier: UserTier): Promise<boolean> {
  if (usePostgres) return pg.pgUpdateUserTier(userId, tier)
  return Promise.resolve(updateUserTierSync(userId, tier))
}

/**
 * Obtiene el número de consultas del mes actual para un usuario
 * Resetea el contador si es un nuevo mes
 */
function getQueriesThisMonth(userId: string): number {
  try {
    const database = getDb()
    const user = getUserSync(userId)
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
 * Registra una consulta realizada por un usuario. Async cuando DATABASE_URL (Postgres).
 */
function logQuerySync(params: {
  userId: string
  query: string
  responseTime: number
  success: boolean
  legalArea?: string
  complexity?: 'simple' | 'medium' | 'complex'
}): number {
  try {
    const database = getDb()
    const now = Date.now()
    const nowDate = new Date(now)
    
    // Obtener usuario actual
    const user = getUserSync(params.userId)
    if (!user) {
      createUserSync({ id: params.userId })
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
    const result = database.prepare(`
      INSERT INTO query_logs (user_id, query, timestamp, response_time, success, legal_area, complexity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.userId,
      params.query.substring(0, 1000), // Limitar longitud de query
      now,
      params.responseTime,
      params.success ? 1 : 0,
      params.legalArea || null,
      params.complexity || null
    )
    
    return result.lastInsertRowid as number
  } catch (error) {
    console.error('[auth] Error logging query:', error)
    return 0
  }
}

export async function logQuery(params: {
  userId: string
  query: string
  responseTime: number
  success: boolean
  legalArea?: string
  complexity?: 'simple' | 'medium' | 'complex'
}): Promise<number> {
  if (usePostgres) return pg.pgLogQuery(params)
  return Promise.resolve(logQuerySync(params))
}

/**
 * Obtiene estadísticas de uso de un usuario. Async cuando DATABASE_URL (Postgres).
 */
function getUserStatsSync(userId: string): {
  queriesThisMonth: number
  totalQueries: number
  tier: UserTier
  lastQueryAt?: Date
} | null {
  try {
    const user = getUserSync(userId)
    if (!user) return null
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

export async function getUserStats(userId: string): Promise<{
  queriesThisMonth: number
  totalQueries: number
  tier: UserTier
  lastQueryAt?: Date
} | null> {
  if (usePostgres) {
    const user = await pg.pgGetUser(userId)
    if (!user) return null
    const queriesThisMonth = await pg.pgGetQueriesThisMonth(userId)
    return {
      queriesThisMonth,
      totalQueries: user.total_queries,
      tier: user.tier,
      lastQueryAt: user.last_query_at != null ? new Date(user.last_query_at) : undefined
    }
  }
  return Promise.resolve(getUserStatsSync(userId))
}

/**
 * Obtiene logs de consultas (útil para analytics). Async cuando DATABASE_URL (Postgres).
 */
function getQueryLogsSync(params: {
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

export async function getQueryLogs(params: {
  userId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
}): Promise<Array<{ userId: string; query: string; timestamp: Date; responseTime: number; success: boolean }>> {
  if (usePostgres) return pg.pgGetQueryLogs(params)
  return Promise.resolve(getQueryLogsSync(params))
}

/**
 * Obtiene métricas agregadas del sistema. Async cuando DATABASE_URL (Postgres).
 */
function getSystemMetricsSync(): {
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

export async function getSystemMetrics(): Promise<{
  totalUsers: number
  totalQueries: number
  queriesToday: number
  averageResponseTime: number
  successRate: number
  tierDistribution: Record<UserTier, number>
}> {
  if (usePostgres) return pg.pgGetSystemMetrics()
  return Promise.resolve(getSystemMetricsSync())
}

/**
 * Consultas por día (últimos N días) para gráficos. Async cuando DATABASE_URL (Postgres).
 */
function getQueriesPerDaySync(lastDays: number): Array<{ date: string; count: number }> {
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

export async function getQueriesPerDay(lastDays: number): Promise<Array<{ date: string; count: number }>> {
  if (usePostgres) return pg.pgGetQueriesPerDay(lastDays)
  return Promise.resolve(getQueriesPerDaySync(lastDays))
}

/**
 * Autenticación básica por API key (para desarrollo). Async cuando DATABASE_URL (Postgres).
 */
export async function authenticateByApiKey(apiKey: string): Promise<User | null> {
  const user = await getUser(apiKey)
  return user ?? null
}

/**
 * Registra métricas de calidad para una consulta. Async cuando DATABASE_URL (Postgres).
 */
export async function logQualityMetrics(params: {
  queryLogId: number
  citationPrecision?: number
  totalCitations?: number
  validCitations?: number
  responseLength?: number
  chunksRetrieved?: number
}): Promise<void> {
  if (usePostgres) {
    await pg.pgLogQualityMetrics(params)
    return
  }
  try {
    const database = getDb()
    const now = Date.now()
    database.prepare(`
      INSERT INTO quality_metrics (query_log_id, citation_precision, total_citations, valid_citations, response_length, chunks_retrieved, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(params.queryLogId, params.citationPrecision ?? null, params.totalCitations ?? null, params.validCitations ?? null, params.responseLength ?? null, params.chunksRetrieved ?? null, now)
  } catch (error) {
    console.error('[auth] Error logging quality metrics:', error)
  }
}

/**
 * Registra feedback de un usuario. Async cuando DATABASE_URL (Postgres).
 */
export async function logUserFeedback(params: {
  queryLogId?: number
  userId?: string
  rating: number
  comment?: string
}): Promise<void> {
  if (usePostgres) {
    await pg.pgLogUserFeedback(params)
    return
  }
  try {
    const database = getDb()
    const now = Date.now()
    database.prepare(`
      INSERT INTO user_feedback (query_log_id, user_id, rating, comment, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(params.queryLogId ?? null, params.userId ?? null, params.rating, params.comment ?? null, now)
  } catch (error) {
    console.error('[auth] Error logging user feedback:', error)
  }
}

/**
 * Obtiene métricas de calidad agregadas. Async cuando DATABASE_URL (Postgres).
 */
function getQualityMetricsSync(params?: {
  startDate?: Date
  endDate?: Date
  legalArea?: string
}): {
  averageCitationPrecision: number
  totalQueriesWithMetrics: number
  averageCitationsPerQuery: number
  averageValidCitations: number
  averageResponseLength: number
  averageChunksRetrieved: number
  precisionByArea: Record<string, { precision: number; count: number }>
  precisionByComplexity: Record<string, { precision: number; count: number }>
} {
  try {
    const database = getDb()
    
    let whereClause = '1=1'
    const paramsArray: any[] = []
    
    if (params?.startDate) {
      whereClause += ' AND qm.timestamp >= ?'
      paramsArray.push(params.startDate.getTime())
    }
    
    if (params?.endDate) {
      whereClause += ' AND qm.timestamp <= ?'
      paramsArray.push(params.endDate.getTime())
    }
    
    if (params?.legalArea) {
      whereClause += ' AND ql.legal_area = ?'
      paramsArray.push(params.legalArea)
    }
    
    // Métricas generales
    const metricsRow = database.prepare(`
      SELECT 
        AVG(qm.citation_precision) as avg_precision,
        COUNT(*) as total_queries,
        AVG(qm.total_citations) as avg_total_citations,
        AVG(qm.valid_citations) as avg_valid_citations,
        AVG(qm.response_length) as avg_response_length,
        AVG(qm.chunks_retrieved) as avg_chunks_retrieved
      FROM quality_metrics qm
      JOIN query_logs ql ON qm.query_log_id = ql.id
      WHERE ${whereClause}
    `).get(...paramsArray) as any
    
    // Precisión por área legal
    const areaRows = database.prepare(`
      SELECT 
        ql.legal_area,
        AVG(qm.citation_precision) as precision,
        COUNT(*) as count
      FROM quality_metrics qm
      JOIN query_logs ql ON qm.query_log_id = ql.id
      WHERE ${whereClause} AND ql.legal_area IS NOT NULL
      GROUP BY ql.legal_area
    `).all(...paramsArray) as any[]
    
    const precisionByArea: Record<string, { precision: number; count: number }> = {}
    for (const row of areaRows) {
      precisionByArea[row.legal_area] = {
        precision: row.precision || 0,
        count: row.count || 0
      }
    }
    
    // Precisión por complejidad
    const complexityRows = database.prepare(`
      SELECT 
        ql.complexity,
        AVG(qm.citation_precision) as precision,
        COUNT(*) as count
      FROM quality_metrics qm
      JOIN query_logs ql ON qm.query_log_id = ql.id
      WHERE ${whereClause} AND ql.complexity IS NOT NULL
      GROUP BY ql.complexity
    `).all(...paramsArray) as any[]
    
    const precisionByComplexity: Record<string, { precision: number; count: number }> = {}
    for (const row of complexityRows) {
      precisionByComplexity[row.complexity] = {
        precision: row.precision || 0,
        count: row.count || 0
      }
    }
    
    return {
      averageCitationPrecision: metricsRow?.avg_precision || 0,
      totalQueriesWithMetrics: metricsRow?.total_queries || 0,
      averageCitationsPerQuery: metricsRow?.avg_total_citations || 0,
      averageValidCitations: metricsRow?.avg_valid_citations || 0,
      averageResponseLength: metricsRow?.avg_response_length || 0,
      averageChunksRetrieved: metricsRow?.avg_chunks_retrieved || 0,
      precisionByArea,
      precisionByComplexity
    }
  } catch (error) {
    console.error('[auth] Error getting quality metrics:', error)
    return {
      averageCitationPrecision: 0,
      totalQueriesWithMetrics: 0,
      averageCitationsPerQuery: 0,
      averageValidCitations: 0,
      averageResponseLength: 0,
      averageChunksRetrieved: 0,
      precisionByArea: {},
      precisionByComplexity: {}
    }
  }
}

export async function getQualityMetrics(params?: {
  startDate?: Date
  endDate?: Date
  legalArea?: string
}): Promise<{
  averageCitationPrecision: number
  totalQueriesWithMetrics: number
  averageCitationsPerQuery: number
  averageValidCitations: number
  averageResponseLength: number
  averageChunksRetrieved: number
  precisionByArea: Record<string, { precision: number; count: number }>
  precisionByComplexity: Record<string, { precision: number; count: number }>
}> {
  if (usePostgres) return pg.pgGetQualityMetrics(params)
  return Promise.resolve(getQualityMetricsSync(params))
}

/**
 * Obtiene métricas de satisfacción (feedback). Async cuando DATABASE_URL (Postgres).
 */
function getSatisfactionMetricsSync(params?: { startDate?: Date; endDate?: Date }): {
  averageRating: number
  totalFeedback: number
  ratingDistribution: Record<number, number>
  feedbackWithComments: number
} {
  try {
    const database = getDb()
    
    let whereClause = '1=1'
    const paramsArray: any[] = []
    
    if (params?.startDate) {
      whereClause += ' AND timestamp >= ?'
      paramsArray.push(params.startDate.getTime())
    }
    
    if (params?.endDate) {
      whereClause += ' AND timestamp <= ?'
      paramsArray.push(params.endDate.getTime())
    }
    
    const metricsRow = database.prepare(`
      SELECT 
        AVG(rating) as avg_rating,
        COUNT(*) as total_feedback,
        SUM(CASE WHEN comment IS NOT NULL AND comment != '' THEN 1 ELSE 0 END) as with_comments
      FROM user_feedback
      WHERE ${whereClause}
    `).get(...paramsArray) as any
    
    const distributionRows = database.prepare(`
      SELECT rating, COUNT(*) as count
      FROM user_feedback
      WHERE ${whereClause}
      GROUP BY rating
    `).all(...paramsArray) as any[]
    
    const ratingDistribution: Record<number, number> = {}
    for (const row of distributionRows) {
      ratingDistribution[row.rating] = row.count || 0
    }
    
    return {
      averageRating: metricsRow?.avg_rating || 0,
      totalFeedback: metricsRow?.total_feedback || 0,
      ratingDistribution,
      feedbackWithComments: metricsRow?.with_comments || 0
    }
  } catch (error) {
    console.error('[auth] Error getting satisfaction metrics:', error)
    return {
      averageRating: 0,
      totalFeedback: 0,
      ratingDistribution: {},
      feedbackWithComments: 0
    }
  }
}

export async function getSatisfactionMetrics(params?: { startDate?: Date; endDate?: Date }): Promise<{
  averageRating: number
  totalFeedback: number
  ratingDistribution: Record<number, number>
  feedbackWithComments: number
}> {
  if (usePostgres) return pg.pgGetSatisfactionMetrics(params)
  return Promise.resolve(getSatisfactionMetricsSync(params))
}

/**
 * Sistema básico de A/B testing. Sync (sin DB en Postgres para asignación).
 */
export function assignABTestVariant(testName: string, userId: string): 'A' | 'B' {
  if (usePostgres) return pg.pgAssignABTestVariant(testName, userId)
  try {
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return hash % 2 === 0 ? 'A' : 'B'
  } catch (error) {
    console.error('[auth] Error assigning AB test variant:', error)
    return 'A'
  }
}

export async function logABTest(params: {
  testName: string
  variant: 'A' | 'B'
  userId?: string
  queryLogId?: number
}): Promise<void> {
  if (usePostgres) {
    await pg.pgLogABTest(params)
    return
  }
  try {
    const database = getDb()
    const now = Date.now()
    database.prepare(`
      INSERT INTO ab_tests (test_name, variant, user_id, query_log_id, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(params.testName, params.variant, params.userId ?? null, params.queryLogId ?? null, now)
  } catch (error) {
    console.error('[auth] Error logging AB test:', error)
  }
}

export async function getABTestResults(testName: string): Promise<{
  variantA: { count: number; avgResponseTime: number; avgSuccess: number }
  variantB: { count: number; avgResponseTime: number; avgSuccess: number }
}> {
  if (usePostgres) return pg.pgGetABTestResults(testName)
  try {
    const database = getDb()
    const variantARow = database.prepare(`
      SELECT COUNT(*) as count, AVG(ql.response_time) as avg_response_time, AVG(ql.success) as avg_success
      FROM ab_tests ab JOIN query_logs ql ON ab.query_log_id = ql.id
      WHERE ab.test_name = ? AND ab.variant = 'A'
    `).get(testName) as any
    const variantBRow = database.prepare(`
      SELECT COUNT(*) as count, AVG(ql.response_time) as avg_response_time, AVG(ql.success) as avg_success
      FROM ab_tests ab JOIN query_logs ql ON ab.query_log_id = ql.id
      WHERE ab.test_name = ? AND ab.variant = 'B'
    `).get(testName) as any
    return Promise.resolve({
      variantA: { count: variantARow?.count || 0, avgResponseTime: variantARow?.avg_response_time || 0, avgSuccess: variantARow?.avg_success || 0 },
      variantB: { count: variantBRow?.count || 0, avgResponseTime: variantBRow?.avg_response_time || 0, avgSuccess: variantBRow?.avg_success || 0 }
    })
  } catch (error) {
    console.error('[auth] Error getting AB test results:', error)
    return { variantA: { count: 0, avgResponseTime: 0, avgSuccess: 0 }, variantB: { count: 0, avgResponseTime: 0, avgSuccess: 0 } }
  }
}
