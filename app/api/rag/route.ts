import { NextRequest, NextResponse } from 'next/server'
import { runRagPipeline } from '@/lib/rag'
import { RagBodySchema } from './schema'
import { getUserTier, checkUsageLimit, trackUsage, adjustQueryForTier } from '@/lib/tiers'
import { authenticateUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

// Cache persistente usando SQLite (puede fallback a memoria si falla)
export const runtime = 'nodejs'

// Timeout configuration
const PIPELINE_TIMEOUT_MS = parseInt(process.env.PIPELINE_TIMEOUT_MS || '60000', 10) // 60 seconds default
const MAX_REQUEST_SIZE = parseInt(process.env.MAX_REQUEST_SIZE || '1048576', 10) // 1MB default

// Cache persistente usando SQLite (puede fallback a memoria si falla)
// Nota: En Next.js, las importaciones dinámicas en top-level pueden causar problemas
// Usamos importación estática con try-catch en la función
let cacheGet: (key: string) => any | undefined
let cacheSet: (key: string, value: any) => void

// Inicializar cache (fallback a memoria si SQLite falla)
const CACHE_TTL_MS = 60 * 1000
const cache = new Map<string, { value: any; expiresAt: number }>()

function initCache() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const persistentCache = require('@/lib/cache-persistent')
    cacheGet = persistentCache.cacheGet
    cacheSet = persistentCache.cacheSet
  } catch (error) {
    console.warn('[api/rag] Cache persistente no disponible, usando memoria:', error)
    // Fallback a cache en memoria
    cacheGet = (key: string) => {
      const entry = cache.get(key)
      if (!entry) return undefined
      if (Date.now() > entry.expiresAt) {
        cache.delete(key)
        return undefined
      }
      return entry.value
    }
    cacheSet = (key: string, value: any) => {
      cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
    }
  }
}

// Inicializar al cargar el módulo
initCache()

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
  let userId: string | undefined
  let userTier: 'free' | 'premium' = 'free'
  let queryText = ''
  
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

    logger.logRequest('POST', '/api/rag')
    logger.debug('Provider configuration', {
      GEN_PROVIDER: process.env.GEN_PROVIDER,
      OLLAMA_MODEL: process.env.OLLAMA_MODEL,
      EMB_PROVIDER: process.env.EMB_PROVIDER
    })
    
    // Autenticación y autorización
    
    // 1. Verificar API key (si está configurada)
    // Nota: Las requests del mismo origen (frontend en el mismo dominio) no requieren API key
    // La API key solo se requiere para requests externas (APIs de terceros)
    if (process.env.RAG_API_KEY) {
      const origin = req.headers.get('origin')
      const referer = req.headers.get('referer')
      
      // Detectar si es request del mismo origen:
      // - No hay origin header (request del mismo origen en navegador)
      // - Origin coincide con el servidor
      // - Referer indica que viene del mismo dominio
      let isSameOrigin = false
      try {
        if (origin === null) {
          // No hay origin header = request del mismo origen
          isSameOrigin = true
        } else if (origin) {
          const originUrl = new URL(origin)
          isSameOrigin = originUrl.origin === req.nextUrl.origin
        }
        
        // Si no se detectó por origin, verificar referer
        if (!isSameOrigin && referer) {
          try {
            const refererUrl = new URL(referer)
            isSameOrigin = refererUrl.origin === req.nextUrl.origin
          } catch {
            // Referer inválido, ignorar
          }
        }
      } catch {
        // Error al parsear URLs, asumir que no es mismo origen
        isSameOrigin = false
      }
      
      // Si es request externa (no mismo origen), requerir API key
      if (!isSameOrigin) {
        const headerKey = req.headers.get('x-api-key')
        if (headerKey !== process.env.RAG_API_KEY) {
          logger.warn('Unauthorized request - invalid API key', {
            origin: req.headers.get('origin')
          })
          return NextResponse.json(
            { error: 'No autorizado', message: 'Invalid API key' },
            { status: 401 }
          )
        }
      }
      // Si hay API key válida o es mismo origen, tratar como usuario premium
      userTier = 'premium'
    }
    
    // 2. Verificar autenticación de usuario (si hay header de usuario)
    const userHeader = req.headers.get('x-user-id')
    if (userHeader) {
      const user = authenticateUser(userHeader)
      if (user) {
        userId = user.id
        userTier = getUserTier(userId)
      }
    }
    
    // 3. Verificar límites de uso ANTES de ejecutar el pipeline (solo si hay userId)
    if (userId) {
      const usageCheck = checkUsageLimit(userTier, userId)
      if (!usageCheck.allowed) {
        logger.warn('Usage limit exceeded', { userId, userTier })
        return NextResponse.json(
          { 
            error: 'Límite de uso excedido', 
            message: usageCheck.reason 
          },
          { status: 429 }
        )
      }
    }

    // Parse and validate request body
    let json: any
    try {
      json = await req.json()
    } catch (parseError) {
      logger.error('JSON parse error', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON', message: 'Request body must be valid JSON' },
        { status: 400 }
      )
    }

    const parsed = RagBodySchema.safeParse(json)
    if (!parsed.success) {
      logger.warn('Validation error', { errors: parsed.error.flatten() })
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
    logger.info('Request body parsed', { 
      queryLength: query?.length || 0, 
      filters, 
      locale, 
      userTier 
    })
    
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
      logger.info('Cache hit', { requestId })
      const responseTime = Date.now() - startTime
      
      // Trackear uso incluso para cache hits (para métricas de uso)
      if (userId) {
        trackUsage(userId, userTier, queryText, responseTime, true)
      }
      
      logger.logResponse('POST', '/api/rag', 200, responseTime, { requestId, cached: true })
      return NextResponse.json(
        { ...cached, cached: true },
        { 
          headers: { 
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60',
            'X-Cache': 'HIT',
            'X-Response-Time': `${responseTime}ms`
          } 
        }
      )
    }

    // Execute pipeline with timeout y parámetros ajustados por tier
    logger.info('Executing pipeline', { 
      timeout: PIPELINE_TIMEOUT_MS, 
      tier: userTier 
    })
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
    
    // Trackear uso después de consulta exitosa
    if (userId) {
      trackUsage(userId, userTier, queryText, responseTime, true)
    }
    
    logger.logMetric('rag_response_time', responseTime, 'ms', { requestId, userTier })
    logger.logResponse('POST', '/api/rag', 200, responseTime, { 
      requestId, 
      userId, 
      userTier,
      retrieved: result.retrieved,
      citationsCount: result.citations.length
    })

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
    
    // Trackear uso incluso en caso de error (para métricas)
    if (userId) {
      const json = await req.clone().json().catch(() => ({}))
      const queryText = json?.query || 'error'
      trackUsage(userId, userTier, queryText, responseTime, false)
    }
    
    logger.error('Pipeline error', e, { 
      requestId, 
      responseTime, 
      userId, 
      userTier,
      isTimeout 
    })
    
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