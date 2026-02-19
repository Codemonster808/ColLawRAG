'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type QueryHistoryItem = {
  id: string
  query: string
  legal_area?: string
  created_at: string
  response_time?: number
  success?: boolean
}

export default function HistorialPage() {
  const [history, setHistory] = useState<QueryHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all')

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    setLoading(true)
    setError(null)
    try {
      // TODO: Cuando CU-03 y CU-04 estén completas, cambiar a:
      // const res = await fetch('/api/historial')
      // const data = await res.json()
      // setHistory(data)
      
      // Por ahora, usar localStorage temporal o datos mock
      const storedHistory = localStorage.getItem('queryHistory')
      if (storedHistory) {
        const parsed = JSON.parse(storedHistory) as QueryHistoryItem[]
        setHistory(parsed.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ))
      } else {
        // Datos mock para demostración
        setHistory([])
      }
    } catch (e: any) {
      setError(e.message || 'Error al cargar historial')
    } finally {
      setLoading(false)
    }
  }

  function clearHistory() {
    if (confirm('¿Estás seguro de que quieres eliminar todo el historial?')) {
      localStorage.removeItem('queryHistory')
      setHistory([])
    }
  }

  const filteredHistory = history.filter(item => {
    if (filter === 'success') return item.success !== false
    if (filter === 'failed') return item.success === false
    return true
  })

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-xl font-bold text-blue-600">
              ColLawRAG
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/app" className="text-gray-600 hover:text-gray-900 font-medium">
                Buscador
              </Link>
              <Link href="/pricing" className="text-gray-600 hover:text-gray-900 font-medium">
                Precios
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Historial de consultas
          </h1>
          <p className="text-gray-600">
            Revisa tus consultas anteriores y sus respuestas
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Filtrar:</span>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todas ({history.length})
              </button>
              <button
                onClick={() => setFilter('success')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'success'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Exitosas ({history.filter(h => h.success !== false).length})
              </button>
              <button
                onClick={() => setFilter('failed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'failed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Fallidas ({history.filter(h => h.success === false).length})
              </button>
            </div>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                Limpiar historial
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Cargando historial...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredHistory.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No hay consultas en el historial</h3>
            <p className="mt-2 text-gray-600">
              {history.length === 0
                ? 'Tus consultas aparecerán aquí después de que las realices.'
                : 'No hay consultas que coincidan con el filtro seleccionado.'}
            </p>
            {history.length === 0 && (
              <Link
                href="/app"
                className="mt-6 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Hacer primera consulta
              </Link>
            )}
          </div>
        )}

        {/* History List */}
        {!loading && !error && filteredHistory.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {filteredHistory.map((item) => (
                <div key={item.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {item.query}
                        </h3>
                        {item.success === false && (
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                            Fallida
                          </span>
                        )}
                        {item.success !== false && (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                            Exitosa
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                        {item.legal_area && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            {item.legal_area}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {new Date(item.created_at).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {item.response_time && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            {item.response_time}ms
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/app?query=${encodeURIComponent(item.query)}`}
                      className="ml-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      Ver respuesta
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Banner */}
        {history.length > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>Nota:</strong> El historial se guarda localmente en tu navegador. 
                  Cuando la autenticación esté disponible, podrás acceder a tu historial desde cualquier dispositivo.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
