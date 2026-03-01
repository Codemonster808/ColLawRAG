#!/usr/bin/env node
/**
 * compare-ab-test.mjs — Comparación A/B de modelos de generación
 *
 * Analiza múltiples benchmarks y genera tabla comparativa.
 * Acepta salida de evaluate-accuracy.mjs (report con metrics/resultados_detallados) o formato con results[].
 *
 * Uso:
 *   node scripts/compare-ab-test.mjs data/benchmarks/ab-qwen7b-*.json data/benchmarks/ab-deepseek-*.json data/benchmarks/ab-groq-*.json
 *   node scripts/compare-ab-test.mjs data/benchmarks/ab-*.json --output data/benchmarks/ab-test-summary.md
 *
 * Opciones:
 *   --output <path>  Escribir tabla y modelo ganador en markdown (para S1.11).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

// Costos aproximados por 1M tokens (input + output promedio)
const PRICING = {
  'qwen7b': { input: 0, output: 0, label: 'Qwen 2.5 7B (HF Free)' },
  'deepseek': { input: 0.14, output: 0.28, label: 'DeepSeek V3 (Novita)' },
  'groq70b': { input: 0.59, output: 0.79, label: 'Llama 3.3 70B (Groq)' },
};

function inferModel(filename) {
  const name = basename(filename, '.json');
  if (name.includes('qwen7b')) return 'qwen7b';
  if (name.includes('deepseek')) return 'deepseek';
  if (name.includes('groq70b')) return 'groq70b';
  return 'unknown';
}

function calculateStats(results) {
  const scores = results.map(r => r.score ?? r.evaluacion?.score_total ?? 0);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const passed = results.filter(r => (r.score ?? r.evaluacion?.score_total ?? 0) >= 5).length;
  const accuracy = results.length ? (passed / results.length) * 100 : 0;

  const byArea = {};
  results.forEach(r => {
    const area = r.area || 'unknown';
    const s = r.score ?? r.evaluacion?.score_total ?? 0;
    if (!byArea[area]) byArea[area] = { scores: [], count: 0 };
    byArea[area].scores.push(s);
    byArea[area].count++;
  });

  const areaStats = Object.entries(byArea).map(([area, data]) => ({
    area,
    avg: data.scores.reduce((a, b) => a + b, 0) / data.count,
    count: data.count,
    accuracy: (data.scores.filter(s => s >= 5).length / data.count) * 100
  }));

  return { avg, accuracy, passed, total: results.length, byArea: areaStats };
}

function estimateCost(model, avgTokensPerQuery = 3500) {
  const pricing = PRICING[model];
  if (!pricing || (pricing.input === 0 && pricing.output === 0)) return 0;
  
  // Asumiendo 70% output, 30% input
  const inputTokens = avgTokensPerQuery * 0.3;
  const outputTokens = avgTokensPerQuery * 0.7;
  
  const costPer1k = ((inputTokens / 1000000) * pricing.input) + ((outputTokens / 1000000) * pricing.output);
  return costPer1k * 1000; // Costo por 1000 queries
}

function main() {
  const rawArgs = process.argv.slice(2);
  const outputPath = (() => {
    const i = rawArgs.indexOf('--output');
    if (i === -1) return null;
    return rawArgs[i + 1] || null;
  })();
  const args = rawArgs.filter((a, i) => {
    if (a === '--output') return false;
    if (i > 0 && rawArgs[i - 1] === '--output') return false;
    return true;
  });

  if (args.length === 0) {
    console.error('❌ Uso: node compare-ab-test.mjs <benchmark1.json> [benchmark2.json] [...] [--output path.md]');
    process.exit(1);
  }

  const lines = [];
  const log = (s = '') => {
    lines.push(s);
    console.log(s);
  };

  log('\n📊 A/B Test Comparison — Sprint 1\n');
  log('═'.repeat(100));

  const models = [];

  for (const file of args) {
    try {
      const fullPath = file.startsWith('/') ? file : join(ROOT, file);
      if (!existsSync(fullPath)) {
        console.error(`⚠️  No encontrado: ${fullPath}`);
        continue;
      }
      const data = JSON.parse(readFileSync(fullPath, 'utf8'));
      const results = data.resultados_detallados ?? data.results ?? [];
      const model = inferModel(file);
      const stats = calculateStats(results);
      const cost = estimateCost(model);

      models.push({
        file: basename(file),
        model,
        label: PRICING[model]?.label || model,
        stats,
        cost,
        timestamp: data.metrics?.fecha || data.fecha || 'unknown'
      });
    } catch (err) {
      console.error(`⚠️  No se pudo leer ${file}: ${err.message}`);
    }
  }

  if (models.length === 0) {
    console.error('❌ No se encontraron resultados válidos.');
    process.exit(1);
  }

  log('\n📈 Overall Performance\n');
  log('| Modelo | Score Avg | Accuracy | Passed/Total | Cost/1k queries |');
  log('|--------|-----------|----------|--------------|-----------------|');

  models.forEach(m => {
    const costStr = m.cost === 0 ? 'FREE' : `$${m.cost.toFixed(2)}`;
    log(
      `| ${m.label.padEnd(30)} | ${m.stats.avg.toFixed(2).padStart(5)}/10 | ` +
      `${m.stats.accuracy.toFixed(1).padStart(5)}% | ` +
      `${m.stats.passed.toString().padStart(2)}/${m.stats.total} | ` +
      `${costStr.padStart(15)} |`
    );
  });

  const winner = models.reduce((best, current) =>
    current.stats.accuracy > best.stats.accuracy ? current : best
  );
  log(`\n🏆 Modelo ganador: **${winner.label}** (${winner.stats.accuracy.toFixed(1)}% accuracy)`);
  log('\nPara configurar como primario en .env.local:');
  if (winner.model === 'groq70b') {
    log('  GEN_PROVIDER=groq');
    log('  HF_GENERATION_MODEL=llama-3.3-70b-versatile');
    log('  GROQ_API_KEY=gsk_...');
  } else if (winner.model === 'deepseek') {
    log('  GEN_PROVIDER=novita');
    log('  HF_GENERATION_MODEL=deepseek/deepseek-v3');
  } else {
    log('  GEN_PROVIDER=hf');
    log('  HF_GENERATION_MODEL=Qwen/Qwen2.5-7B-Instruct');
  }

  log('\n\n📋 Performance by Legal Area\n');
  const allAreas = new Set();
  models.forEach(m => m.stats.byArea.forEach(a => allAreas.add(a.area)));
  log('| Area | ' + models.map(m => m.label.substring(0, 20).padEnd(20)).join(' | ') + ' |');
  log('|------|' + models.map(() => '-'.repeat(20)).join('|') + '|');
  Array.from(allAreas).forEach(area => {
    const row = models.map(m => {
      const areaData = m.stats.byArea.find(a => a.area === area);
      return areaData
        ? `${areaData.avg.toFixed(1)}/10 (${areaData.accuracy.toFixed(0)}%)`
        : 'N/A';
    });
    log(`| ${area.padEnd(4)} | ${row.map(r => r.padEnd(20)).join(' | ')} |`);
  });

  log('\n\n💡 Recommendation\n');
  const baseline = models.find(m => m.model === 'qwen7b');
  const paid = models.filter(m => m.model !== 'qwen7b');
  const bestPaid = paid.length ? paid.reduce((best, current) =>
    current.stats.accuracy > best.stats.accuracy ? current : best
  ) : null;
  if (baseline && bestPaid) {
    const improvement = bestPaid.stats.accuracy - baseline.stats.accuracy;
    log(`- **Baseline (Qwen 7B)**: ${baseline.stats.accuracy.toFixed(1)}% accuracy (FREE)`);
    log(`- **Best paid model (${bestPaid.label})**: ${bestPaid.stats.accuracy.toFixed(1)}% accuracy (+${improvement.toFixed(1)}pp)`);
    log(`- **Cost**: ${bestPaid.cost === 0 ? 'FREE' : `$${bestPaid.cost.toFixed(2)}/1k queries`}`);
    if (improvement >= 15) {
      log(`\n✅ **STRONG RECOMMENDATION**: Usar ${bestPaid.label} como modelo primario.`);
    } else if (improvement >= 5) {
      log(`\n⚖️  **MODERATE RECOMMENDATION**: Considerar ${bestPaid.label} para producción.`);
    } else {
      log(`\n⚠️  **WEAK IMPROVEMENT**: Mejora de +${improvement.toFixed(1)}pp. Evaluar si el costo justifica.`);
    }
  }

  log('\n' + '═'.repeat(100) + '\n');

  if (outputPath) {
    const outFull = outputPath.startsWith('/') ? outputPath : join(ROOT, outputPath);
    writeFileSync(outFull, lines.join('\n'), 'utf8');
    console.error(`\n✅ Resumen escrito en: ${outFull}`);
  }
}

main();
