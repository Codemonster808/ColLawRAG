/**
 * Textos de documentación legal del servicio (disclaimer, términos, privacidad).
 * Se usan en footer, API o páginas legales. Se pueden sustituir por archivos en data/legal-docs/.
 */
import fs from 'node:fs'
import path from 'node:path'

const LEGAL_DOCS_DIR = path.join(process.cwd(), 'data', 'legal-docs')

const DEFAULT_DISCLAIMER = `Este servicio es de carácter informativo y educativo. No constituye asesoría jurídica ni sustituye la consulta con un abogado. La información proporcionada se basa en normativa colombiana indexada y puede no reflejar la vigencia o interpretación más reciente. Para decisiones con efectos legales, consulte a un profesional del derecho y verifique en fuentes oficiales (Diario Oficial, Corte Constitucional, entidades competentes).`

const DEFAULT_TERMS = `Términos de uso – ColLawRAG

1. Uso del servicio. El servicio ColLawRAG ofrece consultas sobre normativa colombiana con fines informativos y educativos.

2. No asesoría jurídica. Las respuestas generadas no constituyen asesoría jurídica. No deben usarse como único fundamento para tomar decisiones con consecuencias legales.

3. Verificación. El usuario es responsable de verificar la vigencia y el contenido de las normas en fuentes oficiales.

4. Limitación de responsabilidad. Los desarrolladores y operadores del servicio no asumen responsabilidad por daños derivados del uso o la interpretación de la información proporcionada.

5. Aceptación. El uso del servicio implica la aceptación de estos términos.`

const DEFAULT_PRIVACY = `Política de privacidad – ColLawRAG

1. Datos que se procesan. Para responder consultas, el sistema procesa el texto de la pregunta y los fragmentos de normas recuperados. No se requiere registro para consultas básicas.

2. Uso de datos. Las consultas se utilizan únicamente para generar respuestas y, en su caso, para métricas agregadas de uso (sin identificación personal).

3. No venta de datos. No se venden ni se comparten datos personales con terceros.

4. Almacenamiento. Los logs pueden almacenar consultas de forma temporal para depuración; no se conservan identificadores personales más allá de lo necesario para el funcionamiento del servicio.

5. Contacto. Para preguntas sobre privacidad, utilice los canales de contacto del proyecto.`

/**
 * Lee un archivo de data/legal-docs/ si existe; si no, devuelve el texto por defecto.
 */
function loadLegalDoc(filename: string, defaultText: string): string {
  const filePath = path.join(LEGAL_DOCS_DIR, filename)
  if (fs.existsSync(filePath)) {
    try {
      return fs.readFileSync(filePath, 'utf-8').trim()
    } catch {
      return defaultText
    }
  }
  return defaultText
}

/**
 * Disclaimer legal para mostrar en respuestas o en la interfaz.
 */
export function getDisclaimer(): string {
  return loadLegalDoc('disclaimer.txt', DEFAULT_DISCLAIMER)
}

/**
 * Términos de uso (texto completo).
 */
export function getTerms(): string {
  return loadLegalDoc('terms.txt', DEFAULT_TERMS)
}

/**
 * Política de privacidad (texto completo).
 */
export function getPrivacy(): string {
  return loadLegalDoc('privacy.txt', DEFAULT_PRIVACY)
}

/**
 * Texto corto de disclaimer para incrustar en respuestas RAG (opcional).
 */
export function getDisclaimerShort(): string {
  return '⚠️ Este contenido es informativo y no sustituye asesoría jurídica. Verifique en fuentes oficiales.'
}
