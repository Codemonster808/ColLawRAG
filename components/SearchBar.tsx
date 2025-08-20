import type { ChangeEvent } from 'react'

type Props = {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  loading?: boolean
}

export default function SearchBar({ value, onChange, onSubmit, loading }: Props) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={handleChange}
        placeholder="Ej.: ¿Cuál es la regulación sobre horas extras en Colombia?"
        className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <button
        onClick={onSubmit}
        disabled={loading || !value.trim()}
        className="rounded-md bg-primary px-4 py-2 text-white disabled:opacity-60"
      >
        {loading ? 'Buscando…' : 'Buscar'}
      </button>
    </div>
  )
} 