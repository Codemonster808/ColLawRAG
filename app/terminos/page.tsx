export default function TerminosPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Términos de Servicio</h1>
          
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-600 mb-6">
              <strong>Última actualización:</strong> {new Date().toLocaleDateString('es-CO')}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Aceptación de los Términos</h2>
              <p className="text-gray-700 mb-4">
                Al acceder y utilizar ColLawRAG, usted acepta estar sujeto a estos términos de servicio. 
                Si no está de acuerdo con alguna parte de estos términos, no debe utilizar el servicio.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Naturaleza del Servicio</h2>
              <p className="text-gray-700 mb-4">
                ColLawRAG es un servicio de consulta de información legal basado en documentos normativos colombianos. 
                El servicio utiliza tecnología de inteligencia artificial para proporcionar respuestas basadas en 
                documentos legales indexados.
              </p>
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 my-4">
                <p className="text-amber-800 font-medium">
                  <strong>IMPORTANTE:</strong> Este servicio proporciona información orientativa únicamente. 
                  No constituye asesoría legal profesional, no reemplaza la consulta con un abogado calificado, 
                  y no establece una relación abogado-cliente.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Limitaciones y Exclusiones</h2>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>La información proporcionada puede no estar actualizada o completa.</li>
                <li>Las respuestas son generadas automáticamente y pueden contener errores.</li>
                <li>No garantizamos la precisión, completitud o actualidad de la información.</li>
                <li>El servicio no proporciona asesoría legal personalizada.</li>
                <li>No somos responsables de decisiones tomadas basándose en la información proporcionada.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Uso del Servicio</h2>
              <p className="text-gray-700 mb-4">Usted se compromete a:</p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Utilizar el servicio de manera responsable y legal.</li>
                <li>No utilizar el servicio para actividades ilegales.</li>
                <li>Respetar los límites de uso establecidos (rate limiting).</li>
                <li>No intentar sobrecargar o dañar el servicio.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Límites de Uso</h2>
              <p className="text-gray-700 mb-4">
                Para garantizar la disponibilidad del servicio para todos los usuarios, implementamos límites de uso:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>Máximo de 50 consultas por hora por dirección IP.</li>
                <li>Los límites pueden ajustarse sin previo aviso.</li>
                <li>El exceso de límites resultará en un error temporal (429).</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Propiedad Intelectual</h2>
              <p className="text-gray-700 mb-4">
                El servicio y su contenido están protegidos por derechos de autor. Los documentos legales 
                referenciados son de dominio público, pero la compilación, organización y presentación son 
                propiedad de ColLawRAG.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Exención de Responsabilidad</h2>
              <p className="text-gray-700 mb-4">
                EL SERVICIO SE PROPORCIONA &quot;TAL CUAL&quot; Y &quot;SEGÚN DISPONIBILIDAD&quot;. NO OFRECEMOS GARANTÍAS DE 
                NINGÚN TIPO, EXPRESAS O IMPLÍCITAS, INCLUYENDO PERO NO LIMITADO A GARANTÍAS DE PRECISIÓN, 
                COMPLETITUD O ACTUALIDAD DE LA INFORMACIÓN.
              </p>
              <p className="text-gray-700 mb-4">
                EN NINGÚN CASO SEREMOS RESPONSABLES POR DAÑOS DIRECTOS, INDIRECTOS, INCIDENTALES O 
                CONSECUENCIALES RESULTANTES DEL USO O IMPOSIBILIDAD DE USO DEL SERVICIO.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Modificaciones</h2>
              <p className="text-gray-700 mb-4">
                Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones 
                entrarán en vigor al publicarse en esta página. Se recomienda revisar periódicamente estos términos.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Contacto</h2>
              <p className="text-gray-700 mb-4">
                Para preguntas sobre estos términos, puede contactarnos a través del repositorio del proyecto 
                en GitHub o mediante los canales establecidos.
              </p>
            </section>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <a 
                href="/" 
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Volver al inicio
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
