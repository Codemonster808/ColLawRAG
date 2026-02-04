/**
 * BM25 (Best Matching 25) implementation for Spanish legal text.
 * Used for hybrid search combining cosine similarity with lexical matching.
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface BM25Index {
  /** Document frequency: term → number of documents containing the term */
  df: Record<string, number>
  /** Average document length (in tokens) */
  avgDL: number
  /** Document lengths: docId → token count */
  docLengths: Record<string, number>
  /** Inverted index: term → { docId → term frequency } */
  invertedIndex: Record<string, Record<string, number>>
  /** Total number of documents */
  totalDocs: number
}

// ── Spanish Stopwords ──────────────────────────────────────────────────

const STOPWORDS_ES = new Set([
  'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se', 'no', 'haber',
  'por', 'con', 'su', 'para', 'como', 'estar', 'tener', 'le', 'lo', 'todo',
  'pero', 'mas', 'hacer', 'o', 'poder', 'decir', 'este', 'ir', 'otro', 'ese',
  'si', 'me', 'ya', 'ver', 'porque', 'dar', 'cuando', 'muy', 'sin', 'vez',
  'mucho', 'saber', 'qué', 'sobre', 'mi', 'alguno', 'mismo', 'yo', 'también',
  'hasta', 'ano', 'dos', 'querer', 'entre', 'asi', 'primero', 'desde', 'grande',
  'eso', 'ni', 'nos', 'llegar', 'pasar', 'tiempo', 'ella', 'cual', 'menos',
  'nada', 'cada', 'te', 'aquel', 'ellos', 'las', 'los', 'les', 'del', 'al',
  'una', 'uno', 'es', 'son', 'fue', 'ha', 'han', 'era', 'esta', 'estas',
  'estos', 'esas', 'esos', 'hay', 'aqui', 'ahi', 'donde', 'quien', 'tan',
  'he', 'sus', 'e', 'u', 'ante', 'bajo', 'contra', 'durante', 'hacia',
  'mediante', 'segun', 'tras'
])

// ── Tokenization ───────────────────────────────────────────────────────

/**
 * Tokenizes text for BM25 indexing/querying.
 * - Lowercases
 * - Removes diacritics (accents)
 * - Splits on non-alphanumeric
 * - Filters stopwords and short tokens
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 1 && !STOPWORDS_ES.has(t))
}

// ── Index Construction ─────────────────────────────────────────────────

/**
 * Builds a BM25 index from an array of documents.
 * Each document must have an `id` and `content` field.
 */
export function buildBM25Index(
  documents: Array<{ id: string; content: string }>
): BM25Index {
  const df: Record<string, number> = {}
  const docLengths: Record<string, number> = {}
  const invertedIndex: Record<string, Record<string, number>> = {}
  let totalLength = 0

  for (const doc of documents) {
    const tokens = tokenize(doc.content)
    docLengths[doc.id] = tokens.length
    totalLength += tokens.length

    // Track unique terms per document for df
    const seenTerms = new Set<string>()

    for (const token of tokens) {
      // Term frequency in this document
      if (!invertedIndex[token]) {
        invertedIndex[token] = {}
      }
      invertedIndex[token][doc.id] = (invertedIndex[token][doc.id] || 0) + 1

      // Document frequency (count each term once per doc)
      if (!seenTerms.has(token)) {
        seenTerms.add(token)
        df[token] = (df[token] || 0) + 1
      }
    }
  }

  return {
    df,
    avgDL: documents.length > 0 ? totalLength / documents.length : 0,
    docLengths,
    invertedIndex,
    totalDocs: documents.length
  }
}

// ── BM25 Scoring ───────────────────────────────────────────────────────

/**
 * Calculates BM25 score for a query against a specific document.
 * Uses standard BM25 formula with configurable k1 and b parameters.
 *
 * @param query - The search query string
 * @param docId - The document ID to score against
 * @param index - The BM25 index
 * @param k1 - Term frequency saturation parameter (default 1.5)
 * @param b - Document length normalization parameter (default 0.75)
 */
export function calculateBM25(
  query: string,
  docId: string,
  index: BM25Index,
  k1: number = 1.5,
  b: number = 0.75
): number {
  const queryTokens = tokenize(query)
  const docLength = index.docLengths[docId]

  if (docLength === undefined) return 0

  let score = 0

  for (const term of queryTokens) {
    const termDf = index.df[term] || 0
    const tf = index.invertedIndex[term]?.[docId] || 0

    if (tf === 0) continue

    // IDF component: log((N - df + 0.5) / (df + 0.5) + 1)
    const idf = Math.log(
      (index.totalDocs - termDf + 0.5) / (termDf + 0.5) + 1
    )

    // TF component with length normalization
    const tfNorm =
      (tf * (k1 + 1)) /
      (tf + k1 * (1 - b + b * (docLength / index.avgDL)))

    score += idf * tfNorm
  }

  return score
}

// ── Hybrid Scoring ─────────────────────────────────────────────────────

/**
 * Combines cosine similarity and BM25 scores using weighted linear combination.
 * BM25 scores are min-max normalized before combining.
 *
 * @param cosineScore - Cosine similarity score (already 0-1 range)
 * @param bm25Score - Raw BM25 score for this document
 * @param allBM25Scores - All BM25 scores in the result set (for normalization)
 * @param alpha - Weight for cosine score; (1 - alpha) for BM25 (default 0.7)
 */
export function hybridScore(
  cosineScore: number,
  bm25Score: number,
  allBM25Scores: number[],
  alpha: number = 0.7
): number {
  // Normalize BM25 score using min-max within the result set
  const maxBM25 = Math.max(...allBM25Scores)
  const minBM25 = Math.min(...allBM25Scores)
  const range = maxBM25 - minBM25

  const normalizedBM25 = range > 0 ? (bm25Score - minBM25) / range : 0

  return alpha * cosineScore + (1 - alpha) * normalizedBM25
}

// ── Serialization ──────────────────────────────────────────────────────

/**
 * Serializes a BM25 index to a JSON string for persistence.
 */
export function serializeBM25Index(index: BM25Index): string {
  return JSON.stringify(index)
}

/**
 * Deserializes a BM25 index from a JSON string.
 */
export function deserializeBM25Index(json: string): BM25Index {
  const parsed = JSON.parse(json) as BM25Index
  // Validate required fields
  if (
    typeof parsed.totalDocs !== 'number' ||
    typeof parsed.avgDL !== 'number' ||
    !parsed.df ||
    !parsed.docLengths ||
    !parsed.invertedIndex
  ) {
    throw new Error('Invalid BM25 index format')
  }
  return parsed
}
