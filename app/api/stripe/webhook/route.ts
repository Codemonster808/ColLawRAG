import { NextRequest, NextResponse } from 'next/server'
import { stripe, handleWebhookEvent } from '@/lib/stripe'
import Stripe from 'stripe'

export const runtime = 'nodejs'

/**
 * POST /api/stripe/webhook
 * Recibe eventos de Stripe (checkout.session.completed, customer.subscription.*).
 * Verifica la firma con STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET no está configurado')
      return NextResponse.json(
        { error: 'Webhook no configurado' },
        { status: 500 }
      )
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe no está configurado' },
        { status: 500 }
      )
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid signature'
      console.error('Webhook signature verification failed:', msg)
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    await handleWebhookEvent(event)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error procesando webhook de Stripe:', error)
    return NextResponse.json(
      {
        error: 'Error procesando webhook',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
