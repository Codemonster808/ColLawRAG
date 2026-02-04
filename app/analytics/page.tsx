import { getSystemMetrics, getQueriesPerDay } from '@/lib/auth'
import AnalyticsDashboard from './AnalyticsDashboard'

type Props = { searchParams: Promise<{ key?: string }> }

/**
 * Dashboard de analytics (protegido).
 * Si ANALYTICS_SECRET está definido, requiere ?key=ANALYTICS_SECRET en la URL.
 */
export default async function AnalyticsPage({ searchParams }: Props) {
  const params = await searchParams
  const secret = process.env.ANALYTICS_SECRET
  if (secret && params.key !== secret) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full rounded-lg bg-white border border-gray-200 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Acceso restringido</h1>
          <p className="mt-2 text-gray-600 text-sm">
            Configure ANALYTICS_SECRET y use <code className="bg-gray-100 px-1 rounded">/analytics?key=SU_SECRETO</code>.
          </p>
        </div>
      </main>
    )
  }

  const metrics = getSystemMetrics()
  const queriesPerDay = getQueriesPerDay(14)

  return (
    <AnalyticsDashboard
      metrics={{
        ...metrics,
        queriesPerDay
      }}
    />
  )
}
