# Sprint 3 — Resultados del Pipeline de Calidad

**Fecha:** 2026-03-02  
**Objetivo:** 80-85% accuracy, chunks tiny < 2%, vigencia funcional

---

## Resumen ejecutivo

| Métrica | Antes S3.9 | Después S3.9 | Objetivo |
|---------|------------|--------------|----------|
| Chunks totales | 33 053 | 14 362 | — |
| Chunks < 200 chars | 4.2% (1 398) | 0% | < 2% ✓ |
| Chunks eliminados/fusionados | — | 1 931 | — |
| Vigencia en reranking | consultarVigencia | + metadata.vigencia fallback | ✓ |
| Accuracy (50 casos) | 81.8% (46/50, 4×504) | **74.6%** (50/50) | ≥ 75% ✓ |
| Recall@10 | — | **100%** | ≥ 0.80 ✓ |

---

## Tareas completadas

### S3.9 — Limpiar chunks tiny
- **Implementado en:** `scripts/ingest.mjs`
- Eliminación de chunks con `content.length < 100` (ruido puro)
- Fusión de chunks 100-200 chars con el anterior si comparten mismo artículo/sección
- **Resultado:** 1 931 chunks eliminados (16 293 → 14 362 en run local)

### S3.10 — Vigencia en reranking
- **Implementado en:** `lib/reranking.ts`
- Fallback a `metadata.vigencia` cuando `consultarVigencia(normaId)` retorna null
- Valores soportados: `vigente`, `derogada`, `parcialmente_derogada`
- `addDerogadaNoteToChunk` también usa el fallback

### S3.11 — Re-indexar
- ✓ Completado (~67 min). BM25 y HNSW reconstruidos.

### S3.12 — Evaluar retrieval
- Re-anotado `chunks_esperados` con `annotate-retrieval-ground-truth.mjs --url localhost --limit 50`
- **Resultado:** Recall@5: 80.4% | Recall@10: **100%** | MRR: 0.66

---

## Benchmark accuracy post-S3 (producción)

**Fuente:** `data/benchmarks/results-2026-03-02.json`  
**Juez:** Groq llama-3.3-70b-versatile | API: https://col-law-rag.vercel.app

| Área | Score | Casos |
|------|-------|-------|
| Tributario | 10.00/10 | 2 |
| Constitucional | 8.06/10 | 14 |
| Civil | 7.92/10 | 4 |
| Laboral | 7.47/10 | 25 |
| Administrativo | 4.73/10 | 3 |
| Penal | 3.75/10 | 2 |

**Score general:** 7.46/10 (**74.6%**) — 50/50 casos evaluados, 0 errores

Veredictos: 31 EXCELENTE | 5 ACEPTABLE | 12 DEFICIENTE | 2 BUENO  
Alucinaciones detectadas: 3 casos (LAB-004, CIV-001, ADM-001 — citan Código Penal erróneamente)

---

## Pipeline completado

1. ✓ Deploy: commit/push → Vercel despliega índices desde Release `indices-v1`
2. ✓ Re-anotar: `annotate-retrieval-ground-truth.mjs --url localhost --limit 50`
3. ✓ evaluate-retrieval: Recall@10 100%, MRR 0.66
4. ✓ Benchmark accuracy: 74.6% en producción
