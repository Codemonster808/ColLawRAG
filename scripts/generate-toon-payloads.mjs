#!/usr/bin/env node
/**
 * generate-toon-payloads.mjs
 * 
 * Genera payloads eficientes en formato TOON (Token-Oriented Object Notation)
 * para las queries al LLM en ColLawRAG.
 * 
 * TOON usa ~40% menos tokens que JSON con mayor precisión del LLM.
 * 
 * Uso:
 *   node scripts/generate-toon-payloads.mjs [--demo] [--bench] [--test-query "texto"]
 * 
 * Modos:
 *   --demo         Muestra ejemplos de payloads TOON vs JSON
 *   --bench        Compara tokens entre TOON y JSON para chunks reales
 *   --test-query   Genera un payload TOON para una query específica
 */

import { encode, decode } from '@toon-format/toon';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// ─── Contador de tokens (aproximado: 1 token ≈ 4 chars en español) ───────────
function countTokensApprox(text) {
  return Math.ceil(text.length / 4);
}

// ─── Generadores de Payload TOON ──────────────────────────────────────────────

/**
 * Genera un payload TOON para context blocks del RAG.
 * Reemplaza el bloque JSON que actualmente se envía al LLM.
 * 
 * @param {Object} params
 * @param {string} params.query - Pregunta del usuario
 * @param {Array}  params.chunks - Chunks recuperados del índice
 * @param {string} params.area - Área legal detectada
 * @param {string} params.complexity - simple | medium | complex
 */
export function generateQueryPayload({ query, chunks, area = 'general', complexity = 'simple' }) {
  const data = {
    query,
    area_legal: area,
    complejidad: complexity,
    n_fuentes: chunks.length,
    fuentes: chunks.map((c, i) => ({
      id: i + 1,
      titulo: c.title || c.source || `Fuente ${i + 1}`,
      area: c.areaLegal || area,
      vigente: c.vigente !== false ? 'sí' : 'no',
      fecha_vigencia: c.fechaVigencia || '',
      texto: (c.text || c.content || '').substring(0, 500), // truncar para demo
      score: c.score ? c.score.toFixed(3) : '0.000',
    }))
  };

  return encode(data);
}

/**
 * Genera payload TOON para el sistema de benchmark de abogados.
 * 
 * @param {Array} cases - Array de casos de benchmark
 */
export function generateBenchmarkPayload(cases) {
  const data = {
    tipo: 'benchmark_juridico',
    total: cases.length,
    casos: cases.map(c => ({
      id: c.id,
      area: c.area,
      pregunta: c.question,
      respuesta_abogado: c.lawyerAnswer || '',
      respuesta_rag: c.ragAnswer || '',
      score_abogado: c.lawyerScore || 0,
      notas: c.notes || '',
    }))
  };

  return encode(data);
}

/**
 * Genera payload TOON para comparación de respuestas (LLM-as-judge).
 * Este es el prompt que se envía al LLM evaluador.
 * 
 * @param {Object} params
 * @param {string} params.question - Pregunta jurídica
 * @param {string} params.ragAnswer - Respuesta del RAG
 * @param {string} params.lawyerAnswer - Respuesta del abogado
 * @param {string} params.area - Área legal
 */
export function generateJudgePayload({ question, ragAnswer, lawyerAnswer, area }) {
  const data = {
    tarea: 'evaluar_respuesta_juridica',
    instruccion: 'Compara la respuesta del sistema RAG con la del abogado experto. Evalúa cada criterio del 0 al 10.',
    area_legal: area,
    pregunta: question,
    criterios: [
      'precision_normativa',
      'articulos_correctos', 
      'interpretacion_valida',
      'completitud',
      'ausencia_alucinaciones',
    ],
    respuestas: [
      { fuente: 'RAG', texto: ragAnswer },
      { fuente: 'abogado', texto: lawyerAnswer },
    ]
  };

  return encode(data);
}

/**
 * Genera payload TOON para múltiples chunks de contexto jurídico.
 * Optimizado para el system prompt del LLM.
 */
export function generateContextBlockToon(chunks) {
  if (!chunks || chunks.length === 0) return 'fuentes[0]: (sin resultados)';
  
  return encode({
    fuentes: chunks.map((c, i) => ({
      n: i + 1,
      tipo: c.type || 'estatuto',
      area: c.areaLegal || 'general',
      vigente: c.vigente !== false,
      norma: c.source || c.title || '',
      articulo: c.articleId || '',
      texto: c.text || c.content || '',
    }))
  });
}

// ─── Demo / Comparación ───────────────────────────────────────────────────────

function runDemo() {
  console.log('\n' + '═'.repeat(60));
  console.log('  TOON vs JSON — Demo ColLawRAG');
  console.log('═'.repeat(60));

  // Ejemplo 1: Context blocks del RAG
  const exampleChunks = [
    {
      title: 'Artículo 65 CST — Indemnización por falta de pago',
      source: 'codigo-sustantivo-trabajo',
      areaLegal: 'laboral',
      vigente: true,
      fechaVigencia: '2024-01-01',
      score: 0.923,
      text: 'Si a la terminación del contrato el empleador no paga al trabajador los salarios y prestaciones debidas, salvo los casos de retención autorizados por la ley, debe pagar al asalariado como indemnización una suma igual al último salario diario por cada día de retardo.',
    },
    {
      title: 'Artículo 22 CST — Definición de contrato de trabajo',
      source: 'codigo-sustantivo-trabajo',
      areaLegal: 'laboral',
      vigente: true,
      fechaVigencia: '2024-01-01',
      score: 0.881,
      text: 'Contrato de trabajo es aquel por el cual una persona natural se obliga a prestar un servicio personal a otra persona, natural o jurídica, bajo la continuada dependencia o subordinación de la segunda y mediante remuneración.',
    },
    {
      title: 'Sentencia T-420/2023 — Derecho al trabajo',
      source: 'corte-constitucional',
      areaLegal: 'laboral',
      vigente: true,
      score: 0.847,
      text: 'La Corte Constitucional reafirma que el derecho al trabajo es un derecho fundamental que debe ser garantizado por el Estado, con especial protección a los trabajadores en situación de debilidad manifiesta.',
    },
  ];

  const query = '¿Cuándo y cómo se paga la indemnización por falta de pago al terminar el contrato?';

  // JSON actual (como se envía hoy)
  const jsonPayload = JSON.stringify({
    query,
    area_legal: 'laboral',
    complejidad: 'medium',
    n_fuentes: exampleChunks.length,
    fuentes: exampleChunks.map((c, i) => ({
      id: i + 1,
      titulo: c.title,
      area: c.areaLegal,
      vigente: c.vigente ? 'sí' : 'no',
      fecha_vigencia: c.fechaVigencia || '',
      texto: c.text,
      score: c.score.toFixed(3),
    }))
  }, null, 2);

  // TOON equivalente
  const toonPayload = generateQueryPayload({
    query,
    chunks: exampleChunks,
    area: 'laboral',
    complexity: 'medium',
  });

  const jsonTokens = countTokensApprox(jsonPayload);
  const toonTokens = countTokensApprox(toonPayload);
  const savings = ((jsonTokens - toonTokens) / jsonTokens * 100).toFixed(1);

  console.log('\n📄 JSON (actual):');
  console.log('─'.repeat(40));
  console.log(jsonPayload.substring(0, 400) + '...');
  console.log(`\nTokens ≈ ${jsonTokens}`);

  console.log('\n🎒 TOON (optimizado):');
  console.log('─'.repeat(40));
  console.log(toonPayload);
  console.log(`\nTokens ≈ ${toonTokens}`);
  
  console.log('\n' + '─'.repeat(40));
  console.log(`💰 Ahorro: ${savings}% menos tokens (${jsonTokens - toonTokens} tokens por query)`);
  console.log('─'.repeat(40));

  // Ejemplo 2: Benchmark payload
  console.log('\n\n📊 Ejemplo — Payload de Benchmark (evaluación de accuracy):');
  console.log('─'.repeat(40));
  
  const benchmarkCases = [
    {
      id: 'LAB-001',
      area: 'laboral',
      question: '¿Cuántos días de vacaciones tiene derecho un trabajador con 2 años de antigüedad?',
      lawyerAnswer: 'Según el Art. 186 del CST, el trabajador tiene derecho a 15 días hábiles de vacaciones remuneradas por año de servicio.',
      ragAnswer: '',
      lawyerScore: 10,
    },
    {
      id: 'CIV-001', 
      area: 'civil',
      question: '¿Cuál es el plazo de prescripción de la acción ejecutiva en Colombia?',
      lawyerAnswer: 'Según el Art. 2536 del Código Civil, la acción ejecutiva prescribe en 5 años.',
      ragAnswer: '',
      lawyerScore: 10,
    },
  ];

  const benchToon = generateBenchmarkPayload(benchmarkCases);
  console.log(benchToon);
  console.log(`\nTokens ≈ ${countTokensApprox(benchToon)}`);

  // Ejemplo 3: Judge payload
  console.log('\n\n⚖️  Ejemplo — Payload para LLM-as-Judge:');
  console.log('─'.repeat(40));
  
  const judgeToon = generateJudgePayload({
    question: '¿Cuántos días de vacaciones tiene un trabajador con 2 años de antigüedad?',
    ragAnswer: 'El trabajador tiene derecho a 15 días hábiles de vacaciones según el Art. 186 del CST...',
    lawyerAnswer: 'Según el Art. 186 del CST, el trabajador tiene derecho a 15 días hábiles de vacaciones remuneradas por año de servicio.',
    area: 'laboral',
  });
  console.log(judgeToon);
  console.log(`\nTokens ≈ ${countTokensApprox(judgeToon)}`);

  console.log('\n' + '═'.repeat(60));
}

function runBenchmark() {
  console.log('\n📊 Benchmark: TOON vs JSON con datos reales del índice...\n');
  
  // Cargar algunos chunks reales del índice
  const indexPath = join(PROJECT_ROOT, 'data', 'index.json');
  if (!existsSync(indexPath)) {
    console.log('⚠️  No se encontró data/index.json. Ejecuta npm run ingest primero.');
    return;
  }

  const { chunks } = JSON.parse(readFileSync(indexPath, 'utf8'));
  const sample = chunks.slice(0, 10); // 10 chunks de muestra

  const jsonStr = JSON.stringify(sample, null, 2);
  const toonStr = encode({ chunks: sample.map(c => ({
    id: c.id,
    titulo: c.title || c.source,
    area: c.areaLegal || 'general',
    vigente: c.vigente !== false,
    score: 0.85,
    texto: (c.text || '').substring(0, 300),
  }))});

  const jsonTok = countTokensApprox(jsonStr);
  const toonTok = countTokensApprox(toonStr);

  console.log(`Muestra: ${sample.length} chunks reales`);
  console.log(`JSON:    ${jsonStr.length} chars ≈ ${jsonTok} tokens`);
  console.log(`TOON:    ${toonStr.length} chars ≈ ${toonTok} tokens`);
  console.log(`Ahorro:  ${((jsonTok - toonTok) / jsonTok * 100).toFixed(1)}% menos tokens`);
  console.log('\nPayload TOON generado:');
  console.log(toonStr);
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--demo') || args.length === 0) {
  runDemo();
}

if (args.includes('--bench')) {
  runBenchmark();
}

if (args.includes('--test-query')) {
  const queryIdx = args.indexOf('--test-query');
  const query = args[queryIdx + 1] || '¿Qué es el contrato de trabajo?';
  
  const mockChunks = [
    { title: 'Art. 22 CST', source: 'cst', areaLegal: 'laboral', vigente: true, score: 0.95, text: 'Contrato de trabajo es aquel por el cual una persona natural se obliga a prestar un servicio personal...' },
  ];
  
  console.log('\nQuery:', query);
  console.log('\nPayload TOON:');
  console.log(generateQueryPayload({ query, chunks: mockChunks, area: 'laboral', complexity: 'simple' }));
}
