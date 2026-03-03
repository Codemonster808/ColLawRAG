# ColLawRAG — Tareas pendientes (diagnóstico 2026-03)

**Fecha:** 2026-03-03  
**Estado:** P0 Fix + Sprint 4 Producto completados. Pendiente deploy a producción.

---

## 1. Resumen ejecutivo

| Fase | Estado | Próxima acción |
|------|--------|----------------|
| Sprint 1–3 | ✅ Cerrados | — |
| P0 Fix (T1–T6) | ✅ Completado | **Deploy índices a producción** |
| Sprint 4 Producto | ✅ Completado (2026-03-03) | Benchmark validación |
| Sprint 4 Retrieval | 🟡 Parcial (S4.3=T4 hecho) | S4.4 S4.5 opcionales |
| Sprint 5–6 | 🔵 Futuro | Chunking, fine-tuning |

---

## 2. Lo que FALTA por hacer

### Prioridad 1 — Deploy P0 a producción

| ID | Tarea | Esfuerzo | Comando / nota |
|----|-------|----------|----------------|
| **D1** | Subir índices nuevos a producción | 30 min | `npm run upload-indices` |
| **D2** | Deploy Vercel con nuevos índices | 10 min | Push a main; Vercel auto-deploy |
| **D3** | Benchmark post-deploy (50 casos) | 15 min | `JUDGE_PROVIDER=groq node scripts/evaluate-accuracy.mjs --prod --limit 50` |

**Objetivo:** Eliminar "codigo codigo" y reducir alucinaciones (3→0 esperado en LAB-004, CIV-001, ADM-001).

---

### Prioridad 2 — Sprint 4 Producto ✅ COMPLETADO (2026-03-03)

| ID | Tarea | Estado |
|----|-------|--------|
| S4.1–S4.9 | Abstención, confidence, badge, feedback, docs | ✅ Completado |

**Próximo:** Benchmark para validar que accuracy se mantiene.

---

### Prioridad 3 — Sprint 4 Retrieval (opcional)

| ID | Tarea | Estado | Nota |
|----|-------|--------|------|
| **S4.3-retrieval** | Query expansion +65 términos | ✅ Hecho (T4) | Ya implementado en P0 |
| **S4.4-retrieval** | Mini-benchmark 30 casos | 🟡 Opcional | `evaluate-accuracy --prod --limit 30` |
| **S4.5-retrieval** | CHANGELOG-SPRINT4, docs | 🟡 Opcional | Documentar cambios |

---

### Prioridad 4 — Sprint 5–6 (futuro)

| Sprint | Tareas | Dependencia |
|--------|--------|-------------|
| Sprint 5 | Chunking optimization, overlap, RRF | Sprint 4 o P0 deploy |
| Sprint 6 | Fine-tuning, jurisprudencia 150, cache | Sprint 5 |

---

## 3. Lo que YA está hecho (no repitas)

| Tarea | Fecha |
|-------|-------|
| T1 T2: metadata.title (MAP_FILENAME_TO_TITLE, normalizeMetadataTitle) | 2026-03-03 |
| T3: Penalización chunks penal en queries laboral/civil/admin | 2026-03-03 |
| T4: Query expansion + variantes sin tilde, homicidio, gravamen, etc. | 2026-03-03 |
| T5: Re-ingest, build-bm25, build-hnsw, benchmark prod | 2026-03-03 |
| S4.1 S4.2 Retrieval: cross-encoder, metadata.article | Sprint 3 |
| S4.3 Retrieval (query expansion): ya cubierto por T4 | 2026-03-03 |

---

## 4. Orden recomendado

```
1. D1–D3: upload-indices + deploy + benchmark  → Validar P0 + Sprint 4 en producción
2. Benchmark Sprint 4 → objetivo accuracy ≥ 74%
3. Sprint 5–6 cuando accuracy ≥ 75% y features producto estables
```

---

## 5. Comandos útiles

```bash
# Deploy índices
npm run upload-indices

# Benchmark producción
JUDGE_PROVIDER=groq node scripts/evaluate-accuracy.mjs --prod --limit 50

# Validar metadata local
node -e "const d=JSON.parse(require('fs').readFileSync('data/index.json','utf8')); console.log('codigo codigo:', d.filter(c=>/codigo codigo/.test(c.metadata?.title||'')).length)"
```

---

## 6. Métricas actuales

| Métrica | Local (post-P0) | Producción |
|---------|-----------------|------------|
| Chunks | 14 470 | 14 362 (viejo) |
| metadata "codigo codigo" | **0** | 3 668 |
| Accuracy (50 casos) | — | 72.6% |
| Alucinaciones | — | 3 (LAB-004, CIV-001, ADM-001) |
| Recall@10 | 100% | 100% |
