export type DocType = 'estatuto' | 'jurisprudencia' | 'reglamento'

export type DocumentMetadata = {
  id: string
  title: string
  type: DocType
  article?: string
  articleHierarchy?: string  // "Título I > Capítulo 1 > Artículo 5"
  chapter?: string            // Capítulo
  section?: string            // Sección
  url?: string
  sourcePath?: string
}

export type DocumentChunk = {
  id: string
  content: string
  embedding?: number[]
  metadata: DocumentMetadata
}

export type RetrieveFilters = {
  type?: DocType
}

export type RagQuery = {
  query: string
  filters?: RetrieveFilters
  locale?: 'es' | 'en'
  // Opciones avanzadas
  enableFactualValidation?: boolean
  enableStructuredResponse?: boolean
  enableCalculations?: boolean
  legalArea?: string
  userId?: string // Para tracking y límites de tier
}

export type RagResponse = {
  answer: string
  citations: Array<{
    id: string
    title: string
    type: DocType
    url?: string
    article?: string
    score?: number
  }>
  retrieved: number
  requestId: string
  // Campos adicionales opcionales
  structuredResponse?: {
    hechosRelevantes?: string
    normasAplicables?: string
    analisisJuridico?: string
    conclusion?: string
    recomendacion?: string
  }
  factualValidation?: {
    isValid: boolean
    warnings: string[]
    validatedFacts: {
      articles: Array<{ article: string; exists: boolean; source: string }>
      numbers: Array<{ value: string; verified: boolean; source: string }>
    }
  }
  calculations?: Array<{
    type: string
    amount: number
    formula: string
    breakdown: Record<string, number | string>
  }>
  detectedLegalArea?: string
  metadata?: {
    responseTime?: number
    complexity?: 'baja' | 'media' | 'alta'
  }
} 