// identity bounded context — public API
export {
  createUser,
  getUser,
  authenticateUser,
  updateUserTier,
  logQuery,
  logQualityMetrics,
  getUserStats,
  getQueryLogs,
  assignABTestVariant,
  logABTest,
} from './infrastructure/AuthService'
export type { User } from './infrastructure/AuthService'
