import { NextRequest, NextResponse } from 'next/server'
import { getTrace, getRecentRequestIds } from '@/lib/tracing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/debug/trace?requestId=xxx — devuelve el trace de un request o los últimos 100 requestIds. */
export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get('requestId')
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '100', 10), 100)

  if (requestId) {
    const trace = getTrace(requestId)
    if (!trace) {
      return NextResponse.json(
        { error: 'Trace not found', requestId },
        { status: 404 }
      )
    }
    return NextResponse.json(trace)
  }

  const recent = getRecentRequestIds(limit)
  return NextResponse.json({
    recentRequestIds: recent,
    message: 'Use ?requestId=<id> to get full trace for a request.',
  })
}
