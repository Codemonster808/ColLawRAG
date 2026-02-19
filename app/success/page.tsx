'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<string | null>(null)

  useEffect(() => {
    if (sessionId) {
      fetch(`/api/stripe/session?session_id=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          setPlan(data.plan ?? null)
          setLoading(false)
        })
        .catch(() => {
          setPlan(null)
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [sessionId])

  return (
    <div className="max-w-md w-full">
      {loading ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Verificando pago...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            ¡Pago exitoso!
          </h1>
          <p className="text-gray-600 mb-6">
            Tu suscripción {plan === 'premium' ? 'Premium' : plan === 'pro' ? 'Pro' : ''} ha sido activada.
            Ya puedes disfrutar de todas las funcionalidades incluidas en tu plan.
          </p>
          <div className="space-y-3">
            <Link
              href="/app"
              className="block w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Ir al buscador
            </Link>
            <Link
              href="/historial"
              className="block w-full bg-gray-100 text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Ver historial
            </Link>
          </div>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
          ← Volver al inicio
        </Link>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4">
      <Suspense fallback={
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </main>
  )
}
