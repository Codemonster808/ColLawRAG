import { HfInference } from '@huggingface/inference'
import { type DocumentChunk } from './types'

const HF_MODEL_GENERATION_DEFAULT = 'mistralai/Mistral-7B-Instruct-v0.3'

let hf: HfInference | null = null
function getHf() {
  if (!hf) {
    // Use the new router endpoint instead of the deprecated api-inference endpoint
    // Try multiple ways to configure the endpoint
    const apiKey = process.env.HUGGINGFACE_API_KEY
    try {
      // Method 1: Try with endpoint option
      // @ts-ignore - endpoint option may exist but not in types
      hf = new HfInference(apiKey, {
        endpoint: 'https://router.huggingface.co'
      } as any)
    } catch (e) {
      // Method 2: Try with baseUrl option
      // @ts-ignore
      hf = new HfInference(apiKey, {
        baseUrl: 'https://router.huggingface.co'
      } as any)
    }
  }
  return hf
}

export async function generateAnswerSpanish(params: {
  query: string
  chunks: Array<{ chunk: DocumentChunk; score: number }>
}): Promise<string> {
  const { query, chunks } = params

  const contextBlocks = chunks.map((r, i) => `Fuente [${i + 1}] (${r.chunk.metadata.title}${r.chunk.metadata.article ? ` — ${r.chunk.metadata.article}` : ''}):\n${r.chunk.content}`).join('\n\n')

  const prompt = `Eres un asistente jurídico especializado en la normativa colombiana. Responde en español claro y preciso, citando entre corchetes el número de la fuente relevante (por ejemplo, [1], [2]). Si la pregunta excede el contexto, explica la limitación y sugiere fuentes oficiales.\n\nPregunta: ${query}\n\nContexto:\n${contextBlocks}\n\nRespuesta (máximo 10 oraciones, con citas):`

  try {
    const provider = (process.env.GEN_PROVIDER || 'hf').toLowerCase()
    console.log('[generation] provider=%s', provider)
    if (provider === 'ollama') {
      const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b-instruct'
      console.log('[generation] using Ollama model=%s', ollamaModel)
      // Local generation via Ollama
      const res = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          prompt,
          stream: false,
          options: { temperature: 0.2, num_predict: 300 },
        })
      })
      if (!res.ok) {
        console.error('[generation] Ollama HTTP error', res.status)
        throw new Error(`Ollama error ${res.status}`)
      }
      const data = await res.json() as { response?: string }
      return data.response || ''
    }

    // Default: Hugging Face Inference API
    const hfModel = process.env.HF_GENERATION_MODEL || HF_MODEL_GENERATION_DEFAULT
    console.log('[generation] using HF model=%s', hfModel)
    
    // Use direct API call to router.huggingface.co since SDK may not respect endpoint config
    const apiKey = process.env.HUGGINGFACE_API_KEY
    if (!apiKey) {
      throw new Error('HUGGINGFACE_API_KEY not set')
    }
    
    const response = await fetch(`https://router.huggingface.co/models/${hfModel}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 300,
          temperature: 0.2,
          return_full_text: false,
        },
        options: { wait_for_model: true }
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HF API error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    // Handle both array and object responses
    if (Array.isArray(data) && data.length > 0) {
      return data[0].generated_text || ''
    }
    return (data as any)?.generated_text || ''
  } catch (e) {
    console.error('[generation] error', e)
    // Fallback simple concatenation if model call fails
    return 'No fue posible generar la respuesta en este momento. Intenta nuevamente más tarde.'
  }
} 