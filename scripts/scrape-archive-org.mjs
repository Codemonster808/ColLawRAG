#!/usr/bin/env node
/**
 * Scraper Archive.org - Jurisprudencia CC
 * 
 * Obtiene sentencias desde Wayback Machine (Archive.org)
 * Ventaja: No hay bloqueos 403, datos históricos disponibles
 * 
 * Uso:
 *   node scripts/scrape-archive-org.mjs --year=2024 --type=tutela --limit=5
 */

import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONFIG ====================

const BASE_URL = 'https://www.corteconstitucional.gov.co/relatoria';
const DELAY_MS = 2000;

const TIPOS_SENTENCIA = {
  tutela: 'T',
  constitucionalidad: 'C',
  unificacion: 'SU'
};

// ==================== HELPERS ====================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Busca y obtiene desde Archive.org
 */
async function getFromArchive(url) {
  try {
    console.log(`   [ARCHIVE] Buscando snapshot de: ${url}`);
    
    // 1. Verificar si existe en archive
    const availabilityUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
    
    await sleep(DELAY_MS);
    const availResponse = await fetch(availabilityUrl);
    const availData = await availResponse.json();
    
    if (!availData.archived_snapshots || !availData.archived_snapshots.closest) {
      console.log(`   [ARCHIVE] ❌ No hay snapshots disponibles`);
      return null;
    }
    
    const snapshotUrl = availData.archived_snapshots.closest.url;
    const snapshotDate = availData.archived_snapshots.closest.timestamp;
    
    console.log(`   [ARCHIVE] ✓ Snapshot encontrado: ${snapshotDate}`);
    console.log(`   [ARCHIVE] Descargando desde: ${snapshotUrl}`);
    
    // 2. Obtener el snapshot
    await sleep(DELAY_MS);
    const response = await fetch(snapshotUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // 3. Limpiar HTML del Wayback Machine
    const cleanHtml = html
      .replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/g, '')
      .replace(/<script[^>]*archive\.org[^>]*>[\s\S]*?<\/script>/gi, '');
    
    // 4. Extraer texto
    const text = cleanHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`   [ARCHIVE] ✅ Obtenido: ${text.length} caracteres`);
    
    return {
      html: cleanHtml,
      text,
      snapshotDate,
      snapshotUrl
    };
    
  } catch (error) {
    console.error(`   [ARCHIVE] ❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Extrae magistrado del HTML
 */
function extractMagistrado(html) {
  const patterns = [
    /Magistrado\s+Ponente[:\s]+([A-ZÁÉÍÓÚÑ\s]+)/i,
    /M\.?\s*P\.?[:\s]+([A-ZÁÉÍÓÚÑ\s]+)/i,
    /Ponente[:\s]+([A-ZÁÉÍÓÚÑ\s]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return match[1].trim().substring(0, 100);
    }
  }
  
  return 'No especificado';
}

/**
 * Extrae fecha del HTML
 */
function extractFecha(html) {
  const patterns = [
    /(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i,
    /Fecha[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(\d{4})-(\d{2})-(\d{2})/
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
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
 * Scrape una sentencia desde Archive.org
 */
async function scrapeSentencia(tipo, numero, año) {
  const tipoCode = TIPOS_SENTENCIA[tipo];
  const url = `${BASE_URL}/${año}/${tipoCode}-${numero}-${año}.htm`;
  
  console.log(`\n📄 ${tipoCode}-${numero}-${año}`);
  console.log(`   URL original: ${url}`);
  
  const result = await getFromArchive(url);
  
  if (!result) {
    return null;
  }
  
  // Extraer metadata
  const magistrado = extractMagistrado(result.html);
  const fecha = extractFecha(result.html);
  
  return {
    tipo,
    numero,
    año,
    tipoCode,
    url,
    text: result.text,
    html: result.html,
    magistrado,
    fecha,
    snapshotDate: result.snapshotDate,
    snapshotUrl: result.snapshotUrl
  };
}

/**
 * Guarda sentencia
 */
async function saveSentencia(data) {
  const { tipo, numero, año, text, url, magistrado, fecha, snapshotDate, snapshotUrl, tipoCode } = data;
  
  const baseDir = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc', año.toString());
  if (!existsSync(baseDir)) {
    await mkdir(baseDir, { recursive: true });
  }
  
  const filename = `sentencia-${tipo}-${numero}-${año}.txt`;
  const filepath = path.join(baseDir, filename);
  
  // Si ya existe, skip
  if (existsSync(filepath)) {
    console.log(`   [SKIP] Ya existe: ${filename}`);
    return { skipped: true };
  }
  
  const content = `SENTENCIA ${tipoCode}-${numero}-${año}

Tipo: ${tipo}
Número: ${numero}
Año: ${año}
Fecha: ${fecha}
Magistrado Ponente: ${magistrado}
URL Original: ${url}
Fuente: Archive.org (Wayback Machine)
Snapshot: ${snapshotDate}
Snapshot URL: ${snapshotUrl}

========================================

${text}
`;
  
  await writeFile(filepath, content, 'utf-8');
  console.log(`   ✅ GUARDADO: ${filename} (${Math.round(text.length / 1024)} KB)`);
  
  return { skipped: false, filename };
}

/**
 * Actualiza metadata
 */
async function updateMetadata(data) {
  const metadataPath = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc', 'metadata.json');
  
  let metadata = {};
  if (existsSync(metadataPath)) {
    const content = await readFile(metadataPath, 'utf-8');
    metadata = JSON.parse(content);
  }
  
  const key = `${data.tipoCode}-${data.numero}-${data.año}`;
  metadata[key] = {
    tipo: data.tipo,
    tipoCode: data.tipoCode,
    numero: data.numero,
    año: data.año,
    fecha: data.fecha,
    magistrado: data.magistrado,
    url: data.url,
    tamaño: data.text.length,
    fuente: 'archive-org',
    snapshotDate: data.snapshotDate,
    areaLegal: null,
    tema: null,
    precedente: false,
    normasCitadas: [],
    resumen: null
  };
  
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
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
  node scripts/scrape-archive-org.mjs --year=2024 --type=tutela --limit=5

Opciones:
  --year=YYYY   Año a scrapear
  --type=TYPE   Tipo (tutela, constitucionalidad, unificacion)
  --limit=N     Número máximo de sentencias

NOTA: Obtiene datos desde Archive.org (Wayback Machine)
      No hay bloqueos 403, pero cobertura puede ser parcial.
`);
    process.exit(1);
  }
  
  const year = parseInt(yearArg.split('=')[1]);
  const tipo = typeArg.split('=')[1];
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;
  
  console.log(`
========================================
SCRAPER ARCHIVE.ORG - JURISPRUDENCIA CC
========================================

Año: ${year}
Tipo: ${tipo}
Límite: ${limit}

Fuente: Archive.org (Wayback Machine)
Ventaja: Sin bloqueos 403
`);
  
  const stats = {
    total: 0,
    exitosos: 0,
    fallidos: 0,
    saltados: 0
  };
  
  // Scrapear sentencias
  for (let i = 1; i <= limit; i++) {
    const numero = String(i).padStart(3, '0');
    stats.total++;
    
    try {
      const result = await scrapeSentencia(tipo, numero, year);
      
      if (result) {
        const saveResult = await saveSentencia(result);
        
        if (saveResult.skipped) {
          stats.saltados++;
        } else {
          await updateMetadata(result);
          stats.exitosos++;
        }
      } else {
        stats.fallidos++;
      }
    } catch (error) {
      stats.fallidos++;
      console.error(`\n❌ Error: ${error.message}`);
    }
  }
  
  // Reporte final
  console.log(`
========================================
REPORTE FINAL
========================================

Total intentos: ${stats.total}
Exitosos: ${stats.exitosos}
Saltados (ya existían): ${stats.saltados}
Fallidos: ${stats.fallidos}

Tasa de éxito: ${Math.round(stats.exitosos / stats.total * 100)}%

Archivos guardados en: data/jurisprudencia/cc/${year}/
Metadata actualizado: data/jurisprudencia/cc/metadata.json
`);
}

main().catch(console.error);
