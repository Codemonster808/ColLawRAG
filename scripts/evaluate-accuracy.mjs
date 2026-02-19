#!/usr/bin/env node
/**
 * evaluate-accuracy.mjs
 *
 * Evalúa el accuracy de ColLawRAG comparando respuestas con las de abogados expertos.
 * Usa DeepSeek V3.2 como juez (LLM-as-judge) con payloads TOON para máxima eficiencia.
 *
 * Uso:
 *   node scripts/evaluate-accuracy.mjs [opciones]
 *
 * Opciones:
 *   --url <url>         URL base del API (default: http://localhost:3000)
 *   --prod              Usar producción: https://col-law-rag.vercel.app
 *   --dataset <path>    Ruta al dataset JSON (default: data/benchmarks/qa-abogados.json)
 *   --output <path>     Ruta para guardar resultados (default: data/benchmarks/results-{date}.json)
 *   --limit <n>         Evaluar solo los primeros N casos
 *   --area <area>       Filtrar por área legal (laboral, civil, penal, etc.)
 *   --skip-rag          Omitir llamadas al RAG (evaluar respuestas ya guardadas)
 *   --verbose           Mostrar payloads TOON y respuestas completas
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// Minimal TOON encoder (inline, no external deps)
function encode(obj, indent = '') {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      if (v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
        const keys = Object.keys(v[0]);
        lines.push(`${indent}${k}[${v.length}]{${keys.join(',')}}`);
        for (const item of v) {
          lines.push(`${indent}  ` + keys.map(ki => {
            const val = item[ki];
            return typeof val === 'string' ? val.replace(/,/g, '，') : String(val ?? '');
          }).join(','));
        }
      } else {
        lines.push(`${indent}${k}[${v.length}]`);
        for (const item of v) lines.push(`${indent}  ${String(item)}`);
      }
    } else if (typeof v === 'object' && v !== null) {
      lines.push(`${indent}${k}`);
      lines.push(encode(v, indent + '  '));
    } else {
      lines.push(`${indent}${k}: ${String(v ?? '')}`);
    }
  }
  return lines.join('\n');
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Configuración ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag, def) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : def;
};
const hasFlag = (flag) => args.includes(flag);

const API_URL = hasFlag('--prod')
  ? 'https://col-law-rag.vercel.app'
  : getArg('--url', 'http://localhost:3000');

const DATASET_PATH = getArg('--dataset', join(ROOT, 'data/benchmarks/qa-abogados.json'));
const LIMIT = getArg('--limit', null);
const AREA_FILTER = getArg('--area', null);
const VERBOSE = hasFlag('--verbose');
const SKIP_RAG = hasFlag('--skip-rag');

const TODAY = new Date().toISOString().split('T')[0];
const OUTPUT_PATH = getArg(
  '--output',
  join(ROOT, `data/benchmarks/results-${TODAY}.json`)
);

// Config del LLM juez (mismo que el RAG usa)
const HF_KEY = process.env.HUGGINGFACE_API_KEY
  || (() => {
    try {
      const env = readFileSync(join(ROOT, '.env.local'), 'utf8');
      const m = env.match(/HUGGINGFACE_API_KEY=(.+)/);
      return m ? m[1].trim() : null;
    } catch { return null; }
  })();

const JUDGE_MODEL = 'deepseek/deepseek-v3.2';
const JUDGE_ENDPOINT = 'https://router.huggingface.co/novita/v3/openai/chat/completions';

// ─── Colores terminal ─────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};
const color = (c, txt) => `${c}${txt}${C.reset}`;
const bold = (txt) => color(C.bold, txt);
const green = (txt) => color(C.green, txt);
const red = (txt) => color(C.red, txt);
const yellow = (txt) => color(C.yellow, txt);
const cyan = (txt) => color(C.cyan, txt);
const gray = (txt) => color(C.gray, txt);
const blue = (txt) => color(C.blue, txt);

// ─── Paso 1: Llamar al RAG ────────────────────────────────────────────────────

async function queryRAG(question, retries = 3) {
  const url = `${API_URL}/api/rag`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question }),
        signal: AbortSignal.timeout(180_000), // 3 min — HF cold start puede tardar
      });
      if (res.status === 429) {
        // Rate limit — esperar y reintentar con backoff
        const wait = attempt * 10_000;
        process.stdout.write(yellow(` (429 rate limit, esperando ${wait/1000}s)... `));
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`RAG API error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      return data.answer || data.response || data.text || JSON.stringify(data);
    } catch (err) {
      if (attempt < retries && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        process.stdout.write(yellow(` (timeout, reintentando ${attempt}/${retries})... `));
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Máximo de reintentos alcanzado');
}

// ─── Paso 2: Construir prompt TOON para el juez ───────────────────────────────

function buildJudgePromptToon({ question, ragAnswer, referenceAnswer, area, normasClave, criterio }) {
  const payload = encode({
    tarea: 'evaluar_respuesta_juridica_colombiana',
    instrucciones: [
      'Compara la respuesta del sistema RAG con la respuesta de referencia del abogado experto',
      'Evalúa cada criterio de 0 a 10 (10=perfecto, 0=incorrecto)',
      'Responde ÚNICAMENTE con el JSON solicitado, sin texto adicional',
    ],
    area_legal: area,
    normas_esperadas: normasClave,
    criterio_principal: criterio,
    pregunta: question,
    respuestas: [
      { fuente: 'RAG', texto: ragAnswer },
      { fuente: 'abogado_experto', texto: referenceAnswer },
    ],
    criterios_evaluacion: [
      { nombre: 'precision_normativa', descripcion: 'Cita las normas correctas (artículos, leyes, decretos)' },
      { nombre: 'articulos_correctos', descripcion: 'Los números de artículos y leyes son exactos' },
      { nombre: 'interpretacion_valida', descripcion: 'La interpretación jurídica es correcta' },
      { nombre: 'completitud', descripcion: 'Responde todos los aspectos de la pregunta' },
      { nombre: 'ausencia_alucinaciones', descripcion: 'No inventa normas o datos que no existen' },
    ],
    formato_respuesta: {
      tipo: 'json_estricto',
      estructura: {
        precision_normativa: 'number (0-10)',
        articulos_correctos: 'number (0-10)',
        interpretacion_valida: 'number (0-10)',
        completitud: 'number (0-10)',
        ausencia_alucinaciones: 'number (0-10)',
        score_total: 'number (0-10, promedio ponderado)',
        veredicto: 'EXCELENTE|BUENO|ACEPTABLE|DEFICIENTE|INCORRECTO',
        normas_correctas: 'array of strings (normas que el RAG citó correctamente)',
        normas_faltantes: 'array of strings (normas que el RAG debió mencionar)',
        alucinaciones: 'array of strings (normas o datos incorrectos que inventó)',
        comentario: 'string (análisis breve 1-2 oraciones)',
      }
    }
  });

  return payload;
}

// ─── Paso 3: Llamar al LLM juez ───────────────────────────────────────────────

async function callJudge(toonPrompt) {
  if (!HF_KEY) throw new Error('HUGGINGFACE_API_KEY no configurada');

  const systemPrompt = `Eres un abogado experto en derecho colombiano que evalúa la calidad de respuestas jurídicas.
Tu tarea es comparar objetivamente la respuesta de un sistema RAG con la de un abogado experto.
Responde SIEMPRE con un JSON válido y nada más.`;

  const res = await fetch(JUDGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${HF_KEY}`,
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '```toon\n' + toonPrompt + '\n```\n\nResponde con el JSON de evaluación:' },
      ],
      temperature: 0.1,
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) throw new Error(`Judge API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Extraer JSON de la respuesta
  const jsonMatch = content.match(/\{[\s\S]+\}/);
  if (!jsonMatch) throw new Error(`Judge no devolvió JSON válido:\n${content}`);

  return JSON.parse(jsonMatch[0]);
}

// ─── Paso 4: Evaluar un caso ──────────────────────────────────────────────────

async function evaluateCase(caso, index, total) {
  const prefix = `[${index + 1}/${total}]`;
  console.log(`\n${bold(prefix)} ${cyan(caso.id)} — ${caso.area} (${caso.dificultad})`);
  console.log(gray(`  Q: ${caso.pregunta.substring(0, 80)}...`));

  const result = {
    id: caso.id,
    area: caso.area,
    dificultad: caso.dificultad,
    pregunta: caso.pregunta,
    respuesta_referencia: caso.respuesta_referencia,
    respuesta_rag: null,
    evaluacion: null,
    error: null,
    timestamp: new Date().toISOString(),
  };

  // 1. Obtener respuesta del RAG
  if (!SKIP_RAG) {
    try {
      process.stdout.write(gray('  → Consultando RAG... '));
      const t0 = Date.now();
      result.respuesta_rag = await queryRAG(caso.pregunta);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(green(`✓ (${elapsed}s)`));
      if (VERBOSE) console.log(gray(`  RAG: ${result.respuesta_rag.substring(0, 200)}...`));
    } catch (err) {
      console.log(red(`✗ Error: ${err.message}`));
      result.error = `RAG error: ${err.message}`;
      return result;
    }
  } else {
    result.respuesta_rag = caso.respuesta_rag_cached || '[SKIP_RAG mode]';
  }

  // 2. Construir payload TOON para el juez
  const toonPrompt = buildJudgePromptToon({
    question: caso.pregunta,
    ragAnswer: result.respuesta_rag,
    referenceAnswer: caso.respuesta_referencia,
    area: caso.area,
    normasClave: caso.normas_clave,
    criterio: caso.criterio_evaluacion,
  });

  if (VERBOSE) {
    console.log(gray('\n  TOON prompt:'));
    console.log(gray('  ' + toonPrompt.split('\n').join('\n  ')));
  }

  // 3. Evaluar con el LLM juez
  try {
    process.stdout.write(gray('  → Evaluando con juez IA... '));
    const t0 = Date.now();
    result.evaluacion = await callJudge(toonPrompt);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const score = result.evaluacion.score_total;
    const veredicto = result.evaluacion.veredicto;
    const scoreColor = score >= 8 ? green : score >= 6 ? yellow : red;
    console.log(`${scoreColor(`✓ Score: ${score}/10 — ${veredicto}`)} ${gray(`(${elapsed}s)`)}`);

    // Mostrar detalles
    const ev = result.evaluacion;
    console.log(gray(`  Normas: ${ev.precision_normativa}/10 | Artículos: ${ev.articulos_correctos}/10 | Interpretación: ${ev.interpretacion_valida}/10 | Completitud: ${ev.completitud}/10 | Sin aluc: ${ev.ausencia_alucinaciones}/10`));
    if (ev.alucinaciones?.length > 0) {
      console.log(red(`  ⚠ Alucinaciones: ${ev.alucinaciones.join(', ')}`));
    }
    if (ev.normas_faltantes?.length > 0) {
      console.log(yellow(`  ⚠ Faltaron: ${ev.normas_faltantes.join(', ')}`));
    }
    if (ev.comentario) {
      console.log(gray(`  💬 ${ev.comentario}`));
    }
  } catch (err) {
    console.log(red(`✗ Error en juez: ${err.message}`));
    result.error = `Judge error: ${err.message}`;
  }

  return result;
}

// ─── Paso 5: Generar reporte ──────────────────────────────────────────────────

function generateReport(results) {
  const valid = results.filter(r => r.evaluacion && !r.error);
  const errors = results.filter(r => r.error);

  if (valid.length === 0) {
    return { error: 'No hay resultados válidos para reportar' };
  }

  const scores = valid.map(r => r.evaluacion.score_total);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Agrupado por área
  const porArea = {};
  for (const r of valid) {
    if (!porArea[r.area]) porArea[r.area] = [];
    porArea[r.area].push(r.evaluacion.score_total);
  }
  const promediosPorArea = Object.fromEntries(
    Object.entries(porArea).map(([area, ss]) => [
      area,
      {
        promedio: (ss.reduce((a, b) => a + b, 0) / ss.length).toFixed(2),
        casos: ss.length,
        scores: ss,
      }
    ])
  );

  // Criterios promedio
  const criterios = ['precision_normativa', 'articulos_correctos', 'interpretacion_valida', 'completitud', 'ausencia_alucinaciones'];
  const promCriterios = Object.fromEntries(
    criterios.map(c => [
      c,
      (valid.reduce((s, r) => s + (r.evaluacion[c] || 0), 0) / valid.length).toFixed(2)
    ])
  );

  // Distribución de veredictos
  const veredictos = {};
  for (const r of valid) {
    const v = r.evaluacion.veredicto || 'DESCONOCIDO';
    veredictos[v] = (veredictos[v] || 0) + 1;
  }

  // Alucinaciones encontradas
  const alucinaciones = valid
    .filter(r => r.evaluacion.alucinaciones?.length > 0)
    .map(r => ({ id: r.id, alucinaciones: r.evaluacion.alucinaciones }));

  // Mejores y peores
  const sorted = [...valid].sort((a, b) => b.evaluacion.score_total - a.evaluacion.score_total);
  const mejores = sorted.slice(0, 3).map(r => ({ id: r.id, area: r.area, score: r.evaluacion.score_total }));
  const peores = sorted.slice(-3).reverse().map(r => ({ id: r.id, area: r.area, score: r.evaluacion.score_total }));

  return {
    fecha: TODAY,
    api_url: API_URL,
    modelo_juez: JUDGE_MODEL,
    resumen: {
      total_casos: results.length,
      evaluados: valid.length,
      errores: errors.length,
      score_promedio: avgScore.toFixed(2),
      accuracy_porcentaje: ((avgScore / 10) * 100).toFixed(1) + '%',
    },
    veredictos,
    promedio_criterios: promCriterios,
    por_area: promediosPorArea,
    mejores_casos: mejores,
    peores_casos: peores,
    alucinaciones_detectadas: alucinaciones,
    resultados_detallados: valid,
    errores: errors,
  };
}

// ─── Paso 6: Imprimir resumen final ──────────────────────────────────────────

function printSummary(report) {
  console.log('\n' + '═'.repeat(60));
  console.log(bold('  📊 REPORTE DE ACCURACY — ColLawRAG vs Abogados'));
  console.log('═'.repeat(60));
  if (report.error) {
    console.log(red(`\n✗ ${report.error}`));
    return;
  }

  const r = report.resumen;
  const scoreNum = parseFloat(r.score_promedio);
  const scoreColor = scoreNum >= 8 ? green : scoreNum >= 6 ? yellow : red;

  console.log(`\n${bold('Score general:')}`);
  console.log(`  ${scoreColor(`${r.score_promedio}/10`)} → ${scoreColor(bold(r.accuracy_porcentaje + ' de accuracy'))}`);
  console.log(`  Casos evaluados: ${r.evaluados}/${r.total_casos} ${r.errores > 0 ? red(`(${r.errores} errores)`) : ''}`);

  console.log(`\n${bold('Por área legal:')}`);
  const areaEmojis = { laboral: '👷', civil: '⚖️', penal: '🔒', constitucional: '📜', administrativo: '🏛️', tributario: '💰' };
  for (const [area, data] of Object.entries(report.por_area)) {
    const s = parseFloat(data.promedio);
    const sc = s >= 8 ? green : s >= 6 ? yellow : red;
    console.log(`  ${areaEmojis[area] || '•'} ${area.padEnd(18)} ${sc(`${data.promedio}/10`)} ${gray(`(${data.casos} casos)`)}`);
  }

  console.log(`\n${bold('Criterios promedio:')}`);
  const criterioLabels = {
    precision_normativa: '📋 Precisión normativa',
    articulos_correctos: '🔢 Artículos correctos',
    interpretacion_valida: '🧠 Interpretación',
    completitud: '✅ Completitud',
    ausencia_alucinaciones: '🚫 Sin alucinaciones',
  };
  for (const [criterio, promedio] of Object.entries(report.promedio_criterios)) {
    const s = parseFloat(promedio);
    const sc = s >= 8 ? green : s >= 6 ? yellow : red;
    console.log(`  ${(criterioLabels[criterio] || criterio).padEnd(28)} ${sc(`${promedio}/10`)}`);
  }

  if (report.alucinaciones_detectadas.length > 0) {
    console.log(`\n${red(bold(`⚠ Alucinaciones detectadas (${report.alucinaciones_detectadas.length} casos):`))}}`);
    for (const a of report.alucinaciones_detectadas) {
      console.log(`  ${red(a.id)}: ${a.alucinaciones.join(', ')}`);
    }
  } else {
    console.log(`\n${green('✓ Sin alucinaciones detectadas')}`);
  }

  console.log(`\n${bold('Mejores respuestas:')} ${report.mejores_casos.map(c => green(`${c.id}(${c.score})`)).join(' | ')}`);
  console.log(`${bold('Peores respuestas: ')} ${report.peores_casos.map(c => red(`${c.id}(${c.score})`)).join(' | ')}`);

  console.log(`\n${bold('Veredictos:')}`);
  const vColors = { EXCELENTE: green, BUENO: green, ACEPTABLE: yellow, DEFICIENTE: red, INCORRECTO: red };
  for (const [v, count] of Object.entries(report.veredictos)) {
    const vc = (vColors[v] || gray);
    console.log(`  ${vc(v.padEnd(12))} ${count}`);
  }

  console.log('\n' + '─'.repeat(60));
  console.log(gray(`Resultados guardados en: ${OUTPUT_PATH}`));
  console.log('═'.repeat(60) + '\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + bold(cyan('🔬 ColLawRAG — Evaluador de Accuracy')));
  console.log(gray(`  API: ${API_URL}`));
  console.log(gray(`  Dataset: ${DATASET_PATH}`));
  console.log(gray(`  Modelo juez: ${JUDGE_MODEL}`));

  // Cargar dataset
  if (!existsSync(DATASET_PATH)) {
    console.error(red(`\n✗ Dataset no encontrado: ${DATASET_PATH}`));
    process.exit(1);
  }
  const dataset = JSON.parse(readFileSync(DATASET_PATH, 'utf8'));
  let casos = dataset.casos || dataset;

  // Filtros
  if (AREA_FILTER) casos = casos.filter(c => c.area === AREA_FILTER);
  if (LIMIT) casos = casos.slice(0, parseInt(LIMIT));

  console.log(gray(`\n  → ${casos.length} casos a evaluar`));
  if (!HF_KEY) {
    console.error(red('\n✗ HUGGINGFACE_API_KEY no encontrada. Configura .env.local o variable de entorno.'));
    process.exit(1);
  }

  // Verificar que el RAG está disponible
  if (!SKIP_RAG) {
    process.stdout.write(gray(`\n  Verificando conexión con RAG (${API_URL})... `));
    try {
      const r = await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(5000) }).catch(() =>
        fetch(`${API_URL}/api/rag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test' }),
          signal: AbortSignal.timeout(10000)
        })
      );
      console.log(green(`✓ (status: ${r.status})`));
    } catch (e) {
      console.log(yellow(`⚠ No se pudo conectar: ${e.message}`));
      console.log(yellow('  Usa --prod para producción o --skip-rag para omitir el RAG.'));
      process.exit(1);
    }
  }

  // Evaluar casos en paralelo (concurrencia controlada)
  const isLocal = API_URL.includes('localhost') || API_URL.includes('127.0.0.1');
  const CONCURRENCY = getArg('--concurrency', '1'); // HF rate limit: secuencial
  const PAUSE_MS = parseInt(getArg('--pause', '2000')); // 2s entre requests (respetar HF rate limit)
  const SAVE_EVERY = 5; // guardar checkpoint más frecuente
  console.log(gray(`\n  ⚡ Concurrencia: ${CONCURRENCY} | Pausa: ${PAUSE_MS}ms | Timeout RAG: 180s (2 intentos)\n`));

  const results = new Array(casos.length).fill(null);
  let completed = 0;

  // Pool de concurrencia
  async function runWithPool(items, concurrency, fn) {
    const queue = [...items.entries()];
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (queue.length > 0) {
        const [i, item] = queue.shift();
        results[i] = await fn(item, i, items.length);
        completed++;
        if (completed % SAVE_EVERY === 0 || completed === items.length) {
          const partial = generateReport(results.filter(Boolean));
          writeFileSync(OUTPUT_PATH, JSON.stringify(partial, null, 2));
          console.log(gray(`  💾 Checkpoint: ${completed}/${items.length} casos`));
        }
        if (PAUSE_MS > 0 && queue.length > 0) await new Promise(r => setTimeout(r, PAUSE_MS));
      }
    });
    await Promise.all(workers);
  }

  await runWithPool(casos, parseInt(CONCURRENCY), evaluateCase);

  // Generar reporte final
  const report = generateReport(results);

  // Guardar resultados finales
  writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));

  // Imprimir resumen
  printSummary(report);
}

main().catch(err => {
  console.error(red(`\n✗ Error fatal: ${err.message}`));
  console.error(err.stack);
  process.exit(1);
});
