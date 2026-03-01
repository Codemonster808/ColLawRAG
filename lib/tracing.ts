/**
 * FASE_5 5.3: Tracing del pipeline RAG por request.
 * PipelineTrace y TraceStep permiten reconstruir cada paso (embedding, retrieval, reranking, generation).
 */

export interface TraceStep {
  step: string
  startMs: number
  endMs?: number
  payload?: Record<string, unknown>
}

export interface PipelineTrace {
  requestId: string
  query: string
  startedAt: string
  steps: TraceStep[]
  /** Chunk ids retornados por retrieval (tras rerank) */
  chunkIds?: string[]
  /** Latencia total ms */
  totalMs?: number
}

const MAX_TRACES = 100
const tracesByRequestId = new Map<string, PipelineTrace>()
const recentRequestIds: string[] = []

function prune() {
  while (recentRequestIds.length > MAX_TRACES) {
    const old = recentRequestIds.shift()
    if (old) tracesByRequestId.delete(old)
  }
}

/**
 * Inicia o obtiene el trace de un request. Si no existe, lo crea.
 */
export function getOrCreateTrace(requestId: string, query: string): PipelineTrace {
  let t = tracesByRequestId.get(requestId)
  if (!t) {
    t = {
      requestId,
      query,
      startedAt: new Date().toISOString(),
      steps: [],
    }
    tracesByRequestId.set(requestId, t)
    recentRequestIds.push(requestId)
    prune()
  }
  return t
}

/**
 * Registra el inicio de un paso del pipeline.
 */
export function startStep(requestId: string, step: string, payload?: Record<string, unknown>): void {
  const t = tracesByRequestId.get(requestId)
  if (!t) return
  const startMs = Date.now()
  t.steps.push({ step, startMs, payload })
}

/**
 * Cierra el último paso con el nombre dado y opcional payload adicional.
 */
export function endStep(requestId: string, step: string, payload?: Record<string, unknown>): void {
  const t = tracesByRequestId.get(requestId)
  if (!t || t.steps.length === 0) return
  const last = t.steps[t.steps.length - 1]
  if (last.step === step) {
    last.endMs = Date.now()
    if (payload) last.payload = { ...last.payload, ...payload }
  }
}

/**
 * Establece chunkIds y totalMs en el trace (típicamente al final del pipeline).
 */
export function setTraceResult(requestId: string, chunkIds: string[], totalMs: number): void {
  const t = tracesByRequestId.get(requestId)
  if (!t) return
  t.chunkIds = chunkIds
  t.totalMs = totalMs
}

/**
 * Devuelve el trace de un requestId o undefined.
 */
export function getTrace(requestId: string): PipelineTrace | undefined {
  return tracesByRequestId.get(requestId)
}

/**
 * Devuelve los últimos N requestIds (para listado en GET /api/debug/trace).
 */
export function getRecentRequestIds(limit: number = MAX_TRACES): string[] {
  return recentRequestIds.slice(-limit).reverse()
}
