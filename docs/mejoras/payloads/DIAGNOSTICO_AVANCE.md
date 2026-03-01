# Diagnóstico de avance — ColLawRAG (payloads e ingest)

**Fecha:** 2026-02-26  
**Actualizado:** 2026-02-25 (post diagnóstico SPRINTS vs FASES)  
**Objetivo:** Reflejar el estado real del código para que Cursor/OpenClaw sepan qué está hecho y qué queda.

---

## Resumen ejecutivo

| Fase | Estado | Tareas hechas | Pendiente / siguiente |
|------|--------|----------------|------------------------|
| INICIO_TRABAJO | ✅ Completado | I1, I2, I3 | Ninguna |
| FASE_0 | ✅ Completada | 0.1, 0.2, 0.3 | Ninguna |
| FASE_1 | ✅ Completada | 1.1, 1.2, 1.3, 1.4 | Ninguna |
| FASE_2 | ✅ Completada | 2.1, 2.2, 2.3, 2.4, 2.5 | Ninguna |
| FASE_3 | ✅ Completada | 3.1, 3.2, 3.3, 3.4 | Ninguna |
| FASE_4 | ✅ Completada | 4.1, 4.2, 4.3, 4.4, 4.5 (Cursor) | Ninguna |
| FASE_5 | ✅ Completada | 5.1–5.4 (Cursor), 5.5 (OpenClaw) | Ninguna |

**Todas las FASES están cerradas. El trabajo pendiente está en los SPRINTS (ver abajo).**

---

## Asignación por agente (referencia FASES)

| Agente | Fases / tareas que ejecutó | Payload asociado |
|--------|----------------------------|------------------|
| **Cursor** | INICIO I1,I3; FASE_4 4.1–4.5; FASE_5 5.1–5.4 | INICIO_TRABAJO.toon, FASE_4_GENERACION_Y_PROMPTS.toon, FASE_5_EVALUACION_Y_OBSERVABILIDAD.toon |
| **OpenClaw** | INICIO I2; FASE_2 2.4; FASE_5 5.5 | INICIO_TRABAJO.toon, FASE_2 (2.4), FASE_5 (5.5) |

---

## INICIO_TRABAJO — Completado

- **I1 (Cursor):** Mejorar metadata.article en ingest (regex, extractArticleFromText, resúmenes por ley/título). ✅
- **I2 (OpenClaw):** applyRerankingWithCrossEncoder en retrieval cuando `RERANK_PROVIDER=hf`. ✅
- **I3 (Cursor):** Re-ingest; índices regenerados. ✅

---

## FASE_0 — Completada

- 0.1 Unificar embeddings; 0.2 Eliminar doble retrieval; 0.3 Warnings y sin fake en prod. ✅

---

## FASE_1 — Completada

- 1.1 HNSW; 1.2 BM25 + RRF; 1.3 Query expansion; 1.4 Metadata boost. ✅

---

## FASE_2 — Completada

- 2.1–2.3, 2.5 (Cursor); 2.4 (OpenClaw). Re-ingest e índices actualizados. ✅

---

## FASE_3 — Completada

- 3.1–3.4 reranking + retrieval (applyRerankingWithCrossEncoder vía I2). ✅

---

## FASE_4 — Completada (Cursor)

- **4.1** MAX_CONTEXT 12k base, 24k complejo, 12k media. ✅
- **4.2** System prompt ≤350 tokens; ejemplo HNAC corto; advertencias en user prompt. ✅
- **4.3** Modelo primario 72B/API documentado; fallback 7B (sin 3B). .env.example actualizado. ✅
- **4.4** Máximo 1 regeneración HNAC; ejemplo con secciones claras. ✅
- **4.5** Fuentes con VIGENTE/DEROGADO, jerarquía, score en lib/generation.ts. ✅

---

## FASE_5 — Completada (Cursor 5.1–5.4; OpenClaw 5.5)

- **5.1 (Cursor):** API `/api/retrieval` + script `annotate-retrieval-ground-truth.mjs`; dataset con `chunks_esperados` al ejecutar el script con servidor. ✅
- **5.2 (Cursor):** `evaluate-retrieval.mjs` con Recall@K, Precision@K, MRR, NDCG@K. ✅
- **5.3 (Cursor):** `lib/tracing.ts` (PipelineTrace, TraceStep); integración en `lib/rag.ts`; GET `/api/debug/trace?requestId=`. ✅
- **5.4 (Cursor):** Juez 14B por defecto; respuestas hasta 1500 chars; criterio `relevancia_contexto`; max_tokens 500. ✅
- **5.5 (OpenClaw):** `full-diagnostic.mjs` y `compare-diagnostics.mjs` (2026-02-24). ✅

---

## Qué usar para Cursor vs OpenClaw

- **Cursor:** Usar payloads de SPRINT. Siguiente: `SPRINT_1_FUNDAMENTOS.toon` (tareas S1.5-S1.12).
- **OpenClaw:** Puede ejecutar tareas ligeras de Sprint 2 (descarga/formateo docs) o Sprint 4 (UI).

---

## Payloads de SPRINT (plan ejecutable — 2026-02-25)

Diagnóstico post-FASES reveló que accuracy bajó a 29.6% (de 32.7% baseline). Las FASES optimizaron el pipeline pero no abordaron: modelos 70B+, corpus expandido, vigencia, ground truth, features de producto.

Se crearon 4 payloads de SPRINT con tareas granulares:

| Sprint | Payload | Tareas total | Pendientes | Objetivo |
|--------|---------|-------------|------------|----------|
| Sprint 1 | `SPRINT_1_FUNDAMENTOS.toon` | 12 | 8 | 55-65% (investigar regresión, Groq, A/B test) |
| Sprint 2 | `SPRINT_2_CORPUS.toon` | 16 | 16 | 70-75% (18+ leyes, 30 sentencias, vigencia, ground truth) |
| Sprint 3 | `SPRINT_3_PIPELINE.toon` | 13 | 5 | 80-85% (limpiar chunks, verificar vigencia, benchmark) |
| Sprint 4 | `SPRINT_4_PRODUCTO.toon` | 15 | 15 | 85-90% (abstención, confianza, citas, feedback) |

**Total tareas pendientes: 44 de 56.**

### Brechas críticas identificadas en diagnóstico

| Brecha | Dato | Sprint que la resuelve |
|--------|------|----------------------|
| Accuracy regresión | 32.7% → 29.6% | Sprint 1 (S1.5 investigar) |
| Sin modelo 70B+ activo | Solo 7B en benchmarks | Sprint 1 (S1.6-S1.9 Groq/DeepSeek) |
| Corpus sin expandir | 751 docs (< 2% leyes vigentes) | Sprint 2 (S2.1-S2.8) |
| Vigencia 0% | 16430 chunks sin vigencia | Sprint 2 (S2.9-S2.11) |
| Ground truth 0 casos | evaluate-retrieval inutilizable | Sprint 2 (S2.13) |
| 2010 chunks tiny | < 200 chars (ruido) | Sprint 3 (S3.9) |
| Sin abstención | Siempre responde (alucinaciones) | Sprint 4 (S4.1-S4.3) |
| Sin features producto | No hay confianza, citas, feedback | Sprint 4 (S4.6-S4.12) |

Para iniciar trabajo: usar `SPRINT_1_FUNDAMENTOS.toon` con `PROMPT_LLM.md` opción 1 o 5.
