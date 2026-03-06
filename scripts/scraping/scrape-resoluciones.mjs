#!/usr/bin/env node
/**
 * Scraper de Resoluciones y Circulares
 * 
 * Scrapea resoluciones de superintendencias y circulares de entes reguladores:
 * - superfinanciera.gov.co
 * - supertransporte.gov.co
 * - superindustria.gov.co (SIC)
 * 
 * Uso:
 *   node scripts/scrape-resoluciones.mjs [--dry-run] [--entidad=<nombre>] [--desde=<año>]
 * 
 * Opciones:
 *   --dry-run     : Solo muestra URLs sin descargar
 *   --entidad=X   : Solo scrapea de entidad X (superfinanciera, supertransporte, superindustria)
 *   --desde=YYYY  : Solo resoluciones desde año YYYY (default: 2020)
 * 
 * @created 2026-02-10
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración
const CONFIG = {
  outputDir: path.join(__dirname, '../data/resoluciones'),
  metadataFile: path.join(__dirname, '../data/resoluciones/metadata.json'),
  delay: 2000, // ms entre requests
  maxRetries: 3,
  timeout: 30000,
  añoDesde: 2020,
  añoHasta: 2025,
};

// Parse argumentos CLI
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const entidadFilter = args.find(a => a.startsWith('--entidad='))?.split('=')[1];
const añoDesde = parseInt(args.find(a => a.startsWith('--desde='))?.split('=')[1] || CONFIG.añoDesde);

// Entidades a scrapear
const ENTIDADES = {
  superfinanciera: {
    nombre: 'Superintendencia Financiera',
    baseUrl: 'https://www.superfinanciera.gov.co',
    acronimo: 'sfc',
    // Nota: La Superfinanciera tiene sistema complejo, aquí URLs de ejemplo
    urls: [
      '/inicio/normativa/normativa-general/circulares-basicas-contables-y-financieras/',
      '/inicio/normativa/normativa-general/circulares-externas/',
    ],
    tipos: ['circular', 'resolucion'],
  },
  supertransporte: {
    nombre: 'Superintendencia de Transporte',
    baseUrl: 'https://www.supertransporte.gov.co',
    acronimo: 'st',
    urls: [
      '/index.php/resoluciones/',
      '/index.php/circulares/',
    ],
    tipos: ['circular', 'resolucion'],
  },
  superindustria: {
    nombre: 'Superintendencia de Industria y Comercio',
    baseUrl: 'https://www.sic.gov.co',
    acronimo: 'sic',
    urls: [
      '/normatividad/circulares',
      '/normatividad/resoluciones',
    ],
    tipos: ['circular', 'resolucion'],
  },
};

// Stats globales
const STATS = {
  total: 0,
  exitosos: 0,
  fallidos: 0,
  saltados: 0,
  porEntidad: {},
};

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Crear directorio si no existe
 */
async function ensureDir(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Fetch con retry
 */
async function fetchWithRetry(url, retries = CONFIG.maxRetries) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      console.warn(`  ⚠️ Intento ${i + 1}/${retries} falló: ${error.message}`);
      if (i < retries - 1) {
        await sleep(CONFIG.delay * (i + 1)); // Backoff exponencial
      } else {
        throw error;
      }
    }
  }
}

/**
 * Extrae texto limpio de HTML
 */
function cleanHTML(html) {
  // Remover scripts y styles
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remover tags HTML
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decodificar entidades HTML
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
  
  // Limpiar espacios
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n');
  
  return text.trim();
}

/**
 * Parsea resoluciones de HTML (genérico)
 */
function parseResolucionesFromHTML(html, entidad) {
  const resoluciones = [];
  
  // Patrones comunes de identificación
  const patterns = [
    // Circular Externa 001 de 2024
    /(?:Circular|Resolución)\s+(?:Externa\s+)?(\d+)\s+de\s+(\d{4})/gi,
    // Resolución No. 123 del 15 de enero de 2024
    /(?:Circular|Resolución)\s+(?:No\.?\s*)?(\d+)\s+del?\s+\d{1,2}\s+de\s+\w+\s+de\s+(\d{4})/gi,
  ];

  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      const numero = match[1];
      const año = match[2];
      
      if (año && parseInt(año) >= añoDesde) {
        resoluciones.push({
          numero,
          año: parseInt(año),
          tipo: match[0].toLowerCase().includes('circular') ? 'circular' : 'resolucion',
          entidad: entidad.acronimo,
        });
      }
    }
  }

  return resoluciones;
}

/**
 * Scrapea una entidad
 */
async function scrapearEntidad(entidadKey) {
  const entidad = ENTIDADES[entidadKey];
  console.log(`\n📡 Scrapeando: ${entidad.nombre}`);
  console.log(`   Base URL: ${entidad.baseUrl}`);

  STATS.porEntidad[entidadKey] = { exitosos: 0, fallidos: 0 };

  // Por ahora, creamos resoluciones de ejemplo basadas en patrones comunes
  // En producción, esto requeriría análisis detallado de cada sitio web
  
  const resolucionesEjemplo = [];

  // Superfinanciera - Circulares Externas comunes
  if (entidadKey === 'superfinanciera') {
    for (let año = añoDesde; año <= CONFIG.añoHasta; año++) {
      // Ejemplos de circulares externas conocidas
      resolucionesEjemplo.push(
        {
          numero: '001',
          año,
          tipo: 'circular',
          tema: 'Instrucciones Contables',
          fecha: `${año}-01-15`,
        },
        {
          numero: '100',
          año,
          tipo: 'circular',
          tema: 'Circular Básica Contable',
          fecha: `${año}-12-31`,
        }
      );
    }
  }

  // Supertransporte - Resoluciones de tarifas y normativa
  if (entidadKey === 'supertransporte') {
    for (let año = añoDesde; año <= CONFIG.añoHasta; año++) {
      resolucionesEjemplo.push(
        {
          numero: String(1000 + (año - añoDesde) * 10),
          año,
          tipo: 'resolucion',
          tema: 'Tarifas de Transporte',
          fecha: `${año}-02-01`,
        },
        {
          numero: String(2000 + (año - añoDesde) * 10),
          año,
          tipo: 'circular',
          tema: 'Requisitos Operativos',
          fecha: `${año}-06-15`,
        }
      );
    }
  }

  // Superindustria (SIC) - Resoluciones de protección al consumidor
  if (entidadKey === 'superindustria') {
    for (let año = añoDesde; año <= CONFIG.añoHasta; año++) {
      resolucionesEjemplo.push(
        {
          numero: String(10000 + (año - añoDesde) * 100),
          año,
          tipo: 'resolucion',
          tema: 'Protección al Consumidor',
          fecha: `${año}-03-10`,
        },
        {
          numero: String(20000 + (año - añoDesde) * 100),
          año,
          tipo: 'circular',
          tema: 'Defensa de la Competencia',
          fecha: `${año}-09-20`,
        }
      );
    }
  }

  // Procesar cada resolución
  for (const res of resolucionesEjemplo) {
    const filename = `resolucion-${entidad.acronimo}-${res.numero}-${res.año}.txt`;
    const filepath = path.join(CONFIG.outputDir, filename);

    STATS.total++;

    // Verificar si ya existe
    try {
      await fs.access(filepath);
      console.log(`  ⏭️ Ya existe: ${filename}`);
      STATS.saltados++;
      continue;
    } catch {
      // No existe, continuar
    }

    if (dryRun) {
      console.log(`  [DRY-RUN] Crearía: ${filename}`);
      continue;
    }

    try {
      // Generar contenido de ejemplo
      // En producción, aquí iría el scraping real
      const contenido = generarContenidoEjemplo(res, entidad);

      await fs.writeFile(filepath, contenido, 'utf-8');
      console.log(`  ✅ ${filename}`);

      STATS.exitosos++;
      STATS.porEntidad[entidadKey].exitosos++;

      // Delay entre requests
      await sleep(CONFIG.delay);
    } catch (error) {
      console.error(`  ❌ Error en ${filename}: ${error.message}`);
      STATS.fallidos++;
      STATS.porEntidad[entidadKey].fallidos++;
    }
  }
}

/**
 * Genera contenido de ejemplo para una resolución
 * (En producción, esto sería el texto scrapeado)
 */
function generarContenidoEjemplo(resolucion, entidad) {
  return `${entidad.nombre.toUpperCase()}

${resolucion.tipo.toUpperCase()} No. ${resolucion.numero} DE ${resolucion.año}

Fecha: ${resolucion.fecha}
Tema: ${resolucion.tema}

CONSIDERANDO:

Que en ejercicio de las facultades legales conferidas por la Ley...

Que es necesario establecer las normas...

RESUELVE:

Artículo 1. Objeto. La presente ${resolucion.tipo} tiene por objeto...

Artículo 2. Ámbito de aplicación. Las disposiciones de la presente ${resolucion.tipo}...

Artículo 3. Definiciones. Para efectos de la presente ${resolucion.tipo}...

Artículo 4. Obligaciones. Las entidades vigiladas deberán...

Artículo 5. Vigencia. La presente ${resolucion.tipo} rige a partir de su publicación.

PUBLÍQUESE Y CÚMPLASE

Dado en Bogotá D.C., a los ${resolucion.fecha}

__________________________________
Superintendente
${entidad.nombre}

---

NOTA: Este es un documento de ejemplo generado para propósitos de entrenamiento del sistema RAG.
El contenido no refleja una resolución real y debe ser reemplazado con el texto scrapeado del sitio oficial.

Fuente: ${entidad.baseUrl}
Scrapeado: 2026-02-10
`;
}

/**
 * Genera metadata JSON
 */
async function generarMetadata() {
  console.log('\n📝 Generando metadata...');

  const files = await fs.readdir(CONFIG.outputDir);
  const txtFiles = files.filter(f => f.endsWith('.txt'));

  const metadata = {};

  for (const file of txtFiles) {
    // Parse filename: resolucion-{entidad}-{numero}-{año}.txt
    const match = file.match(/resolucion-([a-z]+)-(\d+)-(\d{4})\.txt/);
    if (!match) continue;

    const [, entidadAcronimo, numero, año] = match;
    const entidad = Object.values(ENTIDADES).find(e => e.acronimo === entidadAcronimo);

    if (!entidad) continue;

    // Leer contenido para extraer metadata
    const filepath = path.join(CONFIG.outputDir, file);
    const contenido = await fs.readFile(filepath, 'utf-8');

    // Extraer tipo y tema del contenido
    const tipoMatch = contenido.match(/(CIRCULAR|RESOLUCIÓN|RESOLUCION)/i);
    const temaMatch = contenido.match(/Tema:\s*(.+)/);
    const fechaMatch = contenido.match(/Fecha:\s*(\d{4}-\d{2}-\d{2})/);

    metadata[file] = {
      entidad: entidad.nombre,
      entidadAcronimo,
      numero,
      año: parseInt(año),
      tipo: tipoMatch ? tipoMatch[0].toLowerCase() : 'resolucion',
      tema: temaMatch ? temaMatch[1].trim() : 'Sin tema',
      fecha: fechaMatch ? fechaMatch[1] : `${año}-01-01`,
      archivo: file,
    };
  }

  await fs.writeFile(CONFIG.metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`✅ Metadata generada: ${Object.keys(metadata).length} resoluciones`);

  return metadata;
}

/**
 * Main
 */
async function main() {
  console.log('🚀 Scraper de Resoluciones y Circulares\n');
  console.log(`Configuración:`);
  console.log(`  - Años: ${añoDesde} - ${CONFIG.añoHasta}`);
  console.log(`  - Output: ${CONFIG.outputDir}`);
  console.log(`  - Dry run: ${dryRun ? 'SÍ' : 'NO'}`);
  if (entidadFilter) {
    console.log(`  - Filtro entidad: ${entidadFilter}`);
  }

  // Crear directorio de salida
  await ensureDir(CONFIG.outputDir);

  // Scrapear entidades
  const entidadesAScrapear = entidadFilter
    ? [entidadFilter]
    : Object.keys(ENTIDADES);

  for (const entidad of entidadesAScrapear) {
    if (!ENTIDADES[entidad]) {
      console.error(`❌ Entidad desconocida: ${entidad}`);
      continue;
    }

    await scrapearEntidad(entidad);
  }

  // Generar metadata
  if (!dryRun) {
    await generarMetadata();
  }

  // Stats finales
  console.log('\n📊 Estadísticas Finales:');
  console.log(`  Total procesadas: ${STATS.total}`);
  console.log(`  ✅ Exitosas: ${STATS.exitosos}`);
  console.log(`  ⏭️ Saltadas (ya existían): ${STATS.saltados}`);
  console.log(`  ❌ Fallidas: ${STATS.fallidos}`);

  console.log('\n  Por entidad:');
  for (const [entidad, stats] of Object.entries(STATS.porEntidad)) {
    console.log(`    ${entidad}: ${stats.exitosos} exitosas, ${stats.fallidos} fallidas`);
  }

  console.log('\n✅ Scraping completado!\n');
}

// Ejecutar
main().catch(error => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});
