/**
 * Cache persistente usando SQLite
 * Reemplaza el cache en memoria para sobrevivir a cold starts
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'cache.db')

// Asegurar que el directorio existe
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    
    // Crear tabla de cache si no existe
    db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_expires_at ON cache(expires_at);
    `)
    
    // Limpiar entradas expiradas al iniciar
    db.exec(`DELETE FROM cache WHERE expires_at < ${Date.now()}`)
  }
  return db
}

const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || '60000', 10) // 60 segundos por defecto

export function cacheGet(key: string): any | undefined {
  try {
    const database = getDb()
    const row = database.prepare('SELECT value, expires_at FROM cache WHERE key = ?').get(key) as any
    
    if (!row) return undefined
    
    // Verificar si expiró
    if (Date.now() > row.expires_at) {
      cacheDelete(key)
      return undefined
    }
    
    return JSON.parse(row.value)
  } catch (error) {
    console.error('[cache-persistent] Error getting cache:', error)
    return undefined
  }
}

export function cacheSet(key: string, value: any): void {
  try {
    const database = getDb()
    const expiresAt = Date.now() + CACHE_TTL_MS
    const valueStr = JSON.stringify(value)
    
    database.prepare(`
      INSERT OR REPLACE INTO cache (key, value, expires_at)
      VALUES (?, ?, ?)
    `).run(key, valueStr, expiresAt)
  } catch (error) {
    console.error('[cache-persistent] Error setting cache:', error)
  }
}

export function cacheDelete(key: string): void {
  try {
    const database = getDb()
    database.prepare('DELETE FROM cache WHERE key = ?').run(key)
  } catch (error) {
    console.error('[cache-persistent] Error deleting cache:', error)
  }
}

export function cacheClear(): void {
  try {
    const database = getDb()
    database.exec('DELETE FROM cache')
  } catch (error) {
    console.error('[cache-persistent] Error clearing cache:', error)
  }
}

// Limpiar entradas expiradas periódicamente
setInterval(() => {
  try {
    const database = getDb()
    database.exec(`DELETE FROM cache WHERE expires_at < ${Date.now()}`)
  } catch (error) {
    console.error('[cache-persistent] Error cleaning expired entries:', error)
  }
}, 5 * 60 * 1000) // Cada 5 minutos
