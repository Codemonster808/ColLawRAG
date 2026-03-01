#!/usr/bin/env node
/**
 * Post-fase Sprint 1 (Cursor): cuando OpenClaw ya generó ab-test-summary.md,
 * ejecuta el benchmark final de 50 casos con el modelo ganador.
 *
 * Uso:
 *   node scripts/apply-winner-and-benchmark.mjs
 *   node scripts/apply-winner-and-benchmark.mjs --dry-run   # solo comprueba y muestra pasos
 *
 * Requisitos:
 *   - data/benchmarks/ab-test-summary.md existe (lo genera OpenClaw en S1.11)
 *   - .env.local con el modelo ganador ya configurado (o configurar a mano según el summary)
 *   - Servidor RAG levantado si se va a ejecutar el benchmark (npm run dev)
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const SUMMARY_PATH = join(ROOT, 'data/benchmarks/ab-test-summary.md')

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

function main() {
  if (!existsSync(SUMMARY_PATH)) {
    console.log('⏳ Aún no existe data/benchmarks/ab-test-summary.md')
    console.log('   OpenClaw debe terminar S1.11 (compare-ab-test con --output).')
    console.log('   Luego ejecuta: node scripts/apply-winner-and-benchmark.mjs')
    process.exit(0)
  }

  const md = readFileSync(SUMMARY_PATH, 'utf8')
  const ganadorMatch = md.match(/Modelo ganador:\s*\*\*(.+?)\*\*/)
  const ganador = ganadorMatch ? ganadorMatch[1].trim() : 'ver summary'

  const envLines = []
  const genProviderMatch = md.match(/GEN_PROVIDER=(\S+)/)
  const hfModelMatch = md.match(/HF_GENERATION_MODEL=(\S+)/)
  if (genProviderMatch) envLines.push(`GEN_PROVIDER=${genProviderMatch[1]}`)
  if (hfModelMatch) envLines.push(`HF_GENERATION_MODEL=${hfModelMatch[1]}`)

  console.log('✅ ab-test-summary.md encontrado')
  console.log('   Modelo ganador:', ganador)
  if (envLines.length) {
    console.log('   Asegúrate en .env.local:')
    envLines.forEach(l => console.log('   ', l))
  }
  console.log('')

  const date = new Date().toISOString().slice(0, 10)
  const outputPath = join(ROOT, `data/benchmarks/sprint1-final-${date}.json`)

  if (DRY_RUN) {
    console.log('   [dry-run] Comando a ejecutar:')
    console.log('   node scripts/evaluate-accuracy.mjs --limit 50 --output', outputPath)
    console.log('   Requiere: servidor RAG (npm run dev) y juez Ollama si aplica.')
    process.exit(0)
  }

  console.log('   Ejecutando benchmark 50 casos...')
  const { spawn } = await import('child_process')
  const child = spawn(
    'node',
    ['scripts/evaluate-accuracy.mjs', '--limit', '50', '--output', outputPath],
    { cwd: ROOT, stdio: 'inherit', shell: false }
  )
  child.on('close', code => process.exit(code ?? 0))
}

main()
