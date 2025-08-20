import { v4 as uuidv4 } from 'uuid'
import { retrieveRelevantChunks } from './retrieval'
import { generateAnswerSpanish } from './generation'
import { filterSensitivePII } from './pii'
import { type RagQuery, type RagResponse } from './types'

export async function runRagPipeline(params: RagQuery): Promise<RagResponse> {
  const { query, filters, locale = 'es' } = params

  const retrieved = await retrieveRelevantChunks(query, filters, 8)
  const answer = await generateAnswerSpanish({ query, chunks: retrieved })

  const safeAnswer = filterSensitivePII(answer || '')

  const citations = retrieved.map((r, i) => ({
    id: r.chunk.metadata.id || r.chunk.id,
    title: r.chunk.metadata.title,
    type: r.chunk.metadata.type,
    url: r.chunk.metadata.url,
    article: r.chunk.metadata.article,
    score: r.score,
  }))

  return {
    answer: safeAnswer,
    citations,
    retrieved: retrieved.length,
    requestId: uuidv4(),
  }
} 