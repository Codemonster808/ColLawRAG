import { NextRequest, NextResponse } from 'next/server'

// Rate limiting persistente usando SQLite (puede fallback a memoria si falla)
let checkRateLimitPersistent: (clientId: string, limit: number, windowMs: number) => any

// Fallback a rate limiting en memoria
interface RateLimitEntry {
  count: number
  resetAt: number
}
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

function initRateLimit() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rateLimitModule = require('@/lib/rate-limit-persistent')
    checkRateLimitPersistent = rateLimitModule.checkRateLimit
  } catch (error) {
    console.warn('[middleware] Rate limiting persistente no disponible, usando memoria:', error)
    // Fallback a rate limiting en memoria
    checkRateLimitPersistent = (clientId: string, limit: number, windowMs: number) => {
      const now = Date.now()
      const entry = rateLimitStore.get(clientId)
      
      if (!entry || now > entry.resetAt) {
        rateLimitStore.set(clientId, {
          count: 1,
          resetAt: now + windowMs
        })
        return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
      }
      
      if (entry.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: entry.resetAt,
          retryAfter: Math.ceil((entry.resetAt - now) / 1000)
        }
      }
      
      entry.count++
      return {
        allowed: true,
        remaining: limit - entry.count,
        resetAt: entry.resetAt
      }
    }
  }
}

// Inicializar al cargar el módulo
initRateLimit()

function getClientId(req: NextRequest): string {
  // Try to get IP from various headers (Vercel, Cloudflare, etc.)
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  const realIp = req.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  // Fallback to a default (shouldn't happen in production)
  return 'unknown'
}

function checkRateLimit(clientId: string, limit: number, windowMs: number): boolean {
  const result = checkRateLimitPersistent(clientId, limit, windowMs)
  return result.allowed
}

export function middleware(req: NextRequest) {
  // Only apply rate limiting to API routes
  if (!req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }
  
  // Skip rate limiting for health check endpoint
  if (req.nextUrl.pathname === '/api/health') {
    return NextResponse.next()
  }
  
  const clientId = getClientId(req)
  
  // Rate limit: 10 requests per minute per IP
  const limit = parseInt(process.env.RATE_LIMIT_REQUESTS || '10', 10)
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10)
  
  const allowed = checkRateLimit(clientId, limit, windowMs)
  
  if (!allowed) {
    const result = checkRateLimitPersistent(clientId, limit, windowMs)
    const retryAfter = result.retryAfter || 60
    
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded', 
        message: `Too many requests. Please try again in ${retryAfter} seconds.`,
        retryAfter 
      },
      { 
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetAt.toString()
        }
      }
    )
  }
  
  const result = checkRateLimitPersistent(clientId, limit, windowMs)
  
  // Add rate limit headers to response
  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', limit.toString())
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', result.resetAt.toString())
  
  return response
}

export const config = {
  matcher: '/api/:path*'
}
