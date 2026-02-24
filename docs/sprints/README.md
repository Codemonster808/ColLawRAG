# Sprints de Mejora — ColLawRAG: de 32% a 90% accuracy

**Estado:** 32.7% accuracy (179 casos, 2026-02-19)  
**Objetivo:** ≥ 90% accuracy en respuestas sobre ley colombiana  
**Duración total:** 8 semanas (4 sprints de 2 semanas)

---

## Vista general

```
SPRINT 1 ──── "De roto a funcional" ──── Objetivo: 55-65%
  8 tareas │ Arreglar embeddings, probar modelos, A/B test
           │
SPRINT 2 ──── "Corpus viable" ────────── Objetivo: 70-75%
  7 tareas │ Expandir corpus, mapear vigencia, métricas retrieval
           │
SPRINT 3 ──── "Pipeline de calidad" ──── Objetivo: 80-85%
  7 tareas │ Chunking, BM25+RRF, reranking, prompts
           │
SPRINT 4 ──── "Producto comercial" ───── Objetivo: 85-90%
  6 tareas │ Abstención, confianza, citas, feedback
```

---

## Documentos de sprint

| Sprint | Documento | Tareas | Objetivo |
|--------|-----------|--------|----------|
| 1 | [`SPRINT_1_FUNDAMENTOS.md`](./SPRINT_1_FUNDAMENTOS.md) | 8 tareas (1.1 - 1.8) | 55-65% |
| 2 | [`SPRINT_2_CORPUS.md`](./SPRINT_2_CORPUS.md) | 7 tareas (2.1 - 2.7) | 70-75% |
| 3 | [`SPRINT_3_PIPELINE.md`](./SPRINT_3_PIPELINE.md) | 7 tareas (3.1 - 3.7) | 80-85% |
| 4 | [`SPRINT_4_PRODUCTO.md`](./SPRINT_4_PRODUCTO.md) | 6 tareas (4.1 - 4.6) | 85-90% |

---

## Cómo usar con un LLM

**Para cada sprint, darle al LLM:**

1. El documento del sprint completo (contiene todo el contexto necesario)
2. Decirle: "Ejecuta las tareas de este sprint en el orden indicado. Lee los archivos mencionados antes de modificarlos. Valida cada tarea según sus criterios antes de pasar a la siguiente."

**Reglas importantes:**
- Cada sprint es autocontenido — incluye contexto, archivos a leer, tareas con código, y validación
- NO saltar sprints — Sprint 1 debe completarse antes de Sprint 2
- Después de Sprint 1 y Sprint 3 hay re-indexación obligatoria (`node scripts/ingest.mjs`)
- Cada sprint termina con un benchmark para medir impacto real

---

## Resumen de todas las tareas (28 total)

### Sprint 1: Fundamentos (8 tareas)
| ID | Tarea | Tipo |
|----|-------|------|
| 1.1 | Unificar modelo de embeddings (ingest = query) | Código |
| 1.2 | Eliminar doble retrieval del pipeline | Código |
| 1.3 | Bloquear fake embeddings en producción | Código |
| 1.4 | Re-indexar corpus con embeddings correctos | Operación |
| 1.5 | Benchmarkear DeepSeek V3 | Evaluación |
| 1.6 | Integrar Groq (Llama 3.3 70B) | Código |
| 1.7 | A/B test: 7B vs DeepSeek vs Groq | Evaluación |
| 1.8 | Benchmark completo post-fix | Evaluación |

### Sprint 2: Corpus (7 tareas)
| ID | Tarea | Tipo |
|----|-------|------|
| 2.1 | Ingestar leyes laborales faltantes (~6) | Datos |
| 2.2 | Ingestar leyes otras áreas (~12) | Datos |
| 2.3 | Ingestar sentencias hito (~30) | Datos |
| 2.4 | Mapear vigencia de normas (→ 50+) | Datos |
| 2.5 | Re-indexar corpus expandido | Operación |
| 2.6 | Crear script evaluate-retrieval.mjs (Recall@K) | Código |
| 2.7 | Benchmark post-corpus | Evaluación |

### Sprint 3: Pipeline (7 tareas)
| ID | Tarea | Tipo |
|----|-------|------|
| 3.1 | Prefijo jerárquico en chunks | Código |
| 3.2 | Chunks de 2000 chars, corte por oraciones | Código |
| 3.3 | BM25 sobre corpus completo + RRF | Código |
| 3.4 | Recalibrar heurísticas de reranking | Código |
| 3.5 | Expandir ventana de contexto (12k-24k chars) | Código |
| 3.6 | Simplificar system prompt (< 350 tokens) | Código |
| 3.7 | Re-indexar + benchmark post-pipeline | Operación + Evaluación |

### Sprint 4: Producto (6 tareas)
| ID | Tarea | Tipo |
|----|-------|------|
| 4.1 | Abstención inteligente (umbral de confianza) | Código |
| 4.2 | Indicador de confianza en UI | Código (frontend) |
| 4.3 | Citas verificables con excerpt | Código |
| 4.4 | Feedback loop (thumbs up/down) | Código |
| 4.5 | Contexto enriquecido (vigencia en fuentes del LLM) | Código |
| 4.6 | Benchmark final comercial | Evaluación |

---

## Métricas de progreso

| Métrica | Baseline | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 |
|---------|----------|----------|----------|----------|----------|
| Accuracy | 32.7% | 55-65% | 70-75% | 80-85% | 85-90% |
| Corpus (docs) | 749 | 749 | 800+ | 800+ | 800+ |
| Corpus (chunks) | ~33k | ~33k | ~40k+ | ~35k* | ~35k |
| Recall@10 | ? | ? | ≥ 0.70 | ≥ 0.80 | ≥ 0.85 |
| Modelo | 7B | 70B+ | 70B+ | 70B+ | 70B+ |
| Abstención | 0% | 0% | 0% | 0% | 5-15% |
| Accuracy ajustado | — | — | — | — | ≥ 85% |

*Sprint 3 puede reducir chunks al usar chunks más grandes (2000 vs 1000 chars)

---

## Documentación de referencia

Los análisis detallados que fundamentan estos sprints están en:

- [`docs/mejoras/README_PLAN_MEJORAS.md`](../mejoras/README_PLAN_MEJORAS.md) — 10 cuellos de botella identificados
- [`docs/mejoras/PLAN_PRODUCTO_COMERCIAL.md`](../mejoras/PLAN_PRODUCTO_COMERCIAL.md) — Análisis de 3 dimensiones (corpus, modelo, producto)
- [`docs/mejoras/FASE_0_CORRECCIONES_CRITICAS.md`](../mejoras/FASE_0_CORRECCIONES_CRITICAS.md) a [`FASE_5_EVALUACION_Y_OBSERVABILIDAD.md`](../mejoras/FASE_5_EVALUACION_Y_OBSERVABILIDAD.md) — Diagnóstico técnico detallado por capa
- [`docs/bugs-resueltos/README.md`](../bugs-resueltos/README.md) — Bugs ya resueltos (no repetir)
