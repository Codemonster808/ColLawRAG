import { NextResponse } from 'next/server'
import { getSystemMetrics, getQueriesPerDay, getQualityMetrics, getSatisfactionMetrics, getABTestResults } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics — Métricas del sistema (protegido).
 * Header opcional: X-Analytics-Secret = process.env.ANALYTICS_SECRET
 * Si ANALYTICS_SECRET no está definido, se permite el acceso (desarrollo).
 */
export async function GET(request: Request) {
  const secret = process.env.ANALYTICS_SECRET
  if (secret) {
    const headerSecret = request.headers.get('x-analytics-secret')
    if (headerSecret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const [metrics, queriesPerDay, qualityMetrics, satisfactionMetrics, abTestResults] = await Promise.all([
      getSystemMetrics(),
      getQueriesPerDay(14),
      getQualityMetrics(),
      getSatisfactionMetrics(),
      getABTestResults('topk_variants')
    ])

    return NextResponse.json({
      ...metrics,
      queriesPerDay,
      qualityMetrics,
      satisfactionMetrics,
      abTestResults
    })
  } catch (e) {
    console.error('[analytics]', e)
    return NextResponse.json({ error: 'Error loading metrics' }, { status: 500 })
  }
}
