// Shared Kernel — tipos compartidos entre todos los bounded contexts
export type DocType = 'estatuto' | 'jurisprudencia' | 'reglamento' | 'procedimiento'

export type DocumentMetadata = {
  id: string
  title: string
  type: DocType
  article?: string
  articleHierarchy?: string
  chapter?: string
  section?: string
  area?: string
  areaLegal?: string
  entidadEmisora?: string
  fechaVigencia?: string
  url?: string
  sourcePath?: string
  isOverview?: boolean
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
  enableFactualValidation?: boolean
  enableStructuredResponse?: boolean
  enableCalculations?: boolean
  enableCitationValidation?: boolean
  legalArea?: string
  userId?: string
  /** S7.1 A/B: desactivar query expansion para benchmark (override env) */
  useQueryExpansion?: boolean
  /** S7.2 A/B: desactivar prompts por área (usar prompt genérico) */
  usePromptByArea?: boolean
}

export type ConfidenceLevel = 'alta' | 'media' | 'baja' | 'insuficiente'

export type RagResponse = {
  answer: string
  confidence?: { level: ConfidenceLevel; score: number }
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
