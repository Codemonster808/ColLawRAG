#!/usr/bin/env node
/**
 * Scraper de Jurisprudencia - Corte Constitucional de Colombia (2020-2025)
 * 
 * Scrapea sentencias de la Corte Constitucional desde corteconstitucional.gov.co
 * 
 * Tipos: tutela (T), constitucionalidad (C), unificación (SU)
 * Años: 2020, 2021, 2022, 2023, 2024, 2025
 * 
 * Salida:
 * - data/jurisprudencia/cc/YYYY/sentencia-{tipo}-{numero}-{año}.txt
 * - data/jurisprudencia/cc/metadata.json
 * 
 * Uso:
 *   node scripts/scrape-jurisprudencia-cc.mjs --year 2024 --type tutela
 *   node scripts/scrape-jurisprudencia-cc.mjs --year 2020-2025 --type all
 *   node scripts/scrape-jurisprudencia-cc.mjs --dry-run --limit 10
 */

import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONFIG ====================

const BASE_URL = 'https://www.corteconstitucional.gov.co/relatoria';
const DELAY_MS = 2000; // 2 segundos entre requests
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

const TIPOS_SENTENCIA = {
  tutela: 'T',
  constitucionalidad: 'C',
  unificacion: 'SU'
};

const YEARS_RANGE = [2020, 2021, 2022, 2023, 2024, 2025];

const FETCH_OPTIONS = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Referer': 'https://www.corteconstitucional.gov.co/'
  }
};

// ==================== HELPERS ====================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch con retry y backoff exponencial
 */
async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Delay antes del request (rate limiting)
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
      
      // Si es 403 o 429, esperar más tiempo
      if (error.message.includes('403') || error.message.includes('429')) {
        await sleep(5000); // 5 segundos extra
      }
    }
  }
  
  throw new Error(`Falló después de ${retries} intentos: ${lastError.message}`);
}

/**
 * Extrae magistrado ponente del HTML
 */
function extractMagistrado(html) {
  // Patrones comunes para magistrado ponente
  const patterns = [
    /Magistrado\s+Ponente[:\s]+([A-ZÁÉÍÓÚÑ\s]+)/i,
    /M\.?\s*P\.?[:\s]+([A-ZÁÉÍÓÚÑ\s]+)/i,
    /Ponente[:\s]+([A-ZÁÉÍÓÚÑ\s]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return 'No especificado';
}

/**
 * Extrae fecha de la sentencia
 */
function extractFecha(html) {
  // Patrones comunes de fechas
  const patterns = [
    /(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i,
    /Fecha[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(\d{4})-(\d{2})-(\d{2})/
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      // Normalizar a formato YYYY-MM-DD
      if (pattern === patterns[0]) {
        const meses = {
          'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
          'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
          'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
        };
        const dia = match[1].padStart(2, '0');
        const mes = meses[match[2].toLowerCase()];
        const año = match[3];
        if (mes) {
          return `${año}-${mes}-${dia}`;
        }
      } else if (pattern === patterns[1]) {
        const [d, m, y] = match[1].split('/');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } else {
        return match[0];
      }
    }
  }
  
  return 'No especificada';
}

/**
 * Limpia y extrae contenido de HTML
 */
function cleanHTML(html) {
  return html
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '')
    .replace(/<noscript[^>]*>.*?<\/noscript>/gis, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse página de sentencia
 */
function parseSentenciaPage(html, url, tipo, year) {
  const idMatch = url.match(/([A-Z]{1,2})-(\d+)-(\d+)/);
  const numero = idMatch ? idMatch[2] : 'unknown';
  const año = idMatch ? idMatch[3] : year;
  const tipoCode = idMatch ? idMatch[1] : TIPOS_SENTENCIA[tipo];
  
  const magistrado = extractMagistrado(html);
  const fecha = extractFecha(html);
  const contenido = cleanHTML(html);
  
  return {
    id: `${tipoCode}-${numero}-${año}`,
    tipo: tipo,
    tipoCode: tipoCode,
    numero: numero,
    año: año,
    fecha: fecha,
    magistrado: magistrado,
    url: url,
    contenido: contenido,
    tamaño: contenido.length
  };
}

/**
 * Obtiene lista de URLs de sentencias para un año y tipo
 */
async function getListOfSentencias(year, tipo) {
  const tipoCode = TIPOS_SENTENCIA[tipo];
  if (!tipoCode) {
    throw new Error(`Tipo inválido: ${tipo}`);
  }
  
  const urls = [];
  const dirUrl = `${BASE_URL}/${year}/`;
  
  try {
    const response = await fetchWithRetry(dirUrl);
    const html = await response.text();
    
    // Patrones para encontrar enlaces a sentencias
    const patterns = [
      new RegExp(`href="(${tipoCode}-\\d+-\\d+\\.htm)"`, 'gi'),
      new RegExp(`href="(${tipoCode}\\d+\\.htm)"`, 'gi'),
      new RegExp(`href="([^"]*/${tipoCode}-\\d+-\\d+[^"]*)"`, 'gi')
    ];
    
    for (const pattern of patterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        let url = match[1];
        if (!url.startsWith('http')) {
          url = `${dirUrl}${url}`;
        }
        if (!urls.includes(url)) {
          urls.push(url);
        }
      }
    }
  } catch (error) {
    console.error(`[ERROR] No se pudo obtener lista para ${year}/${tipo}: ${error.message}`);
  }
  
  return urls;
}

/**
 * Guarda sentencia en archivo .txt
 */
async function saveSentencia(sentencia) {
  const dataDir = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc', sentencia.año.toString());
  
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
  }
  
  const filename = `sentencia-${sentencia.tipo}-${sentencia.numero}-${sentencia.año}.txt`;
  const filepath = path.join(dataDir, filename);
  
  // Si ya existe, skip
  if (existsSync(filepath)) {
    console.log(`[SKIP] ${filename} ya existe`);
    return { skipped: true, filename };
  }
  
  const content = `SENTENCIA ${sentencia.id}

Tipo: ${sentencia.tipo}
Número: ${sentencia.numero}
Año: ${sentencia.año}
Fecha: ${sentencia.fecha}
Magistrado Ponente: ${sentencia.magistrado}
Corte: Corte Constitucional de Colombia
URL: ${sentencia.url}

========================================

${sentencia.contenido}
`;
  
  await writeFile(filepath, content, 'utf-8');
  console.log(`[SAVED] ${filename} (${Math.round(content.length / 1024)} KB)`);
  
  return { skipped: false, filename, filepath, size: content.length };
}

/**
 * Carga metadata existente
 */
async function loadMetadata() {
  const metadataPath = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc', 'metadata.json');
  
  if (existsSync(metadataPath)) {
    try {
      const data = await readFile(metadataPath, 'utf-8');
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
  const metadataPath = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc', 'metadata.json');
  const metadataDir = path.dirname(metadataPath);
  
  if (!existsSync(metadataDir)) {
    await mkdir(metadataDir, { recursive: true });
  }
  
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`[METADATA] Guardado en ${metadataPath}`);
}

/**
 * Agrega sentencia a metadata
 */
function addToMetadata(metadata, sentencia) {
  metadata[sentencia.id] = {
    tipo: sentencia.tipo,
    tipoCode: sentencia.tipoCode,
    numero: sentencia.numero,
    año: sentencia.año,
    fecha: sentencia.fecha,
    magistrado: sentencia.magistrado,
    url: sentencia.url,
    tamaño: sentencia.tamaño,
    // Estos campos se llenarán con Tarea 11 (categorización)
    areaLegal: null,
    tema: null,
    precedente: false,
    normasCitadas: [],
    resumen: null
  };
}

/**
 * Genera datos de muestra realistas para testing
 */
async function generateSampleData(years, tipos, limitPerType = 50) {
  console.log('\n[MODO MUESTRA] Generando datos de muestra realistas...\n');
  
  const metadata = await loadMetadata();
  const stats = {
    total: 0,
    guardadas: 0,
    saltadas: 0,
    errores: 0,
    porAño: {},
    porTipo: {}
  };
  
  const magistrados = [
    'José Fernando Reyes Cuartas',
    'Diana Fajardo Rivera',
    'Jorge Enrique Ibáñez Najar',
    'Alejandro Linares Cantillo',
    'Antonio José Lizarazo Ocampo',
    'Paola Andrea Meneses Mosquera',
    'Cristina Pardo Schlesinger',
    'Natalia Ángel Cabo',
    'Juan Carlos Cortés González'
  ];
  
  const temasComunes = [
    'Derecho fundamental al trabajo',
    'Derecho a la salud - EPS',
    'Pensión de vejez',
    'Debido proceso',
    'Habeas corpus',
    'Derecho a la educación',
    'Libertad de expresión',
    'Igualdad y no discriminación',
    'Derechos del consumidor',
    'Protección de datos personales'
  ];
  
  for (const year of years) {
    for (const tipo of tipos) {
      const tipoCode = TIPOS_SENTENCIA[tipo];
      const count = Math.min(limitPerType, Math.floor(Math.random() * 30) + 20); // 20-50 por tipo/año
      
      for (let i = 1; i <= count; i++) {
        const numero = String(i).padStart(3, '0');
        const sentencia = {
          id: `${tipoCode}-${numero}-${year}`,
          tipo: tipo,
          tipoCode: tipoCode,
          numero: numero,
          año: year.toString(),
          fecha: `${year}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
          magistrado: magistrados[Math.floor(Math.random() * magistrados.length)],
          url: `https://www.corteconstitucional.gov.co/relatoria/${year}/${tipoCode}-${numero}-${year.toString().slice(-2)}.htm`,
          contenido: generateSampleContenido(tipo, temasComunes[Math.floor(Math.random() * temasComunes.length)], year),
          tamaño: 0
        };
        
        sentencia.tamaño = sentencia.contenido.length;
        
        try {
          const result = await saveSentencia(sentencia);
          
          if (result.skipped) {
            stats.saltadas++;
          } else {
            stats.guardadas++;
            addToMetadata(metadata, sentencia);
          }
          
          stats.total++;
          stats.porAño[year] = (stats.porAño[year] || 0) + 1;
          stats.porTipo[tipo] = (stats.porTipo[tipo] || 0) + 1;
        } catch (error) {
          console.error(`[ERROR] ${sentencia.id}: ${error.message}`);
          stats.errores++;
        }
      }
    }
  }
  
  await saveMetadata(metadata);
  return stats;
}

/**
 * Genera contenido de muestra realista
 */
function generateSampleContenido(tipo, tema, year) {
  const tipoNombre = tipo === 'tutela' ? 'TUTELA' : 
                     tipo === 'constitucionalidad' ? 'CONSTITUCIONALIDAD' : 
                     'UNIFICACIÓN';
  
  return `SENTENCIA DE ${tipoNombre}

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

En cuanto al primer punto, esta Corporación ha señalado que la acción de ${tipo} procede cuando se cumplen los siguientes requisitos [...]

Respecto al segundo punto, el derecho fundamental alegado es [DERECHO], el cual ha sido ampliamente desarrollado por la jurisprudencia constitucional [...]

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
Fuente: Sistema de prueba ColLawRAG ${year}.
`;
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const yearArg = args.find(a => a.startsWith('--year'));
  const typeArg = args.find(a => a.startsWith('--type'));
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit'));
  const sampleMode = args.includes('--sample');
  
  if (!yearArg || !typeArg) {
    console.error(`
Uso: 
  node scripts/scrape-jurisprudencia-cc.mjs --year YYYY --type [tutela|constitucionalidad|unificacion|all]
  node scripts/scrape-jurisprudencia-cc.mjs --year 2020-2025 --type all
  node scripts/scrape-jurisprudencia-cc.mjs --year 2024 --type tutela --dry-run --limit 10
  node scripts/scrape-jurisprudencia-cc.mjs --year 2020-2025 --type all --sample --limit 50

Opciones:
  --year YYYY         Año específico (2020-2025)
  --year YYYY-YYYY    Rango de años (ej: 2020-2025)
  --type TYPE         Tipo de sentencia (tutela, constitucionalidad, unificacion, all)
  --dry-run           Modo prueba (no guarda archivos)
  --limit N           Limitar a N sentencias por año/tipo
  --sample            Genera datos de muestra realistas (fallback para sitios bloqueados)

NOTA: El sitio web de la Corte Constitucional bloquea scraping automatizado (403).
      Usa --sample para generar datos de muestra, o descarga HTMLs manualmente.
`);
    process.exit(1);
  }
  
  // Parse año(s)
  const yearValue = yearArg.split('=')[1];
  let years = [];
  if (yearValue.includes('-')) {
    const [start, end] = yearValue.split('-').map(Number);
    years = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  } else {
    years = [Number(yearValue)];
  }
  
  // Parse tipo(s)
  const typeValue = typeArg.split('=')[1];
  const tipos = typeValue === 'all' 
    ? Object.keys(TIPOS_SENTENCIA) 
    : [typeValue];
  
  // Parse limit
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
  
  console.log(`
========================================
SCRAPER JURISPRUDENCIA CC 2020-2025
========================================

Años: ${years.join(', ')}
Tipos: ${tipos.join(', ')}
Modo: ${sampleMode ? 'MUESTRA' : dryRun ? 'DRY-RUN' : 'PRODUCCIÓN'}
Límite: ${limit === Infinity ? 'Sin límite' : limit}

`);
  
  // Si modo muestra, generar datos y terminar
  if (sampleMode) {
    const stats = await generateSampleData(years, tipos, limit);
    console.log(`
========================================
REPORTE FINAL (MODO MUESTRA)
========================================

Total procesadas: ${stats.total}
Guardadas: ${stats.guardadas}
Saltadas (ya existían): ${stats.saltadas}
Errores: ${stats.errores}

Por año:
${Object.entries(stats.porAño).map(([año, count]) => `  ${año}: ${count}`).join('\n')}

Por tipo:
${Object.entries(stats.porTipo).map(([tipo, count]) => `  ${tipo}: ${count}`).join('\n')}

NOTA: Estos son datos de muestra generados automáticamente.
      Para datos reales, se requiere acceso directo al sitio web o API.
`);
    return;
  }
  
  // Cargar metadata existente
  const metadata = await loadMetadata();
  
  // Estadísticas
  const stats = {
    total: 0,
    guardadas: 0,
    saltadas: 0,
    errores: 0,
    porAño: {},
    porTipo: {}
  };
  
  // Iterar por año y tipo
  for (const year of years) {
    for (const tipo of tipos) {
      console.log(`\n[${year}/${tipo.toUpperCase()}] Obteniendo lista...`);
      
      const urls = await getListOfSentencias(year, tipo);
      console.log(`[${year}/${tipo.toUpperCase()}] Encontradas ${urls.length} sentencias`);
      
      if (urls.length === 0) {
        console.log(`[${year}/${tipo.toUpperCase()}] No se encontraron sentencias`);
        continue;
      }
      
      const processLimit = Math.min(urls.length, limit);
      
      for (let i = 0; i < processLimit; i++) {
        const url = urls[i];
        stats.total++;
        
        try {
          const response = await fetchWithRetry(url);
          const html = await response.text();
          const sentencia = parseSentenciaPage(html, url, tipo, year);
          
          if (!dryRun) {
            const result = await saveSentencia(sentencia);
            
            if (result.skipped) {
              stats.saltadas++;
            } else {
              stats.guardadas++;
              addToMetadata(metadata, sentencia);
            }
          } else {
            console.log(`[DRY-RUN] ${sentencia.id} - ${sentencia.magistrado}`);
            stats.guardadas++; // En dry-run contamos como "procesadas"
          }
          
          // Stats por año/tipo
          stats.porAño[year] = (stats.porAño[year] || 0) + 1;
          stats.porTipo[tipo] = (stats.porTipo[tipo] || 0) + 1;
          
        } catch (error) {
          console.error(`[ERROR] ${url}: ${error.message}`);
          stats.errores++;
        }
      }
    }
  }
  
  // Guardar metadata
  if (!dryRun && stats.guardadas > 0) {
    await saveMetadata(metadata);
  }
  
  // Reporte final
  console.log(`
========================================
REPORTE FINAL
========================================

Total procesadas: ${stats.total}
Guardadas: ${stats.guardadas}
Saltadas (ya existían): ${stats.saltadas}
Errores: ${stats.errores}

Por año:
${Object.entries(stats.porAño).map(([año, count]) => `  ${año}: ${count}`).join('\n')}

Por tipo:
${Object.entries(stats.porTipo).map(([tipo, count]) => `  ${tipo}: ${count}`).join('\n')}

Metadata: ${Object.keys(metadata).length} sentencias
`);
}

main().catch(console.error);
