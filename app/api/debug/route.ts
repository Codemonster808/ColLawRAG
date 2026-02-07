import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function cosineSim(a: number[], b: number[]) {
  if (!a || !b || a.length === 0 || b.length === 0) return NaN
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type R = Record<string, any>

export async function GET() {
  const d: R = { timestamp: new Date().toISOString() }

  // Env
  d.env = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL || 'not set',
    EMB_PROVIDER: process.env.EMB_PROVIDER || 'hf (default)',
    HF_MODEL: process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2',
    HF_KEY_PRESENT: !!process.env.HUGGINGFACE_API_KEY,
    HF_KEY_PREFIX: process.env.HUGGINGFACE_API_KEY?.substring(0, 5) || 'N/A',
    USE_PINECONE: !!(process.env.PINECONE_API_KEY && process.env.PINECONE_INDEX),
    USE_BM25: process.env.USE_BM25 !== 'false',
    USE_RERANKING: process.env.USE_RERANKING !== 'false',
  }

  // Files
  const dataDir = path.join(process.cwd(), 'data')
  const indexJson = path.join(dataDir, 'index.json')
  const indexGz = path.join(dataDir, 'index.json.gz')
  const bm25Json = path.join(dataDir, 'bm25-index.json')
  const bm25Gz = path.join(dataDir, 'bm25-index.json.gz')

  d.files = {
    dataDir: fs.existsSync(dataDir),
    indexJson: fs.existsSync(indexJson) ? `${(fs.statSync(indexJson).size / 1e6).toFixed(1)} MB` : 'NOT FOUND',
    indexGz: fs.existsSync(indexGz) ? `${(fs.statSync(indexGz).size / 1e6).toFixed(1)} MB` : 'NOT FOUND',
    bm25Json: fs.existsSync(bm25Json) ? `${(fs.statSync(bm25Json).size / 1e6).toFixed(1)} MB` : 'NOT FOUND',
    bm25Gz: fs.existsSync(bm25Gz) ? `${(fs.statSync(bm25Gz).size / 1e6).toFixed(1)} MB` : 'NOT FOUND',
  }

  try { d.dataFiles = fs.readdirSync(dataDir) } catch { d.dataFiles = 'error' }

  // Load index
  interface Chunk { id: string; content: string; embedding?: number[]; metadata: R }
  let chunks: Chunk[] = []
  const t0 = Date.now()
  try {
    if (fs.existsSync(indexJson)) {
      chunks = JSON.parse(fs.readFileSync(indexJson, 'utf-8'))
      d.indexLoad = { src: 'index.json', ms: Date.now() - t0, chunks: chunks.length }
    } else if (fs.existsSync(indexGz)) {
      const buf = fs.readFileSync(indexGz)
      d.gzSize = `${(buf.length / 1e6).toFixed(1)} MB`
      const dec = gunzipSync(buf)
      d.decSize = `${(dec.length / 1e6).toFixed(1)} MB`
      chunks = JSON.parse(dec.toString('utf-8'))
      d.indexLoad = { src: 'index.json.gz', ms: Date.now() - t0, chunks: chunks.length }
    } else {
      d.indexLoad = { error: 'no index file' }
    }
  } catch (e) {
    d.indexLoad = { error: (e as Error).message }
  }

  // Embedding stats
  if (chunks.length > 0) {
    const withEmb = chunks.filter(c => c.embedding && c.embedding.length > 0).length
    d.embStats = {
      withEmb,
      withoutEmb: chunks.length - withEmb,
      dim: chunks[0].embedding?.length || 0,
      sample: chunks[0].embedding?.slice(0, 3) || 'none',
    }
  }

  // Test HF API
  const apiKey = process.env.HUGGINGFACE_API_KEY
  const model = process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2'
  const url = `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`

  if (apiKey) {
    try {
      const t1 = Date.now()
      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), 15000)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: ['derechos fundamentales'] }),
        signal: ctrl.signal,
      })
      clearTimeout(tid)
      const ms = Date.now() - t1

      if (!res.ok) {
        d.hfTest = { status: 'FAIL', http: res.status, err: (await res.text()).slice(0, 300), ms }
      } else {
        const data = await res.json()
        let qEmb: number[] = []
        if (Array.isArray(data) && Array.isArray(data[0])) {
          qEmb = data[0]
          d.hfTest = { status: 'OK', fmt: '2D', dim: qEmb.length, sample: qEmb.slice(0, 3), ms }
        } else if (Array.isArray(data)) {
          qEmb = data
          d.hfTest = { status: 'OK', fmt: '1D', dim: qEmb.length, sample: qEmb.slice(0, 3), ms }
        } else {
          d.hfTest = { status: 'UNEXPECTED', preview: JSON.stringify(data).slice(0, 200), ms }
        }

        // Similarity test
        if (qEmb.length > 0 && chunks.length > 0) {
          const scores = chunks.slice(0, 200).map(c => ({
            s: cosineSim(qEmb, c.embedding || []),
            t: ((c.metadata.title as string) || '').slice(0, 50),
          })).sort((a, b) => b.s - a.s)
          d.simTest = {
            top5: scores.slice(0, 5),
            bot3: scores.slice(-3),
            allNaN: scores.every(x => isNaN(x.s)),
            avg: +(scores.reduce((a, b) => a + (isNaN(b.s) ? 0 : b.s), 0) / scores.length).toFixed(4),
          }
        }
      }
    } catch (e) {
      d.hfTest = { status: 'ERR', msg: (e as Error).message, name: (e as Error).name }
    }
  } else {
    d.hfTest = { status: 'SKIP', reason: 'no key' }
  }

  // Memory
  const m = process.memoryUsage()
  d.memory = {
    rss: `${(m.rss / 1e6).toFixed(0)} MB`,
    heapUsed: `${(m.heapUsed / 1e6).toFixed(0)} MB`,
    heapTotal: `${(m.heapTotal / 1e6).toFixed(0)} MB`,
  }

  return NextResponse.json(d)
}
