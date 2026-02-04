'use client'

export type VigenciaNorma = {
  normaId: string
  title: string
  estado: string
  derogadaPor?: string
  derogadaDesde?: string
}

export default function VigenciaWarnings({
  warnings,
  byNorma
}: {
  warnings?: string[]
  byNorma?: VigenciaNorma[]
}) {
  const hasWarnings = (warnings?.length ?? 0) > 0 || (byNorma?.length ?? 0) > 0
  if (!hasWarnings) return null

  const items = byNorma?.length
    ? byNorma
    : (warnings ?? []).map((w, i) => ({ normaId: String(i), title: w, estado: 'derogada' as const }))

  const estadoStyle = (estado: string) => {
    if (estado === 'derogada') return 'bg-red-100 text-red-800 border-red-200'
    if (estado === 'parcialmente_derogada') return 'bg-amber-100 text-amber-800 border-amber-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50/90 p-4">
      <h3 className="text-lg font-semibold text-amber-900 mb-2 flex items-center gap-2">
        <span aria-hidden>⚠️</span> Vigencia de normas
      </h3>
      <p className="text-sm text-amber-800 mb-3">
        Algunas normas citadas están derogadas o parcialmente modificadas. Verifique en fuentes oficiales.
      </p>
      <ul className="space-y-2">
        {items.map((n) => (
          <li
            key={n.normaId}
            className={`rounded-md border px-3 py-2 text-sm ${estadoStyle(n.estado)}`}
          >
            <span className="font-medium">{'title' in n ? n.title : n.normaId}</span>
            {n.estado === 'derogada' && (n as VigenciaNorma).derogadaPor && (
              <span className="block mt-1 opacity-90">
                Derogada por {(n as VigenciaNorma).derogadaPor}
                {(n as VigenciaNorma).derogadaDesde && ` desde ${(n as VigenciaNorma).derogadaDesde}`}
              </span>
            )}
            {n.estado === 'parcialmente_derogada' && (
              <span className="block mt-1 opacity-90">Tiene artículos derogados o modificados.</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
