# FASE 5: Evaluación y Observabilidad — De LLM-as-judge a métricas por capa

**Prioridad:** Media — Necesaria para validar que las fases 0-4 realmente mejoran accuracy  
**Impacto estimado:** No mejora accuracy directamente, pero permite medir y optimizar iterativamente  
**Esfuerzo:** Medio (3-5 días)  
**Dependencias:** Ninguna estricta. Puede ejecutarse en paralelo con cualquier otra fase.

---

## Diagnóstico

### Cuello de botella 10: Evaluación ciega — no se sabe qué capa falla

**Archivos afectados:** `scripts/evaluate-accuracy.mjs`, `data/benchmarks/qa-abogados.json`

**Problemas concretos:**

#### 10a. Evaluación end-to-end sin descomposición por capa

El evaluador actual (`evaluate-accuracy.mjs`) mide la respuesta final contra una referencia del experto. Si el score es bajo, **no se sabe qué falló**:

- ¿El retrieval no encontró el chunk correcto? (problema de recall)
- ¿El reranking puso el chunk incorrecto arriba? (problema de ranking)
- ¿El LLM ignoró el chunk correcto? (problema de generación)
- ¿El LLM alucinó un artículo que no estaba en el contexto? (problema de prompting)

Sin esta descomposición, las mejoras son "a ciegas".

#### 10b. Dataset de evaluación sin ground truth de retrieval

`qa-abogados.json` tiene:
- `pregunta` — la query
- `respuesta_referencia` — respuesta del experto
- `normas_clave` — normas esperadas
- `area`, `dificultad`

**Pero NO tiene:**
- `chunks_esperados` — qué chunks/artículos específicos deberían ser retornados
- `artículos_específicos` — qué artículos exactos deben estar en el contexto

Sin esto, no se puede evaluar el retrieval independientemente.

#### 10c. Juez LLM de 7B con sesgos

El juez `qwen2.5:7b-instruct` tiene capacidad limitada para evaluar calidad legal. Un modelo de 7B evaluando respuestas legales complejas introduce ruido significativo. El prompt del juez trunca las respuestas a 250 chars, perdiendo mucho contexto.

#### 10d. Sin tracing del pipeline

No hay forma de ver, para una query específica:
- Qué chunks retornó el retrieval (con scores)
- Cómo el reranking los reordenó
- Qué contexto exacto recibió el LLM
- Cuántos tokens usó cada paso
- Qué latencia tuvo cada paso

El logger estructura logs pero no permite reconstruir el pipeline completo de una query.

---

## Tareas

### Tarea 5.1: Agregar ground truth de retrieval al dataset

**Qué hacer:**

Enriquecer `data/benchmarks/qa-abogados.json` con información de retrieval esperado:

1. Para cada caso en el dataset, agregar:
   ```json
   {
     "id": "LAB-001",
     "pregunta": "¿Cuántos días de vacaciones le corresponden a un empleado?",
     "respuesta_referencia": "...",
     "normas_clave": ["Art. 186 CST", "Art. 187 CST"],
     "chunks_esperados": [
       {
         "buscar_en_titulo": "Código Sustantivo del Trabajo",
         "buscar_articulo": "Artículo 186",
         "importancia": "critico"
       },
       {
         "buscar_en_titulo": "Código Sustantivo del Trabajo",
         "buscar_articulo": "Artículo 187",
         "importancia": "importante"
       }
     ],
     "area": "laboral",
     "dificultad": "basica"
   }
   ```

2. Crear un script `scripts/annotate-retrieval-ground-truth.mjs`:
   - Para cada caso, ejecuta el retrieval y muestra los top-10 chunks
   - Un humano marca cuáles son correctos (o se usa el juez LLM con las normas_clave)
   - Guarda los chunk IDs correctos en el dataset

3. Idealmente, anotar al menos 50 casos con ground truth de retrieval

**Validación:**
- Al menos 50 casos anotados con chunks esperados
- Cada caso tiene al menos 1 chunk marcado como "crítico"

### Tarea 5.2: Implementar métricas de retrieval independientes

**Qué hacer:**

Crear `scripts/evaluate-retrieval.mjs` que mida la calidad del retrieval sin pasar por generación:

1. Métricas a implementar:
   - **Recall@K**: ¿Cuántos de los chunks esperados aparecen en top-K?
     ```
     Recall@5 = chunks_correctos_en_top5 / total_chunks_correctos
     ```
   - **Precision@K**: ¿Qué proporción de top-K son relevantes?
     ```
     Precision@5 = chunks_correctos_en_top5 / 5
     ```
   - **MRR (Mean Reciprocal Rank)**: ¿En qué posición aparece el primer chunk correcto?
     ```
     MRR = promedio(1 / rank_del_primer_chunk_correcto)
     ```
   - **NDCG@K**: Ranking ponderado por relevancia (crítico vs importante vs nice-to-have)

2. El script debe:
   - Cargar dataset anotado
   - Para cada query: ejecutar solo retrieval (sin generación)
   - Comparar chunks retornados vs chunks esperados
   - Reportar métricas agregadas por área legal y dificultad

3. Output esperado:
   ```
   === RETRIEVAL METRICS ===
   Recall@5:   0.72
   Recall@10:  0.88
   Precision@5: 0.45
   MRR:         0.65
   NDCG@10:     0.71

   Por área:
     laboral:        Recall@5=0.80  MRR=0.72
     constitucional: Recall@5=0.65  MRR=0.58
     ...
   ```

**Validación:**
- El script ejecuta sin errores sobre el dataset anotado
- Las métricas son consistentes (Recall@10 >= Recall@5 siempre)

### Tarea 5.3: Implementar tracing del pipeline

**Qué hacer:**

Para cada request, guardar un trace completo que permita reconstruir qué pasó en cada paso:

1. Crear `lib/tracing.ts`:
   ```typescript
   interface PipelineTrace {
     requestId: string
     query: string
     timestamp: string
     steps: TraceStep[]
     totalLatency: number
   }

   interface TraceStep {
     name: string  // 'embedding' | 'retrieval' | 'bm25' | 'reranking' | 'generation'
     startTime: number
     endTime: number
     latency: number
     input: any   // query embedding, retrieval params, etc.
     output: any  // chunks retornados, scores, etc.
     metadata: Record<string, any>  // tokens usados, modelo, etc.
   }
   ```

2. Modificar `lib/rag.ts` para emitir traces en cada paso:
   - Después de retrieval: guardar los chunks retornados con scores
   - Después de reranking: guardar cómo cambió el orden
   - Después de generación: guardar tokens usados, modelo, latencia

3. Guardar traces en:
   - Desarrollo: `data/traces/{requestId}.json`
   - Producción: en el log estructurado existente (logger.ts) con nivel `trace`

4. Crear endpoint `GET /api/debug/trace/{requestId}` para consultar traces (solo en desarrollo)

**Validación:**
- Para cualquier request, se puede reconstruir qué chunks se retornaron y en qué orden
- El trace incluye latencia de cada paso
- Los traces se limpian automáticamente (retener últimos 100 en desarrollo)

### Tarea 5.4: Mejorar el juez LLM

**Qué hacer:**

1. **No truncar respuestas a 250 chars** — el juez necesita ver la respuesta completa:
   ```javascript
   // evaluate-accuracy.mjs — cambiar:
   const ragShort = ragAnswer.substring(0, 250).replace(/\n+/g, ' ');
   const refShort = referenceAnswer.substring(0, 180).replace(/\n+/g, ' ');
   // por:
   const ragShort = ragAnswer.substring(0, 1500).replace(/\n+/g, ' ');
   const refShort = referenceAnswer.substring(0, 1000).replace(/\n+/g, ' ');
   ```

2. **Usar modelo más capaz como juez**:
   - Local: `qwen2.5:14b-instruct` o `qwen2.5:32b-instruct` (si hay RAM)
   - API: Usar HF Inference con `Qwen/Qwen2.5-72B-Instruct` como juez (gratis)
   - El juez debe ser **más capaz** que el modelo que genera las respuestas

3. **Agregar criterio de retrieval al juez**:
   - Nuevo criterio: `relevancia_contexto` — ¿Las fuentes citadas son las correctas para la pregunta?
   - Pasar las `normas_clave` del dataset al juez para que compare

4. **Aumentar max_tokens del juez** de 300 a 500 para que pueda dar comentarios más detallados

**Validación:**
- Los scores del juez deben ser más consistentes (menos varianza entre evaluaciones de la misma query)
- Ejecutar 10 queries 3 veces cada una: los scores deben variar < 1 punto
- El criterio `relevancia_contexto` debe correlacionar con Recall@5

### Tarea 5.5: Dashboard de métricas por capa

**Qué hacer:**

Crear un reporte que muestre las métricas de cada capa del pipeline lado a lado:

1. Extender `scripts/evaluate-accuracy.mjs` (o crear `scripts/full-diagnostic.mjs`) que:
   - Ejecuta evaluate-retrieval (Tarea 5.2)
   - Ejecuta evaluate-accuracy (existente)
   - Correlaciona: "cuando Recall@5 es bajo, ¿el score de accuracy también es bajo?"
   - Identifica el cuello de botella dominante:
     ```
     DIAGNÓSTICO:
     - Retrieval Recall@5:    0.72 → CUELLO DE BOTELLA (< 0.85)
     - Reranking NDCG@5:      0.80 → OK
     - Generation accuracy:   0.65 → Limitado por retrieval
     - Alucinaciones:         15%  → NECESITA ATENCIÓN
     
     → Priorizar: mejorar retrieval (Recall@5 bajo)
     ```

2. Guardar resultados en `data/benchmarks/diagnostic-{fecha}.json`

3. Script de comparación A/B: `scripts/compare-diagnostics.mjs`:
   - Input: dos archivos de diagnóstico (antes y después de un cambio)
   - Output: tabla comparativa mostrando qué métricas mejoraron/empeoraron

**Validación:**
- El diagnóstico identifica correctamente la capa problemática
- La comparación A/B muestra deltas claros entre dos runs

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `data/benchmarks/qa-abogados.json` | MODIFICAR — agregar chunks_esperados |
| `scripts/evaluate-retrieval.mjs` | CREAR — métricas de retrieval |
| `scripts/full-diagnostic.mjs` | CREAR — diagnóstico por capa |
| `scripts/compare-diagnostics.mjs` | CREAR — comparación A/B |
| `lib/tracing.ts` | CREAR — tracing del pipeline |
| `lib/rag.ts` | MODIFICAR — emitir traces |
| `scripts/evaluate-accuracy.mjs` | MODIFICAR — no truncar, mejor juez, nuevo criterio |

---

## Criterio de éxito

- [ ] Dataset anotado con ≥50 casos que tienen ground truth de retrieval
- [ ] Métricas de retrieval implementadas: Recall@K, Precision@K, MRR, NDCG@K
- [ ] Tracing del pipeline funcional (reconstruir cualquier request paso a paso)
- [ ] Juez LLM mejorado: modelo ≥14B, no trunca respuestas, criterio de retrieval
- [ ] Diagnóstico por capa identifica correctamente el cuello de botella
- [ ] Comparación A/B funcional entre dos runs
