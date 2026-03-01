# Sprint 2 (Cursor) – Próximos pasos

**Estado:** S2.11 y S2.12 hechos. Index: 33053 chunks (vigencia verificada = 0 por naming de archivos). S2.13–S2.16 pendientes.

## S2.13 – Anotar ground truth retrieval (30+ casos)

**Requisito:** servidor RAG levantado (`npm run dev` en otra terminal).

```bash
cd ColLawRAG
node scripts/annotate-retrieval-ground-truth.mjs --limit 35
```

Comprobar:

```bash
node -e "const d=JSON.parse(require('fs').readFileSync('data/benchmarks/qa-abogados.json','utf8')); const c=d.casos||d; console.log('Con ground truth:', c.filter(x=>x.chunks_esperados?.length>0).length);"
```

## S2.14 – Evaluar retrieval

```bash
cd ColLawRAG
node scripts/evaluate-retrieval.mjs --limit 30 --output data/benchmarks/sprint2-retrieval-$(date +%Y-%m-%d).json
```

Objetivo: Recall@10 ≥ 0.70.

## S2.15 – Benchmark accuracy (50 casos)

```bash
cd ColLawRAG
node scripts/evaluate-accuracy.mjs --limit 50 --output data/benchmarks/sprint2-final-$(date +%Y-%m-%d).json
```

Objetivo: accuracy ≥ 65% (ideal 70–75%). Requiere juez LLM (ej. `ollama pull qwen2.5:14b-instruct` si usas Ollama).

## S2.16 – Documentar resultados

Crear `docs/sprints/SPRINT_2_RESULTADOS.md` con: accuracy antes/después, Recall@K, docs añadidos, normas con vigencia, chunks totales. Puede hacerlo OpenClaw o Cursor.

---

**Log del ingest en curso:** `tail -f /tmp/collawrag-ingest.log`
