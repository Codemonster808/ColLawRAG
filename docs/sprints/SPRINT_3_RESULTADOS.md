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
| Accuracy (50 casos) | 81.8% | *pendiente re-benchmark* | ≥ 75% |
| Recall@10 | — | 0* | ≥ 0.80 |

\* evaluate-retrieval requiere re-anotar `chunks_esperados` contra el nuevo índice (IDs cambiaron tras re-ingest).

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
- Ejecutado: Recall@10 = 0 (chunks_esperados del dataset no coinciden con IDs del nuevo índice)
- Para Recall válido: re-ejecutar `annotate-retrieval-ground-truth.mjs` contra índice local

---

## Benchmark accuracy (pre-S3.9, producción)

**Fuente:** `data/benchmarks/results-2026-03-02.json`  
**Juez:** Groq llama-3.3-70b-versatile

| Área | Score | Casos |
|------|-------|-------|
| Civil | 9.82/10 | 4 |
| Administrativo | 9.67/10 | 3 |
| Laboral | 8.17/10 | 23 |
| Constitucional | 7.93/10 | 12 |
| Penal | 6.25/10 | 2 |
| Tributario | 6.25/10 | 2 |

**Score general:** 8.18/10 (81.8%) — 46/50 casos evaluados, 4 errores 504 RAG

---

## Próximos pasos

1. Esperar a que termine `node scripts/ingest.mjs`
2. Ejecutar `npm run build-bm25 && npm run build-hnsw`
3. Ejecutar `node scripts/evaluate-retrieval.mjs --limit 30 --output data/benchmarks/sprint3-retrieval-$(date +%Y-%m-%d).json`
4. Re-ejecutar benchmark accuracy contra índice local o tras deploy
5. Actualizar este documento con Recall@10 y accuracy post-S3
