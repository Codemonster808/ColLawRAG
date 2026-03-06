/**
 * Builds BM25 index from data/index.json and writes data/bm25-index.json.
 * Lee línea a línea para evitar ERR_STRING_TOO_LONG con índices >512MB.
 * Escribe el índice por streaming para evitar RangeError al serializar 36k+ docs.
 * Usage: npx tsx scripts/build-bm25.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { buildBM25Index, streamSerializeBM25Index } from '../../src/contexts/legal-search/infrastructure/sparse-search/Bm25SearchService'

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
    const jsonStr = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed
    try {
      const obj = JSON.parse(jsonStr) as { id: string; content: string; embedding?: number[] }
      docs.push({ id: obj.id, content: obj.content })
    } catch {
      // ignorar líneas malformadas
    }
  }

  console.log(`✅ ${docs.length} chunks leídos. Construyendo índice BM25...`)

  const index = buildBM25Index(docs)

  const dir = path.dirname(BM25_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createWriteStream(BM25_PATH, { encoding: 'utf-8' })
    stream.on('error', reject)
    stream.on('finish', () => resolve())
    try {
      streamSerializeBM25Index(index, stream)
      stream.end()
    } catch (err) {
      stream.destroy(err as Error)
      reject(err)
    }
  })

  console.log(`✅ Índice BM25 guardado en ${BM25_PATH} (${index.totalDocs} documentos)`)
}

main().catch(err => { console.error(err); process.exit(1) })
