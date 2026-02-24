# Diagnóstico de avance — ColLawRAG (payloads e ingest)

**Fecha:** 2026-02-26  
**Objetivo:** Reflejar el estado real del código para que Cursor/OpenClaw inicien trabajo desde el punto actual.

---

## Resumen ejecutivo

| Fase | Estado | Tareas hechas | Pendiente / siguiente |
|------|--------|----------------|------------------------|
| INICIO_TRABAJO | ✅ Completado | I1, I2, I3 | Ninguna → **siguiente: FASE_4** |
| FASE_0 | ✅ Completada | 0.1, 0.2, 0.3 | Ninguna |
| FASE_1 | ✅ Completada | 1.1, 1.2, 1.3, 1.4 | Ninguna |
| FASE_2 | ✅ Completada | 2.1, 2.2, 2.3, 2.4, 2.5 | Ninguna |
| FASE_3 | ✅ Completada | 3.1, 3.2, 3.3, 3.4 (reranking + retrieval vía I2) | Ninguna |
| FASE_4 | ⏸️ No iniciada | — | 4.1–4.5 (Cursor) |
| FASE_5 | 🚧 Parcial | 5.5 (OpenClaw 2026-02-24) | 5.1–5.4 (Cursor) |

---

## INICIO_TRABAJO — Completado

- **I1** Mejorar metadata.article en ingest: regex ampliado + `extractArticleFromText` en `scripts/ingest.mjs`. ✅
- **I2** applyRerankingWithCrossEncoder en retrieval cuando `RERANK_PROVIDER=hf`: en `lib/retrieval.ts`. ✅
- **I3** Re-ingest ejecutado: índices regenerados. ✅

**Siguiente payload:** FASE_4_GENERACION_Y_PROMPTS.toon

---

## FASE_0 — Completada

- 0.1 Unificar embeddings; 0.2 Eliminar doble retrieval; 0.3 Warnings y sin fake en prod. ✅

---

## FASE_1 — Completada

- 1.1 HNSW; 1.2 BM25 + RRF; 1.3 Query expansion; 1.4 Metadata boost. ✅

---

## FASE_2 — Completada

- **2.1** Prefijo jerárquico por chunk. ✅
- **2.2** Chunks por unidad semántica (splitArticleBySemanticUnits). ✅
- **2.3** isOverview en types + chunks resumen por ley y por título en ingest. ✅
- **2.4** Overlap por oraciones (OpenClaw). ✅
- **2.5** metadata.article (regex + fallback, vía INICIO_TRABAJO I1). ✅  
- Re-ingest ejecutado; índices actualizados.

---

## FASE_3 — Completada

- 3.1–3.4 en reranking.ts; 3.4 en retrieval (applyRerankingWithCrossEncoder cuando RERANK_PROVIDER=hf, hecho en I2). ✅

---

## FASE_4 — No iniciada (siguiente para Cursor)

- **generation.ts:** sigue MAX_CONTEXT_CHARS_BASE=4000, COMPLEX=8000 (objetivo 12k/24k).
- **prompt-templates:** sin reducir a ≤350 tokens.
- **Cursor** ejecuta 4.1–4.5; **OpenClaw** no tiene tareas en esta fase.

---

## FASE_5 — Parcial (OpenClaw 5.5 completada 2026-02-24)

- ✅ **5.5 (OpenClaw):** Scripts `full-diagnostic.mjs` y `compare-diagnostics.mjs` creados y validados
  - Diagnóstico por capa (retrieval/reranking/generation)
  - Identificación automática de cuello de botella
  - Comparación A/B de diagnósticos (before/after)
  - Output: `data/benchmarks/diagnostic-{timestamp}.json`
- ⏳ **Pendiente (Cursor 5.1-5.4):**
  - Sin chunks_esperados en dataset → 5.1 pendiente
  - Sin evaluate-retrieval.mjs → 5.2 pendiente
  - Sin tracing (lib/tracing.ts) → 5.3 pendiente
  - Juez LLM sin mejorar → 5.4 pendiente

---

## Orden recomendado para Cursor y OpenClaw

1. **Cursor:** payload **FASE_4_GENERACION_Y_PROMPTS.toon** (tareas 4.1–4.5).
2. **OpenClaw:** FASE_4 sin tareas asignadas → en espera o trabajar en documentación.
3. Después de FASE_4: **FASE_5** (Cursor 5.1–5.4). ✅ OpenClaw 5.5 YA COMPLETADA (2026-02-24).
