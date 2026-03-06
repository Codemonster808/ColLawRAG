// legal-knowledge bounded context — public API
// Domain services
export {
  loadNorma,
  consultarVigencia,
  inferNormaIdFromTitle,
} from './domain/services/NormVigenciaService'
export type {
  NormaVigencia,
  EstadoVigencia,
  DerogacionParcial,
  Modificacion,
} from './domain/services/NormVigenciaService'

export {
  extractNormsFromQuery,
  extractApplicableNorms,
} from './domain/services/NormExtractorService'
export type {
  ExtractedArticle,
  ApplicableNorm,
  NormExtractionResult,
} from './domain/services/NormExtractorService'

export { explainLegalHierarchy } from './domain/services/LegalHierarchyService'
export type { HierarchyExplanation } from './domain/services/LegalHierarchyService'

export {
  calculateCesantias,
  calculateVacaciones,
  calculatePrimaServicios,
  calculateIndemnizacionDespido,
} from './domain/services/LegalCalculatorService'
export type { CalculationResult } from './domain/services/LegalCalculatorService'

export {
  isProcedureRelatedQuery,
  getProcedureChunksForQuery,
} from './domain/services/ProceduresService'
