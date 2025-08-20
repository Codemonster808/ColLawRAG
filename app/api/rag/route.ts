import { NextRequest, NextResponse } from 'next/server'
import { runRagPipeline } from '@/lib/rag'
import LRUCache from 'lru-cache'
import { RagBodySchema } from './schema'

const cache = new LRUCache<string, any>({ max: 100, ttl: 60 * 1000 })

export async function POST(req: NextRequest) {
  try {
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

    const cacheKey = JSON.stringify({ q: query.trim(), f: filters, l: locale })
    const cached = cache.get(cacheKey)
    if (cached) {
      return NextResponse.json({ ...cached, cached: true }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } })
    }

    const result = await runRagPipeline({ query, filters, locale })

    cache.set(cacheKey, result)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 })
  }
} 