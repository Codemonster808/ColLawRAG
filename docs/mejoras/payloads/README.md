# Payloads TOON – Plan de mejoras ColLawRAG

Cada archivo `.toon` en esta carpeta es un **payload derivado** del documento base homónimo en `../` (misma raíz de nombre, extensión `.toon`). Los documentos `.md` en `docs/mejoras/` **no se modifican**; solo se crean estos payloads para uso en Cursor o pipelines que consuman formato TOON.

## Correspondencia documento → payload

| Documento base (.md) | Payload (.toon) |
|----------------------|-----------------|
| `FASE_0_CORRECCIONES_CRITICAS.md` | `FASE_0_CORRECCIONES_CRITICAS.toon` |
| `FASE_1_RETRIEVAL_OPTIMIZADO.md` | `FASE_1_RETRIEVAL_OPTIMIZADO.toon` |
| `FASE_2_CHUNKING_SEMANTICO.md` | `FASE_2_CHUNKING_SEMANTICO.toon` |
| `FASE_3_RERANKING_CROSS_ENCODER.md` | `FASE_3_RERANKING_CROSS_ENCODER.toon` |
| `FASE_4_GENERACION_Y_PROMPTS.md` | `FASE_4_GENERACION_Y_PROMPTS.toon` |
| `FASE_5_EVALUACION_Y_OBSERVABILIDAD.md` | `FASE_5_EVALUACION_Y_OBSERVABILIDAD.toon` |
| `README_PLAN_MEJORAS.md` | `README_PLAN_MEJORAS.toon` |
| `PLAN_PRODUCTO_COMERCIAL.md` | `PLAN_PRODUCTO_COMERCIAL.toon` |

## Contenido de los payloads

- **FASE_0–FASE_5:** `proyecto`, `documento_base`, `modo: autonomo`, `autonomo{}`, `tareas[]` (con `instruccion_concreta`, `comando_validacion`), `archivos_modificar[]`, `orden_ejecucion[]`, `criterio_exito[]`, `post_fase_comando[]`. Cada uno tiene `siguiente_payload` para encadenar fases.
- **README_PLAN_MEJORAS:** Índice del plan; `instruccion_agente` para ejecutar en orden los payloads FASE_0→FASE_5.
- **PLAN_PRODUCTO_COMERCIAL:** Dimensiones C/M/P, roadmap, costos; `instruccion_agente` indica que la implementación técnica sigue los payloads de fases.

## Modo autónomo

Los payloads están ajustados para trabajo autónomo: el agente puede seguir `orden_ejecucion`, aplicar `instruccion_concreta` por tarea, ejecutar `comando_validacion`, respetar `no_modificar` y, al terminar una fase, ejecutar `post_fase_comando` y pasar a `siguiente_payload`. Ver `PROMPT_LLM.md` opción 5.

## Multi-agente (Cursor + OpenClaw mismo sprint)

Cada payload de fase incluye:
- **multi_agente**: `herramientas` (cursor, open_claw), `sprint_id`, `paralelo_en_fase`, `post_fase_agente`
- **asignacion_agente**: por cada tarea, qué agente la ejecuta y sus archivos exclusivos
- **grupos_paralelos**: qué tareas van en ola 1 u ola 2 y qué agente(s); permite paralelo real (FASE_0, FASE_5) o secuencia por olas (FASE_1–4)
- **archivos_compartidos** (si aplica): archivo y orden de edición (cursor primero / open_claw después)
- **instruccion_herramienta**: una línea por herramienta (cursor | open_claw) para que cada una sepa qué hacer y qué no tocar

Cursor y OpenClaw cargan el **mismo** `.toon` del sprint/fase; cada uno ejecuta solo sus tareas y respeta los archivos del otro. Ver `PROMPT_LLM.md` opción 6.

Generado: 2026-02-23.
