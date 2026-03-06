#!/usr/bin/env node
/**
 * Procesador CSV Oficial - Datos.gov.co
 * 
 * Procesa el CSV oficial de sentencias de la Corte Constitucional
 * Fuente: https://www.datos.gov.co
 * Dataset: "Sentencias proferidas por la Corte Constitucional"
 * 
 * Entrada: data/jurisprudencia/cc/downloads/Sentencias_proferidas_por_la_Corte_Constitucional_20260211.csv
 * Salida:
 * - data/jurisprudencia/cc/metadata-oficial.json (metadata enriquecida)
 * - data/jurisprudencia/cc/stats-oficial.json (estadísticas)
 * 
 * Uso:
 *   node scripts/process-datos-gov-csv.mjs
 *   node scripts/process-datos-gov-csv.mjs --year-from=2020
 *   node scripts/process-datos-gov-csv.mjs --year-from=2020 --year-to=2025
 *   node scripts/process-datos-gov-csv.mjs --tipo=T
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONFIG ====================

const CSV_PATH = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc', 'downloads', 'Sentencias_proferidas_por_la_Corte_Constitucional_20260211.csv');
const METADATA_OUTPUT = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc', 'metadata-oficial.json');
const STATS_OUTPUT = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc', 'stats-oficial.json');

// ==================== HELPERS ====================

/**
 * Parsea CSV manualmente (evita dependencias externas)
 */
function parseCSV(content) {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }
  }
  
  return rows;
}

/**
 * Parsea una línea CSV (maneja comillas)
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Extrae año de fecha (formato: "1992 Feb 25 12:00:00 AM")
 */
function extractYear(fechaStr) {
  const match = fechaStr.match(/^(\d{4})/);
  return match ? match[1] : null;
}

/**
 * Normaliza fecha a formato ISO
 */
function normalizeDate(fechaStr) {
  // Formato entrada: "1992 Feb 25 12:00:00 AM"
  const monthMap = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  
  const match = fechaStr.match(/^(\d{4})\s+(\w{3})\s+(\d{1,2})/);
  if (!match) return null;
  
  const [_, year, monthStr, day] = match;
  const month = monthMap[monthStr];
  
  return `${year}-${month}-${day.padStart(2, '0')}`;
}

/**
 * Genera URL de la sentencia
 */
function generateURL(sentencia, año) {
  // Formato: https://www.corteconstitucional.gov.co/relatoria/YYYY/T-001-YY.htm
  const añoCorto = año.slice(-2);
  const sentenciaId = sentencia.replace('/', '-');
  
  return `https://www.corteconstitucional.gov.co/relatoria/${año}/${sentenciaId}.htm`;
}

/**
 * Normaliza tipo de sentencia
 */
function normalizeTipo(tipoCode) {
  const tipos = {
    'T': 'tutela',
    'C': 'constitucionalidad',
    'SU': 'unificacion',
    'A': 'auto',
    'SU-': 'unificacion'
  };
  
  return tipos[tipoCode] || tipoCode.toLowerCase();
}

/**
 * Calcula prioridad (sentencias recientes = mayor prioridad)
 */
function calcularPrioridad(año, tipo) {
  let prioridad = parseInt(año);
  
  // Bonus por tipo
  if (tipo === 'unificacion') prioridad += 100;
  else if (tipo === 'constitucionalidad') prioridad += 50;
  
  return prioridad;
}

// ==================== MAIN ====================

async function procesarCSV(yearFrom = null, yearTo = null, tipoFilter = null) {
  console.log('\n========================================');
  console.log('PROCESADOR CSV OFICIAL - DATOS.GOV.CO');
  console.log('========================================\n');
  
  // Verificar que existe el CSV
  if (!existsSync(CSV_PATH)) {
    console.error(`[ERROR] No se encontró el CSV: ${CSV_PATH}`);
    process.exit(1);
  }
  
  console.log(`[INFO] Leyendo CSV: ${CSV_PATH}\n`);
  
  // Leer y parsear CSV
  const content = await readFile(CSV_PATH, 'utf-8');
  const rows = parseCSV(content);
  
  console.log(`[INFO] Total de filas en CSV: ${rows.length}\n`);
  
  // Procesar filas
  const metadata = {};
  const stats = {
    totalProcesadas: 0,
    totalFiltradas: 0,
    porAño: {},
    porTipo: {},
    porMagistrado: {},
    porSala: {},
    conVotos: 0,
    sinVotos: 0
  };
  
  for (const row of rows) {
    const año = extractYear(row['Fecha Sentencia']);
    if (!año) continue;
    
    stats.totalProcesadas++;
    
    // Aplicar filtros
    if (yearFrom && parseInt(año) < parseInt(yearFrom)) continue;
    if (yearTo && parseInt(año) > parseInt(yearTo)) continue;
    if (tipoFilter && row['Expediente Tipo'] !== tipoFilter) continue;
    
    stats.totalFiltradas++;
    
    // Extraer datos
    const tipoCode = row['Expediente Tipo'];
    const tipo = normalizeTipo(tipoCode);
    const sentenciaId = row['Sentencia'];
    const fecha = normalizeDate(row['Fecha Sentencia']);
    const magistrado = row['Magistrado(a) ponente'];
    const sala = row['Sala'];
    const proceso = row['Proceso'];
    const expedienteNumero = row['Expediente Número'];
    const svSpv = row['SV-SPV'];
    const avApv = row['AV-APV'];
    
    // Determinar si tiene votos
    const tieneVotos = (svSpv !== 's.d.' && svSpv !== '') || (avApv !== 's.d.' && avApv !== '');
    if (tieneVotos) {
      stats.conVotos++;
    } else {
      stats.sinVotos++;
    }
    
    // Generar metadata
    const entry = {
      id: sentenciaId,
      tipo: tipo,
      tipoCode: tipoCode,
      numero: expedienteNumero,
      año: año,
      fecha: fecha,
      magistrado: magistrado,
      sala: sala,
      proceso: proceso,
      url: generateURL(sentenciaId, año),
      prioridad: calcularPrioridad(año, tipo),
      votos: {
        salvamento: svSpv !== 's.d.' && svSpv !== '' ? svSpv : null,
        aclaracion: avApv !== 's.d.' && avApv !== '' ? avApv : null
      },
      fuente: 'datos.gov.co',
      actualizado: '2026-02-03'
    };
    
    metadata[sentenciaId] = entry;
    
    // Actualizar stats
    stats.porAño[año] = (stats.porAño[año] || 0) + 1;
    stats.porTipo[tipo] = (stats.porTipo[tipo] || 0) + 1;
    stats.porMagistrado[magistrado] = (stats.porMagistrado[magistrado] || 0) + 1;
    stats.porSala[sala] = (stats.porSala[sala] || 0) + 1;
  }
  
  // Guardar metadata
  await writeFile(METADATA_OUTPUT, JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`[SAVED] Metadata: ${METADATA_OUTPUT}`);
  
  // Guardar stats
  stats.topMagistrados = Object.entries(stats.porMagistrado)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nombre, count]) => ({ nombre, count }));
  
  stats.topSalas = Object.entries(stats.porSala)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nombre, count]) => ({ nombre, count }));
  
  await writeFile(STATS_OUTPUT, JSON.stringify(stats, null, 2), 'utf-8');
  console.log(`[SAVED] Estadísticas: ${STATS_OUTPUT}\n`);
  
  // Mostrar resumen
  console.log('========================================');
  console.log('RESUMEN DE PROCESAMIENTO');
  console.log('========================================\n');
  
  console.log(`Total procesadas: ${stats.totalProcesadas}`);
  console.log(`Total filtradas: ${stats.totalFiltradas}`);
  console.log(`Con votos salvamento/aclaración: ${stats.conVotos}`);
  console.log(`Sin votos: ${stats.sinVotos}\n`);
  
  console.log('Por tipo:');
  for (const [tipo, count] of Object.entries(stats.porTipo).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tipo}: ${count}`);
  }
  
  console.log('\nTop 10 Magistrados:');
  for (const { nombre, count } of stats.topMagistrados) {
    console.log(`  ${nombre}: ${count}`);
  }
  
  console.log('\nPor año (últimos 10):');
  const añosRecientes = Object.entries(stats.porAño)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 10);
  
  for (const [año, count] of añosRecientes) {
    console.log(`  ${año}: ${count}`);
  }
  
  console.log('\n========================================');
  console.log('PROCESAMIENTO COMPLETADO');
  console.log('========================================\n');
  
  console.log(`📄 Metadata: ${METADATA_OUTPUT}`);
  console.log(`📊 Estadísticas: ${STATS_OUTPUT}\n`);
}

// Parse CLI args
const args = process.argv.slice(2);
let yearFrom = null;
let yearTo = null;
let tipoFilter = null;

args.forEach(arg => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  if (key === 'year-from') yearFrom = value;
  if (key === 'year-to') yearTo = value;
  if (key === 'tipo') tipoFilter = value;
});

procesarCSV(yearFrom, yearTo, tipoFilter).catch(console.error);
