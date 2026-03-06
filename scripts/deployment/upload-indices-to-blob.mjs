#!/usr/bin/env node
/**
 * upload-indices-to-blob.mjs
 *
 * Sube los índices RAG a Vercel Blob (después de que CU-07 esté implementado).
 * Esto reemplaza GitHub Releases como fuente de índices, reduciendo cold start
 * de ~50s a <3s (misma red Vercel → Blob).
 *
 * Requisitos:
 * - BLOB_READ_WRITE_TOKEN en .env.local (o env vars)
 * - @vercel/blob instalado (ya está en package.json)
 * - data/index.json.gz y data/bm25-index.json.gz existentes
 *
 * Uso:
 *   node scripts/upload-indices-to-blob.mjs
 *
 * Output:
 *   Actualiza data/indices-urls.json con las nuevas URLs de Vercel Blob
 */

import { put } from '@vercel/blob'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// Cargar BLOB_READ_WRITE_TOKEN
let BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN
if (!BLOB_TOKEN) {
  try {
    const env = readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    const m = env.match(/BLOB_READ_WRITE_TOKEN=(.+)/)
    BLOB_TOKEN = m ? m[1].trim() : null
  } catch { /* no .env.local */ }
}

if (!BLOB_TOKEN) {
  console.error('❌ BLOB_READ_WRITE_TOKEN no encontrado. Agrega a .env.local o env vars.')
  process.exit(1)
}

process.env.BLOB_READ_WRITE_TOKEN = BLOB_TOKEN

const INDEX_GZ = path.join(ROOT, 'data', 'index.json.gz')
const BM25_GZ = path.join(ROOT, 'data', 'bm25-index.json.gz')
const URLS_FILE = path.join(ROOT, 'data', 'indices-urls.json')

async function uploadFile(filePath, blobName) {
  const size = (readFileSync(filePath).length / (1024 * 1024)).toFixed(1)
  console.log(`📤 Subiendo ${blobName} (${size} MB)...`)

  const fileBuffer = readFileSync(filePath)
  const blob = await put(blobName, fileBuffer, {
    access: 'public',
    contentType: 'application/gzip',
    addRandomSuffix: false, // URL fija para poder actualizar
  })

  console.log(`✅ ${blobName} → ${blob.url}`)
  return blob.url
}

async function main() {
  console.log('🚀 ColLawRAG — Upload Indices to Vercel Blob\n')

  if (!existsSync(INDEX_GZ)) {
    console.error(`❌ ${INDEX_GZ} no existe. Ejecuta: gzip -c data/index.json > data/index.json.gz`)
    process.exit(1)
  }
  if (!existsSync(BM25_GZ)) {
    console.error(`❌ ${BM25_GZ} no existe. Ejecuta: gzip -c data/bm25-index.json > data/bm25-index.json.gz`)
    process.exit(1)
  }

  try {
    const indexUrl = await uploadFile(INDEX_GZ, 'collawrag/index.json.gz')
    const bm25Url = await uploadFile(BM25_GZ, 'collawrag/bm25-index.json.gz')

    // Actualizar indices-urls.json con las nuevas URLs de Blob
    const urls = {
      indexUrl,
      bm25Url,
      uploadedAt: new Date().toISOString(),
      source: 'vercel-blob',
    }
    writeFileSync(URLS_FILE, JSON.stringify(urls, null, 2))
    console.log(`\n📝 Actualizado data/indices-urls.json`)
    console.log(`   indexUrl:  ${indexUrl}`)
    console.log(`   bm25Url:   ${bm25Url}`)
    console.log('\n✅ Listo. Ahora ejecuta: npx vercel --prod --yes para deployar con las nuevas URLs.')
  } catch (err) {
    console.error('❌ Error subiendo a Vercel Blob:', err.message)
    process.exit(1)
  }
}

main()
