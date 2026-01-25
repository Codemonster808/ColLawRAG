#!/usr/bin/env node
/**
 * Script de verificación pre-deploy
 * Verifica que todo está listo antes de hacer deploy a producción
 * 
 * Ejecutar antes de hacer deploy:
 *   node scripts/pre-deploy-check.mjs
 * 
 * O con npm:
 *   npm run pre-deploy-check (agregar al package.json)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')

let hasErrors = false
let hasWarnings = false
const errors = []
const warnings = []

function logError(message) {
  console.log(`❌ ${message}`)
  errors.push(message)
  hasErrors = true
}

function logWarning(message) {
  console.log(`⚠️  ${message}`)
  warnings.push(message)
  hasWarnings = true
}

function logSuccess(message) {
  console.log(`✅ ${message}`)
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`)
}

console.log('='.repeat(80))
console.log('VERIFICACIÓN PRE-DEPLOY')
console.log('='.repeat(80))
console.log()

// ============================================================================
// 1. Verificar data/index.json
// ============================================================================
console.log('📁 VERIFICACIÓN DE ARCHIVOS:')
console.log('-'.repeat(80))

const indexPath = path.join(projectRoot, 'data', 'index.json')

if (!fs.existsSync(indexPath)) {
  logError('data/index.json no existe. Ejecuta: npm run ingest')
} else {
  const stats = fs.statSync(indexPath)
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
  
  logSuccess(`data/index.json existe (${sizeMB} MB)`)
  
  // Verificar tamaño (límite de Vercel: 50MB)
  if (stats.size > 50 * 1024 * 1024) {
    logError(`data/index.json es demasiado grande (${sizeMB} MB > 50 MB). Considera migrar a Pinecone.`)
  } else if (stats.size > 10 * 1024 * 1024) {
    logWarning(`data/index.json es grande (${sizeMB} MB). Monitorea el tamaño.`)
  }
  
  // Verificar que es JSON válido
  try {
    const content = fs.readFileSync(indexPath, 'utf-8')
    const data = JSON.parse(content)
    
    if (!Array.isArray(data) && typeof data !== 'object') {
      logError('data/index.json no tiene estructura válida (debe ser array u objeto)')
    } else {
      logSuccess('data/index.json es JSON válido')
      
      // Verificar estructura básica
      if (Array.isArray(data) && data.length > 0) {
        const firstChunk = data[0]
        if (!firstChunk.content) {
          logWarning('Chunks en index.json no tienen campo "content"')
        }
        if (!firstChunk.metadata) {
          logWarning('Chunks en index.json no tienen campo "metadata"')
        }
        if (!firstChunk.embedding && !firstChunk.vector) {
          logWarning('Chunks en index.json no tienen embeddings (puede ser intencional si usas Pinecone)')
        }
        
        logInfo(`Total de chunks: ${data.length}`)
      }
    }
  } catch (e) {
    logError(`data/index.json no es JSON válido: ${e.message}`)
  }
  
  // Verificar que está en el repositorio
  try {
    const gitFiles = execSync('git ls-files', { cwd: projectRoot, encoding: 'utf-8' })
    if (!gitFiles.includes('data/index.json')) {
      logError('data/index.json no está en el repositorio Git. Ejecuta: git add data/index.json')
    } else {
      logSuccess('data/index.json está en el repositorio Git')
    }
  } catch (e) {
    logWarning('No se pudo verificar si data/index.json está en Git (¿estás en un repo Git?)')
  }
}

console.log()

// ============================================================================
// 2. Verificar .env.example existe
// ============================================================================
console.log('📋 VERIFICACIÓN DE DOCUMENTACIÓN:')
console.log('-'.repeat(80))

const envExamplePath = path.join(projectRoot, '.env.example')
if (!fs.existsSync(envExamplePath)) {
  logError('.env.example no existe. Debe documentar todas las variables de entorno.')
} else {
  logSuccess('.env.example existe')
  
  // Verificar que contiene HUGGINGFACE_API_KEY
  const envExampleContent = fs.readFileSync(envExamplePath, 'utf-8')
  if (!envExampleContent.includes('HUGGINGFACE_API_KEY')) {
    logWarning('.env.example no contiene HUGGINGFACE_API_KEY')
  } else {
    logSuccess('.env.example documenta HUGGINGFACE_API_KEY')
  }
}

console.log()

// ============================================================================
// 3. Verificar archivos sensibles no están en el repo
// ============================================================================
console.log('🔒 VERIFICACIÓN DE SEGURIDAD:')
console.log('-'.repeat(80))

const sensitiveFiles = [
  '.env',
  '.env.local',
  '.env.production',
  'huggin_face_api_key.txt',
  '*.key',
  '*.pem',
  'secrets.json',
  'credentials.json'
]

let foundSensitive = false
for (const pattern of sensitiveFiles) {
  try {
    // Buscar archivos que coincidan con el patrón
    const files = execSync(`find . -name "${pattern}" -not -path "./node_modules/*" -not -path "./.next/*"`, {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim().split('\n').filter(f => f)
    
    if (files.length > 0) {
      // Verificar si están en Git
      for (const file of files) {
        try {
          const gitCheck = execSync(`git check-ignore "${file}"`, {
            cwd: projectRoot,
            encoding: 'utf-8',
            stdio: 'pipe'
          })
          // Si git check-ignore retorna algo, el archivo está ignorado (bien)
        } catch (e) {
          // Si git check-ignore falla, el archivo NO está ignorado (mal)
          const gitFiles = execSync('git ls-files', { cwd: projectRoot, encoding: 'utf-8' })
          if (gitFiles.includes(file.replace('./', ''))) {
            logError(`Archivo sensible en el repositorio: ${file}`)
            foundSensitive = true
          }
        }
      }
    }
  } catch (e) {
    // Ignorar errores de find
  }
}

if (!foundSensitive) {
  logSuccess('No se encontraron archivos sensibles en el repositorio')
}

console.log()

// ============================================================================
// 4. Verificar TypeScript (sin hacer build completo)
// ============================================================================
console.log('🔧 VERIFICACIÓN DE CÓDIGO:')
console.log('-'.repeat(80))

try {
  logInfo('Verificando TypeScript...')
  execSync('npx tsc --noEmit', {
    cwd: projectRoot,
    stdio: 'pipe'
  })
  logSuccess('TypeScript: Sin errores de compilación')
} catch (e) {
  logError(`TypeScript tiene errores: ${e.message.split('\n').slice(0, 3).join(' ')}`)
}

console.log()

// ============================================================================
// 5. Verificar estructura del proyecto
// ============================================================================
console.log('📦 VERIFICACIÓN DE ESTRUCTURA:')
console.log('-'.repeat(80))

const requiredFiles = [
  'package.json',
  'next.config.mjs',
  'vercel.json',
  'app/api/rag/route.ts',
  'app/api/health/route.ts',
  'middleware.ts'
]

for (const file of requiredFiles) {
  const filePath = path.join(projectRoot, file)
  if (!fs.existsSync(filePath)) {
    logError(`Archivo requerido no existe: ${file}`)
  } else {
    logSuccess(`${file} existe`)
  }
}

console.log()

// ============================================================================
// 6. Verificar package.json
// ============================================================================
console.log('📄 VERIFICACIÓN DE package.json:')
console.log('-'.repeat(80))

try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'))
  
  if (!packageJson.scripts || !packageJson.scripts.build) {
    logError('package.json no tiene script "build"')
  } else {
    logSuccess('Script "build" configurado')
  }
  
  if (!packageJson.engines || !packageJson.engines.node) {
    logWarning('package.json no especifica versión de Node.js en "engines"')
  } else {
    logSuccess(`Node.js version: ${packageJson.engines.node}`)
  }
} catch (e) {
  logError(`Error leyendo package.json: ${e.message}`)
}

console.log()

// ============================================================================
// RESUMEN
// ============================================================================
console.log('='.repeat(80))
console.log('RESUMEN')
console.log('='.repeat(80))

if (hasErrors) {
  console.log()
  console.log('❌ ERRORES ENCONTRADOS:')
  errors.forEach((err, i) => {
    console.log(`  ${i + 1}. ${err}`)
  })
  console.log()
  console.log('⚠️  Corrige estos errores antes de hacer deploy.')
  process.exit(1)
} else if (hasWarnings) {
  console.log()
  console.log('⚠️  ADVERTENCIAS:')
  warnings.forEach((warn, i) => {
    console.log(`  ${i + 1}. ${warn}`)
  })
  console.log()
  console.log('✅ No hay errores críticos, pero revisa las advertencias.')
  process.exit(0)
} else {
  console.log()
  console.log('✅ Todas las verificaciones pasaron. Listo para deploy!')
  console.log()
  console.log('Próximos pasos:')
  console.log('  1. Configura variables de entorno en Vercel Dashboard')
  console.log('  2. Ejecuta: vercel --prod')
  console.log('  3. Verifica: npm run deploy-check')
  process.exit(0)
}
