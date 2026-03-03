# Sprint 6 — Resultados (Cierre Mercado)

**Fecha:** _[OpenClaw: completar tras S6.4]_  
**Objetivo:** 72%+ accuracy, prompt anti-repetición, listo para soft launch.

---

## Resumen ejecutivo

| Métrica | Sprint 5 | Sprint 6 | Gate mercado |
|---------|----------|----------|--------------|
| Accuracy (50 casos) | _[OpenClaw: valor S5.4/S6.4]_ | _[OpenClaw: valor final]_ | 70% |
| Alucinaciones | 0 | _[OpenClaw]_ | 0 |
| Recall@10 | 100% | _[OpenClaw]_ | — |
| Documentos | 879 | 879 | — |
| Chunks | 14 728 | 14 728 | — |

**Conclusión:** _[OpenClaw: ¿Gate 70% alcanzado? ¿Listo para soft launch?]_

---

## Tabla comparativa Sprint 1 → 6

| Sprint | Accuracy | Retrieval | Corpus | Notas |
|--------|----------|-----------|--------|-------|
| S1 | 32.7% → 74.6% | 1 llamada, embeddings unificados | 14.4k chunks | Juez Groq 70B |
| S2 | — | — | 750 docs + 608 sentencias | Infraestructura |
| S3 | 74.6% | Recall@10 100%, chunks tiny 0% | 14.4k chunks | Vigencia, cross-encoder |
| S4 | 72.6% | Query expansion T4 | — | Abstención, confidence, feedback |
| S5 | 64.2% | +42 términos, prompts por área | — | S5.3: 879 docs, 14 728 chunks |
| S6 | _[OpenClaw]_ | Anti-repetición activo | 879 docs | _[OpenClaw]_ |

---

## Tareas completadas

### S6.2 (Cursor) — Prompt anti-repetición
- REGLAS: NO repitas, conciso, máx 2–3 artículos
- **Archivo:** `lib/prompt-templates.ts`

### S6.4 (OpenClaw) — Benchmark final
- **Comando:** `JUDGE_PROVIDER=groq node scripts/evaluate-accuracy.mjs --prod --limit 50`
- **Output:** `data/benchmarks/sprint6-final-YYYY-MM-DD.json`
- _[OpenClaw: pegar resultados principales]_

### S6.5 (OpenClaw) — Documentación
- Este archivo: `docs/sprints/SPRINT_6_RESULTADOS.md`
- Actualizar `docs/RESUMEN_CONSOLIDADO.md` si existe

---

## Por área legal (50 casos)

_[OpenClaw: completar tabla con scores S6.4]_

| Área | Score S5 | Score S6 | Casos |
|------|----------|----------|-------|
| Administrativo | 9.67 | _[OpenClaw]_ | 3 |
| Civil | 7.70 | _[OpenClaw]_ | 4 |
| Constitucional | 6.79 | _[OpenClaw]_ | 14 |
| Laboral | 5.64 | _[OpenClaw]_ | 25 |
| Penal | 6.25 | _[OpenClaw]_ | 2 |
| Tributario | 6.25 | _[OpenClaw]_ | 2 |

---

## Evolución accuracy (gráfico)

_[OpenClaw: describir o añadir si hay datos]_

```
S1: 32.7% → 74.6%
S3: 74.6%
S4: 72.6%
S5: 64.2%
S6: _[OpenClaw]_
```

---

## Mejoras por área

_[OpenClaw: resumir qué áreas mejoraron/empeoraron vs S5]_

---

## Lecciones aprendidas

_[OpenClaw: 3–5 puntos clave]_

1. 
2. 
3. 

---

## Próximos pasos

- [ ] Si accuracy ≥ 70%: soft launch con usuarios piloto
- [ ] Si accuracy < 70%: evaluar S5.3 adicional, S6.1 (chunks overview)
- [ ] Monitorear `data/eval/negative-feedback.jsonl`
- [ ] Diferir S6.1 (chunks overview) y S6.3 (cache) a post-lanzamiento
