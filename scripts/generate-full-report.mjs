#!/usr/bin/env node
/**
 * generate-full-report.mjs (Fase 1.4)
 *
 * Genera un reporte unificado de benchmarks a partir del historial y de results-*.json.
 * Uso:
 *   node scripts/generate-full-report.mjs
 *   node scripts/generate-full-report.mjs --output data/benchmarks/REPORTE_BENCHMARK.md
 *   node scripts/generate-full-report.mjs --history-dir data/benchmarks/history --output report.md
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (flag, def) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : def;
};

const HISTORY_DIR = getArg('--history-dir', join(ROOT, 'data', 'benchmarks', 'history'));
const BENCHMARKS_DIR = join(ROOT, 'data', 'benchmarks');
const OUTPUT_PATH = getArg('--output', join(BENCHMARKS_DIR, 'REPORTE_BENCHMARK.md'));

function loadJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function extractRow(report) {
  if (report.error) return null;
  const r = report.resumen || report.metrics || {};
  const acc = report.metrics?.accuracy_porcentaje ?? parseFloat((r.accuracy_porcentaje || '0').toString().replace('%', ''));
  const score = report.metrics?.score_promedio ?? parseFloat(r.score_promedio || '0');
  return {
    fecha: report.fecha || report.metrics?.fecha,
    accuracy_porcentaje: acc,
    score_promedio: score,
    evaluados: r.evaluados ?? report.metrics?.evaluados,
    total_casos: r.total_casos ?? report.metrics?.total_casos,
    errores: r.errores ?? report.metrics?.errores ?? 0,
    ragas_overall: report.ragas_style?.overall ?? null,
    ragas_faithfulness: report.ragas_style?.faithfulness ?? null,
  };
}

function collectResults() {
  const rows = [];
  const seen = new Set();

  if (existsSync(HISTORY_DIR)) {
    const files = readdirSync(HISTORY_DIR).filter(f => f.startsWith('results-') && f.endsWith('.json'));
    for (const f of files.sort()) {
      const report = loadJsonSafe(join(HISTORY_DIR, f));
      const row = extractRow(report);
          if (row?.fecha && !seen.has(row.fecha)) {
            seen.add(row.fecha);
            rows.push({ ...row, source: `history/${f}` });
          }
    }
  }

  if (existsSync(BENCHMARKS_DIR)) {
    const files = readdirSync(BENCHMARKS_DIR).filter(f => f.match(/^results-\d{4}-\d{2}-\d{2}\.json$/));
    for (const f of files.sort()) {
      const date = f.replace('results-', '').replace('.json', '');
      if (seen.has(date)) continue;
      const report = loadJsonSafe(join(BENCHMARKS_DIR, f));
      const row = extractRow(report);
      if (row?.fecha) {
        seen.add(row.fecha);
        rows.push({ ...row, source: f });
      }
    }
  }

  return rows.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
}

function buildMarkdown(rows) {
  const lines = [
    '# Reporte unificado de benchmark — ColLawRAG',
    '',
    `Generado: ${new Date().toISOString().split('T')[0]}`,
    '',
    '## Resumen por fecha',
    '',
    '| Fecha | Accuracy % | Score /10 | Evaluados | Total | Errores | RAGAS overall | RAGAS faithfulness |',
    '|-------|------------|-----------|-----------|-------|---------|----------------|---------------------|',
  ];

  for (const r of rows) {
    const acc = r.accuracy_porcentaje != null ? r.accuracy_porcentaje.toFixed(1) : '—';
    const score = r.score_promedio != null ? r.score_promedio.toFixed(2) : '—';
    const ev = r.evaluados ?? '—';
    const tot = r.total_casos ?? '—';
    const err = r.errores ?? '—';
    const ro = r.ragas_overall != null ? r.ragas_overall.toFixed(2) : '—';
    const rf = r.ragas_faithfulness != null ? r.ragas_faithfulness.toFixed(2) : '—';
    lines.push(`| ${r.fecha} | ${acc} | ${score} | ${ev} | ${tot} | ${err} | ${ro} | ${rf} |`);
  }

  // Gráfico de evolución (Fase 1.4 - visualizaciones)
  if (rows.length >= 2) {
    const accuracies = rows.map(r => r.accuracy_porcentaje != null ? r.accuracy_porcentaje : 0);
    lines.push('');
    lines.push('## Evolución de accuracy');
    lines.push('');
    lines.push('```mermaid');
    lines.push('xychart-beta');
    lines.push('  title "Accuracy % por fecha"');
    lines.push(`  x-axis [${rows.map(r => r.fecha).join(', ')}]`);
    lines.push('  y-axis "Accuracy %" 0 --> 100');
    lines.push(`  line [${accuracies.join(', ')}]`);
    lines.push('```');
    lines.push('');
    lines.push('*(Si el gráfico no se muestra, ver tabla anterior. Soporte Mermaid: GitHub, GitLab, VS Code.)*');
  }

  lines.push('');
  lines.push('## Cómo generar este reporte');
  lines.push('');
  lines.push('1. Ejecutar benchmark: `npm run benchmark -- --prod --copy-to-history` (o con `--stratify area --sample 30` para muestra rápida).');
  lines.push('2. Regenerar reporte: `npm run benchmark:report`');
  lines.push('3. Comparar dos ejecuciones: `npm run benchmark:compare -- --baseline path/to/A.json --candidate path/to/B.json`');
  lines.push('');
  return lines.join('\n');
}

function main() {
  const rows = collectResults();
  const md = buildMarkdown(rows);
  const outDir = dirname(OUTPUT_PATH);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(OUTPUT_PATH, md);
  console.log(`Reporte escrito en: ${OUTPUT_PATH} (${rows.length} ejecuciones)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
