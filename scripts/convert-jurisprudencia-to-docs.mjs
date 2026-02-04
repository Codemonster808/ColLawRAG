/**
 * Convierte la salida JSON del scraper de jurisprudencia a .txt en data/documents/
 * para que npm run ingest los indexe.
 *
 * Uso:
 *   node scripts/convert-jurisprudencia-to-docs.mjs [ruta.json]
 *   node scripts/convert-jurisprudencia-to-docs.mjs   # usa data/jurisprudencia.json por defecto
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DEFAULT_INPUT = path.join(ROOT, 'data', 'jurisprudencia.json')
const OUT_DIR = path.join(ROOT, 'data', 'documents')

function sanitizeId(id) {
  return String(id).replace(/[^a-zA-Z0-9\-_.]/g, '_')
}

function sentenciaToTxt(s) {
  const lines = []
  const topic = s.topic || s.tema || ''
  const title = `Sentencia ${s.id}${topic ? ' - ' + topic : ''}`
  lines.push(`# ${title}`)
  if (s.date) lines.push(`Fecha: ${s.date}`)
  if (s.magistrate) lines.push(`Magistrado: ${s.magistrate}`)
  if (s.court) lines.push(`Corte: ${s.court}`)
  if (s.url) lines.push(`URL: ${s.url}`)
  if (s.type) lines.push(`Tipo: ${s.type}`)
  if (s.keywords?.length) lines.push(`Palabras clave: ${s.keywords.join(', ')}`)
  lines.push('')
  lines.push(s.content || s.texto || '')
  return lines.join('\n')
}

function main() {
  const inputPath = process.argv[2] || DEFAULT_INPUT
  if (!fs.existsSync(inputPath)) {
    console.error('❌ No se encontró:', inputPath)
    console.error('   Uso: node scripts/convert-jurisprudencia-to-docs.mjs [ruta.json]')
    console.error('   El scraper debe guardar un JSON con array de sentencias: [{ id, type, date, court, magistrate, topic, content, url, keywords }, ...]')
    process.exit(1)
  }

  const raw = fs.readFileSync(inputPath, 'utf-8')
  let list
  try {
    const data = JSON.parse(raw)
    list = Array.isArray(data) ? data : (data.sentencias || data.items || [])
  } catch (e) {
    console.error('❌ JSON inválido:', inputPath, e.message)
    process.exit(1)
  }

  if (!list.length) {
    console.warn('⚠️ No hay sentencias en el archivo.')
    process.exit(0)
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  let written = 0
  for (const s of list) {
    const id = s.id || `sentencia-${written + 1}`
    const safeId = sanitizeId(id)
    const filename = `jurisprudencia_${safeId}.txt`
    const outPath = path.join(OUT_DIR, filename)
    fs.writeFileSync(outPath, sentenciaToTxt(s), 'utf-8')
    written++
  }

  console.log(`✅ ${written} sentencias escritas en ${OUT_DIR}`)
  console.log('   Ejecuta npm run ingest para indexar.')
}

main()
