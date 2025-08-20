type Citation = {
  id: string
  title: string
  type: string
  url?: string
  article?: string
  score?: number
}

export default function ResultsDisplay({ answer, citations, requestId }: { answer: string; citations: Citation[]; requestId?: string }) {
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
    <section className="bg-white rounded-lg shadow p-4">
      {answer && (
        <div className="prose prose-sm max-w-none">
          <h2 className="text-xl font-semibold mb-2">Respuesta</h2>
          <div className="whitespace-pre-wrap">{answer}</div>
        </div>
      )}
      {citations?.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Fuentes</h3>
          <ul className="list-disc pl-5 space-y-1">
            {citations.map((c, i) => (
              <li key={c.id} className="text-sm">
                <span className="font-medium">[{i + 1}] {c.title}</span>
                {c.article ? ` — ${c.article}` : ''}
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className="ml-2 text-primary underline">Ver fuente</a>
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
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-gray-600">¿Útil?</span>
          <button onClick={() => sendFeedback('up')} className="rounded border px-2 py-1">👍</button>
          <button onClick={() => sendFeedback('down')} className="rounded border px-2 py-1">👎</button>
        </div>
      )}
    </section>
  )
} 