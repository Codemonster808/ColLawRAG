# Análisis de aplicabilidad: Plan de optimización ColLawRAG

**Fecha:** 2026-02  
**Referencia:** Plan de Optimización ColLawRAG (6 fases, 16-22 días)  
**Objetivo:** Identificar qué partes del plan son aplicables a ColLawRAG y con qué adaptaciones.

---

## Resumen ejecutivo

| Fase | Aplicabilidad | Prioridad sugerida | Notas clave |
|------|----------------|--------------------|-------------|
| **Fase 1** (Línea base + RAGAS + automatización) | ✅ Alta (con adaptaciones) | Alta | RAGAS: usar lib TS o Python vía subprocess; benchmark ya existe |
| **Fase 2** (Embeddings) | ✅ Alta | Alta | Respetar preferencia embeddings locales (Xenova); HF solo opcional |
| **Fase 3** (Retrieval) | ✅ Alta | Alta | Grid search directo; HyDE añade latencia/costo LLM |
| **Fase 4** (Cross-encoder) | ✅ Alta (con adaptaciones) | Media-Alta | Caché: Vercel KV o in-memory (no Redis dedicado hoy) |
| **Fase 5** (Chunking) | ✅ Parcial | Media | Ya hay chunking por artículos; mejorar overlap y métricas |
| **Fase 6** (CI/CD + monitoreo) | ✅ Alta | Media | Dashboard puede vivir en `app/dashboard/`; ya hay `analytics` |

---

## Fase 1: Establecer línea base y automatizar evaluación

### Qué tenemos hoy

- `scripts/evaluate-accuracy.mjs`: benchmark contra `/api/rag`, juez LLM (Ollama o HF), guarda `data/benchmarks/results-YYYY-MM-DD.json` con resumen y por área.
- No hay export estructurado para comparar dos versiones ni muestreo estratificado.
- No hay RAGAS ni métricas faithfulness/context_recall/context_precision.
- No hay GitHub Action ni alertas automáticas.
- No hay reporte unificado con historial ni gráficos.

### Aplicabilidad de las acciones

| Acción | Aplicable | Adaptación / nota |
|--------|-----------|--------------------|
| **1.1 Mejorar script de benchmark** | ✅ Sí | Añadir export JSON estructurado (por caso, por área). Implementar modo A/B: `--baseline results-A.json --candidate results-B.json` y diff. Muestreo estratificado por `area` o `dificultad` en `qa-abogados.json` (ya existe el campo). |
| **1.2 Integrar RAGAS** | ✅ Sí, con adaptación | El plan cita `npm install ragas-metrics`: **no existe** ese paquete. Opciones: (1) **TypeScript:** `npm install @ikrigel/ragas-lib-typescript` (faithfulness, relevance, coherence; multi-provider). (2) **Python:** `pip install ragas` y llamar desde Node con `child_process` o script separado. Para ColLawRAG (stack Node/Next) la opción TS es más coherente. Crear `lib/ragas-integration.ts` (o similar) y que el benchmark opcionalmente calcule y guarde métricas RAGAS. |
| **1.3 Automatizar benchmark diario** | ✅ Sí | `.github/workflows/daily-benchmark.yml`: ejecutar `node scripts/evaluate-accuracy.mjs --prod` (requiere juez disponible: Ollama en runner o `JUDGE_ENDPOINT`+`HUGGINGFACE_API_KEY` en secrets). Alertas >3%: GitHub Actions no tiene Slack/Email nativo; usar `actions/github-script` para comentar en issue o enviar a webhook. |
| **1.4 Reporte unificado** | ✅ Sí | `scripts/generate-full-report.mjs`: leer `data/benchmarks/results-*.json` y opcionalmente `history/`, generar markdown/HTML con tablas y evolución. Guardar historial en `data/benchmarks/history/` (copiar cada results-YYYY-MM-DD.json). Gráficos: puede ser simple (tabla de números) o integrar una lib ligera (ej. Chart.js en script Node que genera HTML). |

### Entregables aplicables

- Benchmark con export estructurado y comparación A/B.
- Métricas tipo RAGAS (vía lib TS o Python) integradas en el flujo de evaluación.
- GitHub Action que ejecute benchmark (diario o en PR) y, si se desea, notificaciones vía webhook.
- Script de reporte unificado e historial en `data/benchmarks/history/`.

---

## Fase 2: Optimización de embeddings

### Qué tenemos hoy

- **Por defecto:** Xenova local (`Xenova/paraphrase-multilingual-MiniLM-L12-v2` en ingest; `Xenova/all-MiniLM-L6-v2` en `lib/embeddings.ts`).
- **Opcional:** HuggingFace API con `EMB_PROVIDER=hf` y `sentence-transformers/paraphrase-multilingual-mpnet-base-v2`.
- No hay conjunto de prueba específico para embeddings ni script de benchmark comparativo.

### Aplicabilidad de las acciones

| Acción | Aplicable | Adaptación / nota |
|--------|-----------|--------------------|
| **2.1 Conjunto de prueba** | ✅ Sí | Usar `data/benchmarks/qa-abogados.json`; para cada pregunta, definir ground truth de chunks relevantes (ids o contenido). Puede ser manual o semi-automático (chunks que contienen la respuesta_referencia o normas_clave). Guardar en `data/benchmarks/embedding-test-set.json`. |
| **2.2 Script benchmark embeddings** | ✅ Sí | `scripts/benchmark-embeddings.mjs`: para cada modelo, generar embeddings (o cargar índice pre-generado) y medir Recall@5/10/20, Precisión@5/10, latencia. **Modelos:** Actual Xenova; candidatos HF (requieren API): `paraphrase-multilingual-mpnet-base-v2`, `hiiamsid/sentence_similarity_spanish_es`, `PlanTL-GOB-ES/roberta-base-bne`, `BAAI/bge-m3`. **Importante:** ColLawRAG prioriza embeddings **locales**. Incluir en el benchmark solo modelos disponibles en Xenova o documentar que los candidatos HF son para evaluación opcional (ej. si se habilita API en CI). |
| **2.3 Ejecutar benchmark** | ✅ Sí | Por modelo: re-generar índice o usar índice ya generado; ejecutar 200 consultas (o subconjunto), medir recall/precision/latencia y accuracy end-to-end si se desea. |
| **2.4 Analizar y seleccionar** | ✅ Sí | Tabla comparativa; trade-off accuracy vs latencia. Si el ganador es solo API (HF), documentar y dejar Xenova como default con opción HF en producción. |
| **2.5 Implementar ganador + caché** | ✅ Parcial | Si el ganador es Xenova: actualizar `EMB_MODEL` en `lib/embeddings.ts` e ingest. Si es HF: ya está soportado con `EMB_PROVIDER=hf`. **Caché LRU para queries:** La API `/api/rag` ya tiene caché en memoria; se puede extender a caché de embeddings de la query (clave = hash de query, valor = vector) para evitar re-embedding en consultas repetidas. Re-generar índice completo con el modelo elegido. |

### Entregables aplicables

- Conjunto de prueba para embeddings y script de benchmark.
- Reporte comparativo (modelos que se puedan ejecutar en nuestro stack: Xenova + opcional HF).
- Modelo ganador configurado y, si aplica, caché de embeddings de query.
- Mejora objetivo en Recall@10 manteniendo preferencia por embeddings locales cuando sea posible.

---

## Fase 3: Optimización de recuperación (retrieval)

### Qué tenemos hoy

- Peso híbrido fijo: **alpha = 0.7** (70% cosine, 30% BM25 normalizado) en `lib/bm25.ts` `hybridScore()`.
- **topK = 8** por defecto; con reranking se recuperan hasta **initialTopK = 20** y luego se recorta a topK.
- Reranking heurístico + opcional HF sentence-similarity (`USE_CROSS_ENCODER=true`).
- No hay grid search ni HyDE.

### Aplicabilidad de las acciones

| Acción | Aplicable | Adaptación / nota |
|--------|-----------|--------------------|
| **3.1 Grid search de parámetros** | ✅ Sí | `scripts/optimize-retrieval.mjs`: variar vector weight (ej. 0.3, 0.5, 0.7, 0.9), BM25 weight = 1 - vector weight, topK (5, 10, 15, 20, 30), con/sin reranking. Hoy el peso no es configurable por env; habría que exponer `HYBRID_ALPHA` (o similar) en `retrieval.ts` y `optimize-retrieval.mjs` para no tocar código en cada experimento. |
| **3.2 Ejecutar grid search** | ✅ Sí | Ejecutar combinaciones, medir Recall@K y Precisión@K sobre el conjunto de prueba. Reducir espacio si hace falta (ej. menos valores de topK o de alpha). |
| **3.3 Validar top combinaciones** | ✅ Sí | Benchmark end-to-end con generación para las 5 mejores configuraciones; elegir la que maximice accuracy con latencia aceptable. |
| **3.4 Implementar HyDE** | ✅ Sí, con coste | HyDE: generar un “documento hipotético” con el LLM a partir de la query, embeberlo y recuperar por similitud. Requiere una llamada extra al LLM por consulta → más latencia y costo. Aplicable sobre todo para consultas complejas. Crear `lib/hyde.ts`: función que llame al LLM (usar mismo proveedor que generación), embeber la respuesta, y opcionalmente combinar con embedding de la query (ej. promedio o recuperar con ambos y fusionar resultados). Integrar como opción (ej. `USE_HYDE=true`) para no afectar a usuarios que no lo necesiten. |
| **3.5 Evaluar HyDE** | ✅ Sí | Comparar Recall/Precisión y accuracy end-to-end con y sin HyDE; medir latencia adicional. |

### Entregables aplicables

- Parámetros óptimos documentados (alpha, topK, con/sin reranking).
- HyDE opcional implementado y evaluado; decisión de activarlo por defecto o solo en modo “complejo”.

---

## Fase 4: Cross-encoder para reranking

### Qué tenemos hoy

- Reranking heurístico (jerarquía legal, recencia, keywords, vigencia) en `lib/reranking.ts`.
- Opcional: `rerankWithHFSimilarity()` con HF sentence-similarity (no es cross-encoder puro) con `USE_CROSS_ENCODER=true` y `HUGGINGFACE_API_KEY`.

### Aplicabilidad de las acciones

| Acción | Aplicable | Adaptación / nota |
|--------|-----------|--------------------|
| **4.1 Evaluar cross-encoders** | ✅ Sí | `scripts/benchmark-cross-encoders.mjs`: probar modelos tipo `BAAI/bge-reranker-large`, `cross-encoder/ms-marco-MiniLM-L-6-v2`, `mixedbread-ai/mxbai-rerank-xsmall-v1` (vía API HF o endpoint compatible). Evaluar en pares query-documento del benchmark. |
| **4.2 Arquitectura híbrida** | ✅ Sí | Ya existe dos fases (heurístico + opcional HF). Extender: fase 1 heurístico (top 30 → top 20), fase 2 cross-encoder solo sobre top 20. Puntaje combinado (ej. 70% cross-encoder + 30% heurístico) y ordenar. Implementar en `lib/reranking.ts` sin romper el flujo actual. |
| **4.3 Caché de reranker** | ✅ Con adaptación | Plan sugiere **Redis**. ColLawRAG hoy no usa Redis; en Vercel se suele usar **Vercel KV** (Redis-compatible) o caché en memoria con TTL corto. Opciones: (1) `@vercel/kv` para caché por (hash(query), hash(chunk_ids)) → scores; (2) caché en memoria en el proceso (útil en serverless con cold start). Documentar en riesgos: en serverless cada instancia tiene su propia memoria. |
| **4.4 Evaluar impacto** | ✅ Sí | Comparar accuracy y latencia con/sin cross-encoder; si hay caché, medir tasa de cache hit. |

### Entregables aplicables

- Cross-encoder elegido e integrado en el flujo de reranking.
- Caché de resultados de reranker (Vercel KV o in-memory con TTL) para reducir latencia en consultas repetidas.
- Mejora esperada en precisión del ranking (objetivo del plan: ~+5%).

---

## Fase 5: Chunking y contexto

### Qué tenemos hoy

- Chunking por estructura legal: `splitByArticles()` (Título, Capítulo, Sección, Artículo, numerales) y `splitTextBySize(1000, 150)` para trozos grandes; `splitLargeChunk(1000, 150)` para no superar 1000 caracteres.
- Overlap fijo de 150 caracteres por líneas.

### Aplicabilidad de las acciones

| Acción | Aplicable | Adaptación / nota |
|--------|-----------|--------------------|
| **5.1 Analizar chunks** | ✅ Sí | `scripts/analyze-chunks.mjs`: sobre el índice actual, contar cuántos chunks cortan un artículo (p. ej. mismo `metadata.article` en chunks consecutivos o chunks que no empiezan en “Artículo X”). Longitud media de artículos en el corpus. Porcentaje de chunks con solo parte de un artículo. |
| **5.2 Chunking semántico** | ⚠️ Parcial | Ya hay detección de estructura legal (títulos, capítulos, artículos). “Semántico” aquí puede ser: (1) no cortar artículos (ya se intenta con `splitByArticles`); (2) para artículos muy largos, dividir por oraciones o párrafos agrupados en lugar de solo por tamaño. Crear `lib/chunking/semantic-chunker.ts` como evolución: respetar siempre límites de artículo; dentro de un artículo, usar agrupación por párrafos/oraciones si supera 1000 caracteres. |
| **5.3 Overlap inteligente** | ✅ Sí | Mejorar `splitTextBySize` / overlap para que el solapamiento incluya contexto legal útil (ej. no cortar a mitad de un numeral; incluir referencia al artículo en el overlap). Mantener compatibilidad con el formato actual de chunks (id, content, metadata). |
| **5.4 Evaluar nuevo chunking** | ✅ Sí | Re-generar índice con el nuevo chunker; ejecutar benchmark completo; comparar Recall@10 y accuracy con el chunking actual. |

### Entregables aplicables

- Script de análisis de chunks y métricas (cortes de artículos, longitudes).
- Chunking que respete mejor los artículos y, opcionalmente, agrupación semántica dentro de artículos largos.
- Overlap mejorado y evaluación comparativa.

---

## Fase 6: Pipeline automatizado y monitoreo

### Qué tenemos hoy

- No hay pipeline CI/CD específico para RAG (ingest → benchmark → deploy).
- Existe `app/analytics/page.tsx` y rutas de API para analytics; no hay dashboard dedicado a métricas RAG (accuracy, latencia, regresiones).
- Documentación en README y varios docs; no hay `docs/optimization-history.md`.

### Aplicabilidad de las acciones

| Acción | Aplicable | Adaptación / nota |
|--------|-----------|--------------------|
| **6.1 Pipeline CI/CD RAG** | ✅ Sí | `.github/workflows/rag-pipeline.yml`: trigger en cambios en `data/documents/`, `scripts/ingest.mjs`, `lib/embeddings.ts`, `lib/retrieval.ts`, `lib/reranking.ts`, etc. Pasos: validar documentos (o skip si no hay cambios en docs) → opcional ingest (puede ser pesado; considerar solo en branch o nightly) → ejecutar benchmark → comparar con baseline (archivo en repo o artifact) → desplegar o notificar según política. En Vercel, el deploy ya puede ser por push; el workflow puede solo correr benchmark y subir resultados. |
| **6.2 Dashboard de monitoreo** | ✅ Sí | Añadir `app/dashboard/rag-monitor/page.tsx` (o reutilizar sección en `analytics`): leer historial de `data/benchmarks/history/` o de un endpoint que devuelva métricas guardadas (accuracy, latencia p95, etc.). Visualización simple: tablas o gráficos (Chart.js, Recharts). Proteger ruta con auth si el dashboard es interno. |
| **6.3 Alertas** | ✅ Sí | Slack/Email vía webhooks desde GitHub Actions (workflow que corre benchmark y envía resumen a webhook si regresión >2%). No es necesario Slack/Email obligatorio; puede ser solo issue o comentario en PR. |
| **6.4 Documentación** | ✅ Sí | Actualizar README con arquitectura y decisiones de optimización. Crear `docs/optimization-history.md` con fechas, fases y resultados (accuracy, recall, etc.) para cada cambio relevante. |

### Entregables aplicables

- Pipeline que ejecute benchmark y opcionalmente ingest en CI.
- Página de monitoreo RAG (dashboard o sección en analytics).
- Alertas configurables (webhook/issue) y documentación del proceso de optimización.

---

## Consideraciones transversales

### Stack y restricciones

- **Embeddings:** Preferencia por **locales (Xenova)**; las fases que asumen HF API deben marcarse como opcionales o para entornos con API.
- **Runtime:** Vercel serverless → sin estado; caché debe ser externo (Vercel KV) o en memoria con expectativa de cold starts.
- **Juez del benchmark:** `evaluate-accuracy.mjs` depende de un juez (Ollama o `JUDGE_ENDPOINT` + API key). En CI, configurar secretos o usar un runner con Ollama si se quiere benchmark automático completo.

### Orden sugerido de aplicación

1. **Fase 1** (línea base y evaluación): necesario para medir cualquier mejora; incluir RAGAS (o equivalente) y comparación A/B.
2. **Fase 2** (embeddings): impacto alto; mantener Xenova por defecto y comparar con modelos HF solo donde sea aceptable.
3. **Fase 3** (retrieval): grid search es bajo esfuerzo y alto valor; HyDE después, como opción.
4. **Fase 4** (cross-encoder): mejora clara del ranking; caché con KV o in-memory para no disparar latencia.
5. **Fase 5** (chunking): refinar lo que ya existe (artículos + overlap).
6. **Fase 6** (CI/CD + monitoreo): en paralelo o después de tener métricas estables.

### Riesgos ya contemplados en el plan

- **Modelos de embeddings lentos:** mitigar con caché de embeddings de query y, en ingest, con batch size y posible paralelismo.
- **Cross-encoder aumenta latencia:** limitar a top 20 chunks y caché (Vercel KV o in-memory).
- **Regresión al cambiar chunking:** benchmark automático antes de desplegar; opción de rollback del índice.
- **Costos de API:** usar modelos locales donde se pueda; caché y batch para HF/Novita.

---

## Lista de acciones priorizadas para implementación

Acciones directamente aplicables, en orden sugerido:

1. **Fase 1.1** — Mejorar `evaluate-accuracy.mjs`: export estructurado, comparación A/B, muestreo estratificado.
2. **Fase 1.2** — Integrar métricas tipo RAGAS (lib TS `@ikrigel/ragas-lib-typescript` o Python vía subprocess).
3. **Fase 3.1–3.3** — Grid search de retrieval: exponer `HYBRID_ALPHA`, topK, con/sin reranking; script y validación end-to-end.
4. **Fase 2.1–2.4** — Conjunto de prueba de embeddings y script de benchmark (Xenova + opcional HF).
5. **Fase 4.1–4.2** — Benchmark de cross-encoders e integración en `lib/reranking.ts` (dos fases: heurístico + cross-encoder).
6. **Fase 1.3–1.4** — GitHub Action de benchmark y reporte unificado con historial.
7. **Fase 5.1–5.4** — Análisis de chunks y mejora de overlap/chunking semántico.
8. **Fase 3.4–3.5** — HyDE opcional y evaluación.
9. **Fase 4.3** — Caché de reranker (Vercel KV o in-memory).
10. **Fase 6** — Pipeline CI/CD, dashboard RAG y documentación de optimización.

Este análisis se puede usar como checklist: ir marcando acciones aplicadas y ajustando prioridades según resultados de cada fase.
