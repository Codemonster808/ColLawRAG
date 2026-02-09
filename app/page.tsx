'use client'

import { useState } from 'react'
import SearchBar from '@/components/SearchBar'
import Filters from '@/components/Filters'
import ResultsDisplay from '@/components/ResultsDisplay'

type Citation = {
  id: string
  title: string
  type: string
  url?: string
  article?: string
  score?: number
}

type CalculationItem = { type: string; amount: number; formula: string; breakdown: Record<string, number | string> }
type VigenciaNorma = { normaId: string; title: string; estado: string; derogadaPor?: string; derogadaDesde?: string }
type ProcedureItem = { id: string; nombre: string; tipo?: string; resumen?: string }

export default function Page() {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('todos')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [citations, setCitations] = useState<Citation[]>([])
  const [requestId, setRequestId] = useState<string | undefined>(undefined)
  const [calculations, setCalculations] = useState<CalculationItem[]>([])
  const [vigenciaValidation, setVigenciaValidation] = useState<{ warnings: string[]; byNorma: VigenciaNorma[] } | null>(null)
  const [procedures, setProcedures] = useState<ProcedureItem[]>([])

  const onSearch = async () => {
    setLoading(true)
    setError(null)
    setAnswer('')
    setCitations([])
    setRequestId(undefined)
    setCalculations([])
    setVigenciaValidation(null)
    setProcedures([])
    try {
      const res = await fetch('/api/rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, filters: { type: typeFilter === 'todos' ? undefined : typeFilter }, locale: 'es' })
      })
      if (!res.ok) {
        if (res.status === 429) {
          const data = await res.json().catch(() => ({}))
          const retryAfter = res.headers.get('retry-after') || '1 hora'
          throw new Error(
            data.message || 
            `Has excedido el límite de consultas. Por favor, intenta nuevamente en ${retryAfter}.`
          )
        }
        const msg = await res.text()
        try {
          const jsonMsg = JSON.parse(msg)
          throw new Error(jsonMsg.message || jsonMsg.error || 'Error en la consulta')
        } catch {
          throw new Error(msg || 'Error en la consulta')
        }
      }
      const data = await res.json()
      setAnswer(data.answer)
      setCitations(data.citations || [])
      setRequestId(data.requestId)
      setCalculations(data.calculations ?? [])
      setVigenciaValidation(data.vigenciaValidation ?? null)
      setProcedures(data.procedures ?? [])
    } catch (e: any) {
      setError(e.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl tracking-tight">
            RAG: Derecho Colombiano
          </h1>
          <p className="mt-2 text-gray-600 sm:text-base">
            Consulte la normativa colombiana en lenguaje natural. Respuestas con contexto, citas, cálculos y procedimientos cuando apliquen.
          </p>
          <p className="mt-1 text-sm text-gray-500">Idioma: Español (ES).</p>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-6">
          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={onSearch}
            loading={loading}
          />
          <Filters value={typeFilter} onChange={setTypeFilter} />
        </div>

        {loading && (
          <div className="animate-pulse rounded-xl bg-gray-100 h-28 mb-6" />
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 text-red-700 px-4 py-3 mb-6" role="alert">
            {error}
          </div>
        )}

      {!loading && (answer || citations.length > 0) && (
        <ResultsDisplay
          answer={answer}
          citations={citations}
          requestId={requestId}
          calculations={calculations}
          vigenciaValidation={vigenciaValidation}
          procedures={procedures}
        />
      )}

        <div className="mt-8 rounded-lg bg-amber-50 border border-amber-200 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">Aviso Legal</h3>
              <div className="mt-2 text-sm text-amber-700">
                <p>
                  Este servicio proporciona <strong>información orientativa</strong> basada en documentos legales colombianos. 
                  <strong> No constituye asesoría legal profesional</strong> y no reemplaza la consulta con un abogado. 
                  La información puede no estar actualizada. Use bajo su propia responsabilidad.
                </p>
                <p className="mt-2">
                  <a href="/terminos" className="font-medium underline hover:text-amber-900">
                    Ver términos de servicio
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-500">
          <p>© 2026 ColLawRAG. Servicio de consulta de normativa colombiana.</p>
        </footer>
      </div>
    </main>
  )
} 