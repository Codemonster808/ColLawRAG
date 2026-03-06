import { NextRequest, NextResponse } from 'next/server'
import { logUserFeedback } from '@/contexts/identity/infrastructure/AuthService'
import { logger } from '@/shared/utils/Logger'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NEGATIVE_FEEDBACK_PATH = path.join(process.cwd(), 'data', 'eval', 'negative-feedback.jsonl')

/**
 * POST /api/feedback — Recibe feedback de usuarios sobre respuestas
 * Acepta:
 * - { requestId, vote: 'up'|'down' } — thumbs (S4.7 S4.8)
 * - { queryLogId, userId, rating: 1-5, comment? } — rating legacy
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { requestId, vote, queryLogId, userId, rating, comment } = body

    // S4.8: Formato thumbs (requestId + vote)
    if (requestId && (vote === 'up' || vote === 'down')) {
      if (vote === 'down') {
        try {
          const dir = path.dirname(NEGATIVE_FEEDBACK_PATH)
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }
          const line = JSON.stringify({
            requestId,
            vote: 'down',
            timestamp: new Date().toISOString()
          }) + '\n'
          fs.appendFileSync(NEGATIVE_FEEDBACK_PATH, line)
        } catch (e) {
          logger.warn('Could not append negative feedback', { requestId, error: (e as Error).message })
        }
      }
      logger.info('Thumbs feedback received', { requestId, vote })
      return NextResponse.json({ success: true })
    }

    // Formato legacy: rating 1-5
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating debe ser un número entre 1 y 5, o envíe requestId y vote (up/down)' },
        { status: 400 }
      )
    }

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
