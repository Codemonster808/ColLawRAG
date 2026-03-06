#!/usr/bin/env node
/**
 * FASE 3 - Tarea A: Analizar qué chunks se recuperan para queries laborales
 * 
 * Este script ejecuta consultas específicas y analiza los chunks recuperados:
 * - ¿Recupera los artículos correctos?
 * - ¿Cuál es el score de los chunks relevantes vs irrelevantes?
 * - ¿BM25 o embeddings están priorizando chunks incorrectos?
 */

import { embedText } from '../lib/embeddings.js'
import { loadLocalIndex, loadBM25Index, searchBM25, rrfMerge, cosineSimilarity } from '../lib/retrieval-debug.js'
import fs from 'node:fs'
import path from 'node:path'

// Queries de prueba basadas en el benchmark
const TEST_QUERIES = [
  {
    id: 'LAB-001',
    query: '¿Cuántos días de vacaciones anuales tiene derecho un trabajador en Colombia?',
    expectedArticles: ['Art. 186 CST', 'Artículo 186'],
    expectedNorm: 'Código Sustantivo del Trabajo'
  },
  {
    id: 'LAB-002',
    query: '¿Cuál es el salario mínimo legal en Colombia para 2024?',
    expectedArticles: ['Art. 145 CST', 'Artículo 145', 'salario mínimo'],
    expectedNorm: 'Código Sustantivo del Trabajo'
  },
  {
    id: 'LAB-003',
    query: '¿Qué es el auxilio de cesantías y cómo se calcula?',
    expectedArticles: ['Art. 249 CST', 'Artículo 249'],
    expectedNorm: 'Código Sustantivo del Trabajo'
  },
  {
    id: 'TRI-001',
    query: '¿Cuál es la tarifa general del impuesto de renta para sociedades en Colombia?',
    expectedArticles: ['Art. 240 ET', 'Artículo 240'],
    expectedNorm: 'Estatuto Tributario'
  },
  {
    id: 'TRI-002',
    query: '¿Qué es el impuesto de industria y comercio (ICA)?',
    expectedArticles: ['Decreto 1333', 'Art. 195', 'Artículo 195'],
    expectedNorm: 'Decreto 1333 de 1986'
  }
]

const RRF_K = 60

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8)
}

async function analyzeQuery(testCase) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`Query: ${testCase.query}`)
  console.log(`Expected articles: ${testCase.expectedArticles.join(', ')}`)
  console.log(`Expected norm: ${testCase.expectedNorm}`)
  console.log(`${'='.repeat(80)}\n`)

  // 1. Get query embedding
  const queryEmbedding = await embedText(testCase.query)
  
  // 2. Load indices
  const chunks = await loadLocalIndex()
  const bm25Index = loadBM25Index()
  
  if (!chunks || chunks.length === 0) {
    console.error('❌ No chunks loaded')
    return
  }
  
  if (!bm25Index) {
    console.error('❌ BM25 index not loaded')
    return
  }
  
  console.log(`📊 Corpus: ${chunks.length} chunks, BM25 index: ${bm25Index.docs.length} docs\n`)
  
  const topK = 16
  
  // 3. Vector search (cosine similarity)
  console.log(`🔍 Vector Search (top ${topK}):`)
  const vectorScores = chunks.map(c => ({
    id: c.id,
    score: cosineSim(queryEmbedding, c.embedding || []),
    chunk: c
  }))
  const vectorTop = vectorScores
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
  
  vectorTop.forEach((item, i) => {
    const isRelevant = testCase.expectedArticles.some(art => 
      item.chunk.metadata?.article?.includes(art) ||
      item.chunk.metadata?.title?.includes(testCase.expectedNorm) ||
      item.chunk.content?.toLowerCase().includes(art.toLowerCase())
    )
    const marker = isRelevant ? '✅' : '❌'
    console.log(`  ${i + 1}. ${marker} [${item.score.toFixed(4)}] ${item.chunk.metadata?.title || 'No title'} — ${item.chunk.metadata?.article || 'No article'}`)
  })
  
  // 4. BM25 search
  console.log(`\n🔍 BM25 Search (top ${topK}):`)
  const bm25Top = searchBM25(testCase.query, bm25Index, topK)
  
  const idMap = new Map(chunks.map(c => [c.id, c]))
  bm25Top.forEach((item, i) => {
    const chunk = idMap.get(item.id)
    if (!chunk) {
      console.log(`  ${i + 1}. ❌ [${item.score.toFixed(4)}] ID ${item.id} NOT FOUND IN INDEX`)
      return
    }
    const isRelevant = testCase.expectedArticles.some(art => 
      chunk.metadata?.article?.includes(art) ||
      chunk.metadata?.title?.includes(testCase.expectedNorm) ||
      chunk.content?.toLowerCase().includes(art.toLowerCase())
    )
    const marker = isRelevant ? '✅' : '❌'
    console.log(`  ${i + 1}. ${marker} [${item.score.toFixed(4)}] ${chunk.metadata?.title || 'No title'} — ${chunk.metadata?.article || 'No article'}`)
  })
  
  // 5. RRF Merge (hybrid)
  console.log(`\n🔍 Hybrid (RRF merge, K=${RRF_K}, top ${topK}):`)
  const vectorList = vectorTop.map(v => ({ id: v.id, score: v.score }))
  const bm25List = bm25Top.map(b => ({ id: b.id, score: b.score }))
  const merged = rrfMerge(vectorList, bm25List, RRF_K).slice(0, topK)
  
  merged.forEach((item, i) => {
    const chunk = idMap.get(item.id)
    if (!chunk) {
      console.log(`  ${i + 1}. ❌ [RRF ${item.rrfScore.toFixed(4)}] ID ${item.id} NOT FOUND IN INDEX`)
      return
    }
    const isRelevant = testCase.expectedArticles.some(art => 
      chunk.metadata?.article?.includes(art) ||
      chunk.metadata?.title?.includes(testCase.expectedNorm) ||
      chunk.content?.toLowerCase().includes(art.toLowerCase())
    )
    const marker = isRelevant ? '✅' : '❌'
    
    // Mostrar ranks originales
    const vectorRank = vectorList.findIndex(v => v.id === item.id)
    const bm25Rank = bm25List.findIndex(b => b.id === item.id)
    const rankInfo = `vec:#${vectorRank >= 0 ? vectorRank + 1 : '?'} bm25:#${bm25Rank >= 0 ? bm25Rank + 1 : '?'}`
    
    console.log(`  ${i + 1}. ${marker} [RRF ${item.rrfScore.toFixed(4)}, ${rankInfo}] ${chunk.metadata?.title || 'No title'} — ${chunk.metadata?.article || 'No article'}`)
  })
  
  // 6. Summary
  const relevantInVector = vectorTop.filter(v => 
    testCase.expectedArticles.some(art => 
      v.chunk.metadata?.article?.includes(art) ||
      v.chunk.metadata?.title?.includes(testCase.expectedNorm) ||
      v.chunk.content?.toLowerCase().includes(art.toLowerCase())
    )
  ).length
  
  const relevantInBM25 = bm25Top.filter(b => {
    const chunk = idMap.get(b.id)
    return chunk && testCase.expectedArticles.some(art => 
      chunk.metadata?.article?.includes(art) ||
      chunk.metadata?.title?.includes(testCase.expectedNorm) ||
      chunk.content?.toLowerCase().includes(art.toLowerCase())
    )
  }).length
  
  const relevantInHybrid = merged.filter(m => {
    const chunk = idMap.get(m.id)
    return chunk && testCase.expectedArticles.some(art => 
      chunk.metadata?.article?.includes(art) ||
      chunk.metadata?.title?.includes(testCase.expectedNorm) ||
      chunk.content?.toLowerCase().includes(art.toLowerCase())
    )
  }).length
  
  console.log(`\n📈 Summary:`)
  console.log(`  Vector: ${relevantInVector}/${topK} relevant chunks`)
  console.log(`  BM25: ${relevantInBM25}/${topK} relevant chunks`)
  console.log(`  Hybrid: ${relevantInHybrid}/${topK} relevant chunks`)
  
  if (relevantInHybrid === 0) {
    console.log(`\n⚠️  CRITICAL: No relevant chunks found in top ${topK} (hybrid)`)
  }
  
  return {
    queryId: testCase.id,
    query: testCase.query,
    relevantInVector,
    relevantInBM25,
    relevantInHybrid,
    totalTopK: topK
  }
}

async function main() {
  console.log('🔬 FASE 3 - Tarea A: Análisis de Retrieval\n')
  
  const results = []
  
  for (const testCase of TEST_QUERIES) {
    const result = await analyzeQuery(testCase)
    results.push(result)
  }
  
  // Overall summary
  console.log(`\n${'='.repeat(80)}`)
  console.log('📊 Overall Results:')
  console.log(`${'='.repeat(80)}\n`)
  
  console.table(results)
  
  const avgVector = results.reduce((sum, r) => sum + r.relevantInVector, 0) / results.length
  const avgBM25 = results.reduce((sum, r) => sum + r.relevantInBM25, 0) / results.length
  const avgHybrid = results.reduce((sum, r) => sum + r.relevantInHybrid, 0) / results.length
  
  console.log(`\nAverage relevant chunks per method (top ${results[0]?.totalTopK || 16}):`)
  console.log(`  Vector: ${avgVector.toFixed(2)}`)
  console.log(`  BM25: ${avgBM25.toFixed(2)}`)
  console.log(`  Hybrid: ${avgHybrid.toFixed(2)}`)
  
  // Save results
  const outputPath = path.join(process.cwd(), 'data', 'analysis', 'retrieval-analysis.json')
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.promises.writeFile(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    testQueries: TEST_QUERIES,
    results,
    summary: {
      avgRelevantVector: avgVector,
      avgRelevantBM25: avgBM25,
      avgRelevantHybrid: avgHybrid,
      topK: results[0]?.totalTopK || 16
    }
  }, null, 2))
  
  console.log(`\n✅ Results saved to ${outputPath}`)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
