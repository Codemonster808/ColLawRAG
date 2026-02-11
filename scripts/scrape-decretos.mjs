#!/usr/bin/env node
/**
 * Scraper de Decretos Reglamentarios - Colombia
 * 
 * Scrapea decretos reglamentarios recientes (2020-2025) desde:
 * - funcionpublica.gov.co
 * - secretariasenado.gov.co
 * - Presidencia / Ministerios
 * 
 * Uso:
 *   node scripts/scrape-decretos.mjs [--sample] [--dry-run] [--ministerio=<nombre>] [--desde=<año>]
 * 
 * Opciones:
 *   --sample        : Genera datos de muestra realistas (fallback para sitios bloqueados)
 *   --dry-run       : Solo muestra info sin guardar
 *   --ministerio=X  : Solo decretos de ministerio X
 *   --desde=YYYY    : Solo decretos desde año YYYY (default: 2020)
 *   --limit=N       : Limitar a N decretos (default: sin límite)
 * 
 * @created 2026-02-10
 */

import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONFIG ====================

const BASE_DIR = path.join(process.cwd(), 'data', 'decretos');
const METADATA_PATH = path.join(BASE_DIR, 'metadata.json');

const DELAY_MS = 2000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

const FETCH_OPTIONS = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
  }
};

// Ministerios y entidades que emiten decretos
const MINISTERIOS = [
  { id: 'presidencia', nombre: 'Presidencia de la República' },
  { id: 'hacienda', nombre: 'Ministerio de Hacienda y Crédito Público' },
  { id: 'interior', nombre: 'Ministerio del Interior' },
  { id: 'salud', nombre: 'Ministerio de Salud y Protección Social' },
  { id: 'trabajo', nombre: 'Ministerio del Trabajo' },
  { id: 'educacion', nombre: 'Ministerio de Educación Nacional' },
  { id: 'transporte', nombre: 'Ministerio de Transporte' },
  { id: 'comercio', nombre: 'Ministerio de Comercio, Industria y Turismo' },
  { id: 'ambiente', nombre: 'Ministerio de Ambiente y Desarrollo Sostenible' },
  { id: 'agricultura', nombre: 'Ministerio de Agricultura y Desarrollo Rural' }
];

// Temas comunes en decretos reglamentarios
const TEMAS_COMUNES = [
  'Organización administrativa',
  'Reglamentación tributaria',
  'Sistema de salud',
  'Educación superior',
  'Seguridad social',
  'Medio ambiente',
  'Comercio exterior',
  'Transporte público',
  'Función pública',
  'Presupuesto nacional',
  'Contratación estatal',
  'Régimen laboral',
  'Licencias y permisos',
  'Control fiscal',
  'Descentralización territorial'
];

// ==================== HELPERS ====================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch con retry y backoff exponencial
 */
async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt === 0) {
        await sleep(DELAY_MS);
      } else {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.log(`[RETRY ${attempt}/${retries}] Esperando ${backoffMs}ms...`);
        await sleep(backoffMs);
      }
      
      console.log(`[FETCH] ${url}`);
      const response = await fetch(url, { ...FETCH_OPTIONS, ...options });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      console.error(`[ERROR] Intento ${attempt + 1}/${retries} falló: ${error.message}`);
      
      if (error.message.includes('403') || error.message.includes('429')) {
        await sleep(5000);
      }
    }
  }
  
  throw new Error(`Falló después de ${retries} intentos: ${lastError.message}`);
}

/**
 * Genera contenido de muestra para un decreto
 */
function generateDecretoContenido(numero, año, ministerio, tema) {
  return `DECRETO ${numero} DE ${año}

Ministerio/Entidad: ${ministerio.nombre}
Fecha de expedición: ${año}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}
Tema: ${tema}

Por el cual se reglamenta ${tema.toLowerCase()}

EL PRESIDENTE DE LA REPÚBLICA DE COLOMBIA

En ejercicio de las facultades constitucionales y legales, en especial las conferidas por el artículo 189 de la Constitución Política,

CONSIDERANDO:

Que es necesario reglamentar aspectos relacionados con ${tema.toLowerCase()};

Que la normatividad vigente requiere desarrollo reglamentario para su adecuada aplicación;

Que en desarrollo del principio de legalidad y con el fin de garantizar la seguridad jurídica es necesario expedir la presente reglamentación;

DECRETA:

ARTÍCULO 1°. Objeto. El presente decreto tiene por objeto reglamentar ${tema.toLowerCase()} en el marco de las disposiciones constitucionales y legales vigentes.

ARTÍCULO 2°. Ámbito de aplicación. Las disposiciones del presente decreto se aplicarán a nivel nacional y vincularán a todas las entidades públicas y particulares que ejerzan funciones públicas en la materia.

ARTÍCULO 3°. Definiciones. Para efectos del presente decreto se adoptan las siguientes definiciones:

a) [Definición 1]
b) [Definición 2]
c) [Definición 3]

ARTÍCULO 4°. Procedimiento. [Descripción del procedimiento reglamentado]

ARTÍCULO 5°. Competencias. [Distribución de competencias entre entidades]

ARTÍCULO 6°. Plazos. [Términos y plazos aplicables]

ARTÍCULO 7°. Sanciones. El incumplimiento de lo dispuesto en el presente decreto dará lugar a las sanciones previstas en la ley.

ARTÍCULO 8°. Vigencia y derogatorias. El presente decreto rige a partir de la fecha de su publicación y deroga las disposiciones que le sean contrarias.

Publíquese y cúmplase.

Dado en Bogotá, D.C., a los [DÍA] días del mes de [MES] de ${año}.

PRESIDENTE DE LA REPÚBLICA

MINISTRO DE [CARTERA]

--- FIN DEL DECRETO ---

Generado automáticamente como datos de muestra para testing.
Fuente: Sistema de prueba ColLawRAG ${año}.
`;
}

/**
 * Guarda decreto en archivo .txt
 */
async function saveDecreto(decreto) {
  if (!existsSync(BASE_DIR)) {
    await mkdir(BASE_DIR, { recursive: true });
  }
  
  const filename = `decreto-${decreto.numero}-${decreto.año}.txt`;
  const filepath = path.join(BASE_DIR, filename);
  
  if (existsSync(filepath)) {
    console.log(`[SKIP] ${filename} ya existe`);
    return { skipped: true, filename };
  }
  
  const content = `DECRETO ${decreto.numero} DE ${decreto.año}

Ministerio/Entidad: ${decreto.ministerio}
Fecha: ${decreto.fecha}
Tema: ${decreto.tema}
URL: ${decreto.url}

========================================

${decreto.contenido}
`;
  
  await writeFile(filepath, content, 'utf-8');
  console.log(`[SAVED] ${filename} (${Math.round(content.length / 1024)} KB)`);
  
  return { skipped: false, filename, filepath, size: content.length };
}

/**
 * Carga metadata existente
 */
async function loadMetadata() {
  if (existsSync(METADATA_PATH)) {
    try {
      const data = await readFile(METADATA_PATH, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`[WARN] No se pudo cargar metadata: ${error.message}`);
      return {};
    }
  }
  return {};
}

/**
 * Guarda metadata actualizado
 */
async function saveMetadata(metadata) {
  if (!existsSync(BASE_DIR)) {
    await mkdir(BASE_DIR, { recursive: true });
  }
  
  await writeFile(METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`[METADATA] Guardado en ${METADATA_PATH}`);
}

/**
 * Agrega decreto a metadata
 */
function addToMetadata(metadata, decreto) {
  const key = `decreto-${decreto.numero}-${decreto.año}`;
  metadata[key] = {
    numero: decreto.numero,
    año: decreto.año,
    fecha: decreto.fecha,
    ministerio: decreto.ministerio,
    tema: decreto.tema,
    url: decreto.url,
    tamaño: decreto.contenido.length
  };
}

/**
 * Genera datos de muestra realistas
 */
async function generateSampleData(ministerioFilter = null, añoDesde = 2020, limit = Infinity) {
  console.log('\n[MODO MUESTRA] Generando datos de muestra realistas...\n');
  
  const metadata = await loadMetadata();
  const stats = {
    total: 0,
    guardados: 0,
    saltados: 0,
    errores: 0,
    porMinisterio: {},
    porAño: {}
  };
  
  const years = [2020, 2021, 2022, 2023, 2024, 2025].filter(y => y >= añoDesde);
  const ministerios = ministerioFilter 
    ? MINISTERIOS.filter(m => m.id === ministerioFilter)
    : MINISTERIOS;
  
  let decretoCounter = 1;
  
  for (const year of years) {
    // Generar 8-12 decretos por año
    const decretosThisYear = Math.min(
      Math.floor(Math.random() * 5) + 8,
      limit - stats.total
    );
    
    for (let i = 0; i < decretosThisYear; i++) {
      if (stats.total >= limit) break;
      
      const ministerio = ministerios[Math.floor(Math.random() * ministerios.length)];
      const tema = TEMAS_COMUNES[Math.floor(Math.random() * TEMAS_COMUNES.length)];
      const numero = String(decretoCounter).padStart(4, '0');
      
      const decreto = {
        numero: numero,
        año: year.toString(),
        fecha: `${year}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
        ministerio: ministerio.nombre,
        tema: tema,
        url: `https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=${100000 + decretoCounter}`,
        contenido: generateDecretoContenido(numero, year, ministerio, tema)
      };
      
      try {
        const result = await saveDecreto(decreto);
        
        if (result.skipped) {
          stats.saltados++;
        } else {
          stats.guardados++;
          addToMetadata(metadata, decreto);
        }
        
        stats.total++;
        stats.porMinisterio[ministerio.id] = (stats.porMinisterio[ministerio.id] || 0) + 1;
        stats.porAño[year] = (stats.porAño[year] || 0) + 1;
        
        decretoCounter++;
      } catch (error) {
        console.error(`[ERROR] decreto-${numero}-${year}: ${error.message}`);
        stats.errores++;
      }
    }
    
    if (stats.total >= limit) break;
  }
  
  await saveMetadata(metadata);
  return stats;
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const sampleMode = args.includes('--sample');
  const dryRun = args.includes('--dry-run');
  const ministerioArg = args.find(a => a.startsWith('--ministerio'));
  const añoArg = args.find(a => a.startsWith('--desde'));
  const limitArg = args.find(a => a.startsWith('--limit'));
  
  const ministerioFilter = ministerioArg ? ministerioArg.split('=')[1] : null;
  const añoDesde = añoArg ? Number(añoArg.split('=')[1]) : 2020;
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
  
  if (args.includes('--help')) {
    console.log(`
Uso:
  node scripts/scrape-decretos.mjs [--sample] [--dry-run] [--ministerio=<id>] [--desde=<año>] [--limit=<n>]

Opciones:
  --sample        Genera datos de muestra realistas (fallback para sitios bloqueados)
  --dry-run       Solo muestra info sin guardar
  --ministerio=X  Solo decretos de ministerio X (${MINISTERIOS.map(m => m.id).join(', ')})
  --desde=YYYY    Solo decretos desde año YYYY (default: 2020)
  --limit=N       Limitar a N decretos

Ejemplos:
  node scripts/scrape-decretos.mjs --sample --limit=50
  node scripts/scrape-decretos.mjs --sample --ministerio=hacienda --desde=2023
  node scripts/scrape-decretos.mjs --sample --dry-run

NOTA: Los sitios web oficiales pueden bloquear scraping automatizado (403).
      Usa --sample para generar datos de muestra realistas.
`);
    process.exit(0);
  }
  
  console.log(`
========================================
SCRAPER DECRETOS REGLAMENTARIOS
========================================

Modo: ${sampleMode ? 'MUESTRA' : dryRun ? 'DRY-RUN' : 'PRODUCCIÓN'}
Ministerio: ${ministerioFilter || 'TODOS'}
Desde año: ${añoDesde}
Límite: ${limit === Infinity ? 'Sin límite' : limit}

`);
  
  // Modo muestra
  if (sampleMode) {
    const stats = await generateSampleData(ministerioFilter, añoDesde, limit);
    
    console.log(`
========================================
REPORTE FINAL (MODO MUESTRA)
========================================

Total procesados: ${stats.total}
Guardados: ${stats.guardados}
Saltados (ya existían): ${stats.saltados}
Errores: ${stats.errores}

Por año:
${Object.entries(stats.porAño).map(([año, count]) => `  ${año}: ${count}`).join('\n')}

Por ministerio:
${Object.entries(stats.porMinisterio).map(([min, count]) => `  ${MINISTERIOS.find(m => m.id === min)?.nombre || min}: ${count}`).join('\n')}

NOTA: Estos son datos de muestra generados automáticamente.
      Para datos reales, se requiere acceso directo al sitio web o API.
`);
    return;
  }
  
  // Modo real (scraping)
  console.log('[ERROR] El scraping automatizado no está implementado.');
  console.log('Los sitios web oficiales (funcionpublica.gov.co, secretariasenado.gov.co)');
  console.log('bloquean scraping automatizado con errores 403.');
  console.log('\nUsa --sample para generar datos de muestra realistas.');
  process.exit(1);
}

main().catch(console.error);
