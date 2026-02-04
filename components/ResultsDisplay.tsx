import CalculationsDisplay from './CalculationsDisplay'
import VigenciaWarnings from './VigenciaWarnings'
import ProceduresDisplay from './ProceduresDisplay'

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

type Props = {
  answer: string
  citations: Citation[]
  requestId?: string
  calculations?: CalculationItem[]
  vigenciaValidation?: { warnings: string[]; byNorma: VigenciaNorma[] } | null
  procedures?: ProcedureItem[]
}

export default function ResultsDisplay({
  answer,
  citations,
  requestId,
  calculations = [],
  vigenciaValidation = null,
  procedures = []
}: Props) {
  async function sendFeedback(vote: 'up' | 'down') {
    if (!requestId) return
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, vote })
      })
    } catch {}
  }

  return (
    <section className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      {answer && (
        <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700">
          <h2 className="text-xl font-semibold mb-3 text-gray-800">Respuesta</h2>
          <div className="whitespace-pre-wrap leading-relaxed">{answer}</div>
        </div>
      )}
      <ProceduresDisplay procedures={procedures} />
      <CalculationsDisplay calculations={calculations} />
      <VigenciaWarnings
        warnings={vigenciaValidation?.warnings}
        byNorma={vigenciaValidation?.byNorma}
      />
      {citations?.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <h3 className="text-lg font-medium mb-2 text-gray-800">Fuentes</h3>
          <ul className="list-disc pl-5 space-y-2">
            {citations.map((c, i) => (
              <li key={c.id} className="text-sm text-gray-700">
                <span className="font-medium">[{i + 1}] {c.title}</span>
                {c.article ? ` — ${c.article}` : ''}
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className="ml-2 text-sky-600 hover:underline">Ver fuente</a>
                ) : null}
                {typeof c.score === 'number' ? (
                  <span className="ml-2 text-gray-500">(score: {c.score.toFixed(3)})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {requestId && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
          <span>¿Útil?</span>
          <button onClick={() => sendFeedback('up')} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">👍</button>
          <button onClick={() => sendFeedback('down')} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">👎</button>
        </div>
      )}
    </section>
  )
} 