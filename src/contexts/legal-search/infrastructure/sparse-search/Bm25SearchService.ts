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

/**
 * Search BM25 index over full corpus: returns top-k document ids by BM25 score.
 * FASE_1 tarea 1.2: BM25 sobre corpus completo para fusionar con vector vía RRF.
 */
export function searchBM25(
  query: string,
  index: BM25Index,
  k: number,
  k1: number = 1.5,
  b: number = 0.75
): Array<{ id: string; score: number }> {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return []

  const candidateIds = new Set<string>()
  for (const term of queryTokens) {
    const postings = index.invertedIndex[term]
    if (postings) {
      for (const docId of Object.keys(postings)) candidateIds.add(docId)
    }
  }
  if (candidateIds.size === 0) return []

  const scored = Array.from(candidateIds).map(docId => ({
    id: docId,
    score: calculateBM25(query, docId, index, k1, b)
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}

/**
 * Reciprocal Rank Fusion (RRF) with constant k=60.
 * Merges two ranked lists (vector and BM25) into one by RRF score: sum 1/(k + rank).
 */
export function rrfMerge(
  listA: Array<{ id: string; score?: number }>,
  listB: Array<{ id: string; score?: number }>,
  k: number = 60
): Array<{ id: string; rrfScore: number }> {
  const scores = new Map<string, number>()
  const add = (list: Array<{ id: string }>, kConst: number) => {
    list.forEach((item, rank) => {
      const rrf = 1 / (kConst + rank + 1)
      scores.set(item.id, (scores.get(item.id) ?? 0) + rrf)
    })
  }
  add(listA, k)
  add(listB, k)
  return Array.from(scores.entries())
    .map(([id, rrfScore]) => ({ id, rrfScore }))
    .sort((a, b) => b.rrfScore - a.rrfScore)
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
 * For very large indices (>100k docs), use streamSerializeBM25Index to avoid RangeError.
 */
export function serializeBM25Index(index: BM25Index): string {
  return JSON.stringify(index)
}

/**
 * Serializes a BM25 index to a Node.js Writable stream to avoid building a single huge string (RangeError with 36k+ docs).
 */
export function streamSerializeBM25Index(
  index: BM25Index,
  stream: { write(chunk: string, encoding?: BufferEncoding, cb?: (err?: Error) => void): boolean }
): void {
  stream.write('{"df":')
  stream.write(JSON.stringify(index.df))
  stream.write(',"avgDL":' + index.avgDL + ',"docLengths":')
  stream.write(JSON.stringify(index.docLengths))
  stream.write(',"invertedIndex":{')
  let first = true
  for (const [term, postings] of Object.entries(index.invertedIndex)) {
    if (!first) stream.write(',')
    stream.write(JSON.stringify(term) + ':' + JSON.stringify(postings))
    first = false
  }
  stream.write('},"totalDocs":' + index.totalDocs + '}')
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
