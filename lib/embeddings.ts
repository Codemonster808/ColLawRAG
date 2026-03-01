// Modelo unificado: una sola variable para ingest y query (FASE_0 tarea 0.1)
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'
// Auto-detect provider: Xenova models ALWAYS use 'xenova', ignore EMB_PROVIDER if model is Xenova
const EMB_PROVIDER = EMBEDDING_MODEL.startsWith('Xenova/') ? 'xenova' : (process.env.EMB_PROVIDER || 'hf')

function stringHash(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return hash >>> 0
}

function seededRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (1664525 * s + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/** Dimensión del embedding según el modelo configurado (para validación vs índice). */
export function getEmbeddingDimension(): number {
  const m = EMBEDDING_MODEL.toLowerCase()
  if (m.includes('mpnet') || m.includes('768')) return 768
  return 384 // MiniLM-L12 y similares
}

function fakeEmbed(text: string, dim = 768): number[] {
  // Tarea 0.3: en producción no debe usarse; en dev log crítico
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL: Fake embeddings are not allowed in production. Set EMB_PROVIDER and HUGGINGFACE_API_KEY (or Xenova) correctly.')
  }
  console.error('[embeddings] CRITICAL: Using fake embeddings. Retrieval quality is zero.')
  const rand = seededRandom(stringHash(text))
  const v = Array.from({ length: dim }, () => rand() * 2 - 1)
  const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0)) || 1
  return v.map(x => x / norm)
}

export type EmbedTextsOptions = { expectedDimension?: number }

function validateDimension(vectors: number[][], options?: EmbedTextsOptions): void {
  if (options?.expectedDimension == null || !vectors[0]) return
  if (vectors[0].length !== options.expectedDimension) {
    throw new Error(`Embedding dimension mismatch: index has ${options.expectedDimension}d but model produces ${vectors[0].length}d. Set EMBEDDING_MODEL to match the model used for ingest.`)
  }
}

export async function embedTexts(texts: string[], options?: EmbedTextsOptions): Promise<number[][]> {
  if (EMB_PROVIDER === 'local') {
    const out = texts.map(t => fakeEmbed(t, getEmbeddingDimension()))
    if (options?.expectedDimension != null && out[0]?.length !== options.expectedDimension) {
      throw new Error(`Embedding dimension mismatch: index has ${options.expectedDimension}d but model produces ${out[0]?.length ?? 0}d. Set EMBEDDING_MODEL to match the model used for ingest.`)
    }
    return out
  }
  if (EMB_PROVIDER === 'xenova') {
    try {
      const { pipeline } = await import('@xenova/transformers')
      const extractor: any = await pipeline('feature-extraction', EMBEDDING_MODEL)
      const outputs: any = await extractor(texts, { pooling: 'mean', normalize: true })
      // Tensor batch: shape [n, dim] — split correctly
      if (outputs?.dims?.length === 2) {
        const [n, dim] = outputs.dims
        const flat = Array.from(outputs.data) as number[]
        const result = Array.from({ length: n }, (_, i) => flat.slice(i * dim, (i + 1) * dim))
        validateDimension(result, options)
        return result
      }
      // Single text fallback
      const single = [Array.from(outputs.data || outputs) as number[]]
      validateDimension(single, options)
      return single
    } catch (e) {
      console.error('[embeddings] CRITICAL: Xenova failed, cannot use fake embeddings in production.', e)
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`CRITICAL: Xenova embeddings failed in production. ${e instanceof Error ? e.message : String(e)}`)
      }
      return texts.map(t => fakeEmbed(t, getEmbeddingDimension()))
    }
  }
  // Default: Hugging Face
  if (!process.env.HUGGINGFACE_API_KEY) {
    console.error('[embeddings] CRITICAL: Using fake embeddings. Retrieval quality is zero.')
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: HUGGINGFACE_API_KEY is required in production. Set EMB_PROVIDER and API key correctly.')
    }
    return texts.map(t => fakeEmbed(t, getEmbeddingDimension()))
  }
  try {
    // Use direct API call to router.huggingface.co for feature extraction
    // The router API format: https://router.huggingface.co/hf-inference/models/{model}/pipeline/feature-extraction
    const apiKey = process.env.HUGGINGFACE_API_KEY
    const apiUrl = `https://router.huggingface.co/hf-inference/models/${EMBEDDING_MODEL}/pipeline/feature-extraction`
    console.log('[embeddings] Calling HF API:', apiUrl)
    
    // Configure timeout for embeddings API call
    const EMB_TIMEOUT_MS = parseInt(process.env.HF_API_TIMEOUT_MS || '30000', 10) // 30 seconds default
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), EMB_TIMEOUT_MS)
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
      inputs: texts,
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HF API error: ${response.status} - ${errorText}`)
      }
      
      const data = await response.json()
      let result: number[][]
      if (Array.isArray(data)) {
        result = data as number[][]
      } else if (Array.isArray(data[0])) {
        result = data as number[][]
      } else {
        result = [data as number[]]
      }
      validateDimension(result, options)
      return result
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        console.error('[embeddings] Timeout after', EMB_TIMEOUT_MS, 'ms')
        throw new Error(`Request timeout: Hugging Face embeddings API did not respond within ${EMB_TIMEOUT_MS}ms`)
      }
      throw fetchError
    }
  } catch (e) {
    console.error('[embeddings] HF API error:', e)
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`CRITICAL: Hugging Face embeddings failed in production. ${e instanceof Error ? e.message : String(e)}`)
    }
    console.error('[embeddings] CRITICAL: Using fake embeddings. Retrieval quality is zero.')
    return texts.map(t => fakeEmbed(t, getEmbeddingDimension()))
  }
}

export async function embedText(text: string): Promise<number[]> {
  const [v] = await embedTexts([text])
  return v
} 