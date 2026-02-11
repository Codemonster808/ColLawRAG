#!/usr/bin/env node
/**
 * Categorización y Enriquecimiento de Metadata - Jurisprudencia CC
 * 
 * Lee sentencias de data/jurisprudencia/cc/ y enriquece metadata.json con:
 * - Área legal (laboral, comercial, penal, constitucional, etc.)
 * - Tema principal
 * - Precedente (si establece uno)
 * - Normas citadas
 * - Resumen breve
 * 
 * Uso:
 *   node scripts/categorize-jurisprudencia.mjs
 *   node scripts/categorize-jurisprudencia.mjs --dry-run
 *   node scripts/categorize-jurisprudencia.mjs --year 2024
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONFIG ====================

const BASE_DIR = path.join(process.cwd(), 'data', 'jurisprudencia', 'cc');
const METADATA_PATH = path.join(BASE_DIR, 'metadata.json');

// Mapa de temas a áreas legales
const AREA_LEGAL_MAP = {
  // Laboral
  'trabajo': 'laboral',
  'empleo': 'laboral',
  'pensión': 'laboral',
  'seguridad social': 'laboral',
  'salud': 'laboral',
  'eps': 'laboral',
  'arl': 'laboral',
  'cesantías': 'laboral',
  'prima': 'laboral',
  'liquidación': 'laboral',
  
  // Comercial
  'consumidor': 'comercial',
  'comercio': 'comercial',
  'empresa': 'comercial',
  'sociedad': 'comercial',
  'contrato': 'comercial',
  
  // Penal
  'delito': 'penal',
  'pena': 'penal',
  'prisión': 'penal',
  'habeas corpus': 'penal',
  'libertad': 'penal',
  'detención': 'penal',
  
  // Constitucional
  'constitución': 'constitucional',
  'constitucional': 'constitucional',
  'derechos fundamentales': 'constitucional',
  'libertad de expresión': 'constitucional',
  'igualdad': 'constitucional',
  'discriminación': 'constitucional',
  'debido proceso': 'constitucional',
  'educación': 'constitucional',
  
  // Administrativo
  'administrativo': 'administrativo',
  'funcionario': 'administrativo',
  'entidad pública': 'administrativo',
  'servidor público': 'administrativo',
  
  // Tributario
  'impuesto': 'tributario',
  'tributo': 'tributario',
  'fiscal': 'tributario',
  'dian': 'tributario',
  
  // Civil
  'familia': 'civil',
  'matrimonio': 'civil',
  'divorcio': 'civil',
  'sucesión': 'civil',
  'herencia': 'civil',
  'propiedad': 'civil',
  
  // Ambiental
  'ambiente': 'ambiental',
  'ecológico': 'ambiental',
  'recursos naturales': 'ambiental',
  'medio ambiente': 'ambiental'
};

// Palabras clave que indican precedente
const PRECEDENTE_KEYWORDS = [
  'precedente',
  'jurisprudencia vinculante',
  'doctrina constitucional',
  'regla de derecho',
  'línea jurisprudencial',
  'ratio decidendi',
  'unificación de jurisprudencia',
  'sentencia de unificación',
  'precedente vinculante'
];

// Patrones para detectar normas citadas
const NORMA_PATTERNS = [
  // Leyes
  /Ley\s+(\d+)\s+de\s+(\d{4})/gi,
  /Ley\s+(\d+)\/(\d{4})/gi,
  
  // Decretos
  /Decreto\s+(\d+)\s+de\s+(\d{4})/gi,
  /Decreto\s+Ley\s+(\d+)\s+de\s+(\d{4})/gi,
  
  // Artículos de la Constitución
  /(?:Artículo|Art\.|Artº)\s+(\d+)\s+(?:de\s+la\s+)?Constitución/gi,
  /Constitución\s+(?:Política\s+)?(?:de\s+Colombia\s+)?(?:Art\.|Artículo)\s+(\d+)/gi,
  
  // Códigos
  /Código\s+(Civil|Penal|de\s+Comercio|de\s+Procedimiento\s+Civil|Sustantivo\s+del\s+Trabajo|General\s+del\s+Proceso)/gi,
  
  // Acuerdos, resoluciones
  /Acuerdo\s+(\d+)\s+de\s+(\d{4})/gi,
  /Resolución\s+(\d+)\s+de\s+(\d{4})/gi
];

// ==================== HELPERS ====================

/**
 * Extrae el tema de una sentencia
 */
function extractTema(contenido) {
  const temaMatch = contenido.match(/TEMA:\s*(.+)/i);
  if (temaMatch) {
    return temaMatch[1].trim();
  }
  
  // Fallback: buscar en título o primeros párrafos
  const lines = contenido.split('\n').filter(l => l.trim());
  for (const line of lines.slice(0, 20)) {
    if (line.includes('fundamental') || line.includes('derecho')) {
      return line.trim().substring(0, 100);
    }
  }
  
  return 'No especificado';
}

/**
 * Determina el área legal basándose en el tema y contenido
 */
function determineAreaLegal(tema, contenido) {
  const textToAnalyze = (tema + ' ' + contenido.substring(0, 1000)).toLowerCase();
  
  // Contar coincidencias por área
  const areaCounts = {};
  
  for (const [keyword, area] of Object.entries(AREA_LEGAL_MAP)) {
    if (textToAnalyze.includes(keyword.toLowerCase())) {
      areaCounts[area] = (areaCounts[area] || 0) + 1;
    }
  }
  
  // Si no hay coincidencias, clasificar según tipo de sentencia
  if (Object.keys(areaCounts).length === 0) {
    // Para tutelas, default a "constitucional"
    if (textToAnalyze.includes('tutela')) {
      return 'constitucional';
    }
    return 'general';
  }
  
  // Retornar área con más coincidencias
  return Object.entries(areaCounts)
    .sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Detecta si la sentencia establece precedente
 */
function detectPrecedente(contenido) {
  const contenidoLower = contenido.toLowerCase();
  
  for (const keyword of PRECEDENTE_KEYWORDS) {
    if (contenidoLower.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  // También verificar si es sentencia de unificación (SU)
  if (contenido.includes('SENTENCIA DE UNIFICACIÓN') || 
      contenido.includes('SU-')) {
    return true;
  }
  
  return false;
}

/**
 * Extrae normas citadas del contenido
 */
function extractNormasCitadas(contenido) {
  const normas = new Set();
  
  for (const pattern of NORMA_PATTERNS) {
    const matches = contenido.matchAll(pattern);
    for (const match of matches) {
      // Normalizar formato
      let norma = match[0].trim();
      
      // Limpiar
      norma = norma
        .replace(/\s+/g, ' ')
        .replace(/Art\./gi, 'Artículo')
        .replace(/Artº/gi, 'Artículo');
      
      normas.add(norma);
    }
  }
  
  return Array.from(normas).sort();
}

/**
 * Genera resumen breve de la sentencia
 */
function generateResumen(contenido, tema, tipo) {
  // Buscar sección de "RESUELVE" o "DECISIÓN"
  const resuelveMatch = contenido.match(/RESUELVE\s+([\s\S]{0,500})/i);
  const decisionMatch = contenido.match(/DECISIÓN\s+([\s\S]{0,300})/i);
  
  if (resuelveMatch) {
    const text = resuelveMatch[1]
      .replace(/PRIMERO:|SEGUNDO:|TERCERO:/gi, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
    return text + '...';
  }
  
  if (decisionMatch) {
    const text = decisionMatch[1]
      .replace(/\[.*?\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
    return text + '...';
  }
  
  // Fallback: descripción genérica
  const tipoNombre = tipo === 'tutela' ? 'Acción de tutela' :
                     tipo === 'constitucionalidad' ? 'Control de constitucionalidad' :
                     'Sentencia de unificación';
  
  return `${tipoNombre} sobre ${tema}.`;
}

/**
 * Lee y categoriza una sentencia
 */
async function categorizeSentencia(filepath, sentenciaId, metadata) {
  try {
    const contenido = await readFile(filepath, 'utf-8');
    
    // Extraer información
    const tema = extractTema(contenido);
    const areaLegal = determineAreaLegal(tema, contenido);
    const precedente = detectPrecedente(contenido);
    const normasCitadas = extractNormasCitadas(contenido);
    const resumen = generateResumen(contenido, tema, metadata.tipo);
    
    return {
      ...metadata,
      tema,
      areaLegal,
      precedente,
      normasCitadas,
      resumen
    };
  } catch (error) {
    console.error(`[ERROR] ${sentenciaId}: ${error.message}`);
    return metadata;
  }
}

/**
 * Procesa todas las sentencias
 */
async function processAll(yearFilter = null, dryRun = false) {
  console.log('\n========================================');
  console.log('CATEGORIZACIÓN DE JURISPRUDENCIA CC');
  console.log('========================================\n');
  
  // Cargar metadata existente
  if (!existsSync(METADATA_PATH)) {
    console.error('[ERROR] No existe metadata.json. Ejecuta scraper primero.');
    process.exit(1);
  }
  
  const metadataContent = await readFile(METADATA_PATH, 'utf-8');
  const metadata = JSON.parse(metadataContent);
  
  console.log(`[INFO] Cargado metadata.json con ${Object.keys(metadata).length} entradas\n`);
  
  // Estadísticas
  const stats = {
    total: 0,
    procesadas: 0,
    errores: 0,
    porArea: {},
    conPrecedente: 0,
    conNormas: 0
  };
  
  // Años disponibles
  const years = readdirSync(BASE_DIR)
    .filter(f => /^\d{4}$/.test(f))
    .filter(y => yearFilter ? y === yearFilter : true)
    .sort();
  
  console.log(`[INFO] Procesando años: ${years.join(', ')}\n`);
  
  // Procesar cada año
  for (const year of years) {
    const yearDir = path.join(BASE_DIR, year);
    if (!existsSync(yearDir)) continue;
    
    const files = readdirSync(yearDir).filter(f => f.endsWith('.txt'));
    console.log(`[${year}] ${files.length} sentencias`);
    
    for (const file of files) {
      const filepath = path.join(yearDir, file);
      const sentenciaId = file.replace('sentencia-', '').replace('.txt', '');
      
      // Buscar en metadata
      let metadataKey = null;
      for (const key of Object.keys(metadata)) {
        if (key.includes(sentenciaId) || sentenciaId.includes(key)) {
          metadataKey = key;
          break;
        }
      }
      
      if (!metadataKey) {
        // Intentar construir key desde filename
        const parts = sentenciaId.split('-');
        if (parts.length >= 3) {
          const tipo = parts[0];
          const numero = parts[1];
          const año = parts[2];
          const tipoCode = tipo === 'tutela' ? 'T' :
                          tipo === 'constitucionalidad' ? 'C' :
                          tipo === 'unificacion' ? 'SU' : tipo.toUpperCase();
          metadataKey = `${tipoCode}-${numero}-${año}`;
        }
      }
      
      if (!metadataKey || !metadata[metadataKey]) {
        console.warn(`[WARN] No metadata para ${sentenciaId}`);
        stats.errores++;
        continue;
      }
      
      stats.total++;
      
      // Categorizar
      const enriched = await categorizeSentencia(filepath, sentenciaId, metadata[metadataKey]);
      
      if (enriched.areaLegal) {
        stats.porArea[enriched.areaLegal] = (stats.porArea[enriched.areaLegal] || 0) + 1;
      }
      
      if (enriched.precedente) {
        stats.conPrecedente++;
      }
      
      if (enriched.normasCitadas && enriched.normasCitadas.length > 0) {
        stats.conNormas++;
      }
      
      // Actualizar metadata
      metadata[metadataKey] = enriched;
      stats.procesadas++;
      
      // Log progress cada 50 sentencias
      if (stats.procesadas % 50 === 0) {
        console.log(`  [PROGRESS] ${stats.procesadas}/${stats.total} procesadas...`);
      }
    }
  }
  
  // Guardar metadata actualizado
  if (!dryRun) {
    await writeFile(METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(`\n[SAVED] Metadata actualizado: ${METADATA_PATH}`);
  } else {
    console.log(`\n[DRY-RUN] No se guardó metadata`);
  }
  
  // Reporte final
  console.log('\n========================================');
  console.log('REPORTE FINAL');
  console.log('========================================\n');
  console.log(`Total sentencias: ${stats.total}`);
  console.log(`Procesadas: ${stats.procesadas}`);
  console.log(`Errores: ${stats.errores}`);
  console.log(`\nCon precedente: ${stats.conPrecedente} (${Math.round(stats.conPrecedente / stats.procesadas * 100)}%)`);
  console.log(`Con normas citadas: ${stats.conNormas} (${Math.round(stats.conNormas / stats.procesadas * 100)}%)`);
  console.log('\nPor área legal:');
  
  const sortedAreas = Object.entries(stats.porArea)
    .sort((a, b) => b[1] - a[1]);
  
  for (const [area, count] of sortedAreas) {
    const pct = Math.round(count / stats.procesadas * 100);
    console.log(`  ${area}: ${count} (${pct}%)`);
  }
  
  console.log('\n========================================\n');
  
  return stats;
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const yearArg = args.find(a => a.startsWith('--year'));
  const dryRun = args.includes('--dry-run');
  
  const yearFilter = yearArg ? yearArg.split('=')[1] : null;
  
  if (args.includes('--help')) {
    console.log(`
Uso:
  node scripts/categorize-jurisprudencia.mjs
  node scripts/categorize-jurisprudencia.mjs --year 2024
  node scripts/categorize-jurisprudencia.mjs --dry-run

Opciones:
  --year YYYY    Procesar solo un año específico
  --dry-run      Modo prueba (no guarda cambios)
  --help         Mostrar esta ayuda
`);
    process.exit(0);
  }
  
  await processAll(yearFilter, dryRun);
}

main().catch(console.error);
