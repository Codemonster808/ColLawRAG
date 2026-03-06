#!/usr/bin/env node
/**
 * Diagnóstico de Accuracy - ColLawRAG
 * 
 * Analiza el estado actual del índice RAG para identificar gaps y áreas de mejora
 */

import { readFileSync } from 'fs';
import { join } from 'path';

console.log('\n========================================');
console.log('DIAGNÓSTICO DE ACCURACY - COLAWRAG');
console.log('========================================\n');

// Cargar índice
console.log('[1/5] Cargando índice RAG...');
const indexPath = join(process.cwd(), 'data', 'index.json');
const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
const chunks = Object.values(index);
console.log(`✓ ${chunks.length.toLocaleString()} chunks cargados\n`);

// Análisis 1: Distribución por fuente
console.log('[2/5] Analizando distribución por fuente...');
const sources = {};
chunks.forEach(chunk => {
  const content = chunk.content || '';
  const match = content.match(/fuente:\s*(.+)/i) || content.match(/source:\s*(.+)/i);
  const source = match ? match[1].trim() : 'unknown';
  sources[source] = (sources[source] || 0) + 1;
});

console.log('\nChunks por fuente:');
Object.entries(sources)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([src, count]) => {
    const pct = ((count / chunks.length) * 100).toFixed(1);
    console.log(`  ${src}: ${count.toLocaleString()} (${pct}%)`);
  });

// Análisis 2: Tipos de documentos
console.log('\n[3/5] Analizando tipos de documentos...');
const tipos = {};
chunks.forEach(chunk => {
  const content = chunk.content || '';
  const match = content.match(/tipo:\s*(.+)/i) || content.match(/type:\s*(.+)/i);
  const tipo = match ? match[1].trim() : 'unknown';
  tipos[tipo] = (tipos[tipo] || 0) + 1;
});

console.log('\nChunks por tipo:');
Object.entries(tipos)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([tipo, count]) => {
    const pct = ((count / chunks.length) * 100).toFixed(1);
    console.log(`  ${tipo}: ${count.toLocaleString()} (${pct}%)`);
  });

// Análisis 3: Áreas legales
console.log('\n[4/5] Analizando cobertura por área legal...');
const areas = {};
chunks.forEach(chunk => {
  const content = chunk.content || '';
  const match = content.match(/area:\s*(.+)/i);
  const area = match ? match[1].trim() : 'general';
  areas[area] = (areas[area] || 0) + 1;
});

console.log('\nChunks por área legal:');
Object.entries(areas)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([area, count]) => {
    const pct = ((count / chunks.length) * 100).toFixed(1);
    console.log(`  ${area}: ${count.toLocaleString()} (${pct}%)`);
  });

// Análisis 4: Tamaño de chunks
console.log('\n[5/5] Analizando tamaño de chunks...');
const sizes = chunks.map(c => (c.content || '').length);
const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
const minSize = Math.min(...sizes);
const maxSize = Math.max(...sizes);
const medianSize = sizes.sort((a, b) => a - b)[Math.floor(sizes.length / 2)];

console.log('\nEstadísticas de tamaño:');
console.log(`  Promedio: ${avgSize.toFixed(0)} caracteres`);
console.log(`  Mediana: ${medianSize} caracteres`);
console.log(`  Mínimo: ${minSize} caracteres`);
console.log(`  Máximo: ${maxSize.toLocaleString()} caracteres`);

// Análisis 5: Embeddings
const withEmbeddings = chunks.filter(c => c.embedding && c.embedding.length > 0).length;
console.log(`\nChunks con embeddings: ${withEmbeddings.toLocaleString()} / ${chunks.length.toLocaleString()} (${((withEmbeddings / chunks.length) * 100).toFixed(1)}%)`);

// Identificar gaps
console.log('\n========================================');
console.log('GAPS IDENTIFICADOS Y RECOMENDACIONES');
console.log('========================================\n');

const gaps = [];

// Gap 1: Jurisprudencia limitada
const jurisprudenciaChunks = chunks.filter(c => {
  const content = c.content || '';
  return content.includes('sentencia') || content.includes('jurisprudencia') || content.includes('tipo: sentencia');
}).length;
const jurisprudenciaPct = (jurisprudenciaChunks / chunks.length) * 100;

if (jurisprudenciaPct < 20) {
  gaps.push({
    area: 'Jurisprudencia',
    actual: `${jurisprudenciaChunks.toLocaleString()} chunks (${jurisprudenciaPct.toFixed(1)}%)`,
    recomendado: '>2,500 chunks (>20%)',
    prioridad: 'ALTA',
    accion: 'Ingerir sentencias del CSV oficial datos.gov.co (3,084 sentencias disponibles)'
  });
}

// Gap 2: Normatividad administrativa
const adminChunks = chunks.filter(c => {
  const content = c.content || '';
  return content.includes('area: administrativo') || content.includes('derecho administrativo');
}).length;
const adminPct = (adminChunks / chunks.length) * 100;

if (adminPct < 5) {
  gaps.push({
    area: 'Derecho Administrativo',
    actual: `${adminChunks.toLocaleString()} chunks (${adminPct.toFixed(1)}%)`,
    recomendado: '>600 chunks (>5%)',
    prioridad: 'MEDIA',
    accion: 'Ampliar normas administrativas: CPACA, contratación estatal, función pública'
  });
}

// Gap 3: Normatividad laboral
const laboralChunks = chunks.filter(c => {
  const content = c.content || '';
  return content.includes('area: laboral') || content.includes('derecho laboral') || content.includes('trabajo');
}).length;
const laboralPct = (laboralChunks / chunks.length) * 100;

if (laboralPct < 5) {
  gaps.push({
    area: 'Derecho Laboral',
    actual: `${laboralChunks.toLocaleString()} chunks (${laboralPct.toFixed(1)}%)`,
    recomendado: '>600 chunks (>5%)',
    prioridad: 'MEDIA',
    accion: 'Ya creadas 4 normas laborales (75KB) - INGESTAR con npm run ingest'
  });
}

// Gap 4: Procedimientos
const procedimientosChunks = chunks.filter(c => {
  const content = c.content || '';
  return content.includes('procedimiento') || content.includes('proceso');
}).length;
const procedimientosPct = (procedimientosChunks / chunks.length) * 100;

if (procedimientosPct < 3) {
  gaps.push({
    area: 'Procedimientos',
    actual: `${procedimientosChunks.toLocaleString()} chunks (${procedimientosPct.toFixed(1)}%)`,
    recomendado: '>350 chunks (>3%)',
    prioridad: 'MEDIA',
    accion: 'Ampliar data/procedures/ con más procedimientos detallados'
  });
}

// Gap 5: Chunks muy pequeños o muy grandes
const tooSmall = chunks.filter(c => (c.content || '').length < 100).length;
const tooLarge = chunks.filter(c => (c.content || '').length > 2000).length;

if (tooSmall > chunks.length * 0.05 || tooLarge > chunks.length * 0.10) {
  gaps.push({
    area: 'Tamaño de Chunks',
    actual: `${tooSmall} muy pequeños (<100), ${tooLarge} muy grandes (>2000)`,
    recomendado: '<5% pequeños, <10% grandes',
    prioridad: 'BAJA',
    accion: 'Revisar estrategia de chunking en scripts/ingest.mjs'
  });
}

// Mostrar gaps
if (gaps.length === 0) {
  console.log('✅ No se detectaron gaps críticos\n');
} else {
  gaps.forEach((gap, i) => {
    console.log(`Gap ${i + 1}: ${gap.area} (Prioridad: ${gap.prioridad})`);
    console.log(`  Actual: ${gap.actual}`);
    console.log(`  Recomendado: ${gap.recomendado}`);
    console.log(`  Acción: ${gap.accion}\n`);
  });
}

// Recomendaciones generales
console.log('========================================');
console.log('RECOMENDACIONES PARA MEJORAR ACCURACY');
console.log('========================================\n');

console.log('1. DATOS (Prioridad ALTA):');
console.log('   - Ingestar normas laborales nuevas (4 archivos, 75KB)');
console.log('   - Ingestar normas administrativas (2 archivos, 26KB)');
console.log('   - Procesar CSV datos.gov.co (3,084 sentencias oficiales)');
console.log('   - Comando: npm run ingest\n');

console.log('2. RETRIEVAL (Prioridad MEDIA):');
console.log('   - Revisar parámetros BM25 (k1, b, alpha)');
console.log('   - Ajustar top_k retrieval (actualmente ¿cuántos?)');
console.log('   - Implementar re-ranking semántico si no existe\n');

console.log('3. PROMPTS (Prioridad MEDIA):');
console.log('   - Revisar templates en lib/prompt-templates.ts');
console.log('   - Agregar instrucciones de citas (artículos, sentencias)');
console.log('   - Forzar estructura HNAC en respuestas jurídicas\n');

console.log('4. TESTING (Prioridad MEDIA):');
console.log('   - Ejecutar tests de accuracy: npm test tests/accuracy.test.ts');
console.log('   - Crear dataset de queries de referencia');
console.log('   - Medir precisión, recall, F1-score\n');

console.log('5. MONITOREO (Prioridad BAJA):');
console.log('   - Dashboard analytics: /analytics');
console.log('   - Feedback de usuarios: /api/feedback');
console.log('   - Métricas en producción\n');

console.log('========================================');
console.log('PRÓXIMOS PASOS INMEDIATOS');
console.log('========================================\n');

console.log('1. Ejecutar ingesta de nuevas normas:');
console.log('   cd /home/lesaint/Documentos/Cursor/ColLawRAG');
console.log('   npm run ingest\n');

console.log('2. Verificar mejora con tests:');
console.log('   npm test tests/accuracy.test.ts\n');

console.log('3. Deployment:');
console.log('   npm run upload-indices');
console.log('   npx vercel --prod\n');

console.log('========================================\n');
