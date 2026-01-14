import { type DocumentChunk } from './types'

// Default model for text generation using router.huggingface.co/novita endpoint
const HF_MODEL_GENERATION_DEFAULT = 'meta-llama/llama-3.3-70b-instruct'

export async function generateAnswerSpanish(params: {
  query: string
  chunks: Array<{ chunk: DocumentChunk; score: number }>
}): Promise<string> {
  const { query, chunks } = params

  // Limit context to avoid API errors (max ~4000 chars to stay within token limits)
  const MAX_CONTEXT_CHARS = 4000
  let contextBlocks = ''
  for (let i = 0; i < chunks.length; i++) {
    const r = chunks[i]
    const block = `Fuente [${i + 1}] (${r.chunk.metadata.title}${r.chunk.metadata.article ? ` — ${r.chunk.metadata.article}` : ''}):\n${r.chunk.content}`
    if (contextBlocks.length + block.length > MAX_CONTEXT_CHARS) break
    contextBlocks += (i > 0 ? '\n\n' : '') + block
  }

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

    // Default: Hugging Face Inference API via router.huggingface.co
    const hfModel = process.env.HF_GENERATION_MODEL || HF_MODEL_GENERATION_DEFAULT
    console.log('[generation] using HF model=%s', hfModel)
    
    const apiKey = process.env.HUGGINGFACE_API_KEY
    if (!apiKey) {
      throw new Error('HUGGINGFACE_API_KEY not set')
    }
    
    // Use router.huggingface.co with OpenAI-compatible chat completions API
    // Format: https://router.huggingface.co/novita/v3/openai/chat/completions
    const apiUrl = 'https://router.huggingface.co/novita/v3/openai/chat/completions'
    console.log('[generation] Calling HF API:', apiUrl)
    console.log('[generation] model:', hfModel)
    console.log('[generation] context length:', contextBlocks.length)
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: hfModel,
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente jurídico especializado en la normativa colombiana. Responde en español claro y preciso, citando entre corchetes el número de la fuente relevante (por ejemplo, [1], [2]). Si la pregunta excede el contexto, explica la limitación y sugiere fuentes oficiales.'
          },
          {
            role: 'user',
            content: `Pregunta: ${query}\n\nContexto:\n${contextBlocks}\n\nRespuesta (máximo 10 oraciones, con citas):`
          }
        ],
        max_tokens: 500,
        temperature: 0.2,
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HF API error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    // Extract content from OpenAI-compatible response
    if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) {
      return data.choices[0].message.content
    }
    return ''
  } catch (e) {
    console.error('[generation] error', e)
    // Fallback simple concatenation if model call fails
    return 'No fue posible generar la respuesta en este momento. Intenta nuevamente más tarde.'
  }
} 