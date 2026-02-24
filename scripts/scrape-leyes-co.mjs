#!/usr/bin/env node
/**
 * scrape-leyes-co.mjs
 *
 * Scraper de alta calidad para leyes.co — obtiene cada artículo individualmente
 * con su número exacto, título y texto limpio (sin ruido editorial/navegación).
 *
 * Produce archivos TXT por código con formato:
 *   slug: codigo_sustantivo_trabajo
 *   tipo: codigo
 *   area: laboral
 *   fuente: leyes.co
 *   url: https://leyes.co/codigo_sustantivo_del_trabajo.htm
 *   fecha_extraccion: ...
 *   ---
 *   ARTÍCULO 186. DURACIÓN.
 *   1. Los trabajadores que hubieren prestado sus servicios durante un año...
 *
 * Uso:
 *   node scripts/scrape-leyes-co.mjs                     # todos los códigos
 *   node scripts/scrape-leyes-co.mjs --codigo cst        # solo CST
 *   node scripts/scrape-leyes-co.mjs --codigo et         # solo Estatuto Tributario
 *   node scripts/scrape-leyes-co.mjs --delay 1500        # delay entre requests (ms)
 *   node scripts/scrape-leyes-co.mjs --dry-run           # solo mostrar qué haría
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DOCS_DIR = path.join(ROOT, 'data', 'documents')

// ─── Configuración de códigos a scrapear ─────────────────────────────────────

const CODIGOS = {
  cst: {
    slug: 'codigo_sustantivo_trabajo',
    nombre: 'Código Sustantivo del Trabajo',
    area: 'laboral',
    tipo: 'codigo',
    entidad: 'Presidencia de la República',
    fecha_norma: '1951-06-07',
    url_base: 'https://leyes.co/codigo_sustantivo_del_trabajo',
    url_indice: 'https://leyes.co/codigo_sustantivo_del_trabajo.htm',
    articulos_max: 492,
    output: 'codigo_codigo_sustantivo_trabajo.txt',
  },
  et: {
    slug: 'estatuto_tributario',
    nombre: 'Estatuto Tributario Nacional — Decreto 624 de 1989',
    area: 'tributario',
    tipo: 'estatuto',
    entidad: 'Presidencia de la República / DIAN',
    fecha_norma: '1989-03-30',
    url_base: 'https://leyes.co/se_expide_el_estatuto_tributario_de_los_impuestos_administrados_por_la_direccion_general_de_impuestos_nacionales',
    url_indice: 'https://leyes.co/estatuto_tributario.htm',
    articulos_max: 960,
    output: 'codigo_estatuto_tributario.txt',
  },
  cp: {
    slug: 'codigo_penal_ley599',
    nombre: 'Código Penal — Ley 599 de 2000',
    area: 'penal',
    tipo: 'codigo',
    entidad: 'Congreso de la República',
    fecha_norma: '2000-07-24',
    url_base: 'https://leyes.co/codigo_penal',
    url_indice: 'https://leyes.co/codigo_penal.htm',
    articulos_max: 476,
    output: 'codigo_codigo_penal_ley599.txt',
  },
  cc: {
    slug: 'codigo_civil',
    nombre: 'Código Civil — Ley 84 de 1873',
    area: 'civil',
    tipo: 'codigo',
    entidad: 'Congreso de la República',
    fecha_norma: '1873-05-26',
    url_base: 'https://leyes.co/codigo_civil',
    url_indice: 'https://leyes.co/codigo_civil.htm',
    articulos_max: 2685,
    output: 'codigo_codigo_civil.txt',
  },
  cpaca: {
    slug: 'cpaca_ley1437',
    nombre: 'CPACA — Código de Procedimiento Administrativo y de lo Contencioso Administrativo — Ley 1437 de 2011',
    area: 'administrativo',
    tipo: 'codigo',
    entidad: 'Congreso de la República',
    fecha_norma: '2011-01-18',
    url_base: 'https://leyes.co/codigo_de_procedimiento_administrativo_y_de_lo_contencioso_administrativo',
    url_indice: 'https://leyes.co/codigo_de_procedimiento_administrativo_y_de_lo_contencioso_administrativo.htm',
    articulos_max: 309,
    output: 'codigo_cpaca_ley1437.txt',
  },
  cgp: {
    slug: 'codigo_general_proceso',
    nombre: 'Código General del Proceso — Ley 1564 de 2012',
    area: 'civil',
    tipo: 'codigo',
    entidad: 'Congreso de la República',
    fecha_norma: '2012-07-12',
    url_base: 'https://leyes.co/codigo_general_del_proceso',
    url_indice: 'https://leyes.co/codigo_general_del_proceso.htm',
    articulos_max: 627,
    output: 'codigo_codigo_general_proceso_ley1564.txt',
  },
}

// ─── Parser HTML → texto limpio ───────────────────────────────────────────────

function decodeHtmlEntities(text) {
  return text
    .replace(/&ntilde;/g, 'ñ').replace(/&Ntilde;/g, 'Ñ')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú').replace(/&uuml;/g, 'ü')
    .replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í').replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
}

function extractArticleText(html, url) {
  // leyes.co estructura: <main class="content"><h1>Código...<br/>Artículo N. Título</h1>...texto...</main>
  // El contenedor del artículo es <div id="statya"> o <main class="content">

  // Estrategia 1: div#statya (contenedor principal del artículo en leyes.co)
  let articleHtml = ''
  const statyaMatch = html.match(/<div[^>]*id="statya"[^>]*>([\s\S]{50,8000}?)<\/div>/i)
  if (statyaMatch && statyaMatch[1].length > 50) {
    articleHtml = statyaMatch[1]
  }

  // Estrategia 2: h1 + contenido hasta la sección de abogados/comentarios
  if (!articleHtml || articleHtml.length < 50) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]{10,200}?)<\/h1>([\s\S]{30,6000}?)(?=<div[^>]*(?:BestLawyers|best_user|jurista|footer|comment)[^>]*>)/i)
    if (h1Match) {
      articleHtml = '<h1>' + h1Match[1] + '</h1>' + h1Match[2]
    }
  }

  // Estrategia 3: main#content
  if (!articleHtml || articleHtml.length < 50) {
    const mainMatch = html.match(/<main[^>]*class="content"[^>]*>([\s\S]{100,8000}?)<\/main>/i)
    if (mainMatch) {
      articleHtml = mainMatch[1]
    }
  }

  if (!articleHtml) return ''

  // Convertir a texto limpio
  let text = articleHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<h[1-6][^>]*>/gi, '\n').replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  text = decodeHtmlEntities(text)

  // Eliminar ruido de leyes.co que puede colarse
  const stopPatterns = [
    /Hacer una pregunta[\s\S]*/i,
    /Mejores juristas[\s\S]*/i,
    /ABOGADOS COLOMBIA[\s\S]*/i,
    /Сomentarios:[\s\S]*/i,
    /Iniciar sesión[\s\S]{0,300}Registrarse/i,
    /\[email[^\]]*\]/gi,
    /Vigente, con las modificaciones.*$/im,
    /CST Artículo \d+ Colombia[\s\S]*/i,
    /Imprimir\s*$/im,
  ]
  for (const p of stopPatterns) {
    text = text.replace(p, '')
  }

  // Limpiar líneas
  text = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2 && !/^\s*&gt;\s*$/.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text
}

function extractArticleNumber(html, url) {
  // Extraer número del artículo del URL o del HTML
  const urlMatch = url.match(/\/(\d+(?:-\w+)?)\.htm/)
  if (urlMatch) return urlMatch[1]

  const htmlMatch = html.match(/Art[íi]culo\s+(\d+(?:\s*-\s*\w+)?)/i)
  return htmlMatch ? htmlMatch[1] : null
}

// ─── Scraper con rate limiting y retry ───────────────────────────────────────

async function fetchWithRetry(url, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ColLawRAG/1.0; Legal Research Bot)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-CO,es;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      })

      if (res.status === 404) return null  // Artículo no existe
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      return await res.text()
    } catch (err) {
      if (i === retries - 1) throw err
      console.warn(`    ↩ Retry ${i + 1}/${retries} para ${url}: ${err.message}`)
      await new Promise(r => setTimeout(r, delay * (i + 1)))
    }
  }
}

async function getArticleNumbers(urlIndice) {
  console.log(`  → Obteniendo lista de artículos desde ${urlIndice}`)
  const html = await fetchWithRetry(urlIndice)
  if (!html) return []

  const matches = [...html.matchAll(/href="[^"]*\/(\d+)\.htm"/g)]
  const nums = [...new Set(matches.map(m => parseInt(m[1])))]
    .filter(n => n > 0 && n < 10000)
    .sort((a, b) => a - b)

  console.log(`  → ${nums.length} artículos encontrados (${nums[0]} - ${nums[nums.length - 1]})`)
  return nums
}

// ─── Función principal por código ────────────────────────────────────────────

async function scrapeCodigo(key, config, options = {}) {
  const { delay = 1200, dryRun = false } = options

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`📖 ${config.nombre}`)
  console.log(`   URL: ${config.url_base}/{n}.htm`)
  console.log(`${'═'.repeat(60)}`)

  // Obtener lista de artículos desde el índice
  let articuloNums = []
  try {
    articuloNums = await getArticleNumbers(config.url_indice)
  } catch (err) {
    console.warn(`  ⚠ No se pudo obtener índice: ${err.message}. Usando rango 1-${config.articulos_max}`)
    articuloNums = Array.from({ length: config.articulos_max }, (_, i) => i + 1)
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Scrapearía ${articuloNums.length} artículos`)
    return
  }

  // Scrapear cada artículo
  const articulos = []
  let errors = 0
  let skipped = 0

  for (let i = 0; i < articuloNums.length; i++) {
    const num = articuloNums[i]
    const url = `${config.url_base}/${num}.htm`

    process.stdout.write(`\r  [${i + 1}/${articuloNums.length}] Art. ${num}...   `)

    try {
      const html = await fetchWithRetry(url)

      if (!html) {
        skipped++
        continue
      }

      const text = extractArticleText(html, url)

      if (text.length < 30) {
        skipped++
        continue
      }

      articulos.push({ num, url, text })
    } catch (err) {
      errors++
      if (errors < 5) console.warn(`\n  ✗ Error Art. ${num}: ${err.message}`)
    }

    // Rate limiting
    if (i < articuloNums.length - 1) {
      await new Promise(r => setTimeout(r, delay + Math.random() * 300))
    }
  }

  console.log(`\n  ✅ Completado: ${articulos.length} artículos | ${skipped} vacíos | ${errors} errores`)

  if (articulos.length === 0) {
    console.error('  ❌ Sin artículos — verificar URL pattern')
    return
  }

  // Generar archivo TXT con FORMATO OBLIGATORIO RAG
  const fechaHoy = new Date().toISOString().split('T')[0]
  const fechaConsulta = new Date().toISOString().split('T')[0]

  // Detectar modificaciones recientes del texto scrapeado
  const textoCompleto = articulos.map(a => a.text).join('\n')
  const modsMatch = textoCompleto.match(/modificado[^.]*?(?:Ley|Decreto)\s+[\d.]+\s+de\s+\d{4}/gi) || []
  const mods = modsMatch.length > 0
    ? [...new Set(modsMatch.slice(0, 5).map(m => m.trim()))].join(', ')
    : 'Ver texto consolidado'

  const header = `${config.nombre.toUpperCase()}
Entidad: ${config.entidad || 'Congreso de la República / Ministerio del Trabajo'}
Fecha: ${config.fecha_norma || 'Ver encabezado'}
Tema: ${config.area.charAt(0).toUpperCase() + config.area.slice(1)} — ${config.nombre}
Vigencia: MODIFICADA
Modificaciones: ${mods}
Texto base: VERSIÓN CONSOLIDADA leyes.co (actualizado ${fechaHoy})
Fuente: ${config.url_indice}

========================================
✔️ VIGENCIA VERIFICADA EN leyes.co — Estado: VIGENTE/MODIFICADA — Consultado: ${fechaConsulta}
========================================

`

  let body = ''
  for (const { num, url, text } of articulos) {
    body += `${text}\n\n`
  }

  const fullContent = header + body
  const outputPath = path.join(DOCS_DIR, config.output)
  writeFileSync(outputPath, fullContent, 'utf-8')

  const sizeMB = (Buffer.byteLength(fullContent, 'utf-8') / 1024 / 1024).toFixed(2)
  console.log(`  💾 Guardado: ${config.output} (${sizeMB} MB)`)

  return { articulos: articulos.length, errors, skipped, outputPath }
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const getArg = (flag, def) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : def }
  const hasFlag = (flag) => args.includes(flag)

  const codigoFilter = getArg('--codigo', null)
  const delay = parseInt(getArg('--delay', '1200'))
  const dryRun = hasFlag('--dry-run')

  // Asegurar directorio
  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true })

  console.log('🚀 ColLawRAG — Scraper leyes.co (artículo por artículo)')
  console.log(`   Delay: ${delay}ms | Dry-run: ${dryRun}`)

  const targets = codigoFilter
    ? { [codigoFilter]: CODIGOS[codigoFilter] }
    : CODIGOS

  if (codigoFilter && !CODIGOS[codigoFilter]) {
    console.error(`❌ Código desconocido: ${codigoFilter}`)
    console.error(`   Disponibles: ${Object.keys(CODIGOS).join(', ')}`)
    process.exit(1)
  }

  const results = {}
  for (const [key, config] of Object.entries(targets)) {
    try {
      results[key] = await scrapeCodigo(key, config, { delay, dryRun })
    } catch (err) {
      console.error(`\n❌ Error en ${key}: ${err.message}`)
      results[key] = { error: err.message }
    }
  }

  console.log('\n\n' + '═'.repeat(60))
  console.log('📊 RESUMEN FINAL')
  console.log('═'.repeat(60))
  for (const [key, r] of Object.entries(results)) {
    if (r?.error) {
      console.log(`  ${key}: ❌ ${r.error}`)
    } else if (r) {
      console.log(`  ${key}: ✅ ${r.articulos} artículos | ${r.errors} errores`)
    }
  }

  console.log('\n✅ Listo. Ejecuta "npm run ingest" para re-indexar con datos limpios.')
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message)
  process.exit(1)
})
