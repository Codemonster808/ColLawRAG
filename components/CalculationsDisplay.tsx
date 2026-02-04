'use client'

export type CalculationItem = {
  type: string
  amount: number
  formula: string
  breakdown: Record<string, number | string>
}

export default function CalculationsDisplay({ calculations }: { calculations: CalculationItem[] }) {
  if (!calculations?.length) return null

  const formatAmount = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-4">
      <h3 className="text-lg font-semibold text-amber-900 mb-3 flex items-center gap-2">
        <span aria-hidden>🧮</span> Cálculos legales
      </h3>
      <ul className="space-y-4">
        {calculations.map((calc, i) => (
          <li key={i} className="rounded-md bg-white/80 p-3 shadow-sm">
            <p className="font-medium text-gray-800 capitalize">{calc.type.replace(/_/g, ' ')}</p>
            <p className="text-xl font-semibold text-emerald-700 mt-1">{formatAmount(calc.amount)}</p>
            {calc.formula && (
              <p className="text-sm text-gray-600 mt-2 font-mono bg-gray-100 px-2 py-1 rounded">
                {calc.formula}
              </p>
            )}
            {Object.keys(calc.breakdown ?? {}).length > 0 && (
              <dl className="mt-2 text-sm text-gray-600 space-y-1">
                {Object.entries(calc.breakdown).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="capitalize">{String(k).replace(/_/g, ' ')}</dt>
                    <dd className="font-medium">{typeof v === 'number' ? formatAmount(v) : String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
