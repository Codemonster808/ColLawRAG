import { NextRequest, NextResponse } from 'next/server'
import { retrieveRelevantChunks } from '@/contexts/legal-search/domain/services/RetrievalService'

export const runtime = 'nodejs'

/** POST: body { query: string, topK?: number }. Returns chunk ids and metadata for evaluation/annotation. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    if (!query) {
      return NextResponse.json(
        { error: 'Missing or invalid query' },
        { status: 400 }
      )
    }
    const topK = Math.min(Math.max(Number(body.topK) || 10, 1), 20)
    const retrieved = await retrieveRelevantChunks(query, undefined, topK)
    const chunks = retrieved.map((r) => ({
      id: r.chunk.id,
      score: r.score,
      title: r.chunk.metadata?.title ?? '',
      contentSnippet: (r.chunk.content || '').slice(0, 400),
    }))
    const chunkIds = chunks.map((c) => c.id)
    return NextResponse.json({ chunkIds, chunks })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Retrieval failed'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
