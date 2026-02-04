'use client'

type Metrics = {
  totalUsers: number
  totalQueries: number
  queriesToday: number
  averageResponseTime: number
  successRate: number
  tierDistribution: { free: number; premium: number }
  queriesPerDay: Array<{ date: string; count: number }>
}

export default function AnalyticsDashboard({ metrics }: { metrics: Metrics }) {
  const { totalUsers, totalQueries, queriesToday, averageResponseTime, successRate, tierDistribution, queriesPerDay } = metrics
  const errorRate = 1 - successRate
  const maxCount = Math.max(1, ...queriesPerDay.map((d) => d.count))

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
        <header className="mb-8">
          <h1 className="text-2xl font-bold sm:text-3xl">Analytics</h1>
          <p className="mt-1 text-gray-600 text-sm">Métricas de uso y calidad del RAG.</p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-sm text-gray-500">Usuarios totales</p>
            <p className="text-2xl font-semibold">{totalUsers}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-sm text-gray-500">Consultas totales</p>
            <p className="text-2xl font-semibold">{totalQueries}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-sm text-gray-500">Consultas hoy</p>
            <p className="text-2xl font-semibold">{queriesToday}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-sm text-gray-500">Tiempo respuesta (prom.)</p>
            <p className="text-2xl font-semibold">{Math.round(averageResponseTime)} ms</p>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Tasa de éxito / errores</h2>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-gray-500">Éxito</p>
                <p className="text-xl font-semibold text-emerald-600">{(successRate * 100).toFixed(1)}%</p>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">Errores</p>
                <p className="text-xl font-semibold text-red-600">{(errorRate * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Uso por tier</h2>
            <ul className="space-y-2">
              <li className="flex justify-between text-sm">
                <span className="text-gray-600">Free</span>
                <span className="font-medium">{tierDistribution.free}</span>
              </li>
              <li className="flex justify-between text-sm">
                <span className="text-gray-600">Premium</span>
                <span className="font-medium">{tierDistribution.premium}</span>
              </li>
            </ul>
          </div>
        </section>

        {queriesPerDay.length > 0 ? (
          <section className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Consultas por día (últimos 14 días)</h2>
            <div className="flex items-end gap-1 h-32">
              {queriesPerDay.map((d) => (
                <div
                  key={d.date}
                  className="flex-1 flex flex-col items-center gap-1 min-w-0"
                  title={`${d.date}: ${d.count}`}
                >
                  <div
                    className="w-full bg-sky-500 rounded-t min-h-[4px] transition-all"
                    style={{ height: `${Math.max(8, (d.count / maxCount) * 100)}%` }}
                  />
                  <span className="text-xs text-gray-500 truncate w-full text-center">
                    {d.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Consultas por día</h2>
            <p className="text-gray-500 text-sm">No hay datos en los últimos 14 días.</p>
          </section>
        )}

        <footer className="mt-8 text-sm text-gray-500">
          <p>Protegido: use <code className="bg-gray-100 px-1 rounded">/analytics?key=ANALYTICS_SECRET</code> cuando ANALYTICS_SECRET esté definido.</p>
        </footer>
      </div>
    </main>
  )
}
