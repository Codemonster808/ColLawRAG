# SPRINT 1: Fundamentos — De roto a funcional

**Duración:** Semana 1-2  
**Accuracy actual:** 32.7%  
**Accuracy objetivo:** 55-65%  
**Concepto:** Arreglar lo que está roto (embeddings) + probar un modelo capaz = duplicar accuracy

---

## Contexto para el LLM

ColLawRAG es un sistema RAG para derecho colombiano (Next.js + TypeScript). Tiene 32.7% de accuracy porque los embeddings de ingest y query usan modelos diferentes. Este sprint arregla eso y prueba modelos de generación más capaces.

**Archivos clave que debes leer antes de empezar:**
- `lib/embeddings.ts` — Genera embeddings para queries
- `lib/retrieval.ts` — Carga índice y ejecuta búsqueda
- `lib/rag.ts` — Pipeline principal
- `lib/generation.ts` — Llama al LLM para generar respuestas
- `scripts/ingest.mjs` — Indexa documentos (genera embeddings de los chunks)
- `.env.example` — Variables de entorno disponibles

---

## TAREA 1.1: Unificar modelo de embeddings

**Problema:** `scripts/ingest.mjs` usa `Xenova/paraphrase-multilingual-MiniLM-L12-v2` para indexar, pero `lib/embeddings.ts` usa `Xenova/all-MiniLM-L6-v2` (local) o `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` (HF API) para queries. Espacios vectoriales distintos = similitud coseno aleatoria.

**Qué hacer:**

1. Abrir `lib/embeddings.ts`. En la línea 1, ver:
   ```
   const HF_MODEL = process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2'
   ```
   En la línea 3:
   ```
   const EMB_MODEL = process.env.EMB_MODEL || 'Xenova/all-MiniLM-L6-v2'
   ```

2. Crear una constante compartida `EMBEDDING_MODEL` que se use en AMBOS archivos:
   - En `lib/embeddings.ts`: cambiar los defaults para que tanto HF como Xenova usen el MISMO modelo base
   - Si `EMB_PROVIDER=hf`: usar `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` (768d)
   - Si `EMB_PROVIDER=xenova`: usar `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384d) — el mismo que usa ingest

3. Abrir `scripts/ingest.mjs` y buscar dónde define el modelo de embeddings. Asegurarse de que usa el mismo modelo que `lib/embeddings.ts` para el provider correspondiente.

4. Agregar validación en `lib/embeddings.ts` función `embedTexts()`:
   - Después de obtener el vector, verificar que su dimensión (`.length`) coincide con lo esperado
   - Si `EMB_PROVIDER=hf` y la dimensión no es 768, log error
   - Si `EMB_PROVIDER=xenova` y la dimensión no es 384, log error

5. Actualizar `.env.example` con documentación clara:
   ```
   # Embedding model — DEBE ser el mismo en ingest y query
   # HF API: sentence-transformers/paraphrase-multilingual-mpnet-base-v2 (768d)
   # Xenova local: Xenova/paraphrase-multilingual-MiniLM-L12-v2 (384d)
   EMB_PROVIDER=hf
   ```

**Validación:**
- Ejecutar: `node -e "const {embedText} = require('./lib/embeddings'); embedText('test').then(v => console.log('dim:', v.length))"`
- La dimensión debe coincidir con la del primer chunk en `data/index.json`

---

## TAREA 1.2: Eliminar doble retrieval del pipeline

**Problema:** `lib/rag.ts` ejecuta dos retrievals por query: uno rápido (topK=5) solo para estimar complejidad, luego otro completo. Duplica latencia.

**Qué hacer:**

1. Abrir `lib/rag.ts`. Buscar la línea:
   ```typescript
   const quickRetrieval = await retrieveRelevantChunks(query, filters, 5)
   ```

2. Eliminar esa línea y la llamada `detectComplexity(query, quickRetrieval.length)`.

3. Reemplazar con detección de complejidad solo basada en la query (sin chunks):
   ```typescript
   const detectedComplexity = detectComplexity(query, 8) // 8 como estimación default
   ```

4. Alternativamente, refactorizar `detectComplexity` en `lib/prompt-templates.ts` para que el segundo parámetro sea opcional con default 8. Buscar la función `detectComplexity` y cambiar su firma:
   ```typescript
   export function detectComplexity(query: string, chunksCount: number = 8): 'baja' | 'media' | 'alta' {
   ```

5. Verificar que solo queda UNA llamada a `retrieveRelevantChunks` en `rag.ts`:
   ```typescript
   const retrieved = await retrieveRelevantChunks(query, filters, adaptiveTopK)
   ```

**Validación:**
- Buscar en `lib/rag.ts` cuántas veces aparece `retrieveRelevantChunks` — debe ser exactamente 1
- Ejecutar una query y medir latencia: debe ser ~50% menos

---

## TAREA 1.3: Eliminar fake embeddings en producción

**Problema:** `lib/embeddings.ts` tiene una función `fakeEmbed()` que genera vectores aleatorios. Si la configuración es incorrecta, el sistema usa estos vectores silenciosamente y el retrieval es ruido puro.

**Qué hacer:**

1. Abrir `lib/embeddings.ts`. Buscar la función `fakeEmbed`.

2. En la función `embedTexts()`, en cada punto donde se llama `fakeEmbed`:
   - Cuando `EMB_PROVIDER === 'local'` (línea ~31-32): agregar un log de warning
   - En el catch de Xenova (línea ~48): agregar log de error
   - En el catch de HF (línea ~107-108): agregar log de error

3. Agregar estos logs:
   ```typescript
   console.error('[embeddings] CRITICAL: Using fake random embeddings. Retrieval quality is ZERO. Check EMB_PROVIDER and HUGGINGFACE_API_KEY configuration.')
   ```

4. En producción (`process.env.NODE_ENV === 'production'`), en lugar de fallback silencioso, lanzar error:
   ```typescript
   if (process.env.NODE_ENV === 'production') {
     throw new Error('Fake embeddings not allowed in production. Configure EMB_PROVIDER and HUGGINGFACE_API_KEY.')
   }
   ```

5. NO eliminar `fakeEmbed` completamente — sigue siendo útil para tests. Solo agregar los warnings y el bloqueo en producción.

**Validación:**
- En desarrollo sin API key: debe aparecer warning en la consola
- En producción sin API key: debe fallar con error descriptivo

---

## TAREA 1.4: Re-indexar el corpus completo

**Problema:** Después de unificar embeddings (Tarea 1.1), el índice actual tiene vectores generados con el modelo antiguo. Hay que regenerar.

**Qué hacer:**

1. Verificar que `.env.local` tiene las variables correctas:
   ```
   EMB_PROVIDER=hf (o xenova)
   HUGGINGFACE_API_KEY=tu-key
   ```

2. Ejecutar re-indexación:
   ```bash
   node scripts/ingest.mjs
   ```

3. Esperar a que termine (~746 documentos). Verificar que el log muestra:
   - El modelo de embeddings usado
   - Cantidad de chunks generados
   - Sin errores de "fake embeddings"

4. Reconstruir índice BM25:
   ```bash
   npx tsx scripts/build-bm25.ts
   ```

5. Verificar que los archivos se generaron:
   - `data/index.json` debe existir y tener tamaño > 100MB
   - `data/bm25-index.json` debe existir y tener tamaño > 30MB

**Validación:**
- Ejecutar una query de prueba conocida:
  ```bash
  curl -X POST http://localhost:3000/api/rag -H 'Content-Type: application/json' -d '{"query":"cuántos días de vacaciones tiene un empleado en Colombia"}'
  ```
- La respuesta debe mencionar el Artículo 186 del CST
- El campo `retrieved` debe ser > 0

---

## TAREA 1.5: Benchmarkear DeepSeek V3 (ya integrado)

**Problema:** El modelo actual (Qwen2.5-7B) tiene accuracy de ~32%. DeepSeek V3 ya está integrado pero nunca se ha benchmarkeado.

**Qué hacer:**

1. Verificar que el provider Novita está integrado en `lib/generation.ts`. Buscar `provider === 'novita'`.

2. Configurar `.env.local`:
   ```
   GEN_PROVIDER=novita
   HF_GENERATION_MODEL=deepseek/deepseek-v3
   ```

3. Ejecutar benchmark sobre muestra pequeña primero (5 casos):
   ```bash
   node scripts/evaluate-accuracy.mjs --limit 5
   ```
   Verificar que el juez (Ollama) está corriendo o configurar endpoint externo.

4. Si funciona, ejecutar sobre muestra estratificada (30 casos):
   ```bash
   node scripts/evaluate-accuracy.mjs --stratify area --sample 30
   ```

5. Guardar resultados con nombre descriptivo:
   ```bash
   cp data/benchmarks/results-$(date +%Y-%m-%d).json data/benchmarks/deepseek-v3-$(date +%Y-%m-%d).json
   ```

6. Comparar score con el baseline de 32.7%.

**Validación:**
- El archivo de resultados debe tener `evaluados >= 25`
- El `score_promedio` debe ser mayor que 3.27 (baseline actual)
- Si DeepSeek V3 supera 5.5/10, adoptarlo como modelo primario

---

## TAREA 1.6: Integrar Groq como opción de generación (Llama 3.3 70B)

**Problema:** Se necesita un modelo más capaz sin depender solo de HF. Groq ofrece Llama 3.3 70B con latencia muy baja y costo moderado.

**Qué hacer:**

1. Abrir `lib/generation.ts`.

2. Agregar un nuevo bloque en `generateWithModel()`, después del bloque `novita` y antes del bloque HF default:
   ```typescript
   if (provider === 'groq') {
     const apiUrl = 'https://api.groq.com/openai/v1/chat/completions'
     const groqKey = process.env.GROQ_API_KEY
     if (!groqKey) throw new Error('GROQ_API_KEY not set')
     const controller = new AbortController()
     const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
     try {
       const response = await fetch(apiUrl, {
         method: 'POST',
         headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({
           model,
           messages: [
             { role: 'system', content: systemPrompt },
             { role: 'user', content: userPrompt },
           ],
           max_tokens: maxTokens,
           temperature: 0.1,
         }),
         signal: controller.signal,
       })
       clearTimeout(timeoutId)
       if (!response.ok) {
         const errorText = await response.text()
         throw new Error(`Groq API error: ${response.status} - ${errorText}`)
       }
       const data = await response.json()
       if (data.choices?.[0]?.message?.content) return data.choices[0].message.content.trim()
       throw new Error('No content in Groq response')
     } catch (err) {
       clearTimeout(timeoutId)
       if (err.name === 'AbortError') throw new Error(`Groq timeout after ${timeoutMs}ms`)
       throw err
     }
   }
   ```

3. Actualizar `.env.example`:
   ```
   # Groq (Llama 3.3 70B — rápido y económico)
   # GEN_PROVIDER=groq
   # GROQ_API_KEY=gsk_...
   # HF_GENERATION_MODEL=llama-3.3-70b-versatile
   ```

4. NO cambiar el provider por defecto — solo agregar la opción.

**Validación:**
- Configurar `GEN_PROVIDER=groq`, `GROQ_API_KEY=...`, `HF_GENERATION_MODEL=llama-3.3-70b-versatile`
- Ejecutar una query de prueba
- La respuesta debe ser más detallada y estructurada que con 7B

---

## TAREA 1.7: A/B test — 7B vs DeepSeek vs Groq

**Problema:** Necesitamos datos para decidir qué modelo usar como primario.

**Qué hacer:**

1. Ejecutar benchmark con cada modelo sobre los mismos 30 casos (estratificados por área):

   ```bash
   # Modelo actual: Qwen2.5-7B
   export GEN_PROVIDER=hf
   export HF_GENERATION_MODEL=Qwen/Qwen2.5-7B-Instruct
   node scripts/evaluate-accuracy.mjs --stratify area --sample 30 --output data/benchmarks/ab-qwen7b-$(date +%Y-%m-%d).json

   # DeepSeek V3
   export GEN_PROVIDER=novita
   export HF_GENERATION_MODEL=deepseek/deepseek-v3
   node scripts/evaluate-accuracy.mjs --stratify area --sample 30 --output data/benchmarks/ab-deepseek-$(date +%Y-%m-%d).json

   # Groq Llama 3.3 70B (si ya está integrado)
   export GEN_PROVIDER=groq
   export HF_GENERATION_MODEL=llama-3.3-70b-versatile
   node scripts/evaluate-accuracy.mjs --stratify area --sample 30 --output data/benchmarks/ab-groq70b-$(date +%Y-%m-%d).json
   ```

2. Comparar resultados usando:
   ```bash
   node scripts/compare-benchmark-results.mjs data/benchmarks/ab-qwen7b-*.json data/benchmarks/ab-deepseek-*.json
   ```

3. Crear tabla comparativa en un archivo `data/benchmarks/ab-test-summary.md`:
   ```
   | Modelo | Score | Accuracy | Latencia promedio | Costo/query |
   ```

4. El modelo ganador se configura como `HF_GENERATION_MODEL` default en `.env.example` y `.env.local`.

**Validación:**
- Los 3 benchmarks usan exactamente los mismos 30 casos (mismo seed de estratificación)
- El modelo ganador tiene accuracy ≥ 50% (vs 32% actual)
- Documentar la decisión con datos

---

## TAREA 1.8: Benchmark post-fix (medir impacto de Sprint 1)

**Problema:** Después de arreglar embeddings + nuevo modelo, necesitamos medir el accuracy real.

**Qué hacer:**

1. Con el modelo ganador del A/B test configurado como default.
2. Ejecutar benchmark COMPLETO (180 casos):
   ```bash
   node scripts/evaluate-accuracy.mjs --output data/benchmarks/sprint1-completo-$(date +%Y-%m-%d).json --copy-to-history
   ```

3. Comparar con el baseline:
   ```bash
   node scripts/compare-benchmark-results.mjs data/benchmarks/local-benchmark-2026-02-19-fase1.json data/benchmarks/sprint1-completo-*.json
   ```

4. Documentar resultados en `docs/sprints/SPRINT_1_RESULTADOS.md`:
   - Score antes vs después
   - Mejora por área legal
   - Mejora por criterio (normativa, artículos, alucinaciones, completitud)
   - Modelo seleccionado y por qué

**Validación:**
- El accuracy post-fix debe ser ≥ 50% (objetivo conservador: 55-65%)
- Si no llega a 50%, revisar que los embeddings se unificaron correctamente

---

## Orden de ejecución

```
1.1 Unificar embeddings ──────┐
1.2 Eliminar doble retrieval ─┤
1.3 Eliminar fake en prod ────┘
         │
         ▼
1.4 Re-indexar corpus ────────── (OBLIGATORIO después de 1.1)
         │
         ▼
1.5 Benchmark DeepSeek V3 ──┐
1.6 Integrar Groq ──────────┤── (pueden hacerse en paralelo)
         │                   │
         ▼                   │
1.7 A/B test comparativo ───┘
         │
         ▼
1.8 Benchmark post-fix completo
```

---

## Checklist del sprint

- [ ] 1.1 — Un solo modelo de embeddings en ingest Y query
- [ ] 1.2 — Una sola llamada a `retrieveRelevantChunks` en `rag.ts`
- [ ] 1.3 — Fake embeddings bloqueados en producción
- [ ] 1.4 — Corpus re-indexado con embeddings correctos
- [ ] 1.5 — Benchmark de DeepSeek V3 ejecutado
- [ ] 1.6 — Groq integrado como opción
- [ ] 1.7 — A/B test ejecutado con ≥3 modelos
- [ ] 1.8 — Benchmark completo (180 casos) post-fix ejecutado y documentado
- [ ] Accuracy post-sprint ≥ 50%
