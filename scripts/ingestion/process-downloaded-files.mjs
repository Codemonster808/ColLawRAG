#!/usr/bin/env node
/**
 * Procesador de Archivos Descargados - Jurisprudencia CC
 * 
 * Lee archivos HTML descargados manualmente y los procesa:
 * - Extrae y limpia el texto
 * - Guarda en formato estándar sentencia-{tipo}-{numero}-{año}.txt
 * - Actualiza metadata.json
 * 
 * Uso:
 *   node scripts/process-downloaded-files.mjs
 *   node scripts/process-downloaded-files.mjs --input-dir=downloads
 *   node scripts/process-downloaded-files.mjs --dry-run
 * 
 * @created 2026-02-10
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONFIG ====================

const DEFAULT_INPUT_DIR = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc', 'downloads');
const OUTPUT_BASE_DIR = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc');
const METADATA_PATH = path.join(OUTPUT_BASE_DIR, 'metadata.json');

// ==================== HELPERS ====================

/**
 * Limpia HTML y extrae texto
 */
function cleanHTML(html) {
  return html
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '')
    .replace(/<noscript[^>]*>.*?<\/noscript>/gis, '')
    .replace(/<header[^>]*>.*?<\/header>/gis, '')
    .replace(/<footer[^>]*>.*?<\/footer>/gis, '')
    .replace(/<nav[^>]*>.*?<\/nav>/gis, '')
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
 * Extrae magistrado ponente del HTML
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
 * Extrae fecha de la sentencia
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
 * Parsea información de un archivo HTML descargado
 */
function parseDownloadedFile(html, filename) {
  // Extraer ID de filename (ej: T-010-2024.html)
  const idMatch = filename.match(/([A-Z]{1,2})-(\d+)-(\d+)/);
  if (!idMatch) {
    throw new Error(`Filename no coincide con patrón esperado: ${filename}`);
  }
  
  const tipoCode = idMatch[1];
  const numero = idMatch[2];
  const año = idMatch[3];
  
  // Determinar tipo
  const tipoMap = {
    'T': 'tutela',
    'C': 'constitucionalidad',
    'SU': 'unificacion'
  };
  const tipo = tipoMap[tipoCode] || 'desconocido';
  
  // Extraer información
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
    contenido: contenido,
    tamaño: contenido.length,
    fuente: 'descarga_manual'
  };
}

/**
 * Guarda sentencia procesada
 */
async function saveSentencia(sentencia) {
  const yearDir = path.join(OUTPUT_BASE_DIR, sentencia.año);
  
  if (!existsSync(yearDir)) {
    await mkdir(yearDir, { recursive: true });
  }
  
  const filename = `sentencia-${sentencia.tipo}-${sentencia.numero}-${sentencia.año}.txt`;
  const filepath = path.join(yearDir, filename);
  
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
Fuente: Descarga manual

========================================

${sentencia.contenido}
`;
  
  await writeFile(filepath, content, 'utf-8');
  console.log(`[SAVED] ${filename} (${Math.round(content.length / 1024)} KB)`);
  
  return { skipped: false, filename, filepath, size: content.length };
}

/**
 * Actualiza metadata con sentencia procesada
 */
async function updateMetadata(sentencia) {
  let metadata = {};
  
  if (existsSync(METADATA_PATH)) {
    const content = await readFile(METADATA_PATH, 'utf-8');
    metadata = JSON.parse(content);
  }
  
  // Actualizar o agregar entrada
  metadata[sentencia.id] = {
    tipo: sentencia.tipo,
    tipoCode: sentencia.tipoCode,
    numero: sentencia.numero,
    año: sentencia.año,
    fecha: sentencia.fecha,
    magistrado: sentencia.magistrado,
    url: `https://www.corteconstitucional.gov.co/relatoria/${sentencia.año}/${sentencia.id}.htm`,
    tamaño: sentencia.tamaño,
    fuente: sentencia.fuente,
    areaLegal: null,
    tema: null,
    precedente: false,
    normasCitadas: [],
    resumen: null
  };
  
  await writeFile(METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf-8');
}

/**
 * Procesa todos los archivos descargados
 */
async function processAllDownloads(inputDir, dryRun = false) {
  console.log('\n========================================');
  console.log('PROCESADOR DE ARCHIVOS DESCARGADOS');
  console.log('========================================\n');
  
  console.log(`Input: ${inputDir}`);
  console.log(`Modo: ${dryRun ? 'DRY-RUN' : 'PRODUCCIÓN'}\n`);
  
  // Verificar que existe el directorio
  if (!existsSync(inputDir)) {
    console.error(`[ERROR] Directorio no existe: ${inputDir}`);
    console.log(`\nCrear con: mkdir -p ${inputDir}`);
    process.exit(1);
  }
  
  // Leer archivos
  const files = await readdir(inputDir);
  const htmlFiles = files.filter(f => f.endsWith('.html') || f.endsWith('.htm'));
  
  console.log(`[INFO] Encontrados ${htmlFiles.length} archivos HTML\n`);
  
  if (htmlFiles.length === 0) {
    console.log('No hay archivos para procesar.');
    console.log('\nDescarga archivos HTML manualmente y guárdalos en:');
    console.log(`  ${inputDir}`);
    console.log('\nFormato de nombre: {TIPO}-{NUMERO}-{AÑO}.html');
    console.log('Ejemplo: T-010-2024.html\n');
    return;
  }
  
  // Estadísticas
  const stats = {
    total: htmlFiles.length,
    procesados: 0,
    saltados: 0,
    errores: 0,
    porTipo: {},
    porAño: {}
  };
  
  // Procesar cada archivo
  for (const file of htmlFiles) {
    try {
      const filepath = path.join(inputDir, file);
      const html = await readFile(filepath, 'utf-8');
      
      // Parsear
      const sentencia = parseDownloadedFile(html, file);
      
      if (!dryRun) {
        // Guardar
        const result = await saveSentencia(sentencia);
        
        if (result.skipped) {
          stats.saltados++;
        } else {
          stats.procesados++;
          
          // Actualizar metadata
          await updateMetadata(sentencia);
        }
      } else {
        console.log(`[DRY-RUN] ${sentencia.id} - ${sentencia.magistrado}`);
        stats.procesados++;
      }
      
      // Stats
      stats.porTipo[sentencia.tipo] = (stats.porTipo[sentencia.tipo] || 0) + 1;
      stats.porAño[sentencia.año] = (stats.porAño[sentencia.año] || 0) + 1;
      
    } catch (error) {
      console.error(`[ERROR] ${file}: ${error.message}`);
      stats.errores++;
    }
  }
  
  // Reporte final
  console.log('\n========================================');
  console.log('REPORTE FINAL');
  console.log('========================================\n');
  console.log(`Total archivos: ${stats.total}`);
  console.log(`Procesados: ${stats.procesados}`);
  console.log(`Saltados (ya existían): ${stats.saltados}`);
  console.log(`Errores: ${stats.errores}`);
  
  console.log('\nPor tipo:');
  for (const [tipo, count] of Object.entries(stats.porTipo)) {
    console.log(`  ${tipo}: ${count}`);
  }
  
  console.log('\nPor año:');
  for (const [año, count] of Object.entries(stats.porAño)) {
    console.log(`  ${año}: ${count}`);
  }
  
  console.log('\n========================================\n');
  
  if (!dryRun && stats.procesados > 0) {
    console.log('✅ Archivos procesados exitosamente');
    console.log('\nSiguiente paso: Ejecutar categorización');
    console.log('  node scripts/categorize-jurisprudencia.mjs\n');
  }
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const inputDirArg = args.find(a => a.startsWith('--input-dir'));
  const dryRun = args.includes('--dry-run');
  
  const inputDir = inputDirArg 
    ? path.join(process.cwd(), inputDirArg.split('=')[1])
    : DEFAULT_INPUT_DIR;
  
  if (args.includes('--help')) {
    console.log(`
Uso:
  node scripts/process-downloaded-files.mjs
  node scripts/process-downloaded-files.mjs --input-dir=downloads
  node scripts/process-downloaded-files.mjs --dry-run

Opciones:
  --input-dir=DIR   Directorio con archivos HTML descargados (default: data/jurisprudencia/cc/downloads)
  --dry-run         Modo prueba (no guarda archivos)
  --help            Mostrar esta ayuda

Formato de archivos HTML:
  Nombre: {TIPO}-{NUMERO}-{AÑO}.html
  Ejemplo: T-010-2024.html, C-123-2023.html, SU-456-2022.html
`);
    process.exit(0);
  }
  
  await processAllDownloads(inputDir, dryRun);
}

main().catch(console.error);
