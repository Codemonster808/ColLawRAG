#!/usr/bin/env node
/**
 * FASE 5 Tarea 5.5: Comparación A/B de diagnósticos ColLawRAG
 * 
 * Compara dos archivos de diagnóstico (antes/después de un cambio)
 * y muestra deltas de métricas clave.
 * 
 * Uso:
 *   node scripts/compare-diagnostics.mjs <before.json> <after.json>
 * 
 * Ejemplo:
 *   node scripts/compare-diagnostics.mjs \
 *     data/benchmarks/diagnostic-2026-02-19.json \
 *     data/benchmarks/diagnostic-2026-02-24.json
 */

import fs from 'node:fs'
import path from 'node:path'

if (process.argv.length < 4) {
  console.error('❌ Uso: node scripts/compare-diagnostics.mjs <before.json> <after.json>')
  process.exit(1)
}

const beforePath = process.argv[2]
const afterPath = process.argv[3]

if (!fs.existsSync(beforePath)) {
  console.error(`❌ Archivo no encontrado: ${beforePath}`)
  process.exit(1)
}

if (!fs.existsSync(afterPath)) {
  console.error(`❌ Archivo no encontrado: ${afterPath}`)
  process.exit(1)
}

const before = JSON.parse(fs.readFileSync(beforePath, 'utf-8'))
const after = JSON.parse(fs.readFileSync(afterPath, 'utf-8'))

console.log('📊 Comparación A/B de Diagnósticos ColLawRAG')
console.log('='.repeat(70))
console.log(`BEFORE: ${path.basename(beforePath)} (${before.timestamp})`)
console.log(`AFTER:  ${path.basename(afterPath)} (${after.timestamp})`)
console.log()

/**
 * Calcula delta y formatea con colores
 */
function formatDelta(before, after, metricName, higherIsBetter = true, decimals = 3, isPercentage = false) {
  if (before === null || after === null) {
    return { delta: null, formatted: 'N/A' }
  }
  
  const delta = after - before
  const deltaAbs = Math.abs(delta)
  const sign = delta > 0 ? '+' : ''
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→'
  
  // Determinar si es mejora o regresión
  const isImprovement = higherIsBetter ? delta > 0 : delta < 0
  const color = isImprovement ? '✅' : delta < 0 ? '❌' : '⚪'
  
  const unit = isPercentage ? '%' : ''
  const formatted = `${before.toFixed(decimals)}${unit} → ${after.toFixed(decimals)}${unit} (${sign}${delta.toFixed(decimals)}${unit} ${arrow}) ${color}`
  
  return { delta, formatted, isImprovement }
}

// === RETRIEVAL METRICS ===
console.log('📊 RETRIEVAL METRICS')
console.log('-'.repeat(70))

if (before.retrieval && after.retrieval) {
  const retrieval = [
    {
      name: 'Recall@5',
      before: before.retrieval.recall_at_5,
      after: after.retrieval.recall_at_5,
      higherIsBetter: true,
      isPercentage: true,
      convert: (v) => v !== null ? v * 100 : null
    },
    {
      name: 'Precision@5',
      before: before.retrieval.precision_at_5,
      after: after.retrieval.precision_at_5,
      higherIsBetter: true,
      isPercentage: true,
      convert: (v) => v !== null ? v * 100 : null
    },
    {
      name: 'MRR',
      before: before.retrieval.mrr,
      after: after.retrieval.mrr,
      higherIsBetter: true,
      isPercentage: false,
      convert: (v) => v
    },
    {
      name: 'NDCG@10',
      before: before.retrieval.ndcg_at_10,
      after: after.retrieval.ndcg_at_10,
      higherIsBetter: true,
      isPercentage: false,
      convert: (v) => v
    }
  ]
  
  retrieval.forEach(metric => {
    const beforeVal = metric.convert(metric.before)
    const afterVal = metric.convert(metric.after)
    const result = formatDelta(beforeVal, afterVal, metric.name, metric.higherIsBetter, 1, metric.isPercentage)
    console.log(`  ${metric.name.padEnd(15)} ${result.formatted}`)
  })
} else {
  console.log('  ⚠️  Métricas de retrieval no disponibles en uno o ambos archivos')
}

console.log()

// === ACCURACY METRICS ===
console.log('📊 ACCURACY METRICS (End-to-End)')
console.log('-'.repeat(70))

if (before.accuracy && after.accuracy) {
  const accuracy = [
    {
      name: 'Accuracy %',
      before: before.accuracy.accuracy_pct,
      after: after.accuracy.accuracy_pct,
      higherIsBetter: true,
      isPercentage: true,
      convert: (v) => v
    },
    {
      name: 'Score Avg',
      before: before.accuracy.score_avg,
      after: after.accuracy.score_avg,
      higherIsBetter: true,
      isPercentage: false,
      convert: (v) => v
    },
    {
      name: 'Casos correctos',
      before: before.accuracy.correct,
      after: after.accuracy.correct,
      higherIsBetter: true,
      isPercentage: false,
      decimals: 0,
      convert: (v) => v
    },
    {
      name: 'Ausencia aluc.',
      before: before.accuracy.ausencia_alucinaciones,
      after: after.accuracy.ausencia_alucinaciones,
      higherIsBetter: true,
      isPercentage: false,
      convert: (v) => v
    },
    {
      name: 'Artículos OK',
      before: before.accuracy.articulos_correctos,
      after: after.accuracy.articulos_correctos,
      higherIsBetter: true,
      isPercentage: false,
      convert: (v) => v
    },
    {
      name: 'Precisión norm.',
      before: before.accuracy.precision_normativa,
      after: after.accuracy.precision_normativa,
      higherIsBetter: true,
      isPercentage: false,
      convert: (v) => v
    },
    {
      name: 'Interpretación',
      before: before.accuracy.interpretacion_valida,
      after: after.accuracy.interpretacion_valida,
      higherIsBetter: true,
      isPercentage: false,
      convert: (v) => v
    },
    {
      name: 'Completitud',
      before: before.accuracy.completitud,
      after: after.accuracy.completitud,
      higherIsBetter: true,
      isPercentage: false,
      convert: (v) => v
    }
  ]
  
  accuracy.forEach(metric => {
    const beforeVal = metric.convert(metric.before)
    const afterVal = metric.convert(metric.after)
    const decimals = metric.decimals !== undefined ? metric.decimals : 2
    const result = formatDelta(beforeVal, afterVal, metric.name, metric.higherIsBetter, decimals, metric.isPercentage)
    console.log(`  ${metric.name.padEnd(15)} ${result.formatted}`)
  })
} else {
  console.log('  ⚠️  Métricas de accuracy no disponibles en uno o ambos archivos')
}

console.log()

// === BOTTLENECK COMPARISON ===
console.log('🔍 BOTTLENECK COMPARISON')
console.log('-'.repeat(70))

if (before.bottleneck && after.bottleneck) {
  console.log(`  BEFORE: ${before.bottleneck.layer} (${before.bottleneck.metric} = ${before.bottleneck.value.toFixed(3)})`)
  console.log(`  AFTER:  ${after.bottleneck.layer} (${after.bottleneck.metric} = ${after.bottleneck.value.toFixed(3)})`)
  
  if (before.bottleneck.layer !== after.bottleneck.layer) {
    console.log(`  ✅ Cuello de botella cambió: ${before.bottleneck.layer} → ${after.bottleneck.layer}`)
  } else {
    console.log(`  ⚠️  Mismo cuello de botella: ${before.bottleneck.layer}`)
  }
} else if (!before.bottleneck && !after.bottleneck) {
  console.log('  ✅ No se detectaron cuellos de botella en ninguno de los runs')
} else if (!before.bottleneck && after.bottleneck) {
  console.log(`  ❌ REGRESIÓN: Nuevo cuello de botella detectado → ${after.bottleneck.layer}`)
} else if (before.bottleneck && !after.bottleneck) {
  console.log(`  ✅ MEJORA: Cuello de botella resuelto (antes: ${before.bottleneck.layer})`)
}

console.log()

// === SUMMARY ===
console.log('='.repeat(70))
console.log('📈 RESUMEN DE CAMBIOS:')

const improvements = []
const regressions = []

// Chequear retrieval
if (before.retrieval?.recall_at_5 !== null && after.retrieval?.recall_at_5 !== null) {
  const delta = after.retrieval.recall_at_5 - before.retrieval.recall_at_5
  if (delta > 0.05) {
    improvements.push(`Retrieval Recall@5 mejoró ${(delta * 100).toFixed(1)}%`)
  } else if (delta < -0.05) {
    regressions.push(`Retrieval Recall@5 empeoró ${(Math.abs(delta) * 100).toFixed(1)}%`)
  }
}

// Chequear accuracy
if (before.accuracy?.accuracy_pct !== null && after.accuracy?.accuracy_pct !== null) {
  const delta = after.accuracy.accuracy_pct - before.accuracy.accuracy_pct
  if (delta > 2.0) {
    improvements.push(`Accuracy mejoró ${delta.toFixed(1)}%`)
  } else if (delta < -2.0) {
    regressions.push(`Accuracy empeoró ${Math.abs(delta).toFixed(1)}%`)
  }
}

// Chequear alucinaciones
if (before.accuracy?.ausencia_alucinaciones !== null && after.accuracy?.ausencia_alucinaciones !== null) {
  const delta = after.accuracy.ausencia_alucinaciones - before.accuracy.ausencia_alucinaciones
  if (delta > 0.5) {
    improvements.push(`Alucinaciones redujeron (score +${delta.toFixed(2)})`)
  } else if (delta < -0.5) {
    regressions.push(`Alucinaciones aumentaron (score ${delta.toFixed(2)})`)
  }
}

// Chequear artículos correctos
if (before.accuracy?.articulos_correctos !== null && after.accuracy?.articulos_correctos !== null) {
  const delta = after.accuracy.articulos_correctos - before.accuracy.articulos_correctos
  if (delta > 0.5) {
    improvements.push(`Artículos correctos mejoró (score +${delta.toFixed(2)})`)
  } else if (delta < -0.5) {
    regressions.push(`Artículos correctos empeoró (score ${delta.toFixed(2)})`)
  }
}

if (improvements.length > 0) {
  console.log('  ✅ MEJORAS:')
  improvements.forEach(imp => console.log(`     - ${imp}`))
}

if (regressions.length > 0) {
  console.log('  ❌ REGRESIONES:')
  regressions.forEach(reg => console.log(`     - ${reg}`))
}

if (improvements.length === 0 && regressions.length === 0) {
  console.log('  ⚪ Sin cambios significativos')
}

console.log('='.repeat(70))
