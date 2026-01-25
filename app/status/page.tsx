import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Estado del Servicio - RAG Derecho Colombiano',
  description: 'Dashboard de estado y métricas del servicio RAG'
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getHealthStatus() {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    
    const res = await fetch(`${baseUrl}/api/health`, {
      cache: 'no-store'
    })
    
    if (!res.ok) {
      return { status: 'error', error: `HTTP ${res.status}` }
    }
    
    return await res.json()
  } catch (error) {
    return { 
      status: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

export default async function StatusPage() {
  const health = await getHealthStatus()
  const timestamp = new Date().toISOString()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Estado del Servicio
          </h1>
          <p className="text-gray-600 mb-8">
            RAG Derecho Colombiano - Dashboard de Estado
          </p>

          {/* Status Card */}
          <div className="mb-8">
            <div className={`rounded-lg p-6 ${
              health.status === 'healthy' 
                ? 'bg-green-50 border-2 border-green-200' 
                : health.status === 'degraded'
                ? 'bg-yellow-50 border-2 border-yellow-200'
                : 'bg-red-50 border-2 border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Estado General
                  </h2>
                  <p className={`text-2xl font-bold ${
                    health.status === 'healthy' 
                      ? 'text-green-700' 
                      : health.status === 'degraded'
                      ? 'text-yellow-700'
                      : 'text-red-700'
                  }`}>
                    {health.status === 'healthy' ? '✅ Saludable' : 
                     health.status === 'degraded' ? '⚠️ Degradado' : 
                     '❌ No Saludable'}
                  </p>
                </div>
                <div className="text-right text-sm text-gray-600">
                  <p>Última verificación:</p>
                  <p className="font-mono">{new Date(timestamp).toLocaleString('es-CO')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Health Checks */}
          {health.checks && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Verificaciones de Salud
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Index File Check */}
                <div className={`rounded-lg p-4 border-2 ${
                  health.checks.indexFile?.status === 'ok'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Archivo de Índice</h3>
                      <p className={`text-sm ${
                        health.checks.indexFile?.status === 'ok'
                          ? 'text-green-700'
                          : 'text-red-700'
                      }`}>
                        {health.checks.indexFile?.status === 'ok' ? '✅ OK' : '❌ Error'}
                      </p>
                    </div>
                  </div>
                  {health.checks.indexFile?.message && (
                    <p className="text-xs text-gray-600 mt-2">
                      {health.checks.indexFile.message}
                    </p>
                  )}
                </div>

                {/* Hugging Face Check */}
                <div className={`rounded-lg p-4 border-2 ${
                  health.checks.huggingFace?.status === 'ok'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Hugging Face API</h3>
                      <p className={`text-sm ${
                        health.checks.huggingFace?.status === 'ok'
                          ? 'text-green-700'
                          : 'text-red-700'
                      }`}>
                        {health.checks.huggingFace?.status === 'ok' ? '✅ OK' : '❌ Error'}
                      </p>
                    </div>
                  </div>
                  {health.checks.huggingFace?.message && (
                    <p className="text-xs text-gray-600 mt-2">
                      {health.checks.huggingFace.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Version Info */}
          {health.version && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Información de Versión
              </h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Versión:</span> {health.version}
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {health.error && (
            <div className="mb-8">
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2">Error</h3>
                <p className="text-sm text-red-700">{health.error}</p>
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="border-t pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Enlaces Rápidos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a
                href="/api/health"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <h3 className="font-semibold text-blue-900">Health Check API</h3>
                <p className="text-sm text-blue-700">Ver estado en formato JSON</p>
              </a>
              <a
                href="/"
                className="block p-4 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <h3 className="font-semibold text-indigo-900">Inicio</h3>
                <p className="text-sm text-indigo-700">Volver a la página principal</p>
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t text-center text-sm text-gray-500">
            <p>RAG Derecho Colombiano - Sistema de Consulta Legal</p>
            <p className="mt-1">Última actualización: {new Date(timestamp).toLocaleString('es-CO')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
