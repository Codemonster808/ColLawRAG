/**
 * Utilidades para el sistema de tiers de ColLawRAG
 * 
 * Este archivo de ejemplo muestra cómo integrar el sistema de tiers
 * en el frontend. Copiar a lib/tier-utils.ts y adaptar según necesidad.
 */

import tierTexts from './ui-texts.json'

export type Tier = 'free' | 'premium'

export interface UserUsage {
  queries_today: number
  queries_this_month: number
  last_reset_daily: string
  last_reset_monthly: string
}

export interface User {
  id: string
  tier: Tier
  usage: UserUsage
  subscription_end?: string
}

export interface LimitCheck {
  limit: number
  used: number
  remaining: number
  exceeded: boolean
  resetTime?: string
  resetDate?: string
}

/**
 * Obtiene los límites de un tier específico
 */
export function getTierLimits(tier: Tier) {
  return tierTexts.tiers[tier].limits
}

/**
 * Verifica si el usuario ha excedido el límite diario
 */
export function checkDailyLimit(user: User): LimitCheck {
  const limits = getTierLimits(user.tier)
  const used = user.usage.queries_today
  const limit = limits.queries_per_day

  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    exceeded: used >= limit,
    resetTime: '00:00'
  }
}

/**
 * Verifica si el usuario ha excedido el límite mensual
 */
export function checkMonthlyLimit(user: User): LimitCheck {
  const limits = getTierLimits(user.tier)
  const used = user.usage.queries_this_month
  const limit = limits.queries_per_month

  // Calcular fecha de reinicio (mismo día del mes siguiente)
  const lastReset = new Date(user.usage.last_reset_monthly)
  const nextReset = new Date(lastReset)
  nextReset.setMonth(nextReset.getMonth() + 1)

  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    exceeded: used >= limit,
    resetDate: nextReset.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long'
    })
  }
}

/**
 * Verifica si el usuario tiene acceso a una funcionalidad
 */
export function hasFeatureAccess(user: User, feature: keyof typeof tierTexts.tiers.free.limits): boolean {
  const limits = getTierLimits(user.tier)
  return Boolean(limits[feature])
}

/**
 * Obtiene el mensaje de límite alcanzado apropiado
 */
export function getLimitReachedMessage(
  limitType: 'daily' | 'monthly',
  limitCheck: LimitCheck
) {
  const message = tierTexts.messages.limit_reached[limitType]

  return {
    title: message.title,
    message: message.message.replace('{limit}', limitCheck.limit.toString()),
    suggestion: message.suggestion,
    cta: message.cta,
    waitMessage: limitType === 'daily'
      ? message.wait_message.replace('{reset_time}', limitCheck.resetTime || '')
      : message.wait_message.replace('{reset_date}', limitCheck.resetDate || '')
  }
}

/**
 * Obtiene el mensaje de función bloqueada
 */
export function getLockedFeatureMessage(feature: 'vigencia' | 'jurisprudence' | 'export_pdf' | 'advanced_search') {
  const featureLocked = tierTexts.messages.limit_reached.feature_locked

  return {
    title: featureLocked.title,
    message: featureLocked.features[feature],
    cta: featureLocked.cta
  }
}

/**
 * Obtiene el mensaje de upgrade completo
 */
export function getUpgradeMessage() {
  return tierTexts.messages.upgrade
}

/**
 * Obtiene la comparación de planes
 */
export function getComparison() {
  return tierTexts.messages.comparison
}

/**
 * Obtiene el badge apropiado para un tier
 */
export function getTierBadge(tier: Tier) {
  return {
    ...tierTexts.messages.badge[tier],
    icon: tierTexts.tiers[tier].icon
  }
}

/**
 * Obtiene los casos de uso de un tier
 */
export function getUseCases(tier: Tier) {
  return tierTexts.use_cases[tier]
}

/**
 * Obtiene las preguntas frecuentes
 */
export function getFAQ() {
  return tierTexts.faq
}

/**
 * Obtiene los testimonios
 */
export function getTestimonials() {
  return tierTexts.testimonials
}

/**
 * Calcula el indicador de uso (para barras de progreso)
 */
export function getUsageIndicator(user: User, type: 'daily' | 'monthly'): {
  percentage: number
  label: string
  color: 'green' | 'yellow' | 'red'
} {
  const limitCheck = type === 'daily' ? checkDailyLimit(user) : checkMonthlyLimit(user)
  const percentage = (limitCheck.used / limitCheck.limit) * 100

  const tooltipMessage = tierTexts.messages.tooltips.usage_indicator
    .replace('{used}', limitCheck.used.toString())
    .replace('{limit}', limitCheck.limit.toString())
    .replace('{period}', type === 'daily' ? 'diarias' : 'mensuales')

  let color: 'green' | 'yellow' | 'red' = 'green'
  if (percentage >= 90) color = 'red'
  else if (percentage >= 70) color = 'yellow'

  return {
    percentage: Math.min(percentage, 100),
    label: tooltipMessage,
    color
  }
}

/**
 * Verifica si el usuario puede realizar una consulta
 */
export function canMakeQuery(user: User): {
  allowed: boolean
  reason?: 'daily_limit' | 'monthly_limit'
  message?: string
} {
  const dailyCheck = checkDailyLimit(user)
  const monthlyCheck = checkMonthlyLimit(user)

  if (dailyCheck.exceeded) {
    const message = getLimitReachedMessage('daily', dailyCheck)
    return {
      allowed: false,
      reason: 'daily_limit',
      message: message.message
    }
  }

  if (monthlyCheck.exceeded) {
    const message = getLimitReachedMessage('monthly', monthlyCheck)
    return {
      allowed: false,
      reason: 'monthly_limit',
      message: message.message
    }
  }

  return { allowed: true }
}

/**
 * Formatea el precio según el tier
 */
export function formatPrice(tier: Tier): string {
  const pricing = tierTexts.messages.comparison.pricing[tier]
  return `${pricing.price} / ${pricing.period}`
}

/**
 * Obtiene la descripción de un tier
 */
export function getTierDescription(tier: Tier): string {
  return tierTexts.tiers[tier].displayName
}

/**
 * Hook de ejemplo para React
 */
export function useTierCheck(user: User) {
  const dailyLimit = checkDailyLimit(user)
  const monthlyLimit = checkMonthlyLimit(user)
  const canQuery = canMakeQuery(user)
  const dailyUsage = getUsageIndicator(user, 'daily')
  const monthlyUsage = getUsageIndicator(user, 'monthly')

  return {
    tier: user.tier,
    limits: getTierLimits(user.tier),
    dailyLimit,
    monthlyLimit,
    canQuery,
    dailyUsage,
    monthlyUsage,
    hasFeatureAccess: (feature: keyof typeof tierTexts.tiers.free.limits) =>
      hasFeatureAccess(user, feature),
    getLockedFeatureMessage,
    getUpgradeMessage
  }
}

/**
 * Ejemplo de uso en un componente React
 */
/*
import { useTierCheck } from '@/lib/tier-utils'

export function QueryForm({ user }: { user: User }) {
  const tierCheck = useTierCheck(user)

  if (!tierCheck.canQuery.allowed) {
    return (
      <div className="limit-reached">
        <h2>{tierCheck.dailyLimit.exceeded ? 'Límite diario' : 'Límite mensual'} alcanzado</h2>
        <p>{tierCheck.canQuery.message}</p>
        <button onClick={handleUpgrade}>
          {tierCheck.getUpgradeMessage().cta_primary}
        </button>
      </div>
    )
  }

  return (
    <div>
      <UsageBar {...tierCheck.dailyUsage} />
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Tu consulta legal..." />
        <button type="submit">Consultar</button>
      </form>
    </div>
  )
}
*/

export default {
  getTierLimits,
  checkDailyLimit,
  checkMonthlyLimit,
  hasFeatureAccess,
  getLimitReachedMessage,
  getLockedFeatureMessage,
  getUpgradeMessage,
  getComparison,
  getTierBadge,
  getUseCases,
  getFAQ,
  getTestimonials,
  getUsageIndicator,
  canMakeQuery,
  formatPrice,
  getTierDescription
}
