import { type DocumentChunk } from './types'
import { generatePrompts, type PromptContext } from './prompt-templates'
import { logger } from './logger'
import { validateHNACStructure, generateHNACErrorFeedback, type HNACValidationResult } from './hnac-validator'

// Default model para testing gratuito: Qwen2.5-7B-Instruct via HF serverless (sin créditos)
// Para producción comercial: deepseek/deepseek-v3.2 via Novita (requiere créditos HF)
// El SDK @huggingface/inference usa hf-inference serverless automáticamente (gratis, plan free)
const HF_MODEL_GENERATION_DEFAULT = 'Qwen/Qwen2.5-7B-Instruct'
const HF_MODEL_FALLBACK_DEFAULT = 'meta-llama/Llama-3.2-3B-Instruct'

// Helper function to sleep
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Check if error is retryable (temporary errors)
function isRetryableError(error: any): boolean {
  if (!error) return false
  
  // Network errors, timeouts, and 5xx errors are retryable
  if (error.name === 'AbortError' || error.message?.includes('timeout')) {
    return true
  }
  
  // 5xx server errors are retryable
  if (error.message?.includes('HF API error: 5')) {
    return true
  }
  
  // Network errors
  if (error.message?.includes('fetch failed') || error.message?.includes('network')) {
    return true
  }
  
  return false
}

// Maximum number of citations to include in context (base, can be increased for complex queries)
const MAX_CITATIONS_BASE = 8
const MAX_CITATIONS_COMPLEX = 16
// Limit context to avoid API errors (base ~4000 chars, can be increased for complex queries)
const MAX_CONTEXT_CHARS_BASE = 4000
const MAX_CONTEXT_CHARS_COMPLEX = 8000

/**
 * Generate answer using a specific model with retry logic
 */
async function generateWithModel(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  timeoutMs: number
): Promise<string> {
  const apiKey = process.env.HUGGINGFACE_API_KEY
  if (!apiKey) throw new Error('HUGGINGFACE_API_KEY not set')

  const provider = (process.env.GEN_PROVIDER || 'hf').toLowerCase()

  // Novita: modelos de pago (DeepSeek V3, etc.) via router.huggingface.co/novita
  if (provider === 'novita') {
    const apiUrl = 'https://router.huggingface.co/novita/v3/openai/chat/completions'
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.2,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!response.ok) {
        const errorText = await response.text()
        const error = new Error(`HF API error: ${response.status} - ${errorText}`)
        ;(error as any).statusCode = response.status
        throw error
      }
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
      if (data.choices?.[0]?.message?.content) return data.choices[0].message.content.trim()
      throw new Error('No content in response')
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') throw new Error(`Generation timeout after ${timeoutMs}ms`)
      throw err
    }
  }

  // Default: HF serverless (gratuito, plan free) via HfInference SDK
  const { HfInference } = await import('@huggingface/inference')
  const hf = new HfInference(apiKey)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const result = await hf.chatCompletion({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    })
    clearTimeout(timeoutId)
    return result.choices[0]?.message?.content?.trim() || ''
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (controller.signal.aborted) throw new Error(`Generation timeout after ${timeoutMs}ms`)
    ;(error as any).statusCode = error.statusCode || 500
    throw error
  }
}

// Legacy fetch-based function kept for reference (Novita/paid endpoint)
async function _generateWithModelLegacy(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  timeoutMs: number
): Promise<string> {
  const apiKey = process.env.HUGGINGFACE_API_KEY
  if (!apiKey) throw new Error('HUGGINGFACE_API_KEY not set')

  const apiUrl = 'https://router.huggingface.co/novita/v3/openai/chat/completions'
  const controller2 = new AbortController()
  const timeoutId2 = setTimeout(() => controller2.abort(), timeoutMs)

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
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
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
      signal: controller2.signal
    })
    
    clearTimeout(timeoutId2)
    
    if (!response.ok) {
      const errorText = await response.text()
      const error = new Error(`HF API error: ${response.status} - ${errorText}`)
      ;(error as any).statusCode = response.status
      throw error
    }
    
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) {
      const content = data.choices[0].message.content.trim()
      if (content.length === 0) throw new Error('Empty response from model')
      return content
    }
    throw new Error('No content in response')
  } catch (fetchError: any) {
    clearTimeout(timeoutId2)
    if (fetchError.name === 'AbortError') {
      const timeoutError = new Error(`Request timeout: ${timeoutMs}ms`)
      ;(timeoutError as any).isTimeout = true
      throw timeoutError
    }
    throw fetchError
  }
}

/**
 * Generate answer with retry logic and exponential backoff
 */
async function generateWithRetry(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  timeoutMs: number,
  requestId?: string
): Promise<string> {
  const maxRetries = parseInt(process.env.HF_RETRY_ATTEMPTS || '3', 10)
  let lastError: any = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now()
      const result = await generateWithModel(model, systemPrompt, userPrompt, maxTokens, timeoutMs)
      const responseTime = Date.now() - startTime
      
      if (attempt > 1) {
        logger.info('Generation succeeded after retry', {
          requestId,
          model,
          attempt,
          responseTime
        })
      }
      
      logger.logMetric('generation_success', responseTime, 'ms', {
        requestId,
        model,
        attempt,
        retried: attempt > 1
      })
      
      return result
    } catch (error: any) {
      lastError = error
      
      // Log error details
      logger.warn('Generation attempt failed', {
        requestId,
        model,
        attempt,
        maxRetries,
        error: error.message,
        statusCode: error.statusCode,
        isTimeout: error.isTimeout || error.message?.includes('timeout'),
        isRetryable: isRetryableError(error)
      })
      
      // Don't retry if it's the last attempt or error is not retryable
      if (attempt === maxRetries || !isRetryableError(error)) {
        logger.error('Generation failed after all retries', error, {
          requestId,
          model,
          attempts: attempt,
          finalError: error.message
        })
        throw error
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const backoffMs = 1000 * Math.pow(2, attempt - 1)
      logger.debug('Retrying generation with exponential backoff', {
        requestId,
        model,
        attempt,
        nextAttempt: attempt + 1,
        backoffMs
      })
      await sleep(backoffMs)
    }
  }
  
  throw lastError || new Error('Generation failed after retries')
}

export async function generateAnswerSpanish(params: {
  query: string
  chunks: Array<{ chunk: DocumentChunk; score: number }>
  legalArea?: string
  includeWarnings?: boolean
  requestId?: string
  complexity?: 'baja' | 'media' | 'alta'
  enforceHNAC?: boolean // Nueva opción para forzar estructura HNAC
}): Promise<string> {
  const { query, chunks, legalArea, includeWarnings = true, requestId, complexity = 'media', enforceHNAC = true } = params

  // Ajustar límites según complejidad
  const maxCitations = complexity === 'alta' ? MAX_CITATIONS_COMPLEX : complexity === 'media' ? 12 : MAX_CITATIONS_BASE
  const maxContextChars = complexity === 'alta' ? MAX_CONTEXT_CHARS_COMPLEX : complexity === 'media' ? 6000 : MAX_CONTEXT_CHARS_BASE
  
  logger.debug('Generation parameters', {
    requestId,
    complexity,
    maxCitations,
    maxContextChars,
    chunksAvailable: chunks.length
  })

  // Limit chunks to MAX_CITATIONS and MAX_CONTEXT_CHARS (adaptativos)
  const limitedChunks: Array<{ chunk: DocumentChunk; score: number }> = []
  let totalChars = 0
  
  for (let i = 0; i < Math.min(chunks.length, maxCitations); i++) {
    const r = chunks[i]
    const block = `Fuente [${i + 1}] (${r.chunk.metadata.title}${r.chunk.metadata.article ? ` — ${r.chunk.metadata.article}` : ''}):\n${r.chunk.content}`
    const blockSize = block.length + (i > 0 ? 2 : 0) // +2 for \n\n
    
    // Si es el primer chunk y es muy grande, truncarlo en lugar de omitirlo
    if (i === 0 && blockSize > maxContextChars) {
      // Truncar el contenido del primer chunk si es necesario
      const maxFirstChunkSize = maxContextChars - 200 // Dejar espacio para metadata
      const truncatedContent = r.chunk.content.substring(0, maxFirstChunkSize) + '...'
      const truncatedBlock = `Fuente [${i + 1}] (${r.chunk.metadata.title}${r.chunk.metadata.article ? ` — ${r.chunk.metadata.article}` : ''}):\n${truncatedContent}`
      limitedChunks.push(r)
      totalChars += truncatedBlock.length
      break
    }
    
    if (totalChars + blockSize > maxContextChars) break
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
    complexity // Usar complejidad detectada
  }
  
  const { systemPrompt, userPrompt } = generatePrompts(promptContext)

  try {
    const provider = (process.env.GEN_PROVIDER || 'hf').toLowerCase()
    logger.debug('Provider configuration', {
      requestId,
      provider,
      GEN_PROVIDER: process.env.GEN_PROVIDER,
      OLLAMA_MODEL: process.env.OLLAMA_MODEL,
      EMB_PROVIDER: process.env.EMB_PROVIDER
    })
    
    if (provider === 'ollama') {
      const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b-instruct'
      logger.info('Using Ollama model', { requestId, model: ollamaModel })
      // Local generation via Ollama
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`
      const res = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: fullPrompt,
          stream: false,
          options: { temperature: 0.2, num_predict: 600 },
        })
      })
      if (!res.ok) {
        logger.error('Ollama HTTP error', new Error(`Ollama error ${res.status}`), { requestId, status: res.status })
        throw new Error(`Ollama error ${res.status}`)
      }
      const data = await res.json() as { response?: string }
      return data.response || ''
    }

    // Default: Hugging Face Inference API via router.huggingface.co
    const primaryModel = process.env.HF_GENERATION_MODEL || HF_MODEL_GENERATION_DEFAULT
    const fallbackModel = process.env.HF_GENERATION_MODEL_FALLBACK || HF_MODEL_FALLBACK_DEFAULT
    
    // Max tokens adaptativo según complejidad
    const baseMaxTokens = parseInt(process.env.HF_MAX_TOKENS || '2000', 10)
    const adaptiveMaxTokens = complexity === 'alta' ? Math.max(baseMaxTokens * 1.5, 3000) : 
                              complexity === 'media' ? Math.max(baseMaxTokens * 1.2, 2400) : 
                              baseMaxTokens
    const timeoutMs = parseInt(process.env.HF_API_TIMEOUT_MS || '60000', 10) // Increased to 60s default
    
    logger.info('Starting generation with Hugging Face', {
      requestId,
      primaryModel,
      fallbackModel,
      maxTokens: adaptiveMaxTokens,
      baseMaxTokens,
      complexity,
      timeoutMs,
      chunksUsed: limitedChunks.length,
      totalChunks: chunks.length,
      legalArea: promptContext.legalArea || 'auto-detected'
    })
    
    try {
      // Try primary model with retry
      const startTime = Date.now()
      const result = await generateWithRetry(
        primaryModel,
        systemPrompt,
        userPrompt,
        adaptiveMaxTokens,
        timeoutMs,
        requestId
      )
      const responseTime = Date.now() - startTime
      
      logger.logMetric('generation_total_time', responseTime, 'ms', {
        requestId,
        model: primaryModel,
        usedFallback: false
      })
      
      // Validar estructura HNAC si está habilitado
      if (enforceHNAC) {
        const validation = validateHNACStructure(result)
        if (!validation.isValid) {
          logger.warn('Generated response does not meet HNAC structure requirements', {
            requestId,
            missingSections: validation.missingSections,
            quality: validation.quality,
            score: validation.score
          })
          
          // Re-generar con feedback mejorado (máximo 2 intentos)
          const maxRegenerationAttempts = 2
          let regeneratedResult = result
          let lastValidation = validation
          
          for (let attempt = 1; attempt <= maxRegenerationAttempts; attempt++) {
            const feedback = generateHNACErrorFeedback(lastValidation)
            const enhancedUserPrompt = `${userPrompt}\n\n⚠️ CORRECCIÓN REQUERIDA (Intento ${attempt}/${maxRegenerationAttempts}):\n${feedback}\n\nPor favor, regenera tu respuesta siguiendo EXACTAMENTE el formato requerido.`
            
            logger.info('Regenerating response with HNAC structure enforcement', {
              requestId,
              attempt,
              maxAttempts: maxRegenerationAttempts,
              missingSections: lastValidation.missingSections
            })
            
            try {
              const regenStartTime = Date.now()
              regeneratedResult = await generateWithRetry(
                primaryModel,
                systemPrompt,
                enhancedUserPrompt,
                adaptiveMaxTokens,
                timeoutMs,
                requestId
              )
              const regenResponseTime = Date.now() - regenStartTime
              
              lastValidation = validateHNACStructure(regeneratedResult)
              
              logger.logMetric('hnac_regeneration_time', regenResponseTime, 'ms', {
                requestId,
                attempt,
                isValid: lastValidation.isValid,
                score: lastValidation.score
              })
              
              if (lastValidation.isValid) {
                logger.info('HNAC structure validation passed after regeneration', {
                  requestId,
                  attempt,
                  score: lastValidation.score,
                  quality: lastValidation.quality
                })
                return regeneratedResult
              }
              
              if (attempt < maxRegenerationAttempts) {
                logger.warn('Regeneration attempt did not meet HNAC requirements, retrying', {
                  requestId,
                  attempt,
                  missingSections: lastValidation.missingSections,
                  score: lastValidation.score
                })
              }
            } catch (regenError: any) {
              logger.error('Error during HNAC regeneration', regenError, {
                requestId,
                attempt
              })
              // Si falla la regeneración, continuar con el resultado original
              break
            }
          }
          
          // Si después de todos los intentos no es válido, loguear pero retornar el resultado
          if (!lastValidation.isValid) {
            logger.warn('Could not generate valid HNAC structure after all attempts, returning best available result', {
              requestId,
              finalScore: lastValidation.score,
              missingSections: lastValidation.missingSections,
              quality: lastValidation.quality
            })
          }
          
          return regeneratedResult
        } else {
          logger.debug('HNAC structure validation passed', {
            requestId,
            score: validation.score,
            quality: validation.quality
          })
        }
      }
      
      return result
    } catch (primaryError: any) {
      // If primary model fails and we have a fallback, try it
      if (fallbackModel && fallbackModel !== primaryModel) {
        logger.warn('Primary model failed, trying fallback', {
          requestId,
          primaryModel,
          fallbackModel,
          error: primaryError.message,
          statusCode: primaryError.statusCode
        })
        
        try {
          const startTime = Date.now()
          const result = await generateWithRetry(
            fallbackModel,
            systemPrompt,
            userPrompt,
            adaptiveMaxTokens,
            timeoutMs,
            requestId
          )
          const responseTime = Date.now() - startTime
          
          logger.logMetric('generation_total_time', responseTime, 'ms', {
            requestId,
            model: fallbackModel,
            usedFallback: true,
            primaryModelFailed: true
          })
          
          logger.info('Fallback model succeeded', {
            requestId,
            fallbackModel,
            responseTime
          })
          
          // Validar estructura HNAC si está habilitado (mismo proceso que con modelo primario)
          if (enforceHNAC) {
            const validation = validateHNACStructure(result)
            if (!validation.isValid) {
              logger.warn('Fallback model response does not meet HNAC structure requirements', {
                requestId,
                missingSections: validation.missingSections,
                quality: validation.quality,
                score: validation.score
              })
              
              // Re-generar con feedback mejorado (máximo 2 intentos)
              const maxRegenerationAttempts = 2
              let regeneratedResult = result
              let lastValidation = validation
              
              for (let attempt = 1; attempt <= maxRegenerationAttempts; attempt++) {
                const feedback = generateHNACErrorFeedback(lastValidation)
                const enhancedUserPrompt = `${userPrompt}\n\n⚠️ CORRECCIÓN REQUERIDA (Intento ${attempt}/${maxRegenerationAttempts}):\n${feedback}\n\nPor favor, regenera tu respuesta siguiendo EXACTAMENTE el formato requerido.`
                
                try {
                  const regenStartTime = Date.now()
                  regeneratedResult = await generateWithRetry(
                    fallbackModel,
                    systemPrompt,
                    enhancedUserPrompt,
                    adaptiveMaxTokens,
                    timeoutMs,
                    requestId
                  )
                  const regenResponseTime = Date.now() - regenStartTime
                  
                  lastValidation = validateHNACStructure(regeneratedResult)
                  
                  if (lastValidation.isValid) {
                    logger.info('HNAC structure validation passed after regeneration (fallback model)', {
                      requestId,
                      attempt,
                      score: lastValidation.score
                    })
                    return regeneratedResult
                  }
                  
                  if (attempt < maxRegenerationAttempts) {
                    logger.warn('Regeneration attempt did not meet HNAC requirements (fallback), retrying', {
                      requestId,
                      attempt,
                      missingSections: lastValidation.missingSections
                    })
                  }
                } catch (regenError: any) {
                  logger.error('Error during HNAC regeneration (fallback)', regenError, {
                    requestId,
                    attempt
                  })
                  break
                }
              }
              
              if (!lastValidation.isValid) {
                logger.warn('Could not generate valid HNAC structure after all attempts (fallback), returning best available result', {
                  requestId,
                  finalScore: lastValidation.score
                })
              }
              
              return regeneratedResult
            } else {
              logger.debug('HNAC structure validation passed (fallback model)', {
                requestId,
                score: validation.score
              })
            }
          }
          
          return result
        } catch (fallbackError: any) {
          logger.error('Both primary and fallback models failed', fallbackError, {
            requestId,
            primaryModel,
            fallbackModel,
            primaryError: primaryError.message,
            fallbackError: fallbackError.message
          })
          throw fallbackError
        }
      } else {
        // No fallback available, throw the primary error
        throw primaryError
      }
    }
  } catch (e: any) {
    logger.error('Generation pipeline error', e, {
      requestId,
      errorMessage: e?.message,
      errorStack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
    })
    // Fallback simple concatenation if model call fails
    return 'No fue posible generar la respuesta en este momento. Intenta nuevamente más tarde.'
  }
} 