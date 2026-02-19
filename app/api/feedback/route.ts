import { NextRequest, NextResponse } from 'next/server'
import { logUserFeedback } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/feedback — Recibe feedback de usuarios sobre respuestas
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { queryLogId, userId, rating, comment } = body
    
    // Validar rating
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating debe ser un número entre 1 y 5' },
        { status: 400 }
      )
    }
    
    // Registrar feedback
    await logUserFeedback({
      queryLogId: queryLogId ? parseInt(queryLogId, 10) : undefined,
      userId,
      rating: parseInt(rating, 10),
      comment: comment || undefined
    })
    
    logger.info('User feedback received', { queryLogId, userId, rating })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error processing feedback', error)
    return NextResponse.json(
      { error: 'Error procesando feedback' },
      { status: 500 }
    )
  }
}
