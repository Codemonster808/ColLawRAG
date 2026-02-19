const HF_MODEL = process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2'
const EMB_PROVIDER = process.env.EMB_PROVIDER || 'hf'
const EMB_MODEL = process.env.EMB_MODEL || 'Xenova/all-MiniLM-L6-v2'

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

function fakeEmbed(text: string, dim = 768): number[] {
  const rand = seededRandom(stringHash(text))
  const v = Array.from({ length: dim }, () => rand() * 2 - 1)
  // L2 normalize
  const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0)) || 1
  return v.map(x => x / norm)
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (EMB_PROVIDER === 'local') {
    return texts.map(t => fakeEmbed(t))
  }
  if (EMB_PROVIDER === 'xenova') {
    try {
      const { pipeline } = await import('@xenova/transformers')
      const extractor: any = await pipeline('feature-extraction', EMB_MODEL)
      const outputs: any = await extractor(texts, { pooling: 'mean', normalize: true })
      // Tensor batch: shape [n, dim] — split correctly
      if (outputs?.dims?.length === 2) {
        const [n, dim] = outputs.dims
        const flat = Array.from(outputs.data) as number[]
        return Array.from({ length: n }, (_, i) => flat.slice(i * dim, (i + 1) * dim))
      }
      // Single text fallback
      return [Array.from(outputs.data || outputs) as number[]]
    } catch (e) {
      return texts.map(t => fakeEmbed(t))
    }
  }
  // Default: Hugging Face
  if (!process.env.HUGGINGFACE_API_KEY) {
    return texts.map(t => fakeEmbed(t))
  }
  try {
    // Use direct API call to router.huggingface.co for feature extraction
    // The router API format: https://router.huggingface.co/hf-inference/models/{model}/pipeline/feature-extraction
    const apiKey = process.env.HUGGINGFACE_API_KEY
    const apiUrl = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}/pipeline/feature-extraction`
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
      // Handle both array and object responses
      if (Array.isArray(data)) {
        return data as number[][]
      }
      // If single embedding, wrap in array
      if (Array.isArray(data[0])) {
        return data as number[][]
      }
      return [data as number[]]
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
    // Fallback to local embeddings if HF fails
    return texts.map(t => fakeEmbed(t))
  }
}

export async function embedText(text: string): Promise<number[]> {
  const [v] = await embedTexts([text])
  return v
} 