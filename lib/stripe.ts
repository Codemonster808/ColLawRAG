/**
 * Stripe Configuration and Helpers (CU-05)
 * Checkout sessions + webhook para actualizar tier del usuario.
 */

import Stripe from 'stripe'
import { updateUserTier } from './auth'

const secretKey = process.env.STRIPE_SECRET_KEY

export const stripe =
  typeof secretKey === 'string' && secretKey.startsWith('sk_')
    ? new Stripe(secretKey, { apiVersion: '2024-11-20.acacia' })
    : null

/** Price IDs desde Stripe Dashboard (variables de entorno) */
export const STRIPE_PRICE_IDS = {
  premium: process.env.STRIPE_PREMIUM_PRICE_ID || '',
  pro: process.env.STRIPE_PRO_PRICE_ID || '',
} as const

const baseUrl =
  process.env.NEXTAUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  'http://localhost:3000'

/**
 * Crea una sesión de checkout de Stripe para suscripción mensual.
 */
export async function createCheckoutSession(
  userId: string,
  plan: 'premium' | 'pro',
  customerEmail?: string
): Promise<{ sessionId: string; url: string }> {
  if (!stripe) {
    throw new Error('STRIPE_SECRET_KEY no está configurado')
  }
  const priceId = STRIPE_PRICE_IDS[plan]
  if (!priceId) {
    throw new Error(`STRIPE_${plan.toUpperCase()}_PRICE_ID no está configurado. Crea el precio en Stripe Dashboard.`)
  }

  const session = await stripe.checkout.sessions.create({
    customer_email: customerEmail || undefined,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing`,
    metadata: { userId, plan },
    subscription_data: {
      metadata: { userId, plan },
    },
  })

  if (!session.url) {
    throw new Error('Stripe no devolvió URL de checkout')
  }
  return { sessionId: session.id, url: session.url }
}

/**
 * Procesa eventos del webhook de Stripe y actualiza el tier del usuario.
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      const plan = session.metadata?.plan as 'premium' | undefined
      if (userId && (plan === 'premium' || plan === 'pro')) {
        await updateUserTier(userId, plan)
      }
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.userId
      if (userId) await updateUserTier(userId, 'free')
      break
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.userId
      if (userId) {
        const tier =
          subscription.status === 'active'
            ? (subscription.metadata?.plan as 'premium' | 'pro')
            : 'free'
        await updateUserTier(userId, tier === 'premium' || tier === 'pro' ? tier : 'free')
      }
      break
    }
    default:
      break
  }
}
