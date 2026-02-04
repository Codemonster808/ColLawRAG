/**
 * Builds BM25 index from data/index.json and writes data/bm25-index.json.
 * Run after ingest so hybrid search can use the index.
 * Usage: npx tsx scripts/build-bm25.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { buildBM25Index, serializeBM25Index } from '../lib/bm25'

const INDEX_PATH = path.join(process.cwd(), 'data', 'index.json')
const BM25_PATH = path.join(process.cwd(), 'data', 'bm25-index.json')

function main() {
  if (!fs.existsSync(INDEX_PATH)) {
    console.error('❌ data/index.json no encontrado. Ejecuta npm run ingest primero.')
    process.exit(1)
  }

  const raw = fs.readFileSync(INDEX_PATH, 'utf-8')
  const chunks = JSON.parse(raw) as Array<{ id: string; content: string }>
  const docs = chunks.map((c) => ({ id: c.id, content: c.content }))

  const index = buildBM25Index(docs)
  const json = serializeBM25Index(index)

  const dir = path.dirname(BM25_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(BM25_PATH, json, 'utf-8')

  console.log(`✅ Índice BM25 guardado en ${BM25_PATH} (${index.totalDocs} documentos)`)
}

main()
