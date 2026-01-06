import { NextRequest, NextResponse } from 'next/server'
import { runRagPipeline } from '@/lib/rag'
import { RagBodySchema } from './schema'

// Simple in-memory cache with TTL to avoid dependency issues
const CACHE_TTL_MS = 60 * 1000
export const runtime = 'nodejs'

const cache = new Map<string, { value: any; expiresAt: number }>()

function cacheGet(key: string) {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return undefined
  }
  return entry.value
}

function cacheSet(key: string, value: any) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
}

export async function POST(req: NextRequest) {
  try {
    console.log('[api/rag] Incoming request')
    console.log('[api/rag] GEN_PROVIDER=%s, OLLAMA_MODEL=%s, EMB_PROVIDER=%s', process.env.GEN_PROVIDER, process.env.OLLAMA_MODEL, process.env.EMB_PROVIDER)
    if (process.env.RAG_API_KEY) {
      const headerKey = req.headers.get('x-api-key')
      if (headerKey !== process.env.RAG_API_KEY) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
    }

    const json = await req.json().catch(() => ({}))
    const parsed = RagBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Consulta inválida', details: parsed.error.flatten() }, { status: 400 })
    }

    const { query, filters, locale = 'es' } = parsed.data
    console.log('[api/rag] Body parsed. query length=%d, filters=%o, locale=%s', query?.length || 0, filters, locale)

    const cacheKey = JSON.stringify({ q: query.trim(), f: filters, l: locale })
    const cached = cacheGet(cacheKey)
    if (cached) {
      return NextResponse.json({ ...cached, cached: true }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } })
    }

    const result = await runRagPipeline({ query, filters, locale })

    cacheSet(cacheKey, result)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } })
  } catch (e: any) {
    console.error('[api/rag] Error:', e)
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 })
  }
} 