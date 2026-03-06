/**
 * Integración tipo RAGAS para métricas de evaluación RAG (Fase 1.2).
 *
 * Métricas objetivo: faithfulness, answer_relevancy, context_recall, context_precision.
 * Esta implementación deriva proxies desde el reporte del juez LLM (evaluate-accuracy).
 * Para métricas completas con LLM separado o NLI, ver docs/ANALISIS_APLICABILIDAD_PLAN_OPTIMIZACION_2026-02.md
 * o integrar @ikrigel/ragas-lib-typescript.
 */

export interface RagasStyleMetrics {
  /** Proxy: 1 - (alucinaciones detectadas); basado en ausencia_alucinaciones del juez */
  faithfulness: number
  /** Proxy: promedio de precisión normativa + completitud del juez (relevancia de la respuesta) */
  answer_relevancy: number
  /** Requiere contexto recuperado; aquí 0 si no se provee */
  context_recall: number | null
  /** Requiere contexto recuperado; aquí 0 si no se provee */
  context_precision: number | null
  /** Promedio de las métricas disponibles (sin null) */
  overall: number
}

export interface EvaluacionResult {
  evaluacion?: {
    score_total?: number
    precision_normativa?: number
    articulos_correctos?: number
    interpretacion_valida?: number
    completitud?: number
    ausencia_alucinaciones?: number
    alucinaciones?: string[]
  }
  error?: string
}

/**
 * Calcula métricas estilo RAGAS a partir de resultados detallados del benchmark.
 * faithfulness: proxy desde ausencia_alucinaciones (0-10 → 0-1).
 * answer_relevancy: promedio de (precision_normativa + completitud) / 10.
 * context_recall / context_precision: null si no se pasa contextChunks (el API actual no los devuelve en el benchmark).
 */
export function computeRagasFromReport(
  resultadosDetallados: EvaluacionResult[],
  _contextChunks?: Array<{ content: string }>
): RagasStyleMetrics {
  const valid = resultadosDetallados.filter((r) => r.evaluacion && !r.error)
  if (valid.length === 0) {
    return {
      faithfulness: 0,
      answer_relevancy: 0,
      context_recall: null,
      context_precision: null,
      overall: 0,
    }
  }

  const faithfulnessScores = valid.map(
    (r) => (r.evaluacion!.ausencia_alucinaciones ?? 0) / 10
  )
  const faithfulness =
    faithfulnessScores.reduce((a, b) => a + b, 0) / faithfulnessScores.length

  const relevancyScores = valid.map((r) => {
    const p = (r.evaluacion!.precision_normativa ?? 0) / 10
    const c = (r.evaluacion!.completitud ?? 0) / 10
    return (p + c) / 2
  })
  const answer_relevancy =
    relevancyScores.reduce((a, b) => a + b, 0) / relevancyScores.length

  const context_recall = _contextChunks ? null : null
  const context_precision = _contextChunks ? null : null

  const available = [faithfulness, answer_relevancy]
  const overall =
    available.reduce((a, b) => a + b, 0) / available.length

  return {
    faithfulness: Math.round(faithfulness * 100) / 100,
    answer_relevancy: Math.round(answer_relevancy * 100) / 100,
    context_recall: context_recall ?? null,
    context_precision: context_precision ?? null,
    overall: Math.round(overall * 100) / 100,
  }
}

/**
 * Añade la sección ragas_style a un reporte generado por evaluate-accuracy.
 * Uso: después de generateReport(results), llamar addRagasToReport(report).
 */
export function addRagasToReport(report: {
  resultados_detallados?: EvaluacionResult[]
  error?: string
  [key: string]: unknown
}): void {
  if (report.error || !report.resultados_detallados?.length) return
  const ragas = computeRagasFromReport(report.resultados_detallados)
  ;(report as Record<string, unknown>).ragas_style = ragas
}
