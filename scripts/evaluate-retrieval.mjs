#!/usr/bin/env node
/**
 * evaluate-retrieval.mjs
 * FASE_5 5.2: Evalúa retrieval con Recall@K, Precision@K, MRR, NDCG@K sobre dataset con chunks_esperados.
 *
 * Uso: node scripts/evaluate-retrieval.mjs [--url URL] [--dataset path] [--limit N] [--k 5,10]
 * Requiere: casos en dataset con campo chunks_esperados (array de chunk ids). Ejecutar antes annotate-retrieval-ground-truth.mjs.
 */

import { readFileSync, existsSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const args = process.argv.slice(2)
const getArg = (flag, def) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : def
}
const hasFlag = (f) => args.includes(f)

const API_URL = getArg('--url', 'http://localhost:3000')
const DATASET_PATH = getArg('--dataset', join(ROOT, 'data/benchmarks/qa-abogados.json'))
const OUTPUT_PATH = getArg('--output', null)
const LIMIT = getArg('--limit', null)
const K_LIST = (getArg('--k', '5,10') || '5,10').split(',').map((x) => parseInt(x, 10)).filter((n) => n > 0)

async function fetchRetrieval(query, topK = 10) {
  const maxRetries = 5
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(`${API_URL}/api/retrieval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK }),
      signal: AbortSignal.timeout(90_000),
    })
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}))
      const wait = (body.retryAfter || 50) * 1000
      if (attempt < maxRetries - 1) {
        process.stdout.write(`  (429 rate limit, esperando ${Math.ceil(wait / 1000)}s)... `)
        await new Promise((r) => setTimeout(r, wait))
        continue
      }
    }
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
    return res.json()
  }
  throw new Error('API 429 después de reintentos')
}

function recallAtK(retrievedIds, expectedIds, k) {
  const topK = retrievedIds.slice(0, k)
  const expectedSet = new Set(expectedIds)
  const hits = topK.filter((id) => expectedSet.has(id))
  if (expectedIds.length === 0) return 1
  return hits.length / expectedIds.length
}

function precisionAtK(retrievedIds, expectedIds, k) {
  const topK = retrievedIds.slice(0, k)
  const expectedSet = new Set(expectedIds)
  const hits = topK.filter((id) => expectedSet.has(id))
  return hits.length / k
}

function reciprocalRank(retrievedIds, expectedIds) {
  const expectedSet = new Set(expectedIds)
  const idx = retrievedIds.findIndex((id) => expectedSet.has(id))
  return idx === -1 ? 0 : 1 / (idx + 1)
}

function dcgAtK(retrievedIds, expectedIds, k) {
  const expectedSet = new Set(expectedIds)
  let dcg = 0
  for (let i = 0; i < Math.min(k, retrievedIds.length); i++) {
    const rel = expectedSet.has(retrievedIds[i]) ? 1 : 0
    dcg += rel / Math.log2(i + 2)
  }
  return dcg
}

function ndcgAtK(retrievedIds, expectedIds, k) {
  const ideal = [...expectedIds].slice(0, k)
  const idealDcg = dcgAtK(ideal, expectedIds, k)
  if (idealDcg === 0) return 1
  return dcgAtK(retrievedIds, expectedIds, k) / idealDcg
}

async function main() {
  if (hasFlag('--help')) {
    console.log(`
Uso: node scripts/evaluate-retrieval.mjs [opciones]
  --url URL       Base URL del API (default: http://localhost:3000)
  --dataset path  Dataset JSON con casos y chunks_esperados
  --limit N       Evaluar solo N casos
  --output path   Guardar resultados JSON (ej. data/benchmarks/sprint2-retrieval-YYYY-MM-DD.json)
  --k 5,10        Valores de K para Recall/Precision/NDCG (default: 5,10)
`)
    process.exit(0)
  }

  if (!existsSync(DATASET_PATH)) {
    console.error('Dataset no encontrado:', DATASET_PATH)
    process.exit(1)
  }

  const dataset = JSON.parse(readFileSync(DATASET_PATH, 'utf8'))
  let casos = (dataset.casos || dataset).filter((c) => Array.isArray(c.chunks_esperados) && c.chunks_esperados.length > 0)
  if (casos.length === 0) {
    console.log('No hay casos con chunks_esperados. Ejecuta antes: node scripts/annotate-retrieval-ground-truth.mjs --limit 50')
    process.exit(0)
  }
  if (LIMIT) casos = casos.slice(0, parseInt(LIMIT, 10))

  const maxK = Math.max(...K_LIST, 10)
  const results = []
  const recallSum = {}
  const precisionSum = {}
  let mrrSum = 0
  const ndcgSum = {}
  K_LIST.forEach((k) => {
    recallSum[k] = 0
    precisionSum[k] = 0
    ndcgSum[k] = 0
  })

  console.log('Evaluando retrieval:', casos.length, 'casos | K:', K_LIST.join(', '))

  for (let i = 0; i < casos.length; i++) {
    const c = casos[i]
    try {
      const { chunkIds = [] } = await fetchRetrieval(c.pregunta, maxK)
      const expected = c.chunks_esperados
      const rec = {}
      const prec = {}
      const ndcg = {}
      K_LIST.forEach((k) => {
        rec[k] = recallAtK(chunkIds, expected, k)
        prec[k] = precisionAtK(chunkIds, expected, k)
        ndcg[k] = ndcgAtK(chunkIds, expected, k)
        recallSum[k] += rec[k]
        precisionSum[k] += prec[k]
        ndcgSum[k] += ndcg[k]
      })
      const rr = reciprocalRank(chunkIds, expected)
      mrrSum += rr
      results.push({ id: c.id, recall: rec, precision: prec, mrr: rr, ndcg })
      if ((i + 1) % 10 === 0) console.log('  ', i + 1, '/', casos.length)
    } catch (err) {
      console.warn('  Error', c.id, err.message)
    }
  }

  const n = results.length
  if (n === 0) {
    console.log('Ningún caso evaluado correctamente.')
    process.exit(1)
  }

  console.log('\n--- Métricas ---')
  K_LIST.forEach((k) => {
    console.log(`Recall@${k}:    ${(recallSum[k] / n).toFixed(4)}`)
    console.log(`Precision@${k}: ${(precisionSum[k] / n).toFixed(4)}`)
    console.log(`NDCG@${k}:     ${(ndcgSum[k] / n).toFixed(4)}`)
  })
  console.log('MRR:          ', (mrrSum / n).toFixed(4))

  const summary = {
    date: new Date().toISOString().slice(0, 10),
    n,
    recall: Object.fromEntries(K_LIST.map((k) => [k, recallSum[k] / n])),
    precision: Object.fromEntries(K_LIST.map((k) => [k, precisionSum[k] / n])),
    ndcg: Object.fromEntries(K_LIST.map((k) => [k, ndcgSum[k] / n])),
    mrr: mrrSum / n,
    results,
  }
  if (OUTPUT_PATH) {
    writeFileSync(OUTPUT_PATH, JSON.stringify(summary, null, 2))
    console.log('Guardado:', OUTPUT_PATH)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
