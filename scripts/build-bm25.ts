/**
 * Builds BM25 index from data/index.json and writes data/bm25-index.json.
 * Lee línea a línea para evitar ERR_STRING_TOO_LONG con índices >512MB.
 * Usage: npx tsx scripts/build-bm25.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { buildBM25Index, serializeBM25Index } from '../lib/bm25'

const INDEX_PATH = path.join(process.cwd(), 'data', 'index.json')
const BM25_PATH = path.join(process.cwd(), 'data', 'bm25-index.json')

async function main() {
  if (!fs.existsSync(INDEX_PATH)) {
    console.error('❌ data/index.json no encontrado. Ejecuta npm run ingest primero.')
    process.exit(1)
  }

  console.log('📖 Leyendo index.json línea a línea...')
  const docs: Array<{ id: string; content: string }> = []

  const rl = readline.createInterface({
    input: fs.createReadStream(INDEX_PATH),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed || trimmed === '[' || trimmed === ']') continue
    // Cada línea es un objeto JSON seguido de una coma opcional
    const jsonStr = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed
    try {
      const obj = JSON.parse(jsonStr) as { id: string; content: string; embedding?: number[] }
      // Solo guardamos id y content para BM25 (no embedding)
      docs.push({ id: obj.id, content: obj.content })
    } catch {
      // ignorar líneas malformadas
    }
  }

  console.log(`✅ ${docs.length} chunks leídos. Construyendo índice BM25...`)

  const index = buildBM25Index(docs)
  const json = serializeBM25Index(index)

  const dir = path.dirname(BM25_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(BM25_PATH, json, 'utf-8')

  console.log(`✅ Índice BM25 guardado en ${BM25_PATH} (${index.totalDocs} documentos)`)
}

main().catch(err => { console.error(err); process.exit(1) })
