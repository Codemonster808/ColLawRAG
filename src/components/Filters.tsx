import type { ChangeEvent } from 'react'

type Props = {
  value: string
  onChange: (v: string) => void
}

const OPTIONS = [
  { value: 'todos', label: 'Todos los tipos' },
  { value: 'estatuto', label: 'Leyes/Estatutos' },
  { value: 'jurisprudencia', label: 'Jurisprudencia' },
  { value: 'reglamento', label: 'Reglamentos' },
]

export default function Filters({ value, onChange }: Props) {
  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)
  return (
    <div className="mt-3 flex items-center gap-3">
      <label className="text-sm text-gray-600">Tipo de documento:</label>
      <select
        value={value}
        onChange={handleChange}
        className="rounded-md border border-gray-300 px-2 py-1 text-sm"
      >
        {OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
} 