#!/usr/bin/env node
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fetch from 'node-fetch'
import * as cheerio from 'cheerio'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DOCS_DIR = path.join(process.cwd(), 'data', 'documents')
const RAW_HTML_DIR = path.join(process.cwd(), 'data', 'raw-html')
const DELAY_MS = 3000 // Delay entre requests para no sobrecargar servidores

// Configuración de fuentes legales colombianas
const LEGAL_SOURCES = {
  suin_juriscol: {
    name: 'SUIN-Juriscol',
    baseUrl: 'https://www.suin-juriscol.gov.co',
    endpoints: {
      leyes: '/viewDocument.asp?ruta=Leyes/',
      decretos: '/viewDocument.asp?ruta=Decretos/',
      codigos: '/viewDocument.asp?ruta=Codigos/'
    },
    selector: '.documento-contenido, #contenido, .contenido-documento',
    priority: 'alta',
    enabled: true
  },
  corte_constitucional: {
    name: 'Corte Constitucional',
    baseUrl: 'https://www.corteconstitucional.gov.co',
    searchUrl: '/relatoria/buscador_new/',
    selector: '.sentencia-contenido, .contenido-sentencia, #contenido',
    priority: 'alta',
    enabled: true,
    // IDs de sentencias importantes para scraping inicial
    importantSentences: [
      { id: 'T-123', year: 2023, type: 'T' }, // Ejemplo
    ]
  },
  corte_suprema: {
    name: 'Corte Suprema de Justicia',
    baseUrl: 'https://www.cortesuprema.gov.co',
    searchUrl: '/corte/index.php/jurisprudencia',
    selector: '.jurisprudencia-contenido, .contenido, #contenido',
    priority: 'media',
    enabled: true
  },
  consejo_estado: {
    name: 'Consejo de Estado',
    baseUrl: 'https://www.consejodeestado.gov.co',
    searchUrl: '/jurisprudencia',
    selector: '.sentencia-contenido, .contenido, #contenido',
    priority: 'media',
    enabled: true
  },
  rama_judicial: {
    name: 'Rama Judicial',
    baseUrl: 'https://www.ramajudicial.gov.co',
    searchUrl: '/normatividad',
    selector: '.normatividad-contenido, .contenido, #contenido',
    priority: 'baja',
    enabled: false // Deshabilitado por defecto, requiere configuración específica
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry(url, retries = 3, options = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-CO,es;q=0.9',
          ...options.headers
        },
        timeout: 30000,
        ...options
      })
      
      if (res.ok) {
        return await res.text()
      }
      
      if (res.status === 404) {
        console.warn(`⚠️  URL no encontrada: ${url}`)
        return null
      }
      
      if (res.status === 403 || res.status === 429) {
        console.warn(`⚠️  Acceso denegado o rate limit (${res.status}), esperando más tiempo...`)
        await sleep(5000 * (i + 1))
        continue
      }
      
      console.warn(`⚠️  HTTP ${res.status} en intento ${i + 1}/${retries}`)
    } catch (e) {
      console.warn(`⚠️  Error en intento ${i + 1}/${retries}:`, e.message)
      if (i < retries - 1) {
        await sleep(2000 * (i + 1))
      }
    }
  }
  return null
}

function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Eliminar caracteres invisibles
    .trim()
}

function extractContent(html, selector) {
  const $ = cheerio.load(html)
  let content = ''
  
  // Intentar con el selector específico primero
  if (selector) {
    const elements = $(selector)
    if (elements.length > 0) {
      content = elements.map((i, el) => $(el).text()).get().join('\n\n')
    }
  }
  
  // Si no se encontró contenido, intentar selectores comunes
  if (!content || content.length < 100) {
    const commonSelectors = ['#contenido', '.contenido', 'main', 'article', '.documento', 'body']
    for (const sel of commonSelectors) {
      const elements = $(sel)
      if (elements.length > 0) {
        const text = elements.map((i, el) => $(el).text()).get().join('\n\n')
        if (text.length > content.length) {
          content = text
        }
      }
    }
  }
  
  // Eliminar scripts, estilos, etc.
  $('script, style, nav, header, footer, .menu, .sidebar').remove()
  
  return cleanText(content)
}

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 100)
}

function extractMetadata(html, source, url) {
  const $ = cheerio.load(html)
  const metadata = {
    source: source.name,
    url,
    scrapedAt: new Date().toISOString()
  }
  
  // Intentar extraer título
  const titleSelectors = ['h1', '.titulo', '.title', 'title']
  for (const sel of titleSelectors) {
    const title = $(sel).first().text().trim()
    if (title && title.length > 5) {
      metadata.title = title
      break
    }
  }
  
  // Intentar extraer fecha
  const datePatterns = [
    /\d{1,2}\/\d{1,2}\/\d{4}/,
    /\d{4}-\d{2}-\d{2}/
  ]
  const bodyText = $('body').text()
  for (const pattern of datePatterns) {
    const match = bodyText.match(pattern)
    if (match) {
      metadata.date = match[0]
      break
    }
  }
  
  return metadata
}

async function scrapeDocument(source, url, docType = 'normativa') {
  console.log(`📥 Descargando desde ${source.name}: ${url}`)
  
  const html = await fetchWithRetry(url)
  if (!html) {
    console.error(`❌ No se pudo descargar: ${url}`)
    return null
  }
  
  // Guardar HTML raw para re-procesamiento
  const rawHtmlDir = path.join(RAW_HTML_DIR, source.name.toLowerCase().replace(/\s+/g, '_'))
  await fsp.mkdir(rawHtmlDir, { recursive: true })
  const urlHash = Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)
  const rawHtmlPath = path.join(rawHtmlDir, `${urlHash}.html`)
  await fsp.writeFile(rawHtmlPath, html, 'utf-8')
  
  const content = extractContent(html, source.selector)
  if (content.length < 100) {
    console.warn(`⚠️  Contenido muy corto (${content.length} chars)`)
    return null
  }
  
  const metadata = extractMetadata(html, source, url)
  
  // Determinar nombre de archivo
  const title = metadata.title || 'documento_sin_titulo'
  const filename = `${docType}_${sanitizeFilename(title)}.txt`
  const filepath = path.join(DOCS_DIR, docType, filename)
  
  // Crear directorio si no existe
  await fsp.mkdir(path.dirname(filepath), { recursive: true })
  
  // Agregar header con metadata
  const header = `# ${title}\n\n`
  const metadataSection = Object.entries(metadata)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
  const fullContent = header + metadataSection + '\n\n---\n\n' + content
  
  await fsp.writeFile(filepath, fullContent, 'utf-8')
  console.log(`✅ Guardado: ${filename} (${fullContent.length} chars)`)
  
  await sleep(DELAY_MS)
  return { filename, size: fullContent.length, metadata }
}

// Scraper específico para SUIN-Juriscol
async function scrapeSUINJuriscol(source) {
  console.log(`\n🌐 Scrapeando ${source.name}...`)
  
  // URLs de documentos importantes en SUIN-Juriscol
  const importantDocs = [
    {
      name: 'Ley 100 de 1993 - Seguridad Social',
      url: 'https://www.suin-juriscol.gov.co/viewDocument.asp?ruta=Leyes/1688814',
      type: 'normativa'
    },
    {
      name: 'Ley 1438 de 2011 - Reforma Sistema de Salud',
      url: 'https://www.suin-juriscol.gov.co/viewDocument.asp?ruta=Leyes/1688815',
      type: 'normativa'
    }
  ]
  
  const results = []
  for (const doc of importantDocs) {
    const result = await scrapeDocument(source, doc.url, doc.type)
    if (result) {
      results.push(result)
    }
  }
  
  return results
}

// Scraper específico para Corte Constitucional
async function scrapeCorteConstitucional(source) {
  console.log(`\n🌐 Scrapeando ${source.name}...`)
  
  // Por ahora, solo documentamos la estructura
  // La implementación completa requeriría acceso a la API o scraping del buscador
  console.log(`⚠️  Scraping de ${source.name} requiere configuración específica`)
  console.log(`   URL base: ${source.baseUrl}${source.searchUrl}`)
  
  return []
}

// Scraper específico para Corte Suprema
async function scrapeCorteSuprema(source) {
  console.log(`\n🌐 Scrapeando ${source.name}...`)
  
  console.log(`⚠️  Scraping de ${source.name} requiere configuración específica`)
  console.log(`   URL base: ${source.baseUrl}${source.searchUrl}`)
  
  return []
}

// Scraper específico para Consejo de Estado
async function scrapeConsejoEstado(source) {
  console.log(`\n🌐 Scrapeando ${source.name}...`)
  
  console.log(`⚠️  Scraping de ${source.name} requiere configuración específica`)
  console.log(`   URL base: ${source.baseUrl}${source.searchUrl}`)
  
  return []
}

// Función principal de scraping
async function scrapeSource(sourceKey) {
  const source = LEGAL_SOURCES[sourceKey]
  if (!source) {
    console.error(`❌ Fuente desconocida: ${sourceKey}`)
    return []
  }
  
  if (!source.enabled) {
    console.log(`⏭️  Fuente ${source.name} está deshabilitada`)
    return []
  }
  
  switch (sourceKey) {
    case 'suin_juriscol':
      return await scrapeSUINJuriscol(source)
    case 'corte_constitucional':
      return await scrapeCorteConstitucional(source)
    case 'corte_suprema':
      return await scrapeCorteSuprema(source)
    case 'consejo_estado':
      return await scrapeConsejoEstado(source)
    default:
      console.warn(`⚠️  Scraper no implementado para: ${sourceKey}`)
      return []
  }
}

async function main() {
  console.log('🚀 Iniciando scraping de fuentes legales colombianas...\n')
  
  // Verificar robots.txt (información)
  console.log('📋 Fuentes configuradas:')
  Object.entries(LEGAL_SOURCES).forEach(([key, source]) => {
    console.log(`   ${source.enabled ? '✅' : '⏭️ '} ${source.name} (${source.priority})`)
  })
  console.log('')
  
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true })
  }
  
  if (!fs.existsSync(RAW_HTML_DIR)) {
    fs.mkdirSync(RAW_HTML_DIR, { recursive: true })
  }
  
  // Crear subdirectorios
  await fsp.mkdir(path.join(DOCS_DIR, 'normativa'), { recursive: true })
  await fsp.mkdir(path.join(DOCS_DIR, 'jurisprudencia'), { recursive: true })
  await fsp.mkdir(path.join(DOCS_DIR, 'codigos'), { recursive: true })
  
  const allResults = []
  
  // Scrapear fuentes por prioridad
  const sourcesByPriority = {
    alta: [],
    media: [],
    baja: []
  }
  
  Object.entries(LEGAL_SOURCES).forEach(([key, source]) => {
    if (source.enabled) {
      sourcesByPriority[source.priority].push(key)
    }
  })
  
  // Procesar por prioridad
  for (const priority of ['alta', 'media', 'baja']) {
    const sources = sourcesByPriority[priority]
    if (sources.length === 0) continue
    
    console.log(`\n📊 Procesando fuentes de prioridad ${priority.toUpperCase()}...`)
    for (const sourceKey of sources) {
      const results = await scrapeSource(sourceKey)
      allResults.push(...results)
    }
  }
  
  console.log(`\n✅ Proceso completado.`)
  console.log(`📚 Total de documentos descargados: ${allResults.length}`)
  console.log(`📁 Directorio: ${DOCS_DIR}`)
  console.log(`📁 HTML raw: ${RAW_HTML_DIR}`)
  
  // Resumen por tipo
  const byType = {}
  allResults.forEach(r => {
    const type = r.metadata?.source || 'unknown'
    byType[type] = (byType[type] || 0) + 1
  })
  
  if (Object.keys(byType).length > 0) {
    console.log('\n📊 Resumen por fuente:')
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} documento(s)`)
    })
  }
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})

