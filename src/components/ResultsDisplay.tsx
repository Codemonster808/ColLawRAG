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

type ConfidenceLevel = 'alta' | 'media' | 'baja' | 'insuficiente'

type Props = {
  query?: string
  answer: string
  citations: Citation[]
  requestId?: string
  calculations?: CalculationItem[]
  vigenciaValidation?: { warnings: string[]; byNorma: VigenciaNorma[] } | null
  procedures?: ProcedureItem[]
  /** S4.6: Nivel de confianza del retrieval para badge */
  confidence?: { level: ConfidenceLevel; score: number }
}

function ConfidenceBadge({ level, score }: { level: ConfidenceLevel; score: number }) {
  const styles: Record<ConfidenceLevel, string> = {
    alta: 'bg-green-100 text-green-800 border-green-200',
    media: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    baja: 'bg-orange-100 text-orange-800 border-orange-200',
    insuficiente: 'bg-red-100 text-red-800 border-red-200'
  }
  const labels: Record<ConfidenceLevel, string> = {
    alta: 'Alta confianza',
    media: 'Confianza media',
    baja: 'Confianza baja',
    insuficiente: 'Información insuficiente'
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[level]}`}>
      {labels[level]} {(score * 100).toFixed(0)}%
    </span>
  )
}

export default function ResultsDisplay({
  query = '',
  answer,
  citations,
  requestId,
  calculations = [],
  vigenciaValidation = null,
  procedures = [],
  confidence
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

  async function exportToPDF() {
    if (!answer) return
    
    try {
      const response = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          answer,
          citations,
          calculations,
          vigenciaValidation,
          procedures,
        }),
      })

      if (!response.ok) {
        throw new Error('Error al generar PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `consulta-legal-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exportando PDF:', error)
      alert('Error al exportar PDF. Por favor, intenta nuevamente.')
    }
  }

  return (
    <section className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      {confidence && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm text-gray-500">Confianza:</span>
          <ConfidenceBadge level={confidence.level as ConfidenceLevel} score={confidence.score} />
        </div>
      )}
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
      {answer && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>📄</span>
            <span>Exportar PDF</span>
          </button>
          {requestId && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>¿Útil?</span>
              <button onClick={() => sendFeedback('up')} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">👍</button>
              <button onClick={() => sendFeedback('down')} className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50">👎</button>
            </div>
          )}
        </div>
      )}
    </section>
  )
} 