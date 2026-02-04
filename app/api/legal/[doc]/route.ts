import { NextResponse } from 'next/server'
import { getDisclaimer, getTerms, getPrivacy } from '@/lib/legal-docs'

const DOC_MAP = {
  disclaimer: getDisclaimer,
  terms: getTerms,
  privacy: getPrivacy
} as const

type DocKey = keyof typeof DOC_MAP

export const runtime = 'nodejs'

/**
 * GET /api/legal/disclaimer | /api/legal/terms | /api/legal/privacy
 * Devuelve el texto de documentación legal en plano o JSON según Accept.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ doc: string }> }
) {
  const { doc } = await params
  const key = doc as DocKey

  if (!(key in DOC_MAP)) {
    return NextResponse.json(
      { error: 'Not found', allowed: ['disclaimer', 'terms', 'privacy'] },
      { status: 404 }
    )
  }

  const text = DOC_MAP[key]()

  const accept = _request.headers.get('accept') || ''
  if (accept.includes('application/json')) {
    return NextResponse.json({ doc: key, text })
  }

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
