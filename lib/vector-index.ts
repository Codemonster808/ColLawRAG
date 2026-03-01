/**
 * HNSW vector index for approximate nearest-neighbor search (FASE_1 tarea 1.1).
 * Reduces retrieval latency from O(n) linear scan to sub-50ms for top-20.
 * Fallback to linear search when native module is unavailable (e.g. Vercel serverless).
 */

import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const _require = typeof require !== 'undefined' ? require : createRequire(import.meta.url)

const HNSW_PATH = path.join(process.cwd(), 'data', 'hnsw-index.dat')
const RRF_K = 40 // Sprint 3: ajustado de 60 a 40 para dar más peso a top-results

let _hnsw: any = null
let _idList: string[] | null = null
let _dim: number = 0

function getHnswLib(): { HierarchicalNSW: any } | null {
  try {
    return _require('hnswlib-node')
  } catch {
    return null
  }
}

/**
 * Check if HNSW native index is available and file exists.
 */
export function isHNSWAvailable(): boolean {
  if (!getHnswLib()) return false
  return fs.existsSync(HNSW_PATH)
}

/**
 * Build HNSW index from chunks (id + embedding) and persist to data/hnsw-index.dat.
 * Also writes data/hnsw-ids.txt (one id per line, same order) for lookup at query time.
 * Call after generating index.json in ingest.
 */
export function buildAndSaveHNSW(chunks: Array<{ id: string; embedding: number[] }>): void {
  const HierarchicalNSW = getHnswLib()?.HierarchicalNSW
  if (!HierarchicalNSW) {
    console.warn('[vector-index] hnswlib-node not available; skipping HNSW build')
    return
  }
  if (chunks.length === 0) return
  const dim = chunks[0].embedding.length
  const maxElements = chunks.length
  const index = new HierarchicalNSW('cosine', dim)
  index.initIndex(maxElements)
  for (let i = 0; i < chunks.length; i++) {
    index.addPoint(chunks[i].embedding, i)
  }
  const dir = path.dirname(HNSW_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  index.writeIndexSync(HNSW_PATH)
  fs.writeFileSync(getHNSWIdListPath(), chunks.map(c => c.id).join('\n'), 'utf-8')
  console.log(`[vector-index] HNSW index saved: ${maxElements} vectors, dim=${dim} -> ${HNSW_PATH}`)
}

/**
 * Load HNSW index and id list from disk. Id list must be saved alongside (same order as build).
 */
export function loadHNSWIndex(idListPath: string): boolean {
  const HierarchicalNSW = getHnswLib()?.HierarchicalNSW
  if (!HierarchicalNSW || !fs.existsSync(HNSW_PATH) || !fs.existsSync(idListPath)) return false
  try {
    const rawIds = fs.readFileSync(idListPath, 'utf-8')
    _idList = rawIds.trim().split('\n').filter(Boolean)
    if (_idList.length === 0) return false
    _dim = 384 // default MiniLM; will be set by first search
    _hnsw = new HierarchicalNSW('cosine', _dim)
    _hnsw.readIndexSync(HNSW_PATH, _idList.length)
    _dim = _hnsw.getNumDimensions?.() ?? _dim
    return true
  } catch (e) {
    console.warn('[vector-index] Failed to load HNSW:', (e as Error).message)
    _hnsw = null
    _idList = null
    return false
  }
}

/**
 * Search HNSW for k nearest neighbors. Returns chunk ids and similarity scores (0-1).
 * Cosine space in hnswlib returns distance = 1 - similarity, so similarity = 1 - distance.
 */
export function searchHNSW(queryVector: number[], k: number): Array<{ id: string; score: number }> {
  if (!_hnsw || !_idList) return []
  const kActual = Math.min(k, _idList.length)
  const res = _hnsw.searchKnn(queryVector, kActual)
  const neighbors: number[] = Array.isArray(res) ? res : (res?.neighbors ?? [])
  const distances: number[] = Array.isArray(res?.distances) ? res.distances : (res?.distances ? [res.distances] : [])
  return neighbors.map((idx: number, i: number) => ({
    id: _idList![idx],
    score: Math.max(0, 1 - (distances[i] ?? 0))
  }))
}

/**
 * Get path where HNSW index is stored.
 */
export function getHNSWPath(): string {
  return HNSW_PATH
}

/**
 * Get path for id list file (same order as HNSW vectors).
 */
export function getHNSWIdListPath(): string {
  return path.join(process.cwd(), 'data', 'hnsw-ids.txt')
}

export { RRF_K, HNSW_PATH }
