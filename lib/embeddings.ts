import { HfInference } from '@huggingface/inference'

const HF_MODEL = process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2'

let hf: HfInference | null = null
function getHf() {
  if (!hf) {
    hf = new HfInference(process.env.HUGGINGFACE_API_KEY)
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
  if (!process.env.HUGGINGFACE_API_KEY) {
    return texts.map(t => fakeEmbed(t))
  }
  const client = getHf()
  const responses = await client.featureExtraction({
    model: HF_MODEL,
    inputs: texts,
  }) as number[][]
  return responses
}

export async function embedText(text: string): Promise<number[]> {
  const [v] = await embedTexts([text])
  return v
} 