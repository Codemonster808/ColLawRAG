# Prompts para Cursor y OpenClaw (ColLawRAG)

Cada agente debe **cargar primero el payload** de la fase/sprint indicado y actuar solo según lo que ahí se define. Ruta: `ColLawRAG/docs/mejoras/payloads/*.toon`.

---

## Estado actual (qué falta de los payloads)

- **FASES 0–5:** Todas completadas. No hay tareas pendientes en FASE_*.
- **SPRINT 1:** Cursor cerrado (S1.1–S1.5, S1.8, S1.12). **OpenClaw pendiente:** S1.6 (test DeepSeek/Novita), S1.7 (benchmark DeepSeek 30), S1.9 (config Groq + benchmark 30), S1.11 (tabla A/B → ab-test-summary.md). S1.10 ya hecho (ab-qwen7b existe). **Cuando exista ab-test-summary.md**, Cursor ejecuta: `node scripts/apply-winner-and-benchmark.mjs` (comprueba summary, sugiere .env y lanza benchmark 50).
- **SPRINT 2:** Pendiente casi todo: OpenClaw S2.1–S2.10 (descargas, formateo, vigencia); Cursor S2.13–S2.15 (ground truth, evaluate-retrieval, benchmark 50+); OpenClaw S2.16 (resultados).
- **SPRINT 3 y 4:** Varias tareas pendientes (ver DIAGNOSTICO_AVANCE.md y cada .toon).

**Resumen:** Lo que falta ahora mismo es **OpenClaw en Sprint 1** (S1.6, S1.7, S1.9, S1.11). Después, Cursor puede hacer post-fase de Sprint 1 (benchmark 50+ con modelo ganador) y/o pasar a Sprint 2.

---

## Prompt para Cursor (tui)

```
Proyecto: ColLawRAG. Soy el agente Cursor: tareas intensivas en tokens (código, ingest, retrieval, generation, evaluación, análisis).

Paso 0 — Cargar payload y diagnóstico
- Lee: ColLawRAG/docs/mejoras/payloads/DIAGNOSTICO_AVANCE.md
- Lee el payload del sprint indicado más abajo (ej. SPRINT_1_FUNDAMENTOS.toon).
- Del payload uso: labores_cursor, asignacion_agente (solo agente=cursor), instruccion_herramienta herramienta=cursor, tareas[] con estado y agente=cursor, orden_ejecucion, post_fase_comando (si post_fase_agente=cursor), archivos_compartidos (orden_edicion).

Paso 1 — Ejecutar
- Ejecuto ÚNICAMENTE las tareas/labores asignadas a cursor en este payload.
- En Sprint 1: según labores_cursor, Cursor está cerrado; solo ejecuto post_fase cuando exista `data/benchmarks/ab-test-summary.md`: `node scripts/apply-winner-and-benchmark.mjs` (benchmark 50 con modelo ganador). Ver `data/benchmarks/README-S1.11.md`.
- No modifico archivos exclusivos de open_claw (ej. data/benchmarks/ab-*.json generados por OpenClaw en Sprint 1).
- Respeto archivos_compartidos y orden_edicion (cursor primero cuando aplique).
- Al terminar, si soy post_fase_agente ejecuto post_fase_comando.

Payload actual: ColLawRAG/docs/mejoras/payloads/SPRINT_1_FUNDAMENTOS.toon

Si Sprint 1 está cerrado para Cursor, siguiente: ColLawRAG/docs/mejoras/payloads/SPRINT_2_CORPUS.toon (labores_cursor: S2.13, S2.14, S2.15). Empieza leyendo el .toon indicado y labores_cursor.
```

---

## Prompt para OpenClaw

```
Proyecto: ColLawRAG. Soy el agente OpenClaw: tareas ligeras en tokens (config, tests manuales, benchmarks acotados, descargas, formateo, documentación). No creo módulos grandes ni refactors pesados.

Paso 0 — Cargar payload
- Lee: ColLawRAG/docs/mejoras/payloads/SPRINT_1_FUNDAMENTOS.toon (o el sprint que se indique).
- Del payload uso: labores_open_claw, asignacion_agente (solo agente=open_claw), instruccion_herramienta herramienta=open_claw, tareas[] con estado=pendiente y agente=open_claw, orden_ejecucion.

Paso 1 — Ejecutar
- Ejecuto ÚNICAMENTE las tareas listadas en labores_open_claw en el orden indicado.
- Sprint 1 pendientes: S1.6 (config .env Novita/DeepSeek + 1 query manual), S1.7 (benchmark DeepSeek 30 → ab-deepseek-v3-*.json), S1.9 (config Groq + benchmark 30 → ab-groq-70b-*.json), S1.11 (compare-benchmark-results → ab-test-summary.md). S1.10 ya hecho.
- No modifico lib/generation.ts ni .env.example (son de Cursor).
- NO ejecuto post_fase_comando de benchmark final 50+ (lo hace Cursor).
- Si no hay tareas open_claw en el payload, respondo "Sin tareas open_claw en este payload" y no modifico nada.

Payload actual: ColLawRAG/docs/mejoras/payloads/SPRINT_1_FUNDAMENTOS.toon

Empieza leyendo el .toon y ejecutando en orden labores_open_claw (S1.6 → S1.7 → S1.9 → S1.11).
```

---

## Cómo usarlos

| Paso | Acción |
|------|--------|
| 1 | Elige el payload (SPRINT_1_FUNDAMENTOS.toon para trabajo actual; FASES ya están cerradas). |
| 2 | En Cursor: pega el **Prompt para Cursor** y adjunta `@ColLawRAG/docs/mejoras/payloads/SPRINT_1_FUNDAMENTOS.toon` (y opcional `@DIAGNOSTICO_AVANCE.md`). |
| 3 | En OpenClaw: pega el **Prompt para OpenClaw** y adjunta el mismo `.toon`. |
| 4 | Cada agente lee el .toon y actúa según labores_cursor / labores_open_claw e instruccion_herramienta. |

**Orden recomendado:** Primero OpenClaw termina Sprint 1 (S1.6, S1.7, S1.9, S1.11) y genera ab-test-summary.md. Luego Cursor puede ejecutar benchmark final 50+ y/o pasar a Sprint 2 (S2.13–S2.15).

**Referencia de estado:** `DIAGNOSTICO_AVANCE.md`. FASES 0–5 completadas. Sprints: Sprint 1 parcial (Cursor cerrado; OpenClaw pendiente). Sprint 2/3/4 con tareas pendientes.
