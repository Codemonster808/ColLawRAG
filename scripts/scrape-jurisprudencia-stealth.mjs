#!/usr/bin/env node
/**
 * Scraper STEALTH de Jurisprudencia - Corte Constitucional
 * 
 * Técnicas anti-detección:
 * 1. Puppeteer con puppeteer-extra-plugin-stealth
 * 2. Navegador NO headless (simula usuario real)
 * 3. Delays humanos largos y variables
 * 4. Scroll y movimientos de mouse
 * 5. Cookies y localStorage persistentes
 * 6. Fallback a Archive.org
 * 
 * Uso:
 *   node scripts/scrape-jurisprudencia-stealth.mjs --year=2024 --type=tutela --limit=5
 */

import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONFIG ====================

const BASE_URL = 'https://www.corteconstitucional.gov.co/relatoria';
const ARCHIVE_BASE = 'https://web.archive.org/web/';
const DELAY_MIN = 5000; // 5 segundos mínimo
const DELAY_MAX = 15000; // 15 segundos máximo
const MAX_RETRIES = 3;

const TIPOS_SENTENCIA = {
  tutela: 'T',
  constitucionalidad: 'C',
  unificacion: 'SU'
};

// ==================== HELPERS ====================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Delay humano ultra-realista
 */
async function humanDelay() {
  const delay = DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN);
  console.log(`   ⏱️  Esperando ${Math.round(delay/1000)}s (comportamiento humano)...`);
  await sleep(delay);
}

/**
 * Intenta con Puppeteer en modo NO HEADLESS (más difícil de detectar)
 */
async function scrapeWithPuppeteerVisible(url) {
  try {
    console.log(`   🌐 [PUPPETEER-VISIBLE] Iniciando navegador...`);
    
    // Importación dinámica de puppeteer
    const puppeteer = await import('puppeteer');
    
    const browser = await puppeteer.default.launch({
      headless: false, // ← NO headless, ventana visible
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080'
      ]
    });
    
    const page = await browser.newPage();
    
    // Configurar viewport realista
    await page.setViewport({ width: 1920, height: 1080 });
    
    // User-Agent realista
    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // Ocultar que es automatizado
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });
    
    console.log(`   📄 Navegando a: ${url}`);
    
    // Navegar con timeout largo
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Simular comportamiento humano: scroll
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await sleep(2000);
    
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await sleep(1000);
    
    // Extraer contenido
    const html = await page.content();
    const text = await page.evaluate(() => document.body.innerText);
    
    console.log(`   ✅ [PUPPETEER-VISIBLE] Obtenido: ${text.length} caracteres`);
    
    await browser.close();
    
    return { html, text, strategy: 'puppeteer-visible' };
    
  } catch (error) {
    console.error(`   ❌ [PUPPETEER-VISIBLE] Error: ${error.message}`);
    return null;
  }
}

/**
 * Intenta obtener desde Archive.org (Wayback Machine)
 */
async function scrapeFromArchive(url) {
  try {
    console.log(`   📚 [ARCHIVE.ORG] Buscando snapshot...`);
    
    // Buscar el snapshot más reciente
    const availabilityUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
    
    const availResponse = await fetch(availabilityUrl);
    const availData = await availResponse.json();
    
    if (availData.archived_snapshots && availData.archived_snapshots.closest) {
      const snapshotUrl = availData.archived_snapshots.closest.url;
      console.log(`   🎯 [ARCHIVE.ORG] Snapshot encontrado: ${snapshotUrl}`);
      
      await humanDelay();
      
      const response = await fetch(snapshotUrl);
      const html = await response.text();
      
      // Limpiar HTML del Wayback Machine (remover sus scripts)
      const cleanHtml = html
        .replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/g, '')
        .replace(/<script[^>]*archive\.org[^>]*>[\s\S]*?<\/script>/gi, '');
      
      const text = cleanHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log(`   ✅ [ARCHIVE.ORG] Obtenido: ${text.length} caracteres`);
      
      return { html: cleanHtml, text, strategy: 'archive-org' };
    } else {
      console.log(`   ⚠️  [ARCHIVE.ORG] No hay snapshots disponibles`);
      return null;
    }
  } catch (error) {
    console.error(`   ❌ [ARCHIVE.ORG] Error: ${error.message}`);
    return null;
  }
}

/**
 * Fetch simple con headers ultra-realistas
 */
async function scrapeWithSimpleFetch(url) {
  try {
    console.log(`   🔗 [FETCH] Intentando con headers realistas...`);
    
    await humanDelay();
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'Referer': 'https://www.google.com/'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`   ✅ [FETCH] Obtenido: ${text.length} caracteres`);
    
    return { html, text, strategy: 'fetch' };
    
  } catch (error) {
    console.error(`   ❌ [FETCH] Error: ${error.message}`);
    return null;
  }
}

/**
 * Scrape una sentencia con todas las estrategias en orden de prioridad
 */
async function scrapeSentencia(tipo, numero, año) {
  const tipoCode = TIPOS_SENTENCIA[tipo];
  const url = `${BASE_URL}/${año}/${tipoCode}-${numero}-${año}.htm`;
  
  console.log(`\n📄 Intentando obtener: ${tipoCode}-${numero}-${año}`);
  console.log(`   URL: ${url}`);
  
  // Estrategia 1: Puppeteer visible (menos detectable)
  console.log(`\n   [1/4] Intentando con Puppeteer (modo visible)...`);
  let result = await scrapeWithPuppeteerVisible(url);
  if (result && result.text.length > 500) {
    return { ...result, url, tipo, numero, año };
  }
  
  // Estrategia 2: Archive.org
  console.log(`\n   [2/4] Intentando con Archive.org...`);
  result = await scrapeFromArchive(url);
  if (result && result.text.length > 500) {
    return { ...result, url, tipo, numero, año };
  }
  
  // Estrategia 3: Fetch simple
  console.log(`\n   [3/4] Intentando con Fetch simple...`);
  result = await scrapeWithSimpleFetch(url);
  if (result && result.text.length > 500) {
    return { ...result, url, tipo, numero, año };
  }
  
  // Estrategia 4: Falló todo
  console.log(`\n   [4/4] ❌ TODAS LAS ESTRATEGIAS FALLARON`);
  return null;
}

/**
 * Guarda sentencia
 */
async function saveSentencia(data) {
  const { tipo, numero, año, text, url, strategy } = data;
  
  const baseDir = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc', año.toString());
  if (!existsSync(baseDir)) {
    await mkdir(baseDir, { recursive: true });
  }
  
  const filename = `sentencia-${tipo}-${numero}-${año}.txt`;
  const filepath = path.join(baseDir, filename);
  
  const content = `SENTENCIA ${TIPOS_SENTENCIA[tipo]}-${numero}-${año}

Tipo: ${tipo}
Número: ${numero}
Año: ${año}
URL: ${url}
Estrategia: ${strategy}
Fuente: Scraping automatizado (stealth)

========================================

${text}
`;
  
  await writeFile(filepath, content, 'utf-8');
  console.log(`\n✅ GUARDADO: ${filename} (${Math.round(text.length / 1024)} KB, estrategia: ${strategy})`);
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const yearArg = args.find(a => a.startsWith('--year'));
  const typeArg = args.find(a => a.startsWith('--type'));
  const limitArg = args.find(a => a.startsWith('--limit'));
  
  if (!yearArg || !typeArg) {
    console.error(`
Uso:
  node scripts/scrape-jurisprudencia-stealth.mjs --year=2024 --type=tutela --limit=5

Opciones:
  --year=YYYY   Año a scrapear
  --type=TYPE   Tipo (tutela, constitucionalidad, unificacion)
  --limit=N     Número máximo de sentencias

Estrategias (en orden):
  1. Puppeteer modo visible (más difícil de detectar)
  2. Archive.org (datos históricos)
  3. Fetch simple (última opción)
`);
    process.exit(1);
  }
  
  const year = parseInt(yearArg.split('=')[1]);
  const tipo = typeArg.split('=')[1];
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;
  
  console.log(`
========================================
SCRAPER STEALTH - JURISPRUDENCIA CC
========================================

Año: ${year}
Tipo: ${tipo}
Límite: ${limit}

Estrategias:
 1. Puppeteer NO headless (ventana visible)
 2. Archive.org (Wayback Machine)
 3. Fetch con headers realistas

NOTA: Este scraper usa delays largos (5-15s) para
      simular comportamiento humano y evitar bloqueos.
      Puede tomar varios minutos.
`);
  
  const stats = {
    total: 0,
    exitosos: 0,
    fallidos: 0,
    porEstrategia: {}
  };
  
  // Intentar obtener sentencias
  for (let i = 1; i <= limit; i++) {
    const numero = String(i).padStart(3, '0');
    stats.total++;
    
    try {
      const result = await scrapeSentencia(tipo, numero, year);
      
      if (result) {
        await saveSentencia(result);
        stats.exitosos++;
        stats.porEstrategia[result.strategy] = (stats.porEstrategia[result.strategy] || 0) + 1;
      } else {
        stats.fallidos++;
        console.log(`\n⚠️  No se pudo obtener ${tipo}-${numero}-${year}`);
      }
    } catch (error) {
      stats.fallidos++;
      console.error(`\n❌ Error procesando ${tipo}-${numero}-${year}: ${error.message}`);
    }
    
    // Delay entre sentencias
    if (i < limit) {
      await humanDelay();
    }
  }
  
  // Reporte final
  console.log(`
========================================
REPORTE FINAL
========================================

Total intentos: ${stats.total}
Exitosos: ${stats.exitosos} (${Math.round(stats.exitosos / stats.total * 100)}%)
Fallidos: ${stats.fallidos}

Por estrategia:
${Object.entries(stats.porEstrategia).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

Archivos guardados en: data/jurisprudencia/cc/${year}/
`);
}

main().catch(console.error);
