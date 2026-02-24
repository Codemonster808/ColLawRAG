# Plan de Mejoras ColLawRAG — Ruta hacia alto accuracy en ley colombiana

**Fecha:** 2026-02-23  
**Proyecto:** ColLawRAG  
**Objetivo:** Llevar el accuracy del pipeline RAG a ≥85% en respuestas sobre legislación colombiana

---

## Diagnóstico: 10 cuellos de botella identificados

Tras analizar el código fuente de todos los archivos críticos del pipeline (`retrieval.ts`, `reranking.ts`, `embeddings.ts`, `generation.ts`, `rag.ts`, `bm25.ts`, `prompt-templates.ts`, `ingest.mjs`, `evaluate-accuracy.mjs`), se identificaron los siguientes cuellos de botella ordenados por impacto:

| # | Cuello de botella | Severidad | Capa afectada | Fase |
|---|-------------------|-----------|---------------|------|
| 1 | **Modelos de embeddings incompatibles entre ingest y query** — Ingest usa `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, query usa `Xenova/all-MiniLM-L6-v2` o `mpnet-base-v2`. Espacios vectoriales distintos = retrieval roto. | CRÍTICA | Embeddings | FASE 0 |
| 2 | **Doble retrieval en pipeline** — `rag.ts` ejecuta dos retrievals completos por query (uno "quick" para detectar complejidad). Duplica latencia sin beneficio. | ALTA | Pipeline | FASE 0 |
| 3 | **Fallback silencioso a embeddings aleatorios** — `fakeEmbed()` genera vectores pseudo-aleatorios sin warning. En producción con mala config, el retrieval es ruido puro. | ALTA | Embeddings | FASE 0 |
| 4 | **Búsqueda lineal O(n) sobre 33k chunks** — `cosineSimilarity` calculada contra cada chunk del índice. No hay ANN/HNSW. No escala. | ALTA | Retrieval | FASE 1 |
| 5 | **BM25 solo sobre resultados vectoriales** — BM25 puntúa únicamente chunks ya filtrados por vector, perdiendo documentos lexicalmente relevantes. | MEDIA | Retrieval | FASE 1 |
| 6 | **Peso híbrido 70/30 sin calibración** — `alpha=0.7` fijo. Para queries exactas (artículo X), BM25 debería pesar más. | MEDIA | Retrieval | FASE 1 |
| 7 | **Chunking por tamaño fijo corta artículos** — `splitLargeChunk(1000, 150)` divide artículos a la mitad sin contexto jerárquico. Chunks "huérfanos". | ALTA | Chunking | FASE 2 |
| 8 | **Reranking heurístico con boosts arbitrarios** — `hierarchyBoost` de hasta +0.60 hace que la Constitución domine TODO. Sin cross-encoder real. Normalización incorrecta del score. | ALTA | Reranking | FASE 3 |
| 9 | **Contexto limitado y modelos pequeños** — Solo 4000-8000 chars de contexto. Qwen-7B para razonamiento legal. System prompt de 700 tokens con duplicaciones. Hasta 3 regeneraciones HNAC. | MEDIA-ALTA | Generación | FASE 4 |
| 10 | **Evaluación ciega sin métricas por capa** — Solo mide resultado final. No hay Recall@K ni tracing. Juez de 7B trunca respuestas a 250 chars. No se sabe qué capa falla. | MEDIA | Evaluación | FASE 5 |

---

## Fases de mejora

### Orden de ejecución recomendado

```
FASE 0 ─────────────────────── [URGENTE, 1-2 días]
  │  Correcciones críticas: embeddings unificados, eliminar doble retrieval
  │
  ├── FASE 5 (en paralelo) ── [3-5 días]
  │     Evaluación: métricas por capa para medir impacto de cada cambio
  │
  ▼
FASE 1 ─────────────────────── [3-5 días]
  │  Retrieval: índice vectorial ANN, BM25 sobre corpus completo, RRF
  │
  ▼
FASE 2 ─────────────────────── [3-4 días]
  │  Chunking: segmentación semántica, prefijos jerárquicos, resúmenes
  │  (requiere re-ingest después)
  │
  ▼
FASE 3 ─────────────────────── [2-3 días]
  │  Reranking: cross-encoder real, heurísticas como señal secundaria
  │
  ▼
FASE 4 ─────────────────────── [3-4 días]
     Generación: contexto expandido, prompts optimizados, mejor modelo
```

**Nota:** FASE 5 (evaluación) puede ejecutarse en paralelo desde el inicio. Es la que permite medir el impacto real de cada fase.

---

### Documentos por fase

| Fase | Documento | Impacto estimado |
|------|-----------|-----------------|
| FASE 0 | [`FASE_0_CORRECCIONES_CRITICAS.md`](./FASE_0_CORRECCIONES_CRITICAS.md) | +15-25% accuracy |
| FASE 1 | [`FASE_1_RETRIEVAL_OPTIMIZADO.md`](./FASE_1_RETRIEVAL_OPTIMIZADO.md) | +10-20% accuracy, -80% latencia |
| FASE 2 | [`FASE_2_CHUNKING_SEMANTICO.md`](./FASE_2_CHUNKING_SEMANTICO.md) | +10-15% accuracy |
| FASE 3 | [`FASE_3_RERANKING_CROSS_ENCODER.md`](./FASE_3_RERANKING_CROSS_ENCODER.md) | +10-15% accuracy |
| FASE 4 | [`FASE_4_GENERACION_Y_PROMPTS.md`](./FASE_4_GENERACION_Y_PROMPTS.md) | +10-15% accuracy |
| FASE 5 | [`FASE_5_EVALUACION_Y_OBSERVABILIDAD.md`](./FASE_5_EVALUACION_Y_OBSERVABILIDAD.md) | Habilita medición iterativa |

**Impacto acumulado estimado:** +40-60% accuracy (no aditivo — hay interacciones entre capas)

---

## Estructura de cada documento

Cada documento de fase tiene el mismo formato para facilitar su uso por un LLM:

1. **Diagnóstico detallado** — Qué archivos están afectados, líneas exactas de código, evidencia concreta
2. **Tareas numeradas** — Cada tarea con:
   - Qué hacer (instrucciones paso a paso)
   - Opciones cuando las hay (A, B, C con pros/cons)
   - Validación (cómo verificar que la tarea se completó correctamente)
3. **Archivos a modificar/crear** — Tabla con archivo y acción
4. **Criterio de éxito** — Checklist de resultados medibles

---

## Cómo usar estos documentos

### Para un LLM (versión destilada → Sprints)

Los documentos de FASE son el análisis técnico detallado. Para ejecución por un LLM, usa los **Sprints** en [`docs/sprints/`](../sprints/README.md) — son la versión destilada con 28 tareas atómicas organizadas en 4 sprints autocontenidos.

### Para entender el diagnóstico (versión detallada → Fases)

Los documentos de FASE tienen el diagnóstico profundo con líneas de código exactas, opciones A/B/C, y justificación técnica. Útiles como referencia cuando un Sprint no queda claro.

**Importante:** Después de Sprint 1 y Sprint 3 se necesita re-indexar el corpus:
```bash
node scripts/ingest.mjs
npx tsx scripts/build-bm25.ts
```

---

## Métricas reales y objetivos

| Métrica | Estado actual REAL (benchmarks) | Objetivo pipeline (FASES 0-5) | Objetivo comercial |
|---------|-------------------------------|-------------------------------|-------------------|
| Accuracy general | **32.7%** (179 casos, 2026-02-19) | ≥ 65% | ≥ 90% |
| Retrieval Recall@5 | Desconocido (no se mide) | ≥ 0.80 | ≥ 0.90 |
| Precision normativa | ~3/10 (estimado) | ≥ 7/10 | ≥ 9/10 |
| Artículos correctos | ~3/10 (estimado) | ≥ 7/10 | ≥ 9/10 |
| Ausencia alucinaciones | ~5/10 (estimado) | ≥ 8/10 | ≥ 9.5/10 |
| Completitud | ~3/10 (estimado) | ≥ 7/10 | ≥ 8/10 |
| Corpus | 749 docs (< 2% leyes vigentes) | — | ≥ 2,000 docs |
| Modelo generación | 7B (gratis, alucina) | — | ≥ 70B o API comercial |
| Latencia end-to-end | ~10-30s | < 8s | < 5s |

**Nota:** Las FASES 0-5 solas no alcanzan el objetivo comercial. Ver [`PLAN_PRODUCTO_COMERCIAL.md`](./PLAN_PRODUCTO_COMERCIAL.md) para las 3 dimensiones adicionales: Corpus, Modelo y Producto.

---

## Plan de producto comercial

El documento [`PLAN_PRODUCTO_COMERCIAL.md`](./PLAN_PRODUCTO_COMERCIAL.md) cubre:
- **Dimensión 1 — Corpus**: El corpus actual (749 docs) cubre < 2% de las leyes colombianas vigentes. Lista priorizada de normas faltantes por área.
- **Dimensión 2 — Modelo**: Ruta de 7B gratis a modelos 70B+ con estimación de costos por query.
- **Dimensión 3 — Producto**: Abstención inteligente, citas verificables, indicador de confianza, feedback loop.
- **Roadmap de 4 sprints**: De 32% a 90% en 8 semanas con tareas priorizadas.
- **Estimación de costos** y modelo de precios para suscripciones.
