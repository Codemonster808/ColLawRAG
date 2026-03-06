import { NextRequest, NextResponse } from 'next/server'

// Middleware corre en Edge Runtime: no se puede usar SQLite (rate-limit-persistent).
// Usamos solo rate limiting en memoria (por instancia; suficiente para MVP).
interface RateLimitEntry {
  count: number
  resetAt: number
}
const rateLimitStore = new Map<string, RateLimitEntry>()

function checkRateLimitInMemory(
  clientId: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number; retryAfter?: number } {
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

function getClientId(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  return 'unknown'
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
  const limit = parseInt(process.env.RATE_LIMIT_REQUESTS || '10', 10)
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10)

  const result = checkRateLimitInMemory(clientId, limit, windowMs)

  if (!result.allowed) {
    const retryAfter = result.retryAfter ?? 60
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

  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', limit.toString())
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', result.resetAt.toString())
  return response
}

export const config = {
  matcher: '/api/:path*'
}
