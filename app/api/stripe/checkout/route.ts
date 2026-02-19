import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { createCheckoutSession } from '@/lib/stripe'

export const runtime = 'nodejs'

/**
 * POST /api/stripe/checkout
 * Crea una sesión de checkout de Stripe para suscripción (premium o pro).
 * Requiere sesión de NextAuth.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const plan = body.plan as string

    if (!plan || (plan !== 'premium' && plan !== 'pro')) {
      return NextResponse.json(
        { error: 'Plan inválido. Debe ser "premium" o "pro"' },
        { status: 400 }
      )
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Debes iniciar sesión para suscribirte', message: 'Inicia sesión en /login' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const customerEmail = session.user.email ?? undefined

    try {
      const { sessionId, url } = await createCheckoutSession(
        userId,
        plan as 'premium' | 'pro',
        customerEmail
      )
      return NextResponse.json({ sessionId, url })
    } catch (checkoutError) {
      const msg = checkoutError instanceof Error ? checkoutError.message : 'Error al crear checkout'
      if (msg.includes('no está configurado') || msg.includes('PRICE_ID')) {
        return NextResponse.json(
          { error: 'Stripe no configurado', message: 'Configura STRIPE_SECRET_KEY y los Price IDs en el servidor.' },
          { status: 503 }
        )
      }
      throw checkoutError
    }
  } catch (error) {
    console.error('Error creando checkout session:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Error al crear sesión de checkout', message },
      { status: 500 }
    )
  }
}
