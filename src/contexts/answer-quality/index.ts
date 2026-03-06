// answer-quality bounded context — public API
export {
  extractArticleReferences,
  verifyArticleInChunk,
  verifyNumberInChunks,
} from './domain/services/FactualValidatorService'
export type { FactualValidation } from './domain/services/FactualValidatorService'

export {
  extractCitationRefs,
  validateCitations,
  generateValidationReport,
} from './domain/services/CitationValidatorService'
export type {
  CitationValidation,
  EvaluationResult,
} from './domain/services/CitationValidatorService'

export {
  validateLogicCoherence,
  generateCoherenceFeedback,
} from './domain/services/LogicValidatorService'
export type {
  LogicValidationResult,
  Inconsistency,
} from './domain/services/LogicValidatorService'

export { compareSources } from './domain/services/SourceComparatorService'
export type {
  Contradiction,
  SourceComparisonResult,
} from './domain/services/SourceComparatorService'
