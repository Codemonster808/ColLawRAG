'use client'

type QualityMetrics = {
  averageCitationPrecision: number
  totalQueriesWithMetrics: number
  averageCitationsPerQuery: number
  averageValidCitations: number
  averageResponseLength: number
  averageChunksRetrieved: number
  precisionByArea: Record<string, { precision: number; count: number }>
  precisionByComplexity: Record<string, { precision: number; count: number }>
}

type SatisfactionMetrics = {
  averageRating: number
  totalFeedback: number
  ratingDistribution: Record<number, number>
  feedbackWithComments: number
}

type ABTestResults = {
  variantA: { count: number; avgResponseTime: number; avgSuccess: number }
  variantB: { count: number; avgResponseTime: number; avgSuccess: number }
}

type Metrics = {
  totalUsers: number
  totalQueries: number
  queriesToday: number
  averageResponseTime: number
  successRate: number
  tierDistribution: { free: number; premium: number }
  queriesPerDay: Array<{ date: string; count: number }>
  qualityMetrics?: QualityMetrics
  satisfactionMetrics?: SatisfactionMetrics
  abTestResults?: ABTestResults
}

export default function AnalyticsDashboard({ metrics }: { metrics: Metrics }) {
  const { 
    totalUsers, 
    totalQueries, 
    queriesToday, 
    averageResponseTime, 
    successRate, 
    tierDistribution, 
    queriesPerDay,
    qualityMetrics,
    satisfactionMetrics,
    abTestResults
  } = metrics
  
  const errorRate = 1 - successRate
  const maxCount = Math.max(1, ...queriesPerDay.map((d) => d.count))
  
  // Preparar datos para gráficos
  const areaEntries = qualityMetrics?.precisionByArea ? Object.entries(qualityMetrics.precisionByArea) : []
  const complexityEntries = qualityMetrics?.precisionByComplexity ? Object.entries(qualityMetrics.precisionByComplexity) : []
  const maxAreaCount = areaEntries.length > 0 ? Math.max(...areaEntries.map(([_, data]) => data.count)) : 1
  const maxComplexityCount = complexityEntries.length > 0 ? Math.max(...complexityEntries.map(([_, data]) => data.count)) : 1

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6">
        <header className="mb-8">
          <h1 className="text-2xl font-bold sm:text-3xl">Analytics Dashboard</h1>
          <p className="mt-1 text-gray-600 text-sm">Métricas de uso, calidad y satisfacción del RAG.</p>
        </header>

        {/* Métricas básicas */}
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

        {/* Métricas de calidad */}
        {qualityMetrics && qualityMetrics.totalQueriesWithMetrics > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Métricas de Calidad</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Precisión de citas</p>
                <p className="text-3xl font-semibold text-blue-600">
                  {(qualityMetrics.averageCitationPrecision * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {qualityMetrics.totalQueriesWithMetrics} consultas evaluadas
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Citas por consulta (prom.)</p>
                <p className="text-3xl font-semibold text-indigo-600">
                  {qualityMetrics.averageCitationsPerQuery.toFixed(1)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {qualityMetrics.averageValidCitations.toFixed(1)} válidas en promedio
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Chunks recuperados (prom.)</p>
                <p className="text-3xl font-semibold text-purple-600">
                  {qualityMetrics.averageChunksRetrieved.toFixed(0)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Longitud respuesta: {(qualityMetrics.averageResponseLength / 1000).toFixed(1)}k chars
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Precisión por área legal */}
        {areaEntries.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Precisión por Área Legal</h2>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <div className="space-y-3">
                {areaEntries.map(([area, data]) => (
                  <div key={area} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium capitalize">{area.replace('_', ' ')}</span>
                        <span className="text-sm text-gray-600">
                          {(data.precision * 100).toFixed(1)}% ({data.count} consultas)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${(data.precision * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Precisión por complejidad */}
        {complexityEntries.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Precisión por Complejidad</h2>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {complexityEntries.map(([complexity, data]) => (
                  <div key={complexity} className="text-center">
                    <p className="text-sm text-gray-500 mb-2 capitalize">{complexity}</p>
                    <p className="text-2xl font-semibold text-indigo-600">
                      {(data.precision * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{data.count} consultas</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Métricas de satisfacción */}
        {satisfactionMetrics && satisfactionMetrics.totalFeedback > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Satisfacción del Usuario</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Rating promedio</p>
                <p className="text-3xl font-semibold text-green-600">
                  {satisfactionMetrics.averageRating.toFixed(1)} / 5.0
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {satisfactionMetrics.totalFeedback} respuestas
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h3 className="text-sm font-medium mb-3">Distribución de ratings</h3>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map(rating => {
                    const count = satisfactionMetrics.ratingDistribution[rating] || 0
                    const percentage = satisfactionMetrics.totalFeedback > 0 
                      ? (count / satisfactionMetrics.totalFeedback) * 100 
                      : 0
                    return (
                      <div key={rating} className="flex items-center gap-2">
                        <span className="text-xs w-8">{rating} ⭐</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-yellow-400 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 w-12 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* A/B Testing */}
        {abTestResults && (abTestResults.variantA.count > 0 || abTestResults.variantB.count > 0) && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">A/B Testing: Variantes TopK</h2>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-3">Variante A</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Consultas</span>
                      <span className="font-medium">{abTestResults.variantA.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Tiempo respuesta (prom.)</span>
                      <span className="font-medium">{Math.round(abTestResults.variantA.avgResponseTime)} ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Tasa de éxito</span>
                      <span className="font-medium">{(abTestResults.variantA.avgSuccess * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-3">Variante B</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Consultas</span>
                      <span className="font-medium">{abTestResults.variantB.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Tiempo respuesta (prom.)</span>
                      <span className="font-medium">{Math.round(abTestResults.variantB.avgResponseTime)} ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Tasa de éxito</span>
                      <span className="font-medium">{(abTestResults.variantB.avgSuccess * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Gráficos existentes */}
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
          <section className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm mb-8">
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
          <section className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm mb-8">
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
