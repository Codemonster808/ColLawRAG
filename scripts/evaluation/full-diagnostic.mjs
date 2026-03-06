#!/usr/bin/env node
/**
 * FASE 5 Tarea 5.5: Full diagnostic del pipeline ColLawRAG
 * 
 * Ejecuta métricas de retrieval (si disponible) y accuracy (existente),
 * correlaciona resultados y diagnostica el cuello de botella dominante.
 * 
 * Uso:
 *   node scripts/full-diagnostic.mjs [--limit N]
 * 
 * Output:
 *   - Console: resumen de métricas por capa
 *   - File: data/benchmarks/diagnostic-{timestamp}.json
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const LIMIT = process.argv.includes('--limit')
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1])
  : undefined

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
const OUTPUT_PATH = path.join(process.cwd(), 'data', 'benchmarks', `diagnostic-${timestamp}.json`)

console.log('🔍 ColLawRAG Full Diagnostic')
console.log('=' .repeat(60))
console.log(`Timestamp: ${new Date().toISOString()}`)
if (LIMIT) console.log(`Limit: ${LIMIT} casos`)
console.log()

const diagnostic = {
  timestamp: new Date().toISOString(),
  limit: LIMIT,
  retrieval: null,
  accuracy: null,
  bottleneck: null,
  recommendations: []
}

// === PASO 1: Métricas de retrieval (si evaluate-retrieval.mjs existe) ===
console.log('📊 PASO 1: Métricas de Retrieval')
console.log('-'.repeat(60))

const retrievalScriptPath = path.join(process.cwd(), 'scripts', 'evaluate-retrieval.mjs')
if (fs.existsSync(retrievalScriptPath)) {
  try {
    const limitArg = LIMIT ? `--limit ${LIMIT}` : ''
    const retrievalOutput = execSync(`node ${retrievalScriptPath} ${limitArg}`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    })
    
    // Parsear output (asume formato JSON en última línea o similar)
    // Por ahora capturamos el output completo
    console.log(retrievalOutput)
    
    // Intentar extraer métricas del output
    const recallMatch = retrievalOutput.match(/Recall@5:\s*([\d.]+)/)
    const precisionMatch = retrievalOutput.match(/Precision@5:\s*([\d.]+)/)
    const mrrMatch = retrievalOutput.match(/MRR:\s*([\d.]+)/)
    const ndcgMatch = retrievalOutput.match(/NDCG@10:\s*([\d.]+)/)
    
    diagnostic.retrieval = {
      recall_at_5: recallMatch ? parseFloat(recallMatch[1]) : null,
      precision_at_5: precisionMatch ? parseFloat(precisionMatch[1]) : null,
      mrr: mrrMatch ? parseFloat(mrrMatch[1]) : null,
      ndcg_at_10: ndcgMatch ? parseFloat(ndcgMatch[1]) : null
    }
  } catch (error) {
    console.log('⚠️  evaluate-retrieval.mjs falló o no retornó datos válidos')
    console.log(`   Error: ${error.message}`)
    diagnostic.retrieval = { error: error.message }
  }
} else {
  console.log('⚠️  evaluate-retrieval.mjs no encontrado (pendiente de Cursor tarea 5.2)')
  console.log('   → Saltando métricas de retrieval')
  diagnostic.retrieval = { status: 'script_not_found' }
}

console.log()

// === PASO 2: Métricas de accuracy (evaluate-accuracy.mjs existente) ===
console.log('📊 PASO 2: Métricas de Accuracy (End-to-End)')
console.log('-'.repeat(60))

const accuracyScriptPath = path.join(process.cwd(), 'scripts', 'evaluate-accuracy.mjs')
if (fs.existsSync(accuracyScriptPath)) {
  try {
    const limitArg = LIMIT ? `--limit ${LIMIT}` : ''
    const accuracyOutput = execSync(`node ${accuracyScriptPath} ${limitArg}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024 // 10 MB buffer
    })
    
    console.log(accuracyOutput)
    
    // Parsear métricas del output
    const scoreMatch = accuracyOutput.match(/Score promedio:\s*([\d.]+)\/10/)
    const accuracyMatch = accuracyOutput.match(/Accuracy:\s*([\d.]+)%/)
    const correctMatch = accuracyOutput.match(/(\d+)\s*\/\s*(\d+)\s*casos/)
    const alucinacionesMatch = accuracyOutput.match(/ausencia_alucinaciones:\s*([\d.]+)/)
    const articulosMatch = accuracyOutput.match(/articulos_correctos:\s*([\d.]+)/)
    const precisionMatch = accuracyOutput.match(/precision_normativa:\s*([\d.]+)/)
    const interpretacionMatch = accuracyOutput.match(/interpretacion_valida:\s*([\d.]+)/)
    const completitudMatch = accuracyOutput.match(/completitud:\s*([\d.]+)/)
    
    diagnostic.accuracy = {
      score_avg: scoreMatch ? parseFloat(scoreMatch[1]) : null,
      accuracy_pct: accuracyMatch ? parseFloat(accuracyMatch[1]) : null,
      correct: correctMatch ? parseInt(correctMatch[1]) : null,
      total: correctMatch ? parseInt(correctMatch[2]) : null,
      ausencia_alucinaciones: alucinacionesMatch ? parseFloat(alucinacionesMatch[1]) : null,
      articulos_correctos: articulosMatch ? parseFloat(articulosMatch[1]) : null,
      precision_normativa: precisionMatch ? parseFloat(precisionMatch[1]) : null,
      interpretacion_valida: interpretacionMatch ? parseFloat(interpretacionMatch[1]) : null,
      completitud: completitudMatch ? parseFloat(completitudMatch[1]) : null
    }
  } catch (error) {
    console.log('⚠️  evaluate-accuracy.mjs falló')
    console.log(`   Error: ${error.message}`)
    diagnostic.accuracy = { error: error.message }
  }
} else {
  console.log('❌ evaluate-accuracy.mjs no encontrado')
  diagnostic.accuracy = { status: 'script_not_found' }
}

console.log()

// === PASO 3: Diagnóstico y recomendaciones ===
console.log('🔍 PASO 3: Diagnóstico del Cuello de Botella')
console.log('-'.repeat(60))

const bottlenecks = []
const recommendations = []

// Analizar retrieval (si disponible)
if (diagnostic.retrieval && diagnostic.retrieval.recall_at_5 !== null) {
  const recall5 = diagnostic.retrieval.recall_at_5
  if (recall5 < 0.70) {
    bottlenecks.push({
      layer: 'retrieval',
      metric: 'recall_at_5',
      value: recall5,
      threshold: 0.70,
      severity: 'critical'
    })
    recommendations.push('PRIORIDAD ALTA: Mejorar retrieval (Recall@5 < 0.70)')
    recommendations.push('  - Query expansion más agresiva')
    recommendations.push('  - Revisar pesos BM25 vs embedding')
    recommendations.push('  - Ajustar metadata.article extraction')
  } else if (recall5 < 0.85) {
    bottlenecks.push({
      layer: 'retrieval',
      metric: 'recall_at_5',
      value: recall5,
      threshold: 0.85,
      severity: 'medium'
    })
    recommendations.push('Retrieval OK pero mejorable (Recall@5 < 0.85)')
  } else {
    console.log('✅ Retrieval: OK (Recall@5 >= 0.85)')
  }
  
  // NDCG bajo sugiere problema de reranking
  const ndcg10 = diagnostic.retrieval.ndcg_at_10
  if (ndcg10 !== null && ndcg10 < 0.75) {
    bottlenecks.push({
      layer: 'reranking',
      metric: 'ndcg_at_10',
      value: ndcg10,
      threshold: 0.75,
      severity: 'medium'
    })
    recommendations.push('Reranking subóptimo (NDCG@10 < 0.75)')
    recommendations.push('  - Revisar pesos de jerarquía/vigencia')
    recommendations.push('  - Cross-encoder real (RERANK_PROVIDER=hf)')
  }
}

// Analizar accuracy
if (diagnostic.accuracy && diagnostic.accuracy.articulos_correctos !== null) {
  const articulosCorrectos = diagnostic.accuracy.articulos_correctos
  if (articulosCorrectos < 3.0) {
    bottlenecks.push({
      layer: 'generation',
      metric: 'articulos_correctos',
      value: articulosCorrectos,
      threshold: 3.0,
      severity: 'critical'
    })
    recommendations.push('PRIORIDAD ALTA: articulos_correctos muy bajo (< 3.0/10)')
    recommendations.push('  - Si Recall@5 es alto → problema de generación (LLM ignora contexto)')
    recommendations.push('  - Si Recall@5 es bajo → problema de retrieval (chunks incorrectos)')
  }
  
  const alucinaciones = diagnostic.accuracy.ausencia_alucinaciones
  if (alucinaciones !== null && alucinaciones < 7.0) {
    bottlenecks.push({
      layer: 'generation',
      metric: 'ausencia_alucinaciones',
      value: alucinaciones,
      threshold: 7.0,
      severity: 'high'
    })
    recommendations.push('Alucinaciones detectadas (< 7.0/10)')
    recommendations.push('  - Reforzar prompt anti-alucinación')
    recommendations.push('  - Penalización por invención de artículos')
  }
}

// Correlación retrieval-accuracy
if (
  diagnostic.retrieval &&
  diagnostic.retrieval.recall_at_5 !== null &&
  diagnostic.accuracy &&
  diagnostic.accuracy.articulos_correctos !== null
) {
  const recall5 = diagnostic.retrieval.recall_at_5
  const articulosCorrectos = diagnostic.accuracy.articulos_correctos / 10 // normalizar a 0-1
  
  if (recall5 >= 0.80 && articulosCorrectos < 0.50) {
    recommendations.push('⚠️  DIAGNÓSTICO: Retrieval OK pero accuracy baja')
    recommendations.push('     → El LLM NO está usando el contexto correcto')
    recommendations.push('     → Revisar prompt de generación')
  } else if (recall5 < 0.70 && articulosCorrectos < 0.30) {
    recommendations.push('⚠️  DIAGNÓSTICO: Retrieval Y accuracy bajos')
    recommendations.push('     → CUELLO DE BOTELLA EN RETRIEVAL (prioridad #1)')
  }
}

// Identificar cuello de botella dominante
if (bottlenecks.length > 0) {
  const criticalBottleneck = bottlenecks.find(b => b.severity === 'critical')
  diagnostic.bottleneck = criticalBottleneck || bottlenecks[0]
  
  console.log('❌ CUELLO DE BOTELLA IDENTIFICADO:')
  console.log(`   Capa: ${diagnostic.bottleneck.layer}`)
  console.log(`   Métrica: ${diagnostic.bottleneck.metric} = ${diagnostic.bottleneck.value.toFixed(3)}`)
  console.log(`   Umbral esperado: ${diagnostic.bottleneck.threshold}`)
  console.log(`   Severidad: ${diagnostic.bottleneck.severity}`)
} else {
  console.log('✅ No se detectaron cuellos de botella críticos')
  diagnostic.bottleneck = null
}

console.log()

if (recommendations.length > 0) {
  console.log('💡 RECOMENDACIONES:')
  recommendations.forEach(rec => console.log(`   ${rec}`))
} else {
  console.log('✅ Sistema funcionando dentro de parámetros esperados')
}

diagnostic.recommendations = recommendations

console.log()

// === PASO 4: Guardar resultados ===
console.log('💾 PASO 4: Guardar Diagnóstico')
console.log('-'.repeat(60))

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(diagnostic, null, 2))
console.log(`✅ Diagnóstico guardado en: ${OUTPUT_PATH}`)

console.log()
console.log('=' .repeat(60))
console.log('🎯 RESUMEN:')
if (diagnostic.retrieval && diagnostic.retrieval.recall_at_5 !== null) {
  console.log(`   Retrieval Recall@5:    ${(diagnostic.retrieval.recall_at_5 * 100).toFixed(1)}%`)
}
if (diagnostic.accuracy && diagnostic.accuracy.accuracy_pct !== null) {
  console.log(`   Accuracy End-to-End:   ${diagnostic.accuracy.accuracy_pct.toFixed(1)}%`)
}
if (diagnostic.bottleneck) {
  console.log(`   Cuello de botella:     ${diagnostic.bottleneck.layer} (${diagnostic.bottleneck.metric})`)
}
console.log('=' .repeat(60))
