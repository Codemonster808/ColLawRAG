export type DocType = 'estatuto' | 'jurisprudencia' | 'reglamento'

export type DocumentMetadata = {
  id: string
  title: string
  type: DocType
  article?: string
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
} 