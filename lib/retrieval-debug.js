/**
 * Debug helpers for retrieval analysis
 * Exports internal functions for testing and analysis scripts
 */

import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

// BM25 utilities
export function deserializeBM25Index(jsonStr) {
  const data = JSON.parse(jsonStr)
  return {
    docs: data.docs || [],
    idf: new Map(Object.entries(data.idf || {})),
    avgDocLength: data.avgDocLength || 0,
    k1: data.k1 || 1.5,
    b: data.b || 0.75
  }
}

export function searchBM25(query, index, topK = 10) {
  const queryTerms = query.toLowerCase().split(/\W+/).filter(t => t.length > 2)
  const scores = []

  for (const doc of index.docs) {
    let score = 0
    for (const term of queryTerms) {
      const idf = index.idf.get(term) || 0
      const tf = doc.termFreq.get(term) || 0
      const docLength = doc.length
      const avgDocLength = index.avgDocLength
      
      // BM25 formula
      const numerator = tf * (index.k1 + 1)
      const denominator = tf + index.k1 * (1 - index.b + index.b * (docLength / avgDocLength))
      score += idf * (numerator / denominator)
    }
    
    if (score > 0) {
      scores.push({ id: doc.id, score })
    }
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, topK)
}

// RRF merge
export function rrfMerge(vectorList, bm25List, k = 60) {
  const rrfScores = new Map()
  
  // Add vector scores
  vectorList.forEach((item, rank) => {
    const score = 1 / (k + rank + 1)
    rrfScores.set(item.id, (rrfScores.get(item.id) || 0) + score)
  })
  
  // Add BM25 scores
  bm25List.forEach((item, rank) => {
    const score = 1 / (k + rank + 1)
    rrfScores.set(item.id, (rrfScores.get(item.id) || 0) + score)
  })
  
  // Convert to array and sort
  return Array.from(rrfScores.entries())
    .map(([id, rrfScore]) => ({ id, rrfScore }))
    .sort((a, b) => b.rrfScore - a.rrfScore)
}

// Cosine similarity
export function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8)
}

// Load local index
export async function loadLocalIndex() {
  const dataDir = path.join(process.cwd(), 'data')
  const indexPath = path.join(dataDir, 'index.json')
  const indexGzPath = path.join(dataDir, 'index.json.gz')
  
  // Try uncompressed first
  if (fs.existsSync(indexPath)) {
    console.log('[debug] Loading index.json...')
    const raw = fs.readFileSync(indexPath, 'utf-8')
    return JSON.parse(raw)
  }
  
  // Try compressed
  if (fs.existsSync(indexGzPath)) {
    console.log('[debug] Loading index.json.gz...')
    const start = Date.now()
    const compressed = fs.readFileSync(indexGzPath)
    const decompressed = gunzipSync(compressed)
    const chunks = JSON.parse(decompressed.toString('utf-8'))
    console.log(`[debug] Decompressed ${chunks.length} chunks in ${Date.now() - start}ms`)
    return chunks
  }
  
  console.error('[debug] No index file found')
  return []
}

// Load BM25 index
export function loadBM25Index() {
  const dataDir = path.join(process.cwd(), 'data')
  const bm25Path = path.join(dataDir, 'bm25-index.json')
  const bm25GzPath = path.join(dataDir, 'bm25-index.json.gz')
  
  // Try uncompressed first
  if (fs.existsSync(bm25Path)) {
    console.log('[debug] Loading bm25-index.json...')
    const raw = fs.readFileSync(bm25Path, 'utf-8')
    return deserializeBM25Index(raw)
  }
  
  // Try compressed
  if (fs.existsSync(bm25GzPath)) {
    console.log('[debug] Loading bm25-index.json.gz...')
    const start = Date.now()
    const compressed = fs.readFileSync(bm25GzPath)
    const decompressed = gunzipSync(compressed)
    const index = deserializeBM25Index(decompressed.toString('utf-8'))
    console.log(`[debug] Loaded BM25 index with ${index.docs.length} docs in ${Date.now() - start}ms`)
    return index
  }
  
  console.error('[debug] No BM25 index file found')
  return null
}
