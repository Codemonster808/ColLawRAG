#!/usr/bin/env node
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// Config
const BASE_URL = 'https://www.corteconstitucional.gov.co/relatoria'
const DELAY_MS = 1000

// Tipos de sentencias
const TYPES = {
  tutela: 'T',
  constitucionalidad: 'C',
  unificacion: 'SU'
}

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// User-Agent para evitar 403 (el sitio puede bloquear peticiones sin cabecera)
const FETCH_OPTIONS = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
  }
}

// Fetch con delay
async function fetchWithDelay(url, delayMs = DELAY_MS) {
  await sleep(delayMs)
  console.log(`[FETCH] ${url}`)
  const response = await fetch(url, FETCH_OPTIONS)
  if (!response.ok) throw new Error(`HTTP ${response.status} - ${url}`)
  return response
}

// Parse página de sentencia (estructura básica)
function parseSentenciaPage(html, url) {
  // Estructura simplificada - extrae texto básico
  const content = html.replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    id: url.match(/([A-Z]{1,2}-\d+-\d+)/)?.[1] || 'unknown',
    type: url.includes('/T-') ? 'tutela' : url.includes('/C-') ? 'constitucionalidad' : 'unificacion',
    date: new Date().toISOString().split('T')[0],
    court: 'Corte Constitucional',
    magistrate: 'Por determinar',
    topic: 'Sentencia',
    content,
    url,
    keywords: []
  }
}

// Obtener lista de sentencias por año y tipo
async function getListOfSentencias(year, type) {
  const typeCode = TYPES[type]
  if (!typeCode) throw new Error(`Tipo inválido: ${type}`)

  const urls = []
  const dirUrl = `${BASE_URL}/${year}/`

  try {
    const response = await fetchWithDelay(dirUrl)
    const html = await response.text()

    // Extraer enlaces a sentencias del tipo especificado
    const pattern = new RegExp(`href="(${typeCode}-\\d+-\\d+\\.htm)"`, 'gi')
    const matches = html.matchAll(pattern)

    for (const match of matches) {
      urls.push(`${dirUrl}${match[1]}`)
    }
  } catch (error) {
    console.error(`[ERROR] No se pudo obtener lista: ${error.message}`)
  }

  return urls
}

// Guardar sentencia
async function saveSentencia(sentencia) {
  const dataDir = path.join(process.cwd(), 'data', 'documents')

  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true })
  }

  const filename = `jurisprudencia_${sentencia.type}_${sentencia.id}.txt`
  const filepath = path.join(dataDir, filename)

  const content = `ID: ${sentencia.id}
Tipo: ${sentencia.type}
Fecha: ${sentencia.date}
Corte: ${sentencia.court}
Magistrado: ${sentencia.magistrate}
Tema: ${sentencia.topic}
URL: ${sentencia.url}

${sentencia.content}
`

  await writeFile(filepath, content, 'utf-8')
  console.log(`[SAVED] ${filename}`)
}

// Main
async function main() {
  const args = process.argv.slice(2)
  const yearArg = args.find(a => a.startsWith('--year'))
  const typeArg = args.find(a => a.startsWith('--type'))
  const dryRun = args.includes('--dry-run')

  if (!yearArg || !typeArg) {
    console.error('Uso: node scripts/scrape-jurisprudencia.mjs --year YYYY --type [tutela|constitucionalidad|unificacion]')
    process.exit(1)
  }

  const year = yearArg.split('=')[1]
  const type = typeArg.split('=')[1]

  console.log(`[START] Scraping ${type} año ${year}`)

  const urls = await getListOfSentencias(year, type)
  console.log(`[FOUND] ${urls.length} sentencias`)

  const limit = dryRun ? Math.min(urls.length, 10) : urls.length

  for (let i = 0; i < limit; i++) {
    const url = urls[i]
    try {
      const response = await fetchWithDelay(url)
      const html = await response.text()
      const sentencia = parseSentenciaPage(html, url)

      if (!dryRun) {
        await saveSentencia(sentencia)
      } else {
        console.log(`[DRY-RUN] ${sentencia.id}`)
      }
    } catch (error) {
      console.error(`[ERROR] ${url}: ${error.message}`)
    }
  }

  console.log(`[DONE] Procesadas ${limit} sentencias`)
}

main().catch(console.error)
