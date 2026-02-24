/**
 * Builds HNSW vector index from data/index.json and writes data/hnsw-index.dat + data/hnsw-ids.txt.
 * FASE_1 tarea 1.1. Run after ingest (or as part of npm run ingest).
 * Usage: npx tsx scripts/build-hnsw.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { buildAndSaveHNSW } from '../lib/vector-index'

const INDEX_PATH = path.join(process.cwd(), 'data', 'index.json')

async function main() {
  if (!fs.existsSync(INDEX_PATH)) {
    console.warn('⚠️  data/index.json no encontrado. Ejecuta npm run ingest primero. Saltando HNSW.')
    process.exit(0)
  }

  console.log('📖 Leyendo index.json para HNSW...')
  const chunks: Array<{ id: string; embedding: number[] }> = []
  const rl = readline.createInterface({
    input: fs.createReadStream(INDEX_PATH),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed || trimmed === '[' || trimmed === ']') continue
    const jsonStr = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed
    try {
      const obj = JSON.parse(jsonStr) as { id: string; embedding?: number[] }
      if (obj.embedding && Array.isArray(obj.embedding)) {
        chunks.push({ id: obj.id, embedding: obj.embedding })
      }
    } catch {
      // skip malformed
    }
  }

  if (chunks.length === 0) {
    console.warn('⚠️  No se encontraron chunks con embedding. Saltando HNSW.')
    process.exit(0)
  }

  console.log(`✅ ${chunks.length} chunks con embedding. Construyendo HNSW...`)
  buildAndSaveHNSW(chunks)
  console.log('✅ HNSW listo.')
}

main().catch(err => { console.error(err); process.exit(1) })
