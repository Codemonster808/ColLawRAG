/**
 * Rate limiting persistente usando SQLite
 * Reemplaza el rate limiting en memoria para sobrevivir a cold starts
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'rate-limit.db')

// Asegurar que el directorio existe
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    
    // Crear tabla de rate limiting si no existe
    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limit (
        client_id TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_reset_at ON rate_limit(reset_at);
    `)
    
    // Limpiar entradas expiradas al iniciar
    db.exec(`DELETE FROM rate_limit WHERE reset_at < ${Date.now()}`)
  }
  return db
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

export function checkRateLimit(
  clientId: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  try {
    const database = getDb()
    const now = Date.now()
    
    const row = database.prepare('SELECT count, reset_at FROM rate_limit WHERE client_id = ?').get(clientId) as any
    
    if (!row || now > row.reset_at) {
      // Crear nueva entrada
      const resetAt = now + windowMs
      database.prepare(`
        INSERT OR REPLACE INTO rate_limit (client_id, count, reset_at)
        VALUES (?, 1, ?)
      `).run(clientId, resetAt)
      
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt
      }
    }
    
    if (row.count >= limit) {
      const retryAfter = Math.ceil((row.reset_at - now) / 1000)
      return {
        allowed: false,
        remaining: 0,
        resetAt: row.reset_at,
        retryAfter
      }
    }
    
    // Incrementar contador
    database.prepare('UPDATE rate_limit SET count = count + 1 WHERE client_id = ?').run(clientId)
    const newCount = row.count + 1
    
    return {
      allowed: true,
      remaining: limit - newCount,
      resetAt: row.reset_at
    }
  } catch (error) {
    console.error('[rate-limit-persistent] Error checking rate limit:', error)
    // En caso de error, permitir la request
    return {
      allowed: true,
      remaining: limit,
      resetAt: Date.now() + windowMs
    }
  }
}

// Limpiar entradas expiradas periódicamente
setInterval(() => {
  try {
    const database = getDb()
    database.exec(`DELETE FROM rate_limit WHERE reset_at < ${Date.now()}`)
  } catch (error) {
    console.error('[rate-limit-persistent] Error cleaning expired entries:', error)
  }
}, 5 * 60 * 1000) // Cada 5 minutos
