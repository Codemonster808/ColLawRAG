#!/usr/bin/env node
/**
 * compare-benchmark-results.mjs (Fase 1.1)
 *
 * Compara dos archivos de resultados del benchmark (baseline vs candidato).
 * Uso:
 *   node scripts/compare-benchmark-results.mjs --baseline data/benchmarks/results-2026-02-01.json --candidate data/benchmarks/results-2026-02-02.json
 *   node scripts/compare-benchmark-results.mjs --baseline path/to/A.json --candidate path/to/B.json [--regression-threshold 3]
 *
 * Opciones:
 *   --baseline <path>   Archivo de resultados baseline (control)
 *   --candidate <path>  Archivo de resultados candidato (nueva versión)
 *   --regression-threshold <n>  Porcentaje mínimo de caída para considerar regresión (default: 3)
 *   --json              Salida solo JSON (para CI)
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (flag, def) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : def;
};
const hasFlag = (flag) => args.includes(flag);

const BASELINE_PATH = getArg('--baseline', null);
const CANDIDATE_PATH = getArg('--candidate', null);
const REGRESSION_THRESHOLD = parseFloat(getArg('--regression-threshold', '3'));
const JSON_ONLY = hasFlag('--json');

function loadReport(path) {
  const full = path.startsWith('/') ? path : join(ROOT, path);
  if (!existsSync(full)) {
    console.error(`Archivo no encontrado: ${full}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(full, 'utf8'));
}

function extractMetrics(report) {
  if (report.error) return null;
  const m = report.metrics || report;
  const resumen = report.resumen || {};
  return {
    accuracy_porcentaje: m.accuracy_porcentaje ?? parseFloat((resumen.accuracy_porcentaje || '0').replace('%', '')),
    score_promedio: m.score_promedio ?? parseFloat(resumen.score_promedio || '0'),
    evaluados: m.evaluados ?? resumen.evaluados ?? 0,
    total_casos: m.total_casos ?? resumen.total_casos ?? 0,
    errores: m.errores ?? resumen.errores ?? 0,
    por_area: m.por_area || report.por_area || {},
    por_dificultad: m.por_dificultad || {},
    fecha: m.fecha || report.fecha,
  };
}

function compare(baseline, candidate) {
  const b = extractMetrics(baseline);
  const c = extractMetrics(candidate);
  if (!b || !c) return { error: 'Uno o ambos reportes no tienen métricas válidas' };

  const deltaAccuracy = (c.accuracy_porcentaje || 0) - (b.accuracy_porcentaje || 0);
  const deltaScore = (c.score_promedio || 0) - (b.score_promedio || 0);
  const isRegression = deltaAccuracy < -REGRESSION_THRESHOLD;

  const areaDeltas = {};
  const allAreas = new Set([...Object.keys(b.por_area || {}), ...Object.keys(c.por_area || {})]);
  for (const area of allAreas) {
    const bVal = b.por_area?.[area]?.promedio;
    const cVal = c.por_area?.[area]?.promedio;
    if (bVal != null && cVal != null) {
      areaDeltas[area] = { baseline: parseFloat(bVal), candidate: parseFloat(cVal), delta: parseFloat(cVal) - parseFloat(bVal) };
    }
  }

  return {
    baseline: { fecha: b.fecha, accuracy_porcentaje: b.accuracy_porcentaje, score_promedio: b.score_promedio, evaluados: b.evaluados },
    candidate: { fecha: c.fecha, accuracy_porcentaje: c.accuracy_porcentaje, score_promedio: c.score_promedio, evaluados: c.evaluados },
    delta_accuracy_pct: parseFloat(deltaAccuracy.toFixed(2)),
    delta_score: parseFloat(deltaScore.toFixed(2)),
    is_regression: isRegression,
    regression_threshold: REGRESSION_THRESHOLD,
    por_area: areaDeltas,
  };
}

function main() {
  if (!BASELINE_PATH || !CANDIDATE_PATH) {
    console.error('Uso: node scripts/compare-benchmark-results.mjs --baseline <path> --candidate <path>');
    process.exit(1);
  }

  const baseline = loadReport(BASELINE_PATH);
  const candidate = loadReport(CANDIDATE_PATH);
  const diff = compare(baseline, candidate);

  if (diff.error) {
    console.error(diff.error);
    process.exit(1);
  }

  if (JSON_ONLY) {
    console.log(JSON.stringify(diff, null, 2));
    process.exit(diff.is_regression ? 1 : 0);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  📊 Comparación de benchmark — Baseline vs Candidato');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`  Baseline:  ${diff.baseline.fecha}  →  Accuracy: ${diff.baseline.accuracy_porcentaje}%   Score: ${diff.baseline.score_promedio}/10  (${diff.baseline.evaluados} casos)`);
  console.log(`  Candidato: ${diff.candidate.fecha}  →  Accuracy: ${diff.candidate.accuracy_porcentaje}%   Score: ${diff.candidate.score_promedio}/10  (${diff.candidate.evaluados} casos)`);
  console.log('');
  const deltaColor = diff.delta_accuracy_pct >= 0 ? '\x1b[32m' : '\x1b[31m';
  console.log(`  Δ Accuracy: ${deltaColor}${diff.delta_accuracy_pct >= 0 ? '+' : ''}${diff.delta_accuracy_pct}%\x1b[0m`);
  console.log(`  Δ Score:    ${deltaColor}${diff.delta_score >= 0 ? '+' : ''}${diff.delta_score}\x1b[0m`);
  if (diff.is_regression) {
    console.log(`  \x1b[31m⚠ Regresión detectada (caída ≥ ${REGRESSION_THRESHOLD}%)\x1b[0m`);
  } else {
    console.log(`  \x1b[32m✓ Sin regresión\x1b[0m`);
  }
  console.log('\n  Por área:');
  for (const [area, d] of Object.entries(diff.por_area)) {
    const sign = d.delta >= 0 ? '+' : '';
    console.log(`    ${area.padEnd(18)} baseline: ${d.baseline.toFixed(2)}  →  candidato: ${d.candidate.toFixed(2)}  (${sign}${d.delta.toFixed(2)})`);
  }
  console.log('\n═══════════════════════════════════════════════════════════\n');

  process.exit(diff.is_regression ? 1 : 0);
}

main();
