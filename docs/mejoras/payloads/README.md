# Payloads TOON – Plan de mejoras ColLawRAG

Cada archivo `.toon` en esta carpeta es un **payload derivado** de un documento base en `../` o en `docs/sprints/`. Los documentos `.md` **no se modifican**; solo se crean estos payloads para uso en Cursor o pipelines que consuman formato TOON.

## Por dónde empezar (avance actual — 2026-02-25)

**Las FASES (0-5) están completadas. Los SPRINTS son el plan ejecutable actual.**

- **Diagnóstico:** `DIAGNOSTICO_AVANCE.md` — estado de las FASES (todas cerradas).
- **Estado real post-diagnóstico:** Accuracy 29.6% (regresión vs 32.7% baseline). Corpus sin expandir (751 docs). Vigencia 0%. Ground truth 0 casos. No hay Groq. No hay features de producto.
- **Siguiente trabajo:** Payloads de SPRINT (nuevos, basados en diagnóstico real):

| Sprint | Payload | Estado | Prioridad |
|--------|---------|--------|-----------|
| Sprint 1 | **SPRINT_1_FUNDAMENTOS.toon** | 50% (falta Groq, benchmarks, A/B test) | URGENTE |
| Sprint 2 | **SPRINT_2_CORPUS.toon** | 0% (corpus no expandido, vigencia 0%) | CRITICA |
| Sprint 3 | **SPRINT_3_PIPELINE.toon** | 85% (falta limpieza chunks, benchmark) | Alta |
| Sprint 4 | **SPRINT_4_PRODUCTO.toon** | 0% (no hay features de producto) | Alta |

**Para empezar:** usar `SPRINT_1_FUNDAMENTOS.toon` con los prompts de `PROMPTS_AGENTES.md` o `PROMPT_LLM.md`.

## Correspondencia documento → payload

### Payloads de SPRINT (plan ejecutable actual)

| Documento base (.md) | Payload (.toon) | Tareas | Estado |
|----------------------|-----------------|--------|--------|
| `docs/sprints/SPRINT_1_FUNDAMENTOS.md` | `SPRINT_1_FUNDAMENTOS.toon` | 12 (4 hechas, 8 pendientes) | parcial |
| `docs/sprints/SPRINT_2_CORPUS.md` | `SPRINT_2_CORPUS.toon` | 16 (0 hechas, 16 pendientes) | no iniciado |
| `docs/sprints/SPRINT_3_PIPELINE.md` | `SPRINT_3_PIPELINE.toon` | 13 (8 hechas, 5 pendientes) | mayormente completado |
| `docs/sprints/SPRINT_4_PRODUCTO.md` | `SPRINT_4_PRODUCTO.toon` | 15 (0 hechas, 15 pendientes) | no iniciado |

### Payloads de FASE (histórico — todas completadas)

| Documento base (.md) | Payload (.toon) | Estado |
|----------------------|-----------------|--------|
| `DIAGNOSTICO_AVANCE.md` | `INICIO_TRABAJO.toon` | completada |
| `FASE_0_CORRECCIONES_CRITICAS.md` | `FASE_0_CORRECCIONES_CRITICAS.toon` | completada |
| `FASE_1_RETRIEVAL_OPTIMIZADO.md` | `FASE_1_RETRIEVAL_OPTIMIZADO.toon` | completada |
| `FASE_2_CHUNKING_SEMANTICO.md` | `FASE_2_CHUNKING_SEMANTICO.toon` | completada |
| `FASE_3_RERANKING_CROSS_ENCODER.md` | `FASE_3_RERANKING_CROSS_ENCODER.toon` | completada |
| `FASE_4_GENERACION_Y_PROMPTS.md` | `FASE_4_GENERACION_Y_PROMPTS.toon` | completada |
| `FASE_5_EVALUACION_Y_OBSERVABILIDAD.md` | `FASE_5_EVALUACION_Y_OBSERVABILIDAD.toon` | completada |
| `README_PLAN_MEJORAS.md` | `README_PLAN_MEJORAS.toon` | completada |
| `PLAN_PRODUCTO_COMERCIAL.md` | `PLAN_PRODUCTO_COMERCIAL.toon` | referencia |

## Contenido de los payloads

### Payloads de SPRINT (nuevos)
- `avance{}`: estado real verificado en código con tareas hechas y pendientes
- `estado_actual{}`: métricas reales del proyecto (accuracy, chunks, vigencia, ground truth)
- `tareas[]`: cada tarea con `instruccion_concreta` detallada, `comando_validacion`, y `estado` (completada/pendiente)
- `orden_ejecucion[]`: con dependencias explícitas entre tareas
- `grupos_paralelos[]`: olas de trabajo paralelizable
- `criterio_exito[]`: métricas objetivo verificables
- `post_fase_comando[]`: comandos para cerrar el sprint
- `siguiente_payload`: encadena SPRINT_1 → SPRINT_2 → SPRINT_3 → SPRINT_4

### Payloads de FASE (históricos)
- Misma estructura con `autonomo{}`, `multi_agente{}`, `asignacion_agente[]`, etc.
- Todas marcadas como completadas en `avance_2026_02{}`.

## Modo autónomo

Los payloads están ajustados para trabajo autónomo: el agente puede seguir `orden_ejecucion`, aplicar `instruccion_concreta` por tarea, ejecutar `comando_validacion`, respetar `no_modificar` y, al terminar un sprint, ejecutar `post_fase_comando` y pasar a `siguiente_payload`. Ver `PROMPT_LLM.md` opción 5.

## Diferencia FASES vs SPRINTS

- **FASES (completadas):** Optimizaron el pipeline mecánico (embeddings, HNSW, BM25, reranking, chunking, generación, tracing). Código funcional pero accuracy bajó a 29.6%.
- **SPRINTS (pendientes):** Abordan lo que las FASES NO cubrieron: modelos de generación 70B+, corpus expandido, vigencia real, ground truth, features de producto. Los sprints son la ruta hacia accuracy comercial (>85%).

Actualizado: 2026-02-25.
