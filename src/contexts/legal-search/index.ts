// legal-search bounded context — public API
// Application layer
export { runRagPipeline } from './application/use-cases/RunRagPipelineUseCase'
export type { RetrievalConfidenceLevel, RetrievalConfidence } from './application/use-cases/RunRagPipelineUseCase'

export {
  shouldUseRecursiveRag,
  runRecursiveRag,
} from './application/use-cases/RunRecursiveRagUseCase'
export type {
  RecursiveRagConfig,
  PartialResponse,
  RecursiveRagResult,
} from './application/use-cases/RunRecursiveRagUseCase'

// Domain services
export { retrieveRelevantChunks, filterChunksByVigencia } from './domain/services/RetrievalService'
export { rerankChunks } from './domain/services/RerankingService'
export { detectLegalArea, detectComplexity, calculateCitationPrecision } from './domain/services/QueryAnalyzerService'
export { expandQuery } from './domain/services/QueryExpansionService'
export { splitQuery } from './domain/services/QuerySplitterService'

// Domain value-objects
export {
  structureResponse,
  formatStructuredResponse,
  validateStructuredResponse,
} from './domain/value-objects/HnacStructure'
export type { StructuredResponse } from './domain/value-objects/HnacStructure'

// Infrastructure
export { generateAnswerSpanish } from './infrastructure/llm/GenerationService'
export { embedText, embedTexts } from './infrastructure/embeddings/EmbeddingService'
