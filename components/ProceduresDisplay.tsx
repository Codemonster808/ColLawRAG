'use client'

export type ProcedureItem = {
  id: string
  nombre: string
  tipo?: string
  resumen?: string
}

export default function ProceduresDisplay({ procedures }: { procedures: ProcedureItem[] }) {
  if (!procedures?.length) return null

  return (
    <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50/80 p-4">
      <h3 className="text-lg font-semibold text-sky-900 mb-3 flex items-center gap-2">
        <span aria-hidden>📋</span> Procedimientos relevantes
      </h3>
      <p className="text-sm text-sky-800 mb-3">
        Procedimientos legales que pueden aplicar a su consulta (plazos, pasos, documentos).
      </p>
      <ul className="space-y-3">
        {procedures.map((p) => (
          <li key={p.id} className="rounded-md bg-white/90 p-3 shadow-sm border border-sky-100">
            <p className="font-medium text-gray-900">{p.nombre}</p>
            {p.tipo && (
              <p className="text-xs text-sky-600 mt-1 capitalize">{p.tipo}</p>
            )}
            {p.resumen && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-3">{p.resumen}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
