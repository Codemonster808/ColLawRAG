/**
 * CU-03: Adaptador Neon Postgres para auth/tiers.
 * Se usa cuando DATABASE_URL está definido (ej. Vercel + Neon).
 * Esquema alineado con TAREAS_CURSOR.toon: users, query_logs, quality_metrics, user_feedback, ab_tests.
 */

import { neon } from '@neondatabase/serverless'

export type UserTier = 'free' | 'premium'

export interface UserRow {
  id: string
  email: string | null
  tier: UserTier
  created_at: number
  last_query_at: number | null
  queries_this_month: number
  total_queries: number
}

const getSql = () => {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required for Postgres')
  return neon(url)
}

/** Ejecutar una vez al desplegar (ej. script o primer request). Idempotente. */
export async function initPostgresSchema(): Promise<void> {
  const sql = getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      tier TEXT NOT NULL DEFAULT 'free',
      created_at BIGINT NOT NULL,
      last_query_at BIGINT,
      queries_this_month INTEGER NOT NULL DEFAULT 0,
      total_queries INTEGER NOT NULL DEFAULT 0
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier)`
  await sql`CREATE INDEX IF NOT EXISTS idx_users_last_query_at ON users(last_query_at)`

  await sql`
    CREATE TABLE IF NOT EXISTS query_logs (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      timestamp BIGINT NOT NULL,
      response_time INTEGER NOT NULL,
      success SMALLINT NOT NULL DEFAULT 1,
      legal_area TEXT,
      complexity TEXT
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_query_logs_user_id ON query_logs(user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_query_logs_timestamp ON query_logs(timestamp)`
  await sql`CREATE INDEX IF NOT EXISTS idx_query_logs_legal_area ON query_logs(legal_area)`

  await sql`
    CREATE TABLE IF NOT EXISTS quality_metrics (
      id SERIAL PRIMARY KEY,
      query_log_id INTEGER NOT NULL,
      citation_precision REAL,
      total_citations INTEGER,
      valid_citations INTEGER,
      response_length INTEGER,
      chunks_retrieved INTEGER,
      timestamp BIGINT NOT NULL
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_quality_metrics_query_log_id ON quality_metrics(query_log_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_quality_metrics_timestamp ON quality_metrics(timestamp)`

  await sql`
    CREATE TABLE IF NOT EXISTS user_feedback (
      id SERIAL PRIMARY KEY,
      query_log_id INTEGER,
      user_id TEXT,
      rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      timestamp BIGINT NOT NULL
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_user_feedback_query_log_id ON user_feedback(query_log_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_user_feedback_timestamp ON user_feedback(timestamp)`

  await sql`
    CREATE TABLE IF NOT EXISTS ab_tests (
      id SERIAL PRIMARY KEY,
      test_name TEXT NOT NULL,
      variant TEXT NOT NULL,
      user_id TEXT,
      query_log_id INTEGER,
      timestamp BIGINT NOT NULL
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_ab_tests_test_name ON ab_tests(test_name)`
  await sql`CREATE INDEX IF NOT EXISTS idx_ab_tests_user_id ON ab_tests(user_id)`
}

// Mapeo UserRow → User (compatible con lib/auth)
export function mapRowToUser(row: UserRow): { id: string; email?: string; tier: UserTier; createdAt: Date; lastQueryAt?: Date; queriesThisMonth: number; totalQueries: number } {
  return {
    id: row.id,
    email: row.email ?? undefined,
    tier: row.tier,
    createdAt: new Date(row.created_at),
    lastQueryAt: row.last_query_at != null ? new Date(row.last_query_at) : undefined,
    queriesThisMonth: row.queries_this_month,
    totalQueries: row.total_queries
  }
}

// --- Operaciones compatibles con la API de lib/auth (async) ---

export async function pgCreateUser(params: {
  id: string
  email?: string
  tier?: UserTier
}): Promise<ReturnType<typeof mapRowToUser>> {
  const sql = getSql()
  const now = Date.now()
  const tier = params.tier || 'free'
  await sql`
    INSERT INTO users (id, email, tier, created_at, queries_this_month, total_queries)
    VALUES (${params.id}, ${params.email ?? null}, ${tier}, ${now}, 0, 0)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      tier = EXCLUDED.tier
  `
  const row = await pgGetUser(params.id)
  return row ? mapRowToUser(row) : mapRowToUser({
    id: params.id,
    email: params.email ?? null,
    tier,
    created_at: now,
    last_query_at: null,
    queries_this_month: 0,
    total_queries: 0
  })
}

export async function pgGetUser(userId: string): Promise<UserRow | null> {
  const sql = getSql()
  const rows = await sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`
  const row = rows[0] as UserRow | undefined
  return row ?? null
}

export async function pgUpdateUserTier(userId: string, tier: UserTier): Promise<boolean> {
  const sql = getSql()
  const r = await sql`UPDATE users SET tier = ${tier} WHERE id = ${userId} RETURNING id`
  return Array.isArray(r) && r.length > 0
}

export async function pgLogQuery(params: {
  userId: string
  query: string
  responseTime: number
  success: boolean
  legalArea?: string
  complexity?: string
}): Promise<number> {
  const sql = getSql()
  const now = Date.now()
  const user = await pgGetUser(params.userId)
  if (!user) await pgCreateUser({ id: params.userId })

  let queriesThisMonth = (user?.queries_this_month ?? 0) + 1
  const totalQueries = (user?.total_queries ?? 0) + 1
  const lastQueryAt = user?.last_query_at
  if (lastQueryAt) {
    const last = new Date(lastQueryAt)
    const nowDate = new Date(now)
    if (last.getMonth() !== nowDate.getMonth() || last.getFullYear() !== nowDate.getFullYear()) {
      queriesThisMonth = 1
    }
  }

  await sql`
    UPDATE users
    SET queries_this_month = ${queriesThisMonth}, total_queries = ${totalQueries}, last_query_at = ${now}
    WHERE id = ${params.userId}
  `
  const insert = await sql`
    INSERT INTO query_logs (user_id, query, timestamp, response_time, success, legal_area, complexity)
    VALUES (
      ${params.userId},
      ${params.query.substring(0, 1000)},
      ${now},
      ${params.responseTime},
      ${params.success ? 1 : 0},
      ${params.legalArea ?? null},
      ${params.complexity ?? null}
    )
    RETURNING id
  `
  const id = (insert[0] as { id: number })?.id
  return id ?? 0
}

export async function pgGetQueriesThisMonth(userId: string): Promise<number> {
  const user = await pgGetUser(userId)
  if (!user || !user.last_query_at) return 0
  const now = new Date()
  const last = new Date(user.last_query_at)
  if (last.getMonth() !== now.getMonth() || last.getFullYear() !== now.getFullYear()) {
    return 0
  }
  return user.queries_this_month
}

export async function pgGetQueryLogs(params: {
  userId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
}): Promise<Array<{ userId: string; query: string; timestamp: Date; responseTime: number; success: boolean }>> {
  const sql = getSql()
  let query = 'SELECT user_id, query, timestamp, response_time, success FROM query_logs WHERE 1=1'
  const args: (string | number)[] = []
  if (params.userId) { query += ' AND user_id = $' + (args.length + 1); args.push(params.userId) }
  if (params.startDate) { query += ' AND timestamp >= $' + (args.length + 1); args.push(params.startDate.getTime()) }
  if (params.endDate) { query += ' AND timestamp <= $' + (args.length + 1); args.push(params.endDate.getTime()) }
  query += ' ORDER BY timestamp DESC'
  if (params.limit) { query += ' LIMIT $' + (args.length + 1); args.push(params.limit) }
  const rows = await sql.query(query, args) as Array<{ user_id: string; query: string; timestamp: number; response_time: number; success: number }>
  return rows.map(r => ({
    userId: r.user_id,
    query: r.query,
    timestamp: new Date(r.timestamp),
    responseTime: r.response_time,
    success: r.success === 1
  }))
}

export async function pgGetSystemMetrics(): Promise<{
  totalUsers: number
  totalQueries: number
  queriesToday: number
  averageResponseTime: number
  successRate: number
  tierDistribution: Record<UserTier, number>
}> {
  const sql = getSql()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTs = today.getTime()

  const totalUsersRow = await sql`SELECT COUNT(*)::int as count FROM users`
  const totalQueriesRow = await sql`SELECT COUNT(*)::int as count FROM query_logs`
  const queriesTodayRow = await sql`SELECT COUNT(*)::int as count FROM query_logs WHERE timestamp >= ${todayTs}`
  const avgRow = await sql`SELECT COALESCE(AVG(response_time), 0)::float as avg FROM query_logs`
  const successRow = await sql`SELECT COUNT(*)::int as count FROM query_logs WHERE success = 1`
  const tierRows = await sql`SELECT tier, COUNT(*)::int as count FROM users GROUP BY tier`

  const totalUsers = (totalUsersRow[0] as { count: number })?.count ?? 0
  const totalQueries = (totalQueriesRow[0] as { count: number })?.count ?? 0
  const successCount = (successRow[0] as { count: number })?.count ?? 0
  const tierDistribution: Record<UserTier, number> = { free: 0, premium: 0 }
  for (const r of tierRows as Array<{ tier: string; count: number }>) {
    tierDistribution[r.tier as UserTier] = r.count
  }

  return {
    totalUsers,
    totalQueries,
    queriesToday: (queriesTodayRow[0] as { count: number })?.count ?? 0,
    averageResponseTime: (avgRow[0] as { avg: number })?.avg ?? 0,
    successRate: totalQueries > 0 ? successCount / totalQueries : 0,
    tierDistribution
  }
}

export async function pgGetQueriesPerDay(lastDays: number): Promise<Array<{ date: string; count: number }>> {
  const sql = getSql()
  const start = new Date()
  start.setDate(start.getDate() - lastDays)
  start.setHours(0, 0, 0, 0)
  const startTs = start.getTime()
  const rows = await sql`
    SELECT to_char(to_timestamp(timestamp/1000), 'YYYY-MM-DD') as day, COUNT(*)::int as count
    FROM query_logs WHERE timestamp >= ${startTs}
    GROUP BY day ORDER BY day ASC
  ` as Array<{ day: string; count: number }>
  return rows.map(r => ({ date: r.day, count: r.count }))
}

export async function pgLogQualityMetrics(params: {
  queryLogId: number
  citationPrecision?: number
  totalCitations?: number
  validCitations?: number
  responseLength?: number
  chunksRetrieved?: number
}): Promise<void> {
  const sql = getSql()
  const now = Date.now()
  await sql`
    INSERT INTO quality_metrics (query_log_id, citation_precision, total_citations, valid_citations, response_length, chunks_retrieved, timestamp)
    VALUES (${params.queryLogId}, ${params.citationPrecision ?? null}, ${params.totalCitations ?? null}, ${params.validCitations ?? null}, ${params.responseLength ?? null}, ${params.chunksRetrieved ?? null}, ${now})
  `
}

export async function pgLogUserFeedback(params: {
  queryLogId?: number
  userId?: string
  rating: number
  comment?: string
}): Promise<void> {
  const sql = getSql()
  const now = Date.now()
  await sql`
    INSERT INTO user_feedback (query_log_id, user_id, rating, comment, timestamp)
    VALUES (${params.queryLogId ?? null}, ${params.userId ?? null}, ${params.rating}, ${params.comment ?? null}, ${now})
  `
}

export async function pgGetQualityMetrics(params?: {
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
  const sql = getSql()
  const empty = {
    averageCitationPrecision: 0,
    totalQueriesWithMetrics: 0,
    averageCitationsPerQuery: 0,
    averageValidCitations: 0,
    averageResponseLength: 0,
    averageChunksRetrieved: 0,
    precisionByArea: {} as Record<string, { precision: number; count: number }>,
    precisionByComplexity: {} as Record<string, { precision: number; count: number }>
  }
  try {
    const whereParts: string[] = ['1=1']
    const args: (number | string)[] = []
    if (params?.startDate) { whereParts.push(`qm.timestamp >= $${args.length + 1}`); args.push(params.startDate.getTime()) }
    if (params?.endDate) { whereParts.push(`qm.timestamp <= $${args.length + 1}`); args.push(params.endDate.getTime()) }
    if (params?.legalArea) { whereParts.push(`ql.legal_area = $${args.length + 1}`); args.push(params.legalArea) }
    const where = whereParts.join(' AND ')

    const metricsRow = await sql.query(`
      SELECT AVG(qm.citation_precision) as avg_precision, COUNT(*)::int as total_queries,
             AVG(qm.total_citations) as avg_total_citations, AVG(qm.valid_citations) as avg_valid_citations,
             AVG(qm.response_length) as avg_response_length, AVG(qm.chunks_retrieved) as avg_chunks_retrieved
      FROM quality_metrics qm JOIN query_logs ql ON qm.query_log_id = ql.id
      WHERE ${where}
    `, args) as Array<{ avg_precision: number; total_queries: number; avg_total_citations: number; avg_valid_citations: number; avg_response_length: number; avg_chunks_retrieved: number }>
    const m = metricsRow[0]
    if (!m) return empty

    const areaRows = await sql.query(`
      SELECT ql.legal_area, AVG(qm.citation_precision)::float as precision, COUNT(*)::int as count
      FROM quality_metrics qm JOIN query_logs ql ON qm.query_log_id = ql.id
      WHERE ${where} AND ql.legal_area IS NOT NULL GROUP BY ql.legal_area
    `, args) as Array<{ legal_area: string; precision: number; count: number }>
    const complexityRows = await sql.query(`
      SELECT ql.complexity, AVG(qm.citation_precision)::float as precision, COUNT(*)::int as count
      FROM quality_metrics qm JOIN query_logs ql ON qm.query_log_id = ql.id
      WHERE ${where} AND ql.complexity IS NOT NULL GROUP BY ql.complexity
    `, args) as Array<{ complexity: string; precision: number; count: number }>

    const precisionByArea: Record<string, { precision: number; count: number }> = {}
    for (const r of areaRows) precisionByArea[r.legal_area] = { precision: r.precision || 0, count: r.count || 0 }
    const precisionByComplexity: Record<string, { precision: number; count: number }> = {}
    for (const r of complexityRows) precisionByComplexity[r.complexity] = { precision: r.precision || 0, count: r.count || 0 }

    return {
      averageCitationPrecision: m.avg_precision ?? 0,
      totalQueriesWithMetrics: m.total_queries ?? 0,
      averageCitationsPerQuery: m.avg_total_citations ?? 0,
      averageValidCitations: m.avg_valid_citations ?? 0,
      averageResponseLength: m.avg_response_length ?? 0,
      averageChunksRetrieved: m.avg_chunks_retrieved ?? 0,
      precisionByArea,
      precisionByComplexity
    }
  } catch {
    return empty
  }
}

export async function pgGetSatisfactionMetrics(params?: {
  startDate?: Date
  endDate?: Date
}): Promise<{
  averageRating: number
  totalFeedback: number
  ratingDistribution: Record<number, number>
  feedbackWithComments: number
}> {
  const sql = getSql()
  const args: (number)[] = []
  let where = '1=1'
  if (params?.startDate) { where += ` AND timestamp >= $${args.length + 1}`; args.push(params.startDate.getTime()) }
  if (params?.endDate) { where += ` AND timestamp <= $${args.length + 1}`; args.push(params.endDate.getTime()) }
  const row = await sql.query(`SELECT AVG(rating)::float as avg_rating, COUNT(*)::int as total_feedback, SUM(CASE WHEN comment IS NOT NULL AND comment != '' THEN 1 ELSE 0 END)::int as with_comments FROM user_feedback WHERE ${where}`, args) as Array<{ avg_rating: number; total_feedback: number; with_comments: number }>
  const dist = await sql.query(`SELECT rating, COUNT(*)::int as count FROM user_feedback WHERE ${where} GROUP BY rating`, args) as Array<{ rating: number; count: number }>
  const ratingDistribution: Record<number, number> = {}
  for (const r of dist) ratingDistribution[r.rating] = r.count ?? 0
  const r = row[0]
  return {
    averageRating: r?.avg_rating ?? 0,
    totalFeedback: r?.total_feedback ?? 0,
    ratingDistribution,
    feedbackWithComments: r?.with_comments ?? 0
  }
}

export function pgAssignABTestVariant(_testName: string, userId: string): 'A' | 'B' {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return hash % 2 === 0 ? 'A' : 'B'
}

export async function pgLogABTest(params: {
  testName: string
  variant: 'A' | 'B'
  userId?: string
  queryLogId?: number
}): Promise<void> {
  const sql = getSql()
  const now = Date.now()
  await sql`
    INSERT INTO ab_tests (test_name, variant, user_id, query_log_id, timestamp)
    VALUES (${params.testName}, ${params.variant}, ${params.userId ?? null}, ${params.queryLogId ?? null}, ${now})
  `
}

export async function pgGetABTestResults(testName: string): Promise<{
  variantA: { count: number; avgResponseTime: number; avgSuccess: number }
  variantB: { count: number; avgResponseTime: number; avgSuccess: number }
}> {
  const sql = getSql()
  const a = await sql`
    SELECT COUNT(*)::int as count, COALESCE(AVG(ql.response_time), 0)::float as avg_response_time, COALESCE(AVG(ql.success), 0)::float as avg_success
    FROM ab_tests ab JOIN query_logs ql ON ab.query_log_id = ql.id
    WHERE ab.test_name = ${testName} AND ab.variant = 'A'
  ` as Array<{ count: number; avg_response_time: number; avg_success: number }>
  const b = await sql`
    SELECT COUNT(*)::int as count, COALESCE(AVG(ql.response_time), 0)::float as avg_response_time, COALESCE(AVG(ql.success), 0)::float as avg_success
    FROM ab_tests ab JOIN query_logs ql ON ab.query_log_id = ql.id
    WHERE ab.test_name = ${testName} AND ab.variant = 'B'
  ` as Array<{ count: number; avg_response_time: number; avg_success: number }>
  return {
    variantA: { count: a[0]?.count ?? 0, avgResponseTime: a[0]?.avg_response_time ?? 0, avgSuccess: a[0]?.avg_success ?? 0 },
    variantB: { count: b[0]?.count ?? 0, avgResponseTime: b[0]?.avg_response_time ?? 0, avgSuccess: b[0]?.avg_success ?? 0 }
  }
}
