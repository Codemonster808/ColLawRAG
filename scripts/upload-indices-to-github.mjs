#!/usr/bin/env node

/**
 * Script para subir índices RAG a GitHub Releases
 * 
 * Este script comprime y sube los índices a un GitHub Release,
 * evitando la necesidad de regenerarlos en cada build de Vercel.
 * 
 * Requisitos:
 * - GitHub CLI (gh) instalado y autenticado
 * - Repositorio Git configurado
 * 
 * Uso:
 *   npm run upload-indices
 *   
 * O manualmente:
 *   node scripts/upload-indices-to-github.mjs
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'

const execAsync = promisify(exec)

const INDICES_DIR = path.join(process.cwd(), 'data')
const RELEASE_TAG = 'indices-v1'
const RELEASE_NAME = 'RAG Indices v1'

async function compressIndices() {
  console.log('📦 Comprimiendo índices...')
  
  const indexPath = path.join(INDICES_DIR, 'index.json')
  const bm25Path = path.join(INDICES_DIR, 'bm25-index.json')
  
  if (!fs.existsSync(indexPath)) {
    throw new Error('❌ data/index.json no existe. Ejecuta npm run ingest primero.')
  }
  
  if (!fs.existsSync(bm25Path)) {
    throw new Error('❌ data/bm25-index.json no existe. Ejecuta npm run ingest primero.')
  }
  
  // Comprimir archivos
  await execAsync(`gzip -c ${indexPath} > ${indexPath}.gz`)
  await execAsync(`gzip -c ${bm25Path} > ${bm25Path}.gz`)
  
  const indexSize = fs.statSync(`${indexPath}.gz`).size / (1024 * 1024)
  const bm25Size = fs.statSync(`${bm25Path}.gz`).size / (1024 * 1024)
  
  console.log(`✅ index.json.gz: ${indexSize.toFixed(2)} MB`)
  console.log(`✅ bm25-index.json.gz: ${bm25Size.toFixed(2)} MB`)
  
  return {
    indexGz: `${indexPath}.gz`,
    bm25Gz: `${bm25Path}.gz`,
    totalSize: indexSize + bm25Size
  }
}

async function checkGitHubCLI() {
  try {
    await execAsync('gh --version')
    console.log('✅ GitHub CLI instalado')
  } catch (error) {
    throw new Error('❌ GitHub CLI no está instalado. Instala desde: https://cli.github.com/')
  }
  
  try {
    await execAsync('gh auth status')
    console.log('✅ GitHub CLI autenticado')
  } catch (error) {
    throw new Error('❌ GitHub CLI no está autenticado. Ejecuta: gh auth login')
  }
}

async function getRepoInfo() {
  try {
    const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url')
    const match = remoteUrl.match(/github\.com[:/](.+?)\.git/)
    if (match) {
      return match[1] // owner/repo
    }
    throw new Error('No se pudo extraer owner/repo de la URL')
  } catch (error) {
    throw new Error('❌ No se pudo obtener información del repositorio Git')
  }
}

async function createOrUpdateRelease(repo, files) {
  console.log(`\n📤 Subiendo índices a GitHub Release...`)
  
  try {
    // Verificar si el release existe
    await execAsync(`gh release view ${RELEASE_TAG} --repo ${repo}`)
    console.log(`📝 Release ${RELEASE_TAG} ya existe, actualizando archivos...`)
    
    // Eliminar assets antiguos
    await execAsync(`gh release delete-asset ${RELEASE_TAG} index.json.gz --yes --repo ${repo}`).catch(() => {})
    await execAsync(`gh release delete-asset ${RELEASE_TAG} bm25-index.json.gz --yes --repo ${repo}`).catch(() => {})
    
    // Subir nuevos assets
    await execAsync(`gh release upload ${RELEASE_TAG} ${files.indexGz} ${files.bm25Gz} --clobber --repo ${repo}`)
    
  } catch (error) {
    // Release no existe, crear uno nuevo
    console.log(`📝 Creando release ${RELEASE_TAG}...`)
    await execAsync(`gh release create ${RELEASE_TAG} ${files.indexGz} ${files.bm25Gz} --title "${RELEASE_NAME}" --notes "Índices RAG pre-generados para ColLawRAG. Estos archivos se descargan automáticamente en el build de Vercel para evitar regenerar embeddings." --repo ${repo}`)
  }
  
  console.log(`\n✅ Índices subidos exitosamente a GitHub Release`)
  console.log(`📦 Release: https://github.com/${repo}/releases/tag/${RELEASE_TAG}`)
  
  // Obtener URLs de descarga
  const { stdout } = await execAsync(`gh release view ${RELEASE_TAG} --json assets --jq '.assets[] | .url' --repo ${repo}`)
  const urls = stdout.trim().split('\n')
  
  return {
    indexUrl: urls.find(u => u.includes('index.json.gz')),
    bm25Url: urls.find(u => u.includes('bm25-index.json.gz'))
  }
}

async function updateVercelConfig(urls) {
  console.log(`\n📝 Actualizando configuración...`)
  
  // Crear archivo con URLs
  const configPath = path.join(process.cwd(), 'data', 'indices-urls.json')
  const config = {
    indexUrl: urls.indexUrl,
    bm25Url: urls.bm25Url,
    updatedAt: new Date().toISOString(),
    version: '1.0'
  }
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  console.log(`✅ Archivo de configuración creado: data/indices-urls.json`)
  
  console.log(`\n📋 URLs de descarga:`)
  console.log(`   index.json.gz: ${urls.indexUrl}`)
  console.log(`   bm25-index.json.gz: ${urls.bm25Url}`)
}

async function main() {
  console.log('🚀 Upload de índices RAG a GitHub Releases\n')
  
  try {
    // 1. Verificar GitHub CLI
    await checkGitHubCLI()
    
    // 2. Obtener información del repo
    const repo = await getRepoInfo()
    console.log(`📁 Repositorio: ${repo}`)
    
    // 3. Comprimir índices
    const files = await compressIndices()
    console.log(`📦 Tamaño total comprimido: ${files.totalSize.toFixed(2)} MB`)
    
    // 4. Crear/actualizar release
    const urls = await createOrUpdateRelease(repo, files)
    
    // 5. Actualizar configuración
    await updateVercelConfig(urls)
    
    console.log(`\n✅ ¡Proceso completado exitosamente!`)
    console.log(`\n📝 Próximos pasos:`)
    console.log(`   1. Commit y push de data/indices-urls.json`)
    console.log(`   2. El build de Vercel descargará los índices desde GitHub`)
    console.log(`   3. Ya no es necesario ejecutar npm run ingest en cada build`)
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`)
    process.exit(1)
  }
}

main()
