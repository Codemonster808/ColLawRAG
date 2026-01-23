import { NextRequest, NextResponse } from 'next/server'

// Rate limiting store (in-memory)
// In production, consider using Redis or Vercel KV for distributed rate limiting
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
  const now = Date.now()
  const entry = rateLimitStore.get(clientId)
  
  if (!entry || now > entry.resetAt) {
    // Create new entry
    rateLimitStore.set(clientId, {
      count: 1,
      resetAt: now + windowMs
    })
    return true
  }
  
  if (entry.count >= limit) {
    return false
  }
  
  entry.count++
  return true
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
    const entry = rateLimitStore.get(clientId)
    const retryAfter = entry ? Math.ceil((entry.resetAt - Date.now()) / 1000) : 60
    
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
          'X-RateLimit-Reset': entry?.resetAt.toString() || (Date.now() + windowMs).toString()
        }
      }
    )
  }
  
  const entry = rateLimitStore.get(clientId)
  const remaining = entry ? Math.max(0, limit - entry.count) : limit - 1
  
  // Add rate limit headers to response
  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', limit.toString())
  response.headers.set('X-RateLimit-Remaining', remaining.toString())
  if (entry) {
    response.headers.set('X-RateLimit-Reset', entry.resetAt.toString())
  }
  
  return response
}

export const config = {
  matcher: '/api/:path*'
}
