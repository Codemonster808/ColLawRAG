#!/usr/bin/env node
/**
 * annotate-retrieval-ground-truth.mjs
 * FASE_5 5.1: Anota hasta 50 casos del dataset con chunks_esperados (ground truth de retrieval).
 * Llama al API de retrieval por pregunta y asigna chunks_esperados = ids de chunks que coinciden
 * con normas_clave (o el top-1 si no hay coincidencia).
 *
 * Uso: node scripts/annotate-retrieval-ground-truth.mjs [--url URL] [--limit N] [--dry-run]
 * Requiere: servidor RAG corriendo (npm run dev) o --url con endpoint /api/retrieval
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const args = process.argv.slice(2)
const getArg = (flag, def) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : def
}
const API_URL = getArg('--url', 'http://localhost:3000')
const LIMIT = parseInt(getArg('--limit', '50'), 10)
const DRY_RUN = args.includes('--dry-run')
const DATASET_PATH = getArg('--dataset', join(ROOT, 'data/benchmarks/qa-abogados.json'))

function normalizeForMatch(str) {
  if (!str || typeof str !== 'string') return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
}

/** Verifica si un chunk (title + snippet) contiene la norma esperada (ej. "Art. 186 CST"). */
function chunkMatchesNorma(chunk, norma) {
  const n = normalizeForMatch(norma)
  const text = normalizeForMatch((chunk.title || '') + ' ' + (chunk.contentSnippet || ''))
  if (!n || !text) return false
  const artNum = (n.match(/\d+/) || [])[0]
  const hasNum = !artNum || text.includes(artNum)
  const siglas = n.replace(/\d+/g, '').replace(/\s+/g, '').slice(0, 10)
  const hasSiglas = siglas.length <= 2 || text.includes('codigo') || text.includes('cst') || text.includes('ley') || text.includes('decreto') || text.includes('constitucion') || text.includes('civil') || text.includes('penal') || text.includes('tributario') || text.includes('laboral')
  return hasNum && (siglas.length <= 2 || hasSiglas || text.includes(n.slice(0, 20)))
}

async function fetchRetrieval(query) {
  const maxRetries = 5
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(`${API_URL}/api/retrieval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK: 10 }),
      signal: AbortSignal.timeout(90_000),
    })
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}))
      const wait = (body.retryAfter || 50) * 1000
      if (attempt < maxRetries - 1) {
        process.stdout.write(`  (429, esperando ${Math.ceil(wait / 1000)}s)... `)
        await new Promise((r) => setTimeout(r, wait))
        continue
      }
    }
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
    return res.json()
  }
  throw new Error('API 429 después de reintentos')
}

async function main() {
  if (!existsSync(DATASET_PATH)) {
    console.error('Dataset no encontrado:', DATASET_PATH)
    process.exit(1)
  }
  const dataset = JSON.parse(readFileSync(DATASET_PATH, 'utf8'))
  const casos = dataset.casos || dataset
  const toAnnotate = casos.slice(0, LIMIT)

  console.log('Anotando ground truth retrieval:', toAnnotate.length, 'casos')
  console.log('API:', API_URL, '| Dry run:', DRY_RUN)

  let annotated = 0
  for (let i = 0; i < toAnnotate.length; i++) {
    const caso = toAnnotate[i]
    const normas = Array.isArray(caso.normas_clave) ? caso.normas_clave : []
    try {
      const { chunks = [] } = await fetchRetrieval(caso.pregunta)
      const expectedIds = []
      for (const c of chunks) {
        if (normas.some((n) => chunkMatchesNorma(c, n))) expectedIds.push(c.id)
      }
      if (expectedIds.length === 0 && chunks.length > 0) expectedIds.push(chunks[0].id)
      caso.chunks_esperados = [...new Set(expectedIds)]
      annotated++
      if ((i + 1) % 10 === 0) console.log('  ', i + 1, '/', toAnnotate.length)
    } catch (err) {
      console.warn('  Error caso', caso.id, err.message)
    }
  }

  if (!DRY_RUN && annotated > 0) {
    writeFileSync(DATASET_PATH, JSON.stringify(dataset, null, 2))
    console.log('Guardado:', DATASET_PATH)
  }
  const withChunks = (dataset.casos || dataset).filter((c) => c.chunks_esperados?.length).length
  console.log('Casos con chunks_esperados:', withChunks)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
