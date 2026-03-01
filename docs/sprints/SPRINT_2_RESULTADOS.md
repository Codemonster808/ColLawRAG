# Sprint 2 — Resultados (Cursor)

**Fecha:** 2026-02-26  
**Alcance:** labores Cursor S2.13, S2.14, S2.15.

## Resumen

| Ítem | Resultado |
|------|-----------|
| Ground truth retrieval | 10 casos anotados con `chunks_esperados` (objetivo 30+; rate limit API cortó el resto) |
| Evaluate retrieval | Ejecutado sobre 10 casos |
| Benchmark accuracy | 50 casos consultados al RAG; juez sin métricas (OOM) |

## Retrieval (S2.14)

- **Archivo:** `data/benchmarks/sprint2-retrieval-2026-02-26.json`
- **Casos evaluados:** 10 (con `chunks_esperados`)

| Métrica | Valor |
|---------|--------|
| Recall@5 | 0.72 |
| Recall@10 | **1.00** |
| Precision@5 | 0.18 |
| Precision@10 | 0.16 |
| NDCG@5 | 0.67 |
| NDCG@10 | 0.78 |
| MRR | 0.68 |

Recall@10 = 1.0 cumple el criterio de éxito (≥ 0.70) en la muestra disponible.

## Accuracy (S2.15)

- **Archivo:** `data/benchmarks/sprint2-final-2026-02-26.json`
- **Casos enviados al RAG:** 50
- **Resultado:** Sin resultados válidos. El juez (`qwen2.5:14b-instruct` vía Ollama) devolvió 500 en todos los casos: *"model requires more system memory (9.8 GiB) than is available (5.x GiB)"*.
- **Conclusión:** Para reportar accuracy hace falta un juez con menos requisitos de RAM (p. ej. 7B) o más memoria disponible para el 14B.

## Corpus e índice (estado actual)

- **Documentos:** 749
- **Chunks en índice:** 33 053
- **Normas con vigencia (JSON):** 19 en `data/normas-vigencia/`
- **Chunks con vigencia verificada en índice:** 0 (nombres de archivo no coinciden con `normaId` en los JSON)

## Cambios de código en el sprint

- **Reintentos ante 429:** En `scripts/evaluate-retrieval.mjs` y `scripts/annotate-retrieval-ground-truth.mjs` se añadió lógica de reintento con espera cuando el API devuelve rate limit (429).

## Próximos pasos sugeridos

1. **Más ground truth:** Con servidor levantado y rate limit más alto (p. ej. `RATE_LIMIT_REQUESTS=200 npm run dev`), volver a ejecutar `node scripts/annotate-retrieval-ground-truth.mjs --limit 35` para acercarse a 30+ casos anotados.
2. **Accuracy:** Ejecutar el benchmark con un juez 7B (p. ej. `qwen2.5:7b-instruct`) o con más RAM para el 14B, y volver a generar `sprint2-final-*.json` con métricas.
3. **Vigencia en índice:** Ajustar nombres de archivos en `data/documents/` para que coincidan con `normaId` en `data/normas-vigencia/*.json`, o ampliar el mapeo en `scripts/ingest.mjs`, y re-ejecutar `node scripts/ingest.mjs`.
