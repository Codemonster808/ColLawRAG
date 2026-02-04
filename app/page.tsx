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
        const msg = await res.text()
        throw new Error(msg || 'Error en la consulta')
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

        <footer className="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-500">
          <p>Ejemplo educativo. No constituye asesoría legal.</p>
        </footer>
      </div>
    </main>
  )
} 