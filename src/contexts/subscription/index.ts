// subscription bounded context — public API
export {
  TIER_LIMITS,
  canMakeQuery,
  getTierLimits,
  hasFeature,
  getUserTier,
  checkUsageLimit,
  trackUsage,
  adjustQueryForTier,
} from './domain/services/TierService'
export type { UserTier, TierLimits } from './domain/services/TierService'

export { checkRateLimit } from './domain/services/RateLimitService'

export { stripe, STRIPE_PRICE_IDS, createCheckoutSession } from './infrastructure/StripeAdapter'
