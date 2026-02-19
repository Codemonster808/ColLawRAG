#!/usr/bin/env node
/**
 * CU-03: Inicializa el esquema en Neon Postgres.
 * Uso: DATABASE_URL="postgresql://..." node scripts/init-postgres.mjs
 * Ejecutar una vez tras crear la base en Neon (o al desplegar).
 */
import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta DATABASE_URL. Ejemplo: DATABASE_URL="postgresql://user:pass@host/db" node scripts/init-postgres.mjs')
  process.exit(1)
}

const sql = neon(url)

async function main() {
  console.log('Creando tablas en Postgres (idempotente)...')
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

  console.log('Esquema Postgres listo.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
