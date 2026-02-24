# Fase 1 — Detalle aplicado: Línea base y evaluación automatizada

**Fecha:** 2026-02  
**Estado:** Implementado en el proyecto ColLawRAG

---

## Objetivo

Tener un sistema de evaluación automático y confiable: benchmark mejorado, métricas tipo RAGAS, comparación A/B, historial y reporte unificado, y opcionalmente ejecución diaria en CI con alertas de regresión.

---

## 1.1 Mejora del script de benchmark

### Cambios realizados

**Archivo:** `scripts/evaluate-accuracy.mjs`

- **Export estructurado:** Cada ejecución guarda un objeto con:
  - `metrics`: bloque plano para comparación (accuracy_porcentaje, score_promedio, total_casos, evaluados, errores, por_area, por_dificultad, veredictos, criterios).
  - `ragas_style`: métricas proxy (faithfulness, answer_relevancy, overall; context_recall/context_precision en null hasta que el API devuelva contexto).
- **Muestreo estratificado:** Nuevas opciones:
  - `--stratify area` o `--stratify dificultad`: reparte la muestra de forma proporcional por ese campo.
  - `--sample N`: tamaño total de la muestra cuando se usa estratificado (por defecto 30).
- **Copia al historial:** `--copy-to-history` escribe una copia del resultado en `data/benchmarks/history/results-YYYY-MM-DD.json` para tendencias.

### Comparación A/B

**Script:** `scripts/compare-benchmark-results.mjs`

- Uso:  
  `node scripts/compare-benchmark-results.mjs --baseline <path> --candidate <path>`
- Opciones:
  - `--regression-threshold N`: umbral de caída en % para considerar regresión (default 3).
  - `--json`: salida solo JSON (para CI); exit code 1 si hay regresión.
- Salida: diferencias de accuracy, score y por área; exit 1 si la caída supera el umbral.

### Comandos npm

```bash
npm run benchmark                    # evaluate-accuracy con defaults
npm run benchmark -- --prod --limit 5
npm run benchmark -- --prod --stratify area --sample 30 --copy-to-history
npm run benchmark:compare -- --baseline data/benchmarks/results-2026-02-01.json --candidate data/benchmarks/results-2026-02-02.json
```

---

## 1.2 Métricas tipo RAGAS

### Implementación

- **En el reporte:** El script `evaluate-accuracy.mjs` calcula y guarda `ragas_style` en cada ejecución:
  - **faithfulness:** proxy desde el criterio del juez `ausencia_alucinaciones` (0–10 → 0–1).
  - **answer_relevancy:** proxy desde el promedio de (precision_normativa + completitud) del juez.
  - **context_recall / context_precision:** `null` (requieren que el API devuelva los chunks usados; se pueden añadir después).
  - **overall:** promedio de faithfulness y answer_relevancy.
- **Lib TypeScript:** `lib/ragas-integration.ts` expone:
  - `computeRagasFromReport(resultadosDetallados, contextChunks?)`: calcula las mismas métricas desde un array de resultados.
  - `addRagasToReport(report)`: añade `ragas_style` a un reporte existente.
- Para métricas RAGAS completas (con LLM o NLI externo) se puede integrar después `@ikrigel/ragas-lib-typescript` o el pipeline Python; esta fase deja la estructura lista y proxies útiles.

---

## 1.3 Benchmark automatizado (GitHub Actions)

**Archivo:** `.github/workflows/daily-benchmark.yml`

- **Disparadores:**
  - Programado: `cron: '0 2 * * *'` (2:00 UTC).
  - Manual: `workflow_dispatch` con inputs opcionales `sample_size` y `limit`.
- **Pasos:**
  1. Checkout, Node 20, `npm ci`.
  2. Ejecutar benchmark contra producción (`--prod`) con muestra estratificada por área (o con `--limit` si `sample_size=0`), guardando en `data/benchmarks/results-latest.json` y copiando al historial.
  3. Generar reporte unificado: `node scripts/generate-full-report.mjs`.
  4. Si existe `data/benchmarks/baseline.json`, ejecutar `compare-benchmark-results.mjs`; si hay regresión >3%, el job falla.
  5. **Alertas:** Si hubo regresión, se envía un POST al webhook configurado en el secret `BENCHMARK_ALERT_WEBHOOK_URL` (opcional).
  6. Subir artefactos: `results-latest.json`, `REPORTE_BENCHMARK.md`, carpeta `history/` (`if-no-files-found: ignore`).

**Secrets necesarios (para el juez):**

- `JUDGE_ENDPOINT`: URL del API del juez (p. ej. HuggingFace o OpenAI-compatible).
- `HUGGINGFACE_API_KEY`: si el juez usa HF.
- Opcional: `JUDGE_MODEL`.

Si no se configuran, el paso de benchmark fallará (no hay Ollama en el runner de GitHub). Para tener baseline y alertas de regresión, hay que añadir en el repo un archivo `data/benchmarks/baseline.json` (por ejemplo una copia de una ejecución de referencia).

---

## 1.4 Reporte unificado e historial

**Script:** `scripts/generate-full-report.mjs`

- Lee:
  - `data/benchmarks/history/results-*.json`
  - `data/benchmarks/results-YYYY-MM-DD.json` (para fechas no repetidas en history).
- Genera `data/benchmarks/REPORTE_BENCHMARK.md` con:
  - Tabla por fecha: Accuracy %, Score, Evaluados, Total, Errores, RAGAS overall, RAGAS faithfulness.
  - **Visualización:** Gráfico de evolución (Mermaid `xychart-beta`) de Accuracy % por fecha cuando hay al menos 2 ejecuciones.
- Uso:  
  `npm run benchmark:report`  
  o  
  `node scripts/generate-full-report.mjs --output ruta/REPORTE.md`

El historial se alimenta ejecutando el benchmark con `--copy-to-history` (local o en el workflow).

---

## Resumen de archivos tocados o creados

| Archivo | Cambio |
|---------|--------|
| `scripts/evaluate-accuracy.mjs` | Opciones --stratify, --sample, --copy-to-history; bloque metrics; ragas_style; impresión de RAGAS en consola |
| `scripts/compare-benchmark-results.mjs` | Nuevo: comparación A/B con --baseline, --candidate, --regression-threshold, --json |
| `scripts/generate-full-report.mjs` | Nuevo: reporte unificado desde history/ y results-*.json |
| `lib/ragas-integration.ts` | Nuevo: computeRagasFromReport, addRagasToReport, tipos RagasStyleMetrics |
| `.github/workflows/daily-benchmark.yml` | Nuevo: workflow programado + manual, compare con baseline, alerta webhook opcional, artefactos con if-no-files-found |
| `package.json` | Scripts: benchmark, benchmark:compare, benchmark:report |

---

## Próximos pasos opcionales

- Configurar el secret `BENCHMARK_ALERT_WEBHOOK_URL` con la URL de un Incoming Webhook (Slack, Discord, etc.) para recibir un mensaje cuando la comparación detecte regresión.
- Establecer un `baseline.json` en el repo tras una ejecución de referencia y protegerlo o actualizarlo bajo criterio definido.
- Integrar `@ikrigel/ragas-lib-typescript` para faithfulness/relevancy con LLM externo si se quiere ir más allá de los proxies del juez.
- Si el API `/api/rag` devuelve los chunks usados, extender el benchmark para rellenar context_recall y context_precision en `ragas_style`.
