export type DocType = 'estatuto' | 'jurisprudencia' | 'reglamento' | 'procedimiento'

export type DocumentMetadata = {
  id: string
  title: string
  type: DocType
  article?: string
  articleHierarchy?: string  // "Título I > Capítulo 1 > Artículo 5"
  chapter?: string            // Capítulo
  section?: string            // Sección
  area?: string               // Área legal para filtros (frontmatter o detectada; preferir sobre areaLegal)
  areaLegal?: string          // Área legal detectada (legacy; uso interno preferir metadata.area)
  entidadEmisora?: string     // Entidad que emitió la norma (Congreso, Presidencia, Corte Constitucional, etc.)
  fechaVigencia?: string      // Fecha aproximada de vigencia (YYYY-MM-DD)
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
  enableCitationValidation?: boolean
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
  citationValidation?: {
    totalCitations: number
    validCitations: number
    precision: number
    invalidCitations: Array<{ ref: string; error?: string }>
  }
  calculations?: Array<{
    type: string
    amount: number
    formula: string
    breakdown: Record<string, number | string>
  }>
  vigenciaValidation?: {
    warnings: string[]
    byNorma: Array<{ normaId: string; title: string; estado: string; derogadaPor?: string; derogadaDesde?: string }>
  }
  detectedLegalArea?: string
  sourceComparison?: {
    contradictions: Array<{
      source1: { title: string; statement: string }
      source2: { title: string; statement: string }
      topic: string
      severity: 'alta' | 'media' | 'baja'
      prevailingSource: 'source1' | 'source2' | 'indeterminado'
      explanation: string
    }>
    warnings: string[]
    hasConflicts: boolean
  }
  hierarchyExplanation?: {
    explanation: string
    hierarchyOrder: Array<{
      title: string
      type: string
      hierarchyLevel: number
      hierarchyScore: number
      vigencia?: {
        estado: string
        derogadaPor?: string
      }
    }>
    constitutionalPrinciples?: string[]
    formattedExplanation: string
  }
  metadata?: {
    responseTime?: number
    complexity?: 'baja' | 'media' | 'alta'
  }
} 