import { NextRequest, NextResponse } from 'next/server'
import { runRagPipeline } from '@/lib/rag'
import { RagBodySchema } from './schema'
import { getUserTier, checkUsageLimit, trackUsage, adjustQueryForTier } from '@/lib/tiers'
import { authenticateUser } from '@/lib/auth'

// Simple in-memory cache with TTL to avoid dependency issues
const CACHE_TTL_MS = 60 * 1000
export const runtime = 'nodejs'

// Timeout configuration
const PIPELINE_TIMEOUT_MS = parseInt(process.env.PIPELINE_TIMEOUT_MS || '60000', 10) // 60 seconds default
const MAX_REQUEST_SIZE = parseInt(process.env.MAX_REQUEST_SIZE || '1048576', 10) // 1MB default

const cache = new Map<string, { value: any; expiresAt: number }>()

function cacheGet(key: string) {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return undefined
  }
  return entry.value
}

function cacheSet(key: string, value: any) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ])
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  let requestId: string | undefined
  
  try {
    // Check Content-Length header to prevent large payloads
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { 
          error: 'Request too large', 
          message: `Request body exceeds maximum size of ${MAX_REQUEST_SIZE} bytes` 
        },
        { status: 413 }
      )
    }

    console.log('[api/rag] Incoming request')
    console.log('[api/rag] GEN_PROVIDER=%s, OLLAMA_MODEL=%s, EMB_PROVIDER=%s', process.env.GEN_PROVIDER, process.env.OLLAMA_MODEL, process.env.EMB_PROVIDER)
    
    // Autenticación y autorización
    let userId: string | undefined
    let userTier: 'free' | 'premium' = 'free'
    
    // 1. Verificar API key (si está configurada)
    if (process.env.RAG_API_KEY) {
      const headerKey = req.headers.get('x-api-key')
      if (headerKey !== process.env.RAG_API_KEY) {
        console.warn('[api/rag] Unauthorized request - invalid API key')
        return NextResponse.json(
          { error: 'No autorizado', message: 'Invalid API key' },
          { status: 401 }
        )
      }
      // Si hay API key válida, tratar como usuario premium
      userTier = 'premium'
    }
    
    // 2. Verificar autenticación de usuario (si hay header de usuario)
    const userHeader = req.headers.get('x-user-id')
    if (userHeader) {
      const user = authenticateUser(userHeader)
      if (user) {
        userId = user.id
        userTier = getUserTier(userId)
        
        // Verificar límites de uso
        const usageCheck = checkUsageLimit(userTier, userId)
        if (!usageCheck.allowed) {
          console.warn(`[api/rag] Usage limit exceeded for user ${userId}`)
          return NextResponse.json(
            { 
              error: 'Límite de uso excedido', 
              message: usageCheck.reason 
            },
            { status: 429 }
          )
        }
      }
    }
    
    // 3. Trackear uso (si hay userId)
    if (userId) {
      trackUsage(userId, userTier)
    }

    // Parse and validate request body
    let json: any
    try {
      json = await req.json()
    } catch (parseError) {
      console.error('[api/rag] JSON parse error:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON', message: 'Request body must be valid JSON' },
        { status: 400 }
      )
    }

    const parsed = RagBodySchema.safeParse(json)
    if (!parsed.success) {
      console.warn('[api/rag] Validation error:', parsed.error.flatten())
      return NextResponse.json(
        { 
          error: 'Consulta inválida', 
          details: parsed.error.flatten(),
          message: 'Request validation failed'
        },
        { status: 400 }
      )
    }

    const { query, filters, locale = 'es' } = parsed.data
    console.log('[api/rag] Body parsed. query length=%d, filters=%o, locale=%s, userTier=%s', query?.length || 0, filters, locale, userTier)
    
    // Ajustar parámetros según tier del usuario
    const tierAdjustedParams = adjustQueryForTier(userTier, {
      topK: 8,
      maxContextChars: 4000,
      includeCalculations: true,
      includeProcedures: true,
      includeStructuredResponse: true
    })
    
    // Mapear a flags del pipeline
    // Nota: includeFactualValidation no está en tiers, usar variable de entorno
    const enableFactualValidation = process.env.ENABLE_FACTUAL_VALIDATION === 'true'
    const enableStructuredResponse = tierAdjustedParams.includeStructuredResponse
    const enableCalculations = tierAdjustedParams.includeCalculations

    // Check cache
    const cacheKey = JSON.stringify({ q: query.trim(), f: filters, l: locale })
    const cached = cacheGet(cacheKey)
    if (cached) {
      console.log('[api/rag] Cache hit')
      return NextResponse.json(
        { ...cached, cached: true },
        { 
          headers: { 
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60',
            'X-Cache': 'HIT'
          } 
        }
      )
    }

    // Execute pipeline with timeout y parámetros ajustados por tier
    console.log('[api/rag] Executing pipeline with timeout:', PIPELINE_TIMEOUT_MS, 'ms, tier:', userTier)
    const result = await withTimeout(
      runRagPipeline({ 
        query, 
        filters, 
        locale,
        userId,
        enableFactualValidation,
        enableStructuredResponse,
        enableCalculations
      }),
      PIPELINE_TIMEOUT_MS
    )
    
    requestId = result.requestId
    const responseTime = Date.now() - startTime
    console.log('[api/rag] Pipeline completed in', responseTime, 'ms. Request ID:', requestId)

    // Cache successful results
    cacheSet(cacheKey, result)
    
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60',
        'X-Cache': 'MISS',
        'X-Response-Time': `${responseTime}ms`
      }
    })
  } catch (e: any) {
    const responseTime = Date.now() - startTime
    const errorMessage = e?.message || 'Error interno'
    const isTimeout = errorMessage.includes('timeout')
    
    console.error('[api/rag] Error after', responseTime, 'ms:', errorMessage)
    if (requestId) {
      console.error('[api/rag] Request ID:', requestId)
    }
    
    // Log stack trace in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/rag] Stack:', e?.stack)
    }
    
    const statusCode = isTimeout ? 504 : 500
    
    return NextResponse.json(
      {
        error: isTimeout ? 'Request timeout' : 'Error interno',
        message: errorMessage,
        requestId: requestId || undefined
      },
      {
        status: statusCode,
        headers: {
          'X-Response-Time': `${responseTime}ms`
        }
      }
    )
  }
} 