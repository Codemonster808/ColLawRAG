#!/usr/bin/env node
/**
 * Copia archivos de decretos y resoluciones desde data/decretos/ y data/resoluciones/
 * a data/documents/ para que puedan ser procesados por npm run ingest
 * 
 * Uso:
 *   node scripts/copy-decretos-resoluciones-to-docs.mjs
 *   node scripts/copy-decretos-resoluciones-to-docs.mjs --type decretos
 *   node scripts/copy-decretos-resoluciones-to-docs.mjs --type resoluciones
 */

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')

const DECRETOS_DIR = path.join(ROOT, 'data', 'decretos')
const RESOLUCIONES_DIR = path.join(ROOT, 'data', 'resoluciones')
const DOCS_DIR = path.join(ROOT, 'data', 'documents')

async function copyFiles(sourceDir, prefix, typeName) {
  if (!fs.existsSync(sourceDir)) {
    console.warn(`⚠️  Directorio no encontrado: ${sourceDir}`)
    return { copied: 0, skipped: 0 }
  }
  
  const entries = await fsp.readdir(sourceDir)
  const files = entries
    .filter(f => f.endsWith('.txt') && !f.includes('README') && !f.includes('metadata'))
    .sort()
  
  if (files.length === 0) {
    console.warn(`⚠️  No se encontraron archivos .txt en ${sourceDir}`)
    return { copied: 0, skipped: 0 }
  }
  
  console.log(`📁 ${typeName}: ${files.length} archivos encontrados`)
  
  let copied = 0
  let skipped = 0
  
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file)
    // Mantener el nombre original pero asegurar que tenga el prefijo correcto
    const newName = file.startsWith(prefix) ? file : `${prefix}_${file}`
    const destPath = path.join(DOCS_DIR, newName)
    
    // Verificar si ya existe
    if (fs.existsSync(destPath)) {
      skipped++
      continue
    }
    
    try {
      // Copiar archivo
      await fsp.copyFile(sourcePath, destPath)
      copied++
      
      if (copied % 10 === 0) {
        process.stdout.write('.')
      }
    } catch (e) {
      console.error(`\n❌ Error copiando ${file}:`, e.message)
    }
  }
  
  return { copied, skipped }
}

async function main() {
  const args = process.argv.slice(2)
  const typeArg = args.find(a => a.startsWith('--type'))
  
  const typeFilter = typeArg ? typeArg.split('=')[1] : 'all'
  
  // Asegurar que docs dir existe
  if (!fs.existsSync(DOCS_DIR)) {
    await fsp.mkdir(DOCS_DIR, { recursive: true })
  }
  
  console.log(`\n📚 Copiando decretos y resoluciones a data/documents/\n`)
  
  let totalCopied = 0
  let totalSkipped = 0
  
  // Copiar decretos
  if (typeFilter === 'all' || typeFilter === 'decretos') {
    const result = await copyFiles(DECRETOS_DIR, 'decreto', 'Decretos')
    totalCopied += result.copied
    totalSkipped += result.skipped
  }
  
  // Copiar resoluciones
  if (typeFilter === 'all' || typeFilter === 'resoluciones') {
    const result = await copyFiles(RESOLUCIONES_DIR, 'resolucion', 'Resoluciones')
    totalCopied += result.copied
    totalSkipped += result.skipped
  }
  
  console.log(`\n\n✅ Copia completada:`)
  console.log(`   - Copiados: ${totalCopied} archivos`)
  console.log(`   - Saltados (ya existían): ${totalSkipped} archivos`)
  console.log(`\n📝 Siguiente paso: Ejecuta 'npm run ingest' para indexar los documentos`)
}

main().catch(console.error)
