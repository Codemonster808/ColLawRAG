import { type DocumentChunk } from './types'
import { generatePrompts, type PromptContext } from './prompt-templates'

// Default model for text generation using router.huggingface.co/novita endpoint
// Cambiado a Mistral 7B para mejor rendimiento y velocidad
// Alternativas: meta-llama/Llama-3.1-8B-Instruct, Qwen/Qwen2.5-7B-Instruct
const HF_MODEL_GENERATION_DEFAULT = 'mistralai/Mistral-7B-Instruct-v0.3'

// Maximum number of citations to include in context
const MAX_CITATIONS = 8
// Limit context to avoid API errors (max ~4000 chars to stay within token limits)
const MAX_CONTEXT_CHARS = 4000

export async function generateAnswerSpanish(params: {
  query: string
  chunks: Array<{ chunk: DocumentChunk; score: number }>
  legalArea?: string
  includeWarnings?: boolean
}): Promise<string> {
  const { query, chunks, legalArea, includeWarnings = true } = params

  // Limit chunks to MAX_CITATIONS and MAX_CONTEXT_CHARS
  const limitedChunks: Array<{ chunk: DocumentChunk; score: number }> = []
  let totalChars = 0
  
  for (let i = 0; i < Math.min(chunks.length, MAX_CITATIONS); i++) {
    const r = chunks[i]
    const block = `Fuente [${i + 1}] (${r.chunk.metadata.title}${r.chunk.metadata.article ? ` — ${r.chunk.metadata.article}` : ''}):\n${r.chunk.content}`
    const blockSize = block.length + (i > 0 ? 2 : 0) // +2 for \n\n
    
    // Si es el primer chunk y es muy grande, truncarlo en lugar de omitirlo
    if (i === 0 && blockSize > MAX_CONTEXT_CHARS) {
      // Truncar el contenido del primer chunk si es necesario
      const maxFirstChunkSize = MAX_CONTEXT_CHARS - 200 // Dejar espacio para metadata
      const truncatedContent = r.chunk.content.substring(0, maxFirstChunkSize) + '...'
      const truncatedBlock = `Fuente [${i + 1}] (${r.chunk.metadata.title}${r.chunk.metadata.article ? ` — ${r.chunk.metadata.article}` : ''}):\n${truncatedContent}`
      limitedChunks.push(r)
      totalChars += truncatedBlock.length
      break
    }
    
    if (totalChars + blockSize > MAX_CONTEXT_CHARS) break
    limitedChunks.push(r)
    totalChars += blockSize
  }
  
  // Asegurar que al menos hay un chunk
  if (limitedChunks.length === 0 && chunks.length > 0) {
    limitedChunks.push(chunks[0])
  }

  // Generate prompts using the new template system
  const promptContext: PromptContext = {
    query,
    chunks: limitedChunks,
    legalArea: legalArea as any,
    maxCitations: limitedChunks.length,
    includeWarnings,
    complexity: 'media' // Will be auto-detected
  }
  
  const { systemPrompt, userPrompt } = generatePrompts(promptContext)

  try {
    const provider = (process.env.GEN_PROVIDER || 'hf').toLowerCase()
    console.log('[generation] provider=%s', provider)
    if (provider === 'ollama') {
      const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b-instruct'
      console.log('[generation] using Ollama model=%s', ollamaModel)
      // Local generation via Ollama
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`
      const res = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: fullPrompt,
          stream: false,
          options: { temperature: 0.2, num_predict: 600 }, // Increased for structured responses
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
    console.log('[generation] chunks used:', limitedChunks.length, 'of', chunks.length)
    console.log('[generation] legal area:', promptContext.legalArea || 'auto-detected')
    
    // Configure timeout for Hugging Face API call
    const HF_TIMEOUT_MS = parseInt(process.env.HF_API_TIMEOUT_MS || '30000', 10) // 30 seconds default
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HF_TIMEOUT_MS)
    
    try {
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
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          max_tokens: 1000, // Increased for structured responses
          temperature: 0.2,
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
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
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        console.error('[generation] Timeout after', HF_TIMEOUT_MS, 'ms')
        throw new Error(`Request timeout: Hugging Face API did not respond within ${HF_TIMEOUT_MS}ms`)
      }
      throw fetchError
    }
  } catch (e) {
    console.error('[generation] error', e)
    // Fallback simple concatenation if model call fails
    return 'No fue posible generar la respuesta en este momento. Intenta nuevamente más tarde.'
  }
} 