#!/usr/bin/env node
/**
 * Copia archivos de jurisprudencia desde data/jurisprudencia/cc/ a data/documents/
 * para que puedan ser procesados por npm run ingest
 * 
 * Uso:
 *   node scripts/copy-jurisprudencia-to-docs.mjs
 *   node scripts/copy-jurisprudencia-to-docs.mjs --year 2024
 *   node scripts/copy-jurisprudencia-to-docs.mjs --year 2020-2025
 */

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')

const JURISPRUDENCIA_DIR = path.join(ROOT, 'data', 'jurisprudencia', 'cc')
const DOCS_DIR = path.join(ROOT, 'data', 'documents')
const METADATA_PATH = path.join(JURISPRUDENCIA_DIR, 'metadata.json')

async function main() {
  const args = process.argv.slice(2)
  const yearArg = args.find(a => a.startsWith('--year'))
  
  // Parse años
  let years = []
  if (yearArg) {
    const yearValue = yearArg.split('=')[1]
    if (yearValue.includes('-')) {
      const [start, end] = yearValue.split('-').map(Number)
      years = Array.from({ length: end - start + 1 }, (_, i) => start + i)
    } else {
      years = [Number(yearValue)]
    }
  } else {
    // Por defecto, todos los años disponibles
    const entries = await fsp.readdir(JURISPRUDENCIA_DIR)
    years = entries
      .filter(e => /^\d{4}$/.test(e))
      .map(Number)
      .sort()
  }
  
  // Cargar metadata si existe
  let metadata = {}
  if (fs.existsSync(METADATA_PATH)) {
    try {
      const metadataContent = await fsp.readFile(METADATA_PATH, 'utf-8')
      metadata = JSON.parse(metadataContent)
    } catch (e) {
      console.warn('⚠️  No se pudo cargar metadata.json:', e.message)
    }
  }
  
  // Asegurar que docs dir existe
  if (!fs.existsSync(DOCS_DIR)) {
    await fsp.mkdir(DOCS_DIR, { recursive: true })
  }
  
  let totalCopied = 0
  let totalSkipped = 0
  
  console.log(`\n📚 Copiando jurisprudencia de años: ${years.join(', ')}\n`)
  
  for (const year of years) {
    const yearDir = path.join(JURISPRUDENCIA_DIR, year.toString())
    
    if (!fs.existsSync(yearDir)) {
      console.warn(`⚠️  Directorio no encontrado: ${yearDir}`)
      continue
    }
    
    const files = (await fsp.readdir(yearDir))
      .filter(f => f.endsWith('.txt'))
      .sort()
    
    console.log(`📁 ${year}: ${files.length} archivos encontrados`)
    
    for (const file of files) {
      const sourcePath = path.join(yearDir, file)
      // Convertir nombre: sentencia-tutela-001-24.txt -> jurisprudencia_sentencia_tutela_001_24.txt
      const newName = file.replace(/^sentencia-/, 'jurisprudencia_sentencia_')
      const destPath = path.join(DOCS_DIR, newName)
      
      // Verificar si ya existe
      if (fs.existsSync(destPath)) {
        totalSkipped++
        continue
      }
      
      try {
        // Copiar archivo
        await fsp.copyFile(sourcePath, destPath)
        totalCopied++
        
        if (totalCopied % 50 === 0) {
          process.stdout.write('.')
        }
      } catch (e) {
        console.error(`\n❌ Error copiando ${file}:`, e.message)
      }
    }
  }
  
  console.log(`\n\n✅ Copia completada:`)
  console.log(`   - Copiados: ${totalCopied} archivos`)
  console.log(`   - Saltados (ya existían): ${totalSkipped} archivos`)
  console.log(`\n📝 Siguiente paso: Ejecuta 'npm run ingest' para indexar los documentos`)
}

main().catch(console.error)
