#!/usr/bin/env node
/**
 * ColLawRAG — Scraper de fuentes legales colombianas
 * 
 * Fuente principal: Secretaría del Senado (secretariasenado.gov.co)
 *   - Textos actualizados (incluye modificaciones de 2025)
 *   - Estructura limpia por artículos
 *   - Paginación predecible (_prNNN.html)
 * 
 * Fuente secundaria: Función Pública (funcionpublica.gov.co)
 *   - Para normas no disponibles en Senado
 *   - IDs numéricos verificados
 * 
 * Uso:
 *   node scripts/scrape-colombia-legal.mjs            # Scrape todo
 *   node scripts/scrape-colombia-legal.mjs --only codigos
 *   node scripts/scrape-colombia-legal.mjs --only leyes
 *   node scripts/scrape-colombia-legal.mjs --only jurisprudencia
 *   node scripts/scrape-colombia-legal.mjs --dry-run   # Solo verificar URLs
 */

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')
const DOCS_DIR = path.join(PROJECT_ROOT, 'data', 'documents')
const META_DIR = path.join(PROJECT_ROOT, 'data', 'scrape-meta')
const DELAY_MS = 1500 // Respetar servidores
const MAX_PAGES = 50  // Máximo de páginas por documento paginado
const FETCH_TIMEOUT = 30_000

// ============================================================================
// CATÁLOGO DE FUENTES LEGALES COLOMBIANAS
// ============================================================================

const SENADO_BASE = 'http://www.secretariasenado.gov.co/senado/basedoc'
const FP_BASE = 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php'

/**
 * Cada entrada del catálogo tiene:
 *   slug     — nombre corto para el archivo
 *   nombre   — nombre oficial
 *   tipo     — estatuto | codigo | ley | decreto | jurisprudencia
 *   area     — laboral | penal | civil | comercial | constitucional | administrativo | tributario | familia | seguridad_social | general
 *   fuente   — 'senado' | 'fp' (función pública)
 *   url      — URL base (para senado, sin paginación)
 *   fpId     — ID en Función Pública (fallback)
 *   paginated — true si el documento tiene múltiples páginas (solo senado)
 *   enabled  — true para scrapearlo
 */
const CATALOGO = [
  // ─── CONSTITUCIÓN ─────────────────────────────────────────────
  {
    slug: 'constitucion_politica_1991',
    nombre: 'Constitución Política de Colombia de 1991',
    tipo: 'constitucion',
    area: 'constitucional',
    fuente: 'senado',
    url: `${SENADO_BASE}/constitucion_politica_1991.html`,
    fpId: 4125,
    paginated: true,
    enabled: true
  },

  // ─── CÓDIGOS PRINCIPALES ──────────────────────────────────────
  {
    slug: 'codigo_civil',
    nombre: 'Código Civil (Ley 84 de 1873)',
    tipo: 'codigo',
    area: 'civil',
    fuente: 'senado',
    url: `${SENADO_BASE}/codigo_civil.html`,
    paginated: true,
    enabled: true
  },
  {
    slug: 'codigo_comercio',
    nombre: 'Código de Comercio (Decreto 410 de 1971)',
    tipo: 'codigo',
    area: 'comercial',
    fuente: 'senado',
    url: `${SENADO_BASE}/codigo_comercio.html`,
    paginated: true,
    enabled: true
  },
  {
    slug: 'codigo_sustantivo_trabajo',
    nombre: 'Código Sustantivo del Trabajo',
    tipo: 'codigo',
    area: 'laboral',
    fuente: 'senado',
    url: `${SENADO_BASE}/codigo_sustantivo_trabajo.html`,
    paginated: true,
    enabled: true
  },
  {
    slug: 'codigo_procesal_trabajo',
    nombre: 'Código Procesal del Trabajo y de la Seguridad Social (Decreto Ley 2158 de 1948)',
    tipo: 'codigo',
    area: 'laboral',
    fuente: 'senado',
    url: `${SENADO_BASE}/codigo_procesal_trabajo.html`,
    paginated: true,
    enabled: false  // URL no disponible en Senado, buscar fuente alternativa
  },
  {
    slug: 'codigo_penal_ley599',
    nombre: 'Código Penal (Ley 599 de 2000)',
    tipo: 'codigo',
    area: 'penal',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_0599_2000.html`,
    fpId: 6388,
    paginated: true,
    enabled: true
  },
  {
    slug: 'codigo_procedimiento_penal_ley906',
    nombre: 'Código de Procedimiento Penal (Ley 906 de 2004)',
    tipo: 'codigo',
    area: 'penal',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_0906_2004.html`,
    fpId: 14787,
    paginated: true,
    enabled: true
  },
  {
    slug: 'codigo_general_proceso_ley1564',
    nombre: 'Código General del Proceso (Ley 1564 de 2012)',
    tipo: 'codigo',
    area: 'civil',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_1564_2012.html`,
    fpId: 48425,
    paginated: true,
    enabled: true
  },
  {
    slug: 'cpaca_ley1437',
    nombre: 'Código de Procedimiento Administrativo y de lo Contencioso Administrativo (Ley 1437 de 2011)',
    tipo: 'codigo',
    area: 'administrativo',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_1437_2011.html`,
    fpId: 41249,
    paginated: true,
    enabled: true
  },
  {
    slug: 'codigo_infancia_adolescencia_ley1098',
    nombre: 'Código de la Infancia y la Adolescencia (Ley 1098 de 2006)',
    tipo: 'codigo',
    area: 'familia',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_1098_2006.html`,
    fpId: null,
    paginated: true,
    enabled: true
  },
  {
    slug: 'estatuto_tributario',
    nombre: 'Estatuto Tributario (Decreto 624 de 1989)',
    tipo: 'codigo',
    area: 'tributario',
    fuente: 'senado',
    url: `${SENADO_BASE}/estatuto_tributario.html`,
    fpId: 6533,
    paginated: true,
    enabled: true
  },

  // ─── LEYES LABORALES ──────────────────────────────────────────
  {
    slug: 'ley_50_1990_reforma_laboral',
    nombre: 'Ley 50 de 1990 — Reforma Laboral',
    tipo: 'ley',
    area: 'laboral',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_0050_1990.html`,
    paginated: true,
    enabled: false  // URL no disponible en Senado, buscar fuente alternativa
  },
  {
    slug: 'ley_789_2002_empleo',
    nombre: 'Ley 789 de 2002 — Apoyo al Empleo y Protección Social',
    tipo: 'ley',
    area: 'laboral',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_0789_2002.html`,
    paginated: false,
    enabled: true
  },
  {
    slug: 'ley_1010_2006_acoso_laboral',
    nombre: 'Ley 1010 de 2006 — Acoso Laboral',
    tipo: 'ley',
    area: 'laboral',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_1010_2006.html`,
    paginated: false,
    enabled: true
  },
  {
    slug: 'ley_1221_2008_teletrabajo',
    nombre: 'Ley 1221 de 2008 — Teletrabajo',
    tipo: 'ley',
    area: 'laboral',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_1221_2008.html`,
    paginated: false,
    enabled: true
  },
  {
    slug: 'ley_2101_2021_reduccion_jornada',
    nombre: 'Ley 2101 de 2021 — Reducción de Jornada Laboral',
    tipo: 'ley',
    area: 'laboral',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_2101_2021.html`,
    paginated: false,
    enabled: true
  },
  {
    slug: 'ley_2121_2021_trabajo_remoto',
    nombre: 'Ley 2121 de 2021 — Trabajo Remoto',
    tipo: 'ley',
    area: 'laboral',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_2121_2021.html`,
    fpId: 167966,
    paginated: false,
    enabled: true
  },
  {
    slug: 'ley_2466_2025_reforma_laboral',
    nombre: 'Ley 2466 de 2025 — Reforma Laboral',
    tipo: 'ley',
    area: 'laboral',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_2466_2025.html`,
    paginated: true,
    enabled: true
  },

  // ─── SEGURIDAD SOCIAL ─────────────────────────────────────────
  {
    slug: 'ley_100_1993_seguridad_social',
    nombre: 'Ley 100 de 1993 — Sistema General de Seguridad Social',
    tipo: 'ley',
    area: 'seguridad_social',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_0100_1993.html`,
    fpId: 5248,
    paginated: true,
    enabled: true
  },
  {
    slug: 'ley_776_2002_riesgos_laborales',
    nombre: 'Ley 776 de 2002 — Riesgos Laborales',
    tipo: 'ley',
    area: 'seguridad_social',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_0776_2002.html`,
    paginated: false,
    enabled: true
  },
  {
    slug: 'ley_1562_2012_riesgos_laborales',
    nombre: 'Ley 1562 de 2012 — Sistema General de Riesgos Laborales',
    tipo: 'ley',
    area: 'seguridad_social',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_1562_2012.html`,
    paginated: false,
    enabled: true
  },

  // ─── DERECHO CIVIL Y FAMILIA ──────────────────────────────────
  {
    slug: 'ley_1996_2019_capacidad_legal',
    nombre: 'Ley 1996 de 2019 — Régimen de Capacidad Legal de Personas con Discapacidad',
    tipo: 'ley',
    area: 'civil',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_1996_2019.html`,
    paginated: false,
    enabled: true
  },
  {
    slug: 'ley_1774_2016_maltrato_animal',
    nombre: 'Ley 1774 de 2016 — Protección Animal',
    tipo: 'ley',
    area: 'penal',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_1774_2016.html`,
    paginated: false,
    enabled: true
  },

  // ─── DERECHO ADMINISTRATIVO Y CONSTITUCIONAL ──────────────────
  {
    slug: 'ley_1581_2012_habeas_data',
    nombre: 'Ley 1581 de 2012 — Protección de Datos Personales',
    tipo: 'ley',
    area: 'constitucional',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_1581_2012.html`,
    fpId: 49981,
    paginated: false,
    enabled: true
  },
  {
    slug: 'ley_1712_2014_transparencia',
    nombre: 'Ley 1712 de 2014 — Transparencia y Acceso a la Información',
    tipo: 'ley',
    area: 'administrativo',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_1712_2014.html`,
    fpId: 56882,
    paginated: false,
    enabled: true
  },
  {
    slug: 'ley_1755_2015_derecho_peticion',
    nombre: 'Ley 1755 de 2015 — Derecho de Petición',
    tipo: 'ley',
    area: 'constitucional',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_1755_2015.html`,
    paginated: false,
    enabled: true
  },
  {
    slug: 'ley_472_1998_acciones_populares',
    nombre: 'Ley 472 de 1998 — Acciones Populares y de Grupo',
    tipo: 'ley',
    area: 'constitucional',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_0472_1998.html`,
    paginated: false,
    enabled: true
  },
  {
    slug: 'ley_393_1997_accion_cumplimiento',
    nombre: 'Ley 393 de 1997 — Acción de Cumplimiento',
    tipo: 'ley',
    area: 'constitucional',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_0393_1997.html`,
    paginated: false,
    enabled: true
  },

  // ─── DERECHO PENAL COMPLEMENTARIO ─────────────────────────────
  {
    slug: 'ley_600_2000_proc_penal_anterior',
    nombre: 'Ley 600 de 2000 — Código de Procedimiento Penal (anterior)',
    tipo: 'ley',
    area: 'penal',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_0600_2000.html`,
    fpId: 6389,
    paginated: true,
    enabled: true
  },
  {
    slug: 'ley_1826_2017_procedimiento_penal_abreviado',
    nombre: 'Ley 1826 de 2017 — Procedimiento Penal Abreviado',
    tipo: 'ley',
    area: 'penal',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_1826_2017.html`,
    paginated: false,
    enabled: true
  },

  // ─── CONSUMIDOR Y COMERCIAL ───────────────────────────────────
  {
    slug: 'ley_1480_2011_consumidor',
    nombre: 'Ley 1480 de 2011 — Estatuto del Consumidor',
    tipo: 'ley',
    area: 'comercial',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_1480_2011.html`,
    paginated: false,
    enabled: true
  },
  {
    slug: 'ley_1116_2006_insolvencia',
    nombre: 'Ley 1116 de 2006 — Régimen de Insolvencia Empresarial',
    tipo: 'ley',
    area: 'comercial',
    fuente: 'senado',
    url: `${SENADO_BASE}/ley_1116_2006.html`,
    paginated: false,
    enabled: true
  },

  // ─── FUNCIÓN PÚBLICA (fallback para normas no disponibles en Senado)
  {
    slug: 'decreto_1069_2015_sector_justicia',
    nombre: 'Decreto 1069 de 2015 — Decreto Único Reglamentario Sector Justicia',
    tipo: 'decreto',
    area: 'administrativo',
    fuente: 'fp',
    url: `${FP_BASE}?i=74174`,
    paginated: false,
    enabled: false  // Muy extenso, habilitar selectivamente
  },

  // ─── JURISPRUDENCIA — CORTE CONSTITUCIONAL ────────────────────────
  // Nota: Las sentencias de la Corte Constitucional se scrapean de forma diferente
  // usando el buscador/relatoría. Se implementará en función separada.
]

// ============================================================================
// FUNCIONES CORE
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch con timeout, retry y manejo de errores
 */
async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-CO,es;q=0.9,en;q=0.5',
        },
        signal: controller.signal
      })
      clearTimeout(timeout)

      if (res.ok) {
        return await res.text()
      }
      if (res.status === 404) return null
      if (res.status === 403 || res.status === 429) {
        console.warn(`   ⚠️  Rate limit/blocked (${res.status}), esperando...`)
        await sleep(5000 * (i + 1))
        continue
      }
      console.warn(`   ⚠️  HTTP ${res.status} intento ${i + 1}/${retries}`)
    } catch (e) {
      if (e.name === 'AbortError') {
        console.warn(`   ⚠️  Timeout intento ${i + 1}/${retries}`)
      } else {
        console.warn(`   ⚠️  Error intento ${i + 1}/${retries}: ${e.message}`)
      }
      if (i < retries - 1) await sleep(2000 * (i + 1))
    }
  }
  return null
}

/**
 * Extrae texto limpio de HTML de Secretaría del Senado
 * Usa un parser básico sin dependencias de cheerio para simplicidad
 */
function extractTextFromHTML(html) {
  if (!html) return ''

  // Remover scripts, styles, comments
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Intentar extraer solo el contenido principal
  // Secretaría del Senado usa <div id="TextoNorma"> o <div class="texto-norma">
  const textoNormaMatch = text.match(/<div[^>]*(?:id=["']TextoNorma["']|class=["']texto-norma["'])[^>]*>([\s\S]*?)(?=<div[^>]*(?:id=["']pie|class=["']footer))/i)
  if (textoNormaMatch) {
    text = textoNormaMatch[1]
  } else {
    // Fallback: buscar el contenido principal por otros patrones
    const bodyMatch = text.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    if (bodyMatch) {
      text = bodyMatch[1]
    }
    // Remover headers, footers, navs
    text = text
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
  }

  // Convertir tags de bloque a newlines
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')

  // Remover todos los tags restantes
  text = text.replace(/<[^>]+>/g, ' ')

  // Decodificar entidades HTML
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&Aacute;/gi, 'Á')
    .replace(/&Eacute;/gi, 'É')
    .replace(/&Iacute;/gi, 'Í')
    .replace(/&Oacute;/gi, 'Ó')
    .replace(/&Uacute;/gi, 'Ú')
    .replace(/&Ntilde;/gi, 'Ñ')
    .replace(/&uuml;/gi, 'ü')
    .replace(/&#\d+;/g, '') // Remaining numeric entities

  // Limpiar whitespace
  text = text
    .replace(/[ \t]+/g, ' ')         // Colapsar espacios
    .replace(/\n\s*\n\s*\n+/g, '\n\n') // Max 2 newlines
    .replace(/^\s+/gm, '')            // Trim inicio de línea
    .replace(/\s+$/gm, '')            // Trim final de línea
    .trim()

  // Remover líneas de navegación del Senado
  text = text
    .replace(/^Anterior\s*\|\s*Siguiente\s*$/gm, '')
    .replace(/^Anterior\s*$/gm, '')
    .replace(/^Siguiente\s*$/gm, '')
    .replace(/^JavaScript:window\.print\(\);\s*$/gm, '')
    .replace(/^.*Leyes desde 1992.*$/gm, '')
    .replace(/^\s*Ir al inicio\s*$/gmi, '')
    .replace(/^.*#top\s*$/gm, '')
    .trim()

  return text
}

/**
 * Extrae texto de Función Pública (usa readability-style extraction)
 */
function extractTextFromFP(html) {
  if (!html) return ''

  // FP usa <div class="descripcion-contenido"> para el texto legal
  const contentMatch = html.match(/<div[^>]*class=["'][^"']*descripcion-contenido[^"']*["'][^>]*>([\s\S]*?)(?=<\/div>\s*(?:<div[^>]*class=["'][^"']*(?:footer|pie)|<footer))/i)

  let text = contentMatch ? contentMatch[1] : html

  // Usar la misma limpieza que para Senado
  return extractTextFromHTML(`<div>${text}</div>`)
}

/**
 * Descarga un documento paginado de Secretaría del Senado
 * Detecta paginación automáticamente siguiendo links "Siguiente"
 */
async function scrapeSenado(entry) {
  const parts = []

  // Página base
  console.log(`   📄 Descargando página base...`)
  const baseHtml = await fetchPage(entry.url)
  if (!baseHtml) return null

  const baseText = extractTextFromHTML(baseHtml)
  if (baseText.length < 100) {
    console.warn(`   ⚠️  Contenido muy corto (${baseText.length} chars)`)
    return null
  }
  parts.push(baseText)

  // Detectar si hay paginación
  if (entry.paginated) {
    // Extraer el slug base de la URL para construir URLs paginadas
    const urlParts = entry.url.match(/\/([^/]+)\.html$/)
    if (!urlParts) {
      console.warn(`   ⚠️  No se pudo extraer slug de URL: ${entry.url}`)
      return parts.join('\n\n')
    }
    const baseSlug = urlParts[1]
    const baseDir = entry.url.replace(/\/[^/]+$/, '')

    // Detectar si la primera página tiene link "Siguiente"
    const hasSiguiente = baseHtml.includes('Siguiente') || baseHtml.includes('siguiente')
    if (!hasSiguiente) {
      console.log(`   📄 Documento de una sola página`)
      return parts.join('\n\n')
    }

    // Iterar páginas paginadas _pr001, _pr002, ...
    for (let page = 1; page <= MAX_PAGES; page++) {
      const pageNum = String(page).padStart(3, '0')
      const pageUrl = `${baseDir}/${baseSlug}_pr${pageNum}.html`

      await sleep(DELAY_MS)
      console.log(`   📄 Página ${page}...`)

      const pageHtml = await fetchPage(pageUrl)
      if (!pageHtml) {
        // 404 = no más páginas
        console.log(`   ✅ Fin de paginación en página ${page - 1}`)
        break
      }

      const pageText = extractTextFromHTML(pageHtml)
      if (pageText.length > 50) {
        parts.push(pageText)
      }

      // Si no tiene "Siguiente", es la última página
      const hasNext = pageHtml.includes('Siguiente') || pageHtml.includes('siguiente')
      if (!hasNext) {
        console.log(`   ✅ Última página: ${page}`)
        break
      }
    }
  }

  return parts.join('\n\n')
}

/**
 * Descarga un documento de Función Pública
 */
async function scrapeFP(entry) {
  const url = entry.fpId ? `${FP_BASE}?i=${entry.fpId}` : entry.url
  console.log(`   📄 Descargando de Función Pública...`)

  const html = await fetchPage(url)
  if (!html) return null

  // Verificar que no sea error page
  if (html.includes('norma_error.php') || html.includes('no está disponible')) {
    console.warn(`   ⚠️  Norma no disponible en Función Pública`)
    return null
  }

  const text = extractTextFromFP(html)
  if (text.length < 100) {
    console.warn(`   ⚠️  Contenido muy corto (${text.length} chars)`)
    return null
  }

  return text
}

/**
 * Scrapea sentencias de la Corte Constitucional
 * URL base: https://www.corteconstitucional.gov.co/relatoria/
 */
async function scrapeCorteConstitucional() {
  const CORTE_BASE = 'https://www.corteconstitucional.gov.co'
  const results = []
  
  // Lista de sentencias importantes para scrapear inicialmente
  // Formato: T-123/2023 (Tutela), C-456/2023 (Constitucionalidad), SU-789/2023 (Unificación)
  const importantSentences = [
    { type: 'T', num: '025', year: '1992' }, // T-025/1992 - Desplazados
    { type: 'T', num: '760', year: '2008' }, // T-760/2008 - Salud
    { type: 'C', num: '355', year: '2006' }, // C-355/2006 - Aborto
    { type: 'T', num: '406', year: '1992' }, // T-406/1992 - Acción de tutela
    { type: 'C', num: '221', year: '1994' }, // C-221/1994 - Estado de cosas inconstitucional
  ]
  
  console.log(`\n📜 Scrapeando ${importantSentences.length} sentencias de Corte Constitucional...`)
  
  for (const sent of importantSentences) {
    await sleep(DELAY_MS)
    
    // URL típica: https://www.corteconstitucional.gov.co/relatoria/1992/T-025-92.htm
    const url = `${CORTE_BASE}/relatoria/${sent.year}/${sent.type}-${sent.num.padStart(3, '0')}-${sent.year.slice(-2)}.htm`
    
    console.log(`   📄 ${sent.type}-${sent.num}/${sent.year}...`)
    
    const html = await fetchPage(url)
    if (!html) {
      console.warn(`      ⚠️  No disponible`)
      continue
    }
    
    // Extraer texto de la sentencia
    const text = extractTextFromHTML(html)
    if (text.length < 500) {
      console.warn(`      ⚠️  Contenido muy corto (${text.length} chars)`)
      continue
    }
    
    const slug = `sentencia_${sent.type.toLowerCase()}_${sent.num}_${sent.year}`
    const nombre = `Sentencia ${sent.type}-${sent.num}/${sent.year} - Corte Constitucional`
    
    results.push({
      slug,
      nombre,
      tipo: 'jurisprudencia',
      area: 'constitucional',
      fuente: 'corte_constitucional',
      url,
      text,
      size: text.length
    })
    
    console.log(`      ✅ ${text.length} caracteres`)
  }
  
  return results
}

/**
 * Scrapea sentencias de la Corte Suprema de Justicia
 * URL base: https://www.cortesuprema.gov.co
 */
async function scrapeCorteSuprema() {
  const CORTE_BASE = 'https://www.cortesuprema.gov.co'
  const results = []
  
  // Lista de sentencias importantes (formato puede variar)
  // Por ahora, intentamos URLs comunes
  const importantSentences = [
    { type: 'STC', num: '4361', year: '2020' }, // Ejemplo de sentencia
    { type: 'STC', num: '1234', year: '2019' },
  ]
  
  console.log(`\n⚖️  Scrapeando sentencias de Corte Suprema...`)
  console.log(`   ⚠️  Nota: La estructura de URLs de Corte Suprema requiere investigación adicional`)
  console.log(`   Por ahora, esta función está como placeholder`)
  
  // TODO: Implementar cuando se conozca la estructura exacta de URLs
  // La Corte Suprema tiene un buscador diferente que requiere más investigación
  
  return results
}

/**
 * Genera el header de metadata para el archivo
 */
function buildHeader(entry, textLength, scrapedAt) {
  const fuenteName = entry.fuente === 'senado' ? 'Secretaría del Senado' :
                     entry.fuente === 'fp' ? 'Función Pública' :
                     entry.fuente === 'corte_constitucional' ? 'Corte Constitucional' :
                     entry.fuente || 'Desconocida'
  
  return [
    `# ${entry.nombre}`,
    '',
    `slug: ${entry.slug}`,
    `tipo: ${entry.tipo}`,
    `area: ${entry.area}`,
    `fuente: ${fuenteName}`,
    `url: ${entry.url}`,
    `fecha_extraccion: ${scrapedAt}`,
    `caracteres: ${textLength}`,
    '',
    '---',
    '',
  ].join('\n')
}

/**
 * Sanitiza el nombre para usar como archivo
 */
function sanitizeFilename(slug) {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 120)
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const onlyFilter = args.find(a => a.startsWith('--only='))?.split('=')[1]
    || (args.includes('--only') ? args[args.indexOf('--only') + 1] : null)

  console.log('🇨🇴 ColLawRAG — Scraper de Fuentes Legales Colombianas')
  console.log('══════════════════════════════════════════════════════\n')

  if (dryRun) console.log('🔍 Modo dry-run: solo verificar URLs\n')

  // Filtrar catálogo
  let catalog = CATALOGO.filter(e => e.enabled)
  if (onlyFilter) {
    const filterLower = onlyFilter.toLowerCase()
    catalog = catalog.filter(e =>
      e.tipo === filterLower ||
      e.area === filterLower ||
      e.slug.includes(filterLower)
    )
    console.log(`📋 Filtrado: ${catalog.length} fuentes matching "${onlyFilter}"\n`)
  }

  console.log(`📋 ${catalog.length} fuentes legales a procesar:\n`)
  for (const entry of catalog) {
    const icon = entry.tipo === 'constitucion' ? '📜' :
                 entry.tipo === 'codigo' ? '📕' :
                 entry.tipo === 'ley' ? '📗' :
                 entry.tipo === 'decreto' ? '📘' : '📄'
    console.log(`   ${icon} ${entry.nombre} (${entry.area})`)
  }
  console.log('')

  // Crear directorios
  await fsp.mkdir(DOCS_DIR, { recursive: true })
  await fsp.mkdir(META_DIR, { recursive: true })

  const results = []
  const errors = []
  const scrapedAt = new Date().toISOString()

  // Scrapear jurisprudencia primero (si está habilitado)
  const scrapeJurisprudencia = args.includes('--jurisprudencia') || !onlyFilter || onlyFilter === 'jurisprudencia'
  if (scrapeJurisprudencia) {
    console.log('\n📜 Scrapeando Jurisprudencia...')
    const jurisprudenciaResults = await scrapeCorteConstitucional()
    for (const result of jurisprudenciaResults) {
      const header = buildHeader({
        slug: result.slug,
        nombre: result.nombre,
        tipo: result.tipo,
        area: result.area,
        fuente: result.fuente,
        url: result.url
      }, result.size, scrapedAt)
      const fullContent = header + result.text
      const filename = `${result.tipo}_${sanitizeFilename(result.slug)}.txt`
      const filepath = path.join(DOCS_DIR, filename)
      await fsp.writeFile(filepath, fullContent, 'utf-8')
      const sizeKB = (fullContent.length / 1024).toFixed(1)
      console.log(`   ✅ Guardado: ${filename} (${sizeKB} KB)`)
      results.push({
        slug: result.slug,
        filename,
        size: fullContent.length,
        sizeKB: parseFloat(sizeKB),
        tipo: result.tipo,
        area: result.area,
        scrapedAt
      })
    }
  }

  for (let i = 0; i < catalog.length; i++) {
    const entry = catalog[i]
    const progress = `[${i + 1}/${catalog.length}]`

    console.log(`\n${progress} 📥 ${entry.nombre}`)
    console.log(`   URL: ${entry.url}`)

    if (dryRun) {
      // Solo verificar que la URL responda
      const html = await fetchPage(entry.url)
      const status = html ? '✅ OK' : '❌ FAIL'
      console.log(`   ${status} (${html ? html.length : 0} bytes)`)
      results.push({ slug: entry.slug, status: html ? 'ok' : 'fail' })
      await sleep(500)
      continue
    }

    try {
      // Scrape según la fuente
      let text = null
      if (entry.fuente === 'senado') {
        text = await scrapeSenado(entry)
      } else {
        text = await scrapeFP(entry)
      }

      // Si la fuente principal falló y hay fallback FP
      if (!text && entry.fpId && entry.fuente === 'senado') {
        console.log(`   🔄 Intentando fallback en Función Pública (id=${entry.fpId})...`)
        text = await scrapeFP({ ...entry, fuente: 'fp' })
      }

      if (!text || text.length < 200) {
        console.error(`   ❌ No se pudo obtener contenido suficiente`)
        errors.push({ slug: entry.slug, error: 'Contenido insuficiente' })
        continue
      }

      // Construir archivo
      const header = buildHeader(entry, text.length, scrapedAt)
      const fullContent = header + text
      const filename = `${entry.tipo}_${sanitizeFilename(entry.slug)}.txt`
      const filepath = path.join(DOCS_DIR, filename)

      await fsp.writeFile(filepath, fullContent, 'utf-8')

      const sizeKB = (fullContent.length / 1024).toFixed(1)
      console.log(`   ✅ Guardado: ${filename} (${sizeKB} KB)`)

      results.push({
        slug: entry.slug,
        filename,
        size: fullContent.length,
        sizeKB: parseFloat(sizeKB),
        tipo: entry.tipo,
        area: entry.area,
        scrapedAt
      })

      // Guardar metadata individual
      await fsp.writeFile(
        path.join(META_DIR, `${entry.slug}.json`),
        JSON.stringify({
          ...entry,
          filename,
          size: fullContent.length,
          scrapedAt,
          textLength: text.length
        }, null, 2),
        'utf-8'
      )

    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`)
      errors.push({ slug: entry.slug, error: err.message })
    }

    // Delay entre documentos
    if (i < catalog.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  // ─── RESUMEN ───────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════')
  console.log('📊 RESUMEN\n')

  if (dryRun) {
    const ok = results.filter(r => r.status === 'ok').length
    const fail = results.filter(r => r.status === 'fail').length
    console.log(`   ✅ URLs OK: ${ok}`)
    console.log(`   ❌ URLs fallidas: ${fail}`)
  } else {
    const totalSize = results.reduce((acc, r) => acc + (r.size || 0), 0)
    console.log(`   ✅ Documentos descargados: ${results.length}`)
    console.log(`   ❌ Errores: ${errors.length}`)
    console.log(`   📁 Tamaño total: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   📂 Directorio: ${DOCS_DIR}`)

    // Resumen por tipo
    const byType = {}
    results.forEach(r => {
      byType[r.tipo] = (byType[r.tipo] || 0) + 1
    })
    console.log('\n   Por tipo:')
    Object.entries(byType).forEach(([tipo, count]) => {
      console.log(`     ${tipo}: ${count}`)
    })

    // Resumen por área
    const byArea = {}
    results.forEach(r => {
      byArea[r.area] = (byArea[r.area] || 0) + 1
    })
    console.log('\n   Por área legal:')
    Object.entries(byArea).forEach(([area, count]) => {
      console.log(`     ${area}: ${count}`)
    })

    if (errors.length > 0) {
      console.log('\n   ⚠️  Documentos con error:')
      errors.forEach(e => console.log(`     - ${e.slug}: ${e.error}`))
    }

    // Guardar resumen global
    const summaryPath = path.join(META_DIR, '_scrape-summary.json')
    await fsp.writeFile(summaryPath, JSON.stringify({
      scrapedAt,
      totalDocuments: results.length,
      totalErrors: errors.length,
      totalSizeBytes: totalSize,
      results,
      errors
    }, null, 2), 'utf-8')
    console.log(`\n   📋 Resumen guardado en: ${summaryPath}`)
  }

  console.log('\n══════════════════════════════════════════════════════')

  if (errors.length > 0) {
    console.log('\n⚠️  Hay errores. Revisa los logs arriba.')
    console.log('   Puedes re-ejecutar para los que fallaron.\n')
  } else {
    console.log('\n✅ Scraping completado sin errores.')
    console.log('   Ejecuta `npm run ingest` para re-indexar los documentos.\n')
  }
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err)
  process.exit(1)
})
