'use client'

import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-blue-600">ColLawRAG</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/app" className="text-gray-600 hover:text-gray-900 font-medium">
                Buscador
              </Link>
              <Link href="/historial" className="text-gray-600 hover:text-gray-900 font-medium">
                Historial
              </Link>
              <Link href="/pricing" className="text-gray-600 hover:text-gray-900 font-medium">
                Precios
              </Link>
              <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium">
                Iniciar sesión
              </Link>
              <Link 
                href="/app" 
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Empieza gratis
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Consulta el derecho colombiano
            <span className="text-blue-600"> con inteligencia artificial</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Respuestas precisas con citas, cálculos automáticos y validación de vigencia. 
            Todo el conocimiento legal colombiano al alcance de tu mano.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/app" 
              className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
            >
              Probar ahora gratis
            </Link>
            <Link 
              href="/pricing" 
              className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition-colors"
            >
              Ver planes y precios
            </Link>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Prueba el buscador ahora
          </h2>
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <p className="text-sm text-gray-500 mb-2">Ejemplo de consulta:</p>
              <p className="text-gray-800 font-medium mb-4">
                "¿Cuáles son los requisitos para interponer una acción de tutela?"
              </p>
              <Link 
                href="/app" 
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Probar esta consulta →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
          Funcionalidades principales
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">RAG con citas precisas</h3>
            <p className="text-gray-600">
              Respuestas basadas en documentos legales reales con referencias exactas a artículos, leyes y jurisprudencia.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Validación de vigencia</h3>
            <p className="text-gray-600">
              Detecta automáticamente si las normas citadas están vigentes o han sido derogadas, con advertencias claras.
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Cálculos automáticos</h3>
            <p className="text-gray-600">
              Calcula automáticamente indemnizaciones, prestaciones y otros valores legales con fórmulas precisas.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
          Planes y precios
        </h2>
        <p className="text-center text-gray-600 mb-12">
          Elige el plan que mejor se adapte a tus necesidades
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {/* Free Plan */}
          <div className="bg-white rounded-xl p-8 shadow-md border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
            <div className="mb-4">
              <span className="text-4xl font-bold text-gray-900">$0</span>
              <span className="text-gray-600">/mes</span>
            </div>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-700">10 consultas/mes</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-700">Acceso básico sin auth</span>
              </li>
            </ul>
            <Link 
              href="/app" 
              className="block w-full text-center bg-gray-100 text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Empezar gratis
            </Link>
          </div>

          {/* Premium Plan */}
          <div className="bg-blue-600 rounded-xl p-8 shadow-xl border-2 border-blue-700 transform scale-105">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-2xl font-bold text-white">Premium</h3>
              <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded">Popular</span>
            </div>
            <div className="mb-4">
              <span className="text-4xl font-bold text-white">$29.000</span>
              <span className="text-blue-100"> COP/mes</span>
            </div>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-yellow-300 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-white">Consultas ilimitadas</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-yellow-300 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-white">Validación factual</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-yellow-300 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-white">Cálculos automáticos</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-yellow-300 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-white">Historial de consultas</span>
              </li>
            </ul>
            <Link 
              href="/pricing" 
              className="block w-full text-center bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              Suscribirse
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="bg-white rounded-xl p-8 shadow-md border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Pro</h3>
            <div className="mb-4">
              <span className="text-4xl font-bold text-gray-900">$149.000</span>
              <span className="text-gray-600"> COP/mes</span>
            </div>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-700">Todo de Premium</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-700">API key incluida</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-700">Analytics avanzados</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-700">Exportar a PDF</span>
              </li>
            </ul>
            <Link 
              href="/pricing" 
              className="block w-full text-center bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Suscribirse
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
          Preguntas frecuentes
        </h2>
        <div className="space-y-6">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¿Es esto asesoría legal profesional?
            </h3>
            <p className="text-gray-600">
              No. ColLawRAG proporciona información orientativa basada en documentos legales colombianos. 
              No constituye asesoría legal profesional y no reemplaza la consulta con un abogado calificado.
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¿Cómo funciona el sistema de precios?
            </h3>
            <p className="text-gray-600">
              El plan Free incluye 10 consultas por mes sin necesidad de registro. 
              Los planes Premium y Pro ofrecen consultas ilimitadas con funcionalidades adicionales.
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¿Qué información legal está disponible?
            </h3>
            <p className="text-gray-600">
              El sistema incluye constitución, códigos, leyes, decretos, resoluciones y jurisprudencia 
              de la Corte Constitucional colombiana, con validación automática de vigencia.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-blue-600 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            ¿Listo para empezar?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Prueba ColLawRAG gratis y descubre cómo la IA puede ayudarte con consultas legales.
          </p>
          <Link 
            href="/app" 
            className="inline-block bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-50 transition-colors shadow-lg"
          >
            Probar ahora gratis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">ColLawRAG</h3>
              <p className="text-gray-600 text-sm">
                Consulta legal inteligente para Colombia
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Producto</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/app" className="text-gray-600 hover:text-gray-900">Buscador</Link></li>
                <li><Link href="/pricing" className="text-gray-600 hover:text-gray-900">Precios</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/terminos" className="text-gray-600 hover:text-gray-900">Términos de servicio</a></li>
                <li><a href="/privacidad" className="text-gray-600 hover:text-gray-900">Privacidad</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Contacto</h4>
              <p className="text-gray-600 text-sm">
                Soporte disponible en la aplicación
              </p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>© 2026 ColLawRAG. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
