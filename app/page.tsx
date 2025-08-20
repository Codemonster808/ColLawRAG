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

export default function Page() {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('todos')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [citations, setCitations] = useState<Citation[]>([])
  const [requestId, setRequestId] = useState<string | undefined>(undefined)

  const onSearch = async () => {
    setLoading(true)
    setError(null)
    setAnswer('')
    setCitations([])
    setRequestId(undefined)
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
    } catch (e: any) {
      setError(e.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-3xl font-semibold mb-2">RAG: Derecho Colombiano</h1>
      <p className="text-gray-600 mb-2">Consulta la normativa colombiana en lenguaje natural. Respuestas con contexto y citas.</p>
      <p className="text-gray-500 text-sm mb-6">Idioma: Español (ES). Próximamente: Inglés (EN).</p>
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <SearchBar
          value={query}
          onChange={setQuery}
          onSubmit={onSearch}
          loading={loading}
        />
        <Filters value={typeFilter} onChange={setTypeFilter} />
      </div>

      {loading && (
        <div className="animate-pulse rounded-md bg-gray-200 h-24" />
      )}

      {error && (
        <div className="text-red-600 mb-4">{error}</div>
      )}

      {!loading && (answer || citations.length > 0) && (
        <ResultsDisplay answer={answer} citations={citations} requestId={requestId} />
      )}

      <footer className="mt-10 text-sm text-gray-500">
        <p>Ejemplo educativo. No constituye asesoría legal.</p>
      </footer>
    </main>
  )
} 