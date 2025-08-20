import { HfInference } from '@huggingface/inference'
import { type DocumentChunk } from './types'

const HF_MODEL_GENERATION = process.env.HF_GENERATION_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct'

let hf: HfInference | null = null
function getHf() {
  if (!hf) {
    hf = new HfInference(process.env.HUGGINGFACE_API_KEY)
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
    const client = getHf()
    const out = await client.textGeneration({
      model: HF_MODEL_GENERATION,
      inputs: prompt,
      parameters: {
        max_new_tokens: 300,
        temperature: 0.2,
        return_full_text: false,
      }
    })
    return (out as any)?.generated_text || ''
  } catch (e) {
    // Fallback simple concatenation if model call fails
    return 'No fue posible generar la respuesta en este momento. Intenta nuevamente más tarde.'
  }
} 