import { HfInference } from '@huggingface/inference'

const HF_MODEL = process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2'
const EMB_PROVIDER = process.env.EMB_PROVIDER || 'hf'
const EMB_MODEL = process.env.EMB_MODEL || 'Xenova/all-MiniLM-L6-v2'

let hf: HfInference | null = null
function getHf() {
  if (!hf) {
    // Use the new router endpoint instead of the deprecated api-inference endpoint
    // @ts-ignore - endpoint option exists but may not be in types yet
    hf = new HfInference(process.env.HUGGINGFACE_API_KEY, {
      endpoint: 'https://router.huggingface.co'
    } as any)
  }
  return hf
}

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
      // outputs can be a single tensor or array; normalize to number[][]
      const toArray = (x: any): number[] => Array.from(x.data || x) as number[]
      if (Array.isArray(outputs)) {
        return outputs.map(toArray) as number[][]
      }
      return [toArray(outputs)]
    } catch (e) {
      return texts.map(t => fakeEmbed(t))
    }
  }
  // Default: Hugging Face
  if (!process.env.HUGGINGFACE_API_KEY) {
    return texts.map(t => fakeEmbed(t))
  }
  try {
    // Use direct API call to router.huggingface.co since SDK may not respect endpoint config
    const apiKey = process.env.HUGGINGFACE_API_KEY
    const response = await fetch(`https://router.huggingface.co/models/${HF_MODEL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: texts,
      })
    })
    
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