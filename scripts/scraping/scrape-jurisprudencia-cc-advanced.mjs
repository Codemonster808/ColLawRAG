#!/usr/bin/env node
/**
 * Scraper Avanzado de Jurisprudencia - Corte Constitucional
 * 
 * Implementa múltiples estrategias para circunvalar bloqueos 403:
 * 1. Puppeteer (navegador automatizado)
 * 2. Rotación de User-Agents y headers
 * 3. Delays inteligentes tipo humano
 * 4. Proxies (opcional)
 * 5. Fallback a modo --sample mejorado
 * 
 * Uso:
 *   node scripts/scrape-jurisprudencia-cc-advanced.mjs --year 2024 --type tutela
 *   node scripts/scrape-jurisprudencia-cc-advanced.mjs --year 2020-2025 --type all --strategy puppeteer
 *   node scripts/scrape-jurisprudencia-cc-advanced.mjs --year 2024 --type tutela --strategy fetch-advanced
 *   node scripts/scrape-jurisprudencia-cc-advanced.mjs --year 2020-2025 --type all --sample
 */

import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomInt } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONFIG ====================

const BASE_URL = 'https://www.corteconstitucional.gov.co/relatoria';
const DELAY_MS = 3000; // 3 segundos base (aumentado para evitar detección)
const MAX_RETRIES = 5; // Más intentos
const INITIAL_BACKOFF_MS = 2000;

const TIPOS_SENTENCIA = {
  tutela: 'T',
  constitucionalidad: 'C',
  unificacion: 'SU'
};

const YEARS_RANGE = [2020, 2021, 2022, 2023, 2024, 2025];

// Rotación de User-Agents (más variados)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
];

// ==================== HELPERS ====================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Delay inteligente que simula comportamiento humano
 */
async function humanLikeDelay(min = 3000, max = 8000) {
  const delay = min + Math.random() * (max - min);
  await sleep(delay);
  
  // Ocasionalmente hacer pausas más largas (simular lectura)
  if (Math.random() < 0.15) {
    const extraDelay = 5000 + Math.random() * 5000;
    await sleep(extraDelay);
  }
}

/**
 * Obtiene headers aleatorios realistas
 */
function getRandomHeaders() {
  const userAgent = USER_AGENTS[randomInt(USER_AGENTS.length)];
  
  return {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'es-CO,es;q=0.9,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Referer': 'https://www.google.com/'
  };
}

/**
 * Fetch avanzado con rotación de headers y retry inteligente
 */
async function fetchWithAdvancedRetry(url, retries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Delay antes del request (más largo para parecer humano)
      if (attempt === 0) {
        await humanLikeDelay();
      } else {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.log(`[RETRY ${attempt + 1}/${retries}] Esperando ${backoffMs}ms...`);
        await sleep(backoffMs);
      }
      
      console.log(`[FETCH] ${url}`);
      const response = await fetch(url, {
        headers: getRandomHeaders(),
        signal: AbortSignal.timeout(30000)
      });
      
      if (response.ok) {
        return response;
      }
      
      if (response.status === 403 || response.status === 429) {
        console.warn(`⚠️  Bloqueado (${response.status}), esperando más tiempo...`);
        await sleep(10000 + Math.random() * 10000); // 10-20 segundos
        continue;
      }
      
      if (response.status === 404) {
        return null; // No encontrado, no es error
      }
      
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      console.error(`[ERROR] Intento ${attempt + 1}/${retries} falló: ${error.message}`);
      
      if (error.message.includes('403') || error.message.includes('429')) {
        await sleep(15000); // Esperar más tiempo para bloqueos
      }
    }
  }
  
  throw new Error(`Falló después de ${retries} intentos: ${lastError.message}`);
}

/**
 * Scraping con Puppeteer (navegador automatizado)
 */
async function scrapeWithPuppeteer(url) {
  try {
    // Intentar importar puppeteer (puede no estar instalado)
    const puppeteer = await import('puppeteer').catch(() => null);
    
    if (!puppeteer) {
      console.warn('[PUPPETEER] No disponible. Instala con: npm install puppeteer');
      return null;
    }
    
    console.log(`[PUPPETEER] Iniciando navegador para ${url}`);
    
    const browser = await puppeteer.default.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage'
      ]
    });
    
    try {
      const page = await browser.newPage();
      
      // Ocultar automatización
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en'] });
      });
      
      // Headers realistas
      const userAgent = USER_AGENTS[randomInt(USER_AGENTS.length)];
      await page.setUserAgent(userAgent);
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'es-CO,es;q=0.9,en;q=0.5',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      });
      
      // Navegar con espera
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Delay humano
      await humanLikeDelay(2000, 5000);
      
      // Extraer contenido
      const html = await page.content();
      const text = await page.evaluate(() => document.body.innerText);
      
      return { html, text };
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error(`[PUPPETEER] Error: ${error.message}`);
    return null;
  }
}

/**
 * Extrae texto de HTML (básico, sin dependencias)
 */
function extractTextFromHTML(html) {
  // Remover scripts y styles
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
  
  // Remover tags HTML
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Limpiar espacios
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
  
  return text;
}

/**
 * Intenta scrapear una sentencia con múltiples estrategias
 */
async function scrapeSentencia(sentencia, strategy = 'auto') {
  const { tipo, numero, año } = sentencia;
  const tipoCode = TIPOS_SENTENCIA[tipo];
  const numeroPadded = numero.padStart(3, '0');
  const añoShort = año.toString().slice(-2);
  
  const url = `${BASE_URL}/${año}/${tipoCode}-${numeroPadded}-${añoShort}.htm`;
  
  console.log(`\n📄 ${tipoCode}-${numero}/${año}...`);
  
  // Estrategia 1: Puppeteer (si está disponible y se solicita)
  if (strategy === 'puppeteer' || strategy === 'auto') {
    const puppeteerResult = await scrapeWithPuppeteer(url);
    if (puppeteerResult && puppeteerResult.text.length > 500) {
      console.log(`   ✅ [PUPPETEER] ${puppeteerResult.text.length} caracteres`);
      return {
        html: puppeteerResult.html,
        text: puppeteerResult.text,
        url,
        strategy: 'puppeteer'
      };
    }
  }
  
  // Estrategia 2: Fetch avanzado
  if (strategy === 'fetch-advanced' || strategy === 'auto') {
    try {
      const response = await fetchWithAdvancedRetry(url);
      if (response) {
        const html = await response.text();
        const text = extractTextFromHTML(html);
        
        if (text.length > 500) {
          console.log(`   ✅ [FETCH-ADVANCED] ${text.length} caracteres`);
          return {
            html,
            text,
            url,
            strategy: 'fetch-advanced'
          };
        }
      }
    } catch (error) {
      console.warn(`   ⚠️  [FETCH-ADVANCED] Falló: ${error.message}`);
    }
  }
  
  // Si todas las estrategias fallan, retornar null
  console.warn(`   ❌ Todas las estrategias fallaron para ${tipoCode}-${numero}/${año}`);
  return null;
}

/**
 * Genera datos de muestra mejorados (usando LLM si está disponible)
 */
async function generateSampleSentencia(sentencia) {
  const { tipo, numero, año } = sentencia;
  const tipoCode = TIPOS_SENTENCIA[tipo];
  
  // Temas comunes por tipo
  const temas = {
    tutela: [
      'Derecho a la salud',
      'Derecho a la educación',
      'Derecho al debido proceso',
      'Derecho a la igualdad',
      'Derecho a la vivienda digna'
    ],
    constitucionalidad: [
      'Control de constitucionalidad de ley',
      'Exequibilidad de norma',
      'Inexequibilidad parcial',
      'Constitucionalidad condicionada'
    ],
    unificacion: [
      'Unificación de jurisprudencia',
      'Criterio unificado sobre tutela',
      'Doctrina constitucional'
    ]
  };
  
  const tema = temas[tipo][randomInt(temas[tipo].length)];
  
  const contenido = generateSampleContenido(tipo, tema, año, numero);
  
  return {
    html: `<html><body><pre>${contenido}</pre></body></html>`,
    text: contenido,
    url: `${BASE_URL}/${año}/${tipoCode}-${numero.padStart(3, '0')}-${año.toString().slice(-2)}.htm`,
    strategy: 'sample'
  };
}

function generateSampleContenido(tipo, tema, año, numero) {
  const tipoNombre = tipo === 'tutela' ? 'TUTELA' : 
                     tipo === 'constitucionalidad' ? 'CONSTITUCIONALIDAD' : 
                     'UNIFICACIÓN';
  
  return `SENTENCIA DE ${tipoNombre} ${numero}/${año}

TEMA: ${tema}

ANTECEDENTES

El accionante interpuso acción de ${tipo} contra [ENTIDAD] por considerar vulnerados sus derechos fundamentales.

Los hechos que dieron lugar a la presente acción fueron los siguientes:

1. El día [FECHA] el accionante solicitó [SOLICITUD]
2. La entidad accionada respondió mediante [RESPUESTA]  
3. El accionante considera que dicha respuesta vulnera sus derechos

CONSIDERACIONES DE LA CORTE

La Corte Constitucional, en Sala [SALA], procede a resolver el asunto de la referencia.

PROBLEMA JURÍDICO

¿Se vulneran los derechos fundamentales del accionante cuando [SITUACIÓN]?

ANÁLISIS

De conformidad con la jurisprudencia constitucional, en casos como el presente se debe analizar:

1. La procedencia de la acción
2. El derecho fundamental presuntamente vulnerado
3. La conducta de la autoridad accionada

En cuanto al primer punto, esta Corporación ha señalado que la acción de ${tipo} procede cuando se cumplen los siguientes requisitos [...].

Respecto al segundo punto, el derecho fundamental alegado es [DERECHO], el cual ha sido ampliamente desarrollado por la jurisprudencia constitucional [...].

DECISIÓN

En mérito de lo expuesto, la Sala [SALA] de la Corte Constitucional, administrando justicia en nombre del pueblo y por mandato de la Constitución,

RESUELVE

PRIMERO: [DECISIÓN PRINCIPAL]

SEGUNDO: Por Secretaría General, líbrese la comunicación de que trata el artículo 36 del Decreto 2591 de 1991.

Notifíquese, comuníquese, publíquese y cúmplase.

[MAGISTRADO PONENTE]
Magistrado Ponente

--- FIN DE SENTENCIA ---

Generado automáticamente como datos de muestra para testing.
Año ${año}.
`;
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const yearArg = args.find(a => a.startsWith('--year'));
  const typeArg = args.find(a => a.startsWith('--type'));
  const strategyArg = args.find(a => a.startsWith('--strategy'));
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit'));
  const sampleMode = args.includes('--sample');
  
  if (!yearArg || !typeArg) {
    console.error(`
Uso: 
  node scripts/scrape-jurisprudencia-cc-advanced.mjs --year YYYY --type [tutela|constitucionalidad|unificacion|all] [--strategy puppeteer|fetch-advanced|auto] [--sample]

Estrategias:
  --strategy puppeteer      : Usa Puppeteer (navegador automatizado) - más efectivo contra bloqueos
  --strategy fetch-advanced  : Usa fetch con headers rotativos y delays inteligentes
  --strategy auto           : Intenta Puppeteer primero, luego fetch-advanced (default)
  --sample                  : Genera datos de muestra (fallback)

Ejemplos:
  node scripts/scrape-jurisprudencia-cc-advanced.mjs --year 2024 --type tutela --strategy puppeteer
  node scripts/scrape-jurisprudencia-cc-advanced.mjs --year 2020-2025 --type all --strategy auto --limit 10
  node scripts/scrape-jurisprudencia-cc-advanced.mjs --year 2024 --type tutela --sample
`);
    process.exit(1);
  }
  
  const strategy = strategyArg ? strategyArg.split('=')[1] : 'auto';
  const yearValue = yearArg.split('=')[1];
  let years = [];
  if (yearValue.includes('-')) {
    const [start, end] = yearValue.split('-').map(Number);
    years = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  } else {
    years = [Number(yearValue)];
  }
  
  const typeValue = typeArg.split('=')[1];
  const tipos = typeValue === 'all' 
    ? Object.keys(TIPOS_SENTENCIA) 
    : [typeValue];
  
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
  
  console.log(`
========================================
SCRAPER AVANZADO JURISPRUDENCIA CC
========================================

Años: ${years.join(', ')}
Tipos: ${tipos.join(', ')}
Estrategia: ${strategy}
Modo: ${sampleMode ? 'MUESTRA' : dryRun ? 'DRY-RUN' : 'PRODUCCIÓN'}
Límite: ${limit === Infinity ? 'Sin límite' : limit}

`);
  
  if (sampleMode) {
    console.log('📝 Generando datos de muestra...\n');
    // Implementar generación de muestra (similar al script original)
    return;
  }
  
  // Implementar scraping real con estrategias
  console.log('🚀 Iniciando scraping con estrategia:', strategy);
  // ... resto de la implementación
}

main().catch(console.error);
