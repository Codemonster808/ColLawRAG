#!/usr/bin/env node

/**
 * Script para descargar índices RAG desde GitHub Releases
 * 
 * Este script se ejecuta en el build de Vercel para descargar
 * los índices pre-generados en lugar de regenerarlos.
 * 
 * Uso:
 *   npm run download-indices
 *   
 * O manualmente:
 *   node scripts/download-indices.mjs
 */

import https from 'node:https'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createGunzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'

const DATA_DIR = path.join(process.cwd(), 'data')
const CONFIG_PATH = path.join(DATA_DIR, 'indices-urls.json')
const INDEX_PATH = path.join(DATA_DIR, 'index.json')
const BM25_PATH = path.join(DATA_DIR, 'bm25-index.json')

function getHttpModule(url) {
  return url.startsWith('https') ? https : http
}

async function downloadFile(url, outputPath, label) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Descargando ${label}...`)
    console.log(`   URL: ${url}`)
    
    const httpModule = getHttpModule(url)
    const file = fs.createWriteStream(outputPath)
    
    let downloadedSize = 0
    const startTime = Date.now()
    
    httpModule.get(url, {
      headers: {
        'User-Agent': 'ColLawRAG-Build',
        'Accept': 'application/octet-stream'
      }
    }, (response) => {
      // Seguir redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location
        console.log(`   → Redirigiendo a: ${redirectUrl}`)
        file.close()
        fs.unlinkSync(outputPath)
        return downloadFile(redirectUrl, outputPath, label).then(resolve).catch(reject)
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
        return
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10)
      const totalMB = (totalSize / (1024 * 1024)).toFixed(2)
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length
        const progress = ((downloadedSize / totalSize) * 100).toFixed(1)
        const downloadedMB = (downloadedSize / (1024 * 1024)).toFixed(2)
        process.stdout.write(`\r   Progreso: ${progress}% (${downloadedMB} MB / ${totalMB} MB)`)
      })
      
      response.pipe(file)
      
      file.on('finish', () => {
        file.close()
        const duration = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(`\n   ✅ Descargado en ${duration}s`)
        resolve()
      })
      
      file.on('error', (err) => {
        fs.unlinkSync(outputPath)
        reject(err)
      })
    }).on('error', (err) => {
      fs.unlinkSync(outputPath)
      reject(err)
    })
  })
}

async function decompressFile(gzPath, outputPath, label) {
  console.log(`📦 Descomprimiendo ${label}...`)
  
  const startTime = Date.now()
  const gzSize = fs.statSync(gzPath).size / (1024 * 1024)
  
  await pipeline(
    fs.createReadStream(gzPath),
    createGunzip(),
    fs.createWriteStream(outputPath)
  )
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  const outputSize = fs.statSync(outputPath).size / (1024 * 1024)
  
  console.log(`   ✅ Descomprimido en ${duration}s (${gzSize.toFixed(2)} MB → ${outputSize.toFixed(2)} MB)`)
  
  // En Vercel, NO eliminar el .gz (se usa en runtime)
  // Localmente, eliminar para ahorrar espacio
  if (!process.env.VERCEL) {
    fs.unlinkSync(gzPath)
    console.log(`   🗑️ Archivo .gz eliminado (local)`)
  } else {
    console.log(`   📦 Archivo .gz conservado para runtime (Vercel)`)
  }
}

async function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`❌ Archivo de configuración no encontrado: ${CONFIG_PATH}\n   Ejecuta: npm run upload-indices`)
  }
  
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  
  if (!config.indexUrl || !config.bm25Url) {
    throw new Error('❌ URLs de índices no configuradas en indices-urls.json')
  }
  
  console.log(`📋 Configuración cargada:`)
  console.log(`   Versión: ${config.version}`)
  console.log(`   Actualizado: ${new Date(config.updatedAt).toLocaleString()}`)
  
  return config
}

const IS_VERCEL = !!process.env.VERCEL

async function checkIndicesExist() {
  // En Vercel: verificar si los .gz existen (NO descomprimimos)
  if (IS_VERCEL) {
    const gzIndexExists = fs.existsSync(INDEX_PATH + '.gz')
    const gzBm25Exists = fs.existsSync(BM25_PATH + '.gz')
    if (gzIndexExists && gzBm25Exists) {
      console.log('✅ Los índices comprimidos ya existen. Saltando descarga.')
      console.log(`   index.json.gz: ${(fs.statSync(INDEX_PATH + '.gz').size / (1024 * 1024)).toFixed(2)} MB`)
      console.log(`   bm25-index.json.gz: ${(fs.statSync(BM25_PATH + '.gz').size / (1024 * 1024)).toFixed(2)} MB`)
      return true
    }
    return false
  }
  
  // Local: verificar si los .json existen
  const indexExists = fs.existsSync(INDEX_PATH)
  const bm25Exists = fs.existsSync(BM25_PATH)
  
  if (indexExists && bm25Exists) {
    console.log('✅ Los índices ya existen localmente. Saltando descarga.')
    console.log(`   index.json: ${(fs.statSync(INDEX_PATH).size / (1024 * 1024)).toFixed(2)} MB`)
    console.log(`   bm25-index.json: ${(fs.statSync(BM25_PATH).size / (1024 * 1024)).toFixed(2)} MB`)
    return true
  }
  
  return false
}

async function main() {
  console.log('🚀 Descarga de índices RAG desde GitHub Releases\n')
  
  try {
    // 1. Verificar si los índices ya existen
    const alreadyExists = await checkIndicesExist()
    if (alreadyExists) {
      console.log('\n✅ Los índices están listos.')
      return
    }
    
    // 2. Cargar configuración
    const config = await loadConfig()
    
    // 3. Descargar índices comprimidos
    const indexGzPath = INDEX_PATH + '.gz'
    const bm25GzPath = BM25_PATH + '.gz'
    
    await downloadFile(config.indexUrl, indexGzPath, 'index.json.gz')
    await downloadFile(config.bm25Url, bm25GzPath, 'bm25-index.json.gz')
    
    if (IS_VERCEL) {
      // En Vercel: NO descomprimir. Se hará en runtime desde .gz
      // Esto reduce el tamaño de las funciones serverless de ~335 MB a ~108 MB
      console.log(`\n✅ ¡Índices descargados exitosamente! (modo Vercel - solo .gz)`)
      console.log(`   index.json.gz: ${(fs.statSync(indexGzPath).size / (1024 * 1024)).toFixed(2)} MB`)
      console.log(`   bm25-index.json.gz: ${(fs.statSync(bm25GzPath).size / (1024 * 1024)).toFixed(2)} MB`)
      console.log(`   💡 Los índices se descomprimirán en memoria al recibir la primera consulta.`)
    } else {
      // Local: descomprimir normalmente
      await decompressFile(indexGzPath, INDEX_PATH, 'index.json')
      await decompressFile(bm25GzPath, BM25_PATH, 'bm25-index.json')
      
      console.log(`\n✅ ¡Índices descargados y descomprimidos exitosamente!`)
      console.log(`   index.json: ${(fs.statSync(INDEX_PATH).size / (1024 * 1024)).toFixed(2)} MB`)
      console.log(`   bm25-index.json: ${(fs.statSync(BM25_PATH).size / (1024 * 1024)).toFixed(2)} MB`)
    }
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`)
    console.error('\n💡 Soluciones posibles:')
    console.error('   1. Verifica que ejecutaste: npm run upload-indices')
    console.error('   2. Verifica que data/indices-urls.json existe y tiene URLs válidas')
    console.error('   3. Verifica conectividad a GitHub')
    process.exit(1)
  }
}

main()
