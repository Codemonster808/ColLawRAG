import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'

/**
 * GET /api/stripe/session?session_id=cs_xxx
 * Devuelve el plan de una sesión de checkout completada (para la página /success).
 */
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('session_id')
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id requerido' }, { status: 400 })
    }

    if (!stripe) {
      return NextResponse.json({ plan: null, message: 'Stripe no configurado' })
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })
    const plan = (session.metadata?.plan as string) || null
    return NextResponse.json({ plan, payment_status: session.payment_status })
  } catch (error) {
    console.error('Error retrieving Stripe session:', error)
    return NextResponse.json(
      { error: 'Sesión no encontrada', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 400 }
    )
  }
}
