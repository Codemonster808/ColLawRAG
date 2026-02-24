# SPRINT 4: Producto Comercial — Features que hacen al RAG confiable y usable

**Duración:** Semana 7-8  
**Accuracy entrada:** ~80-85% (post Sprint 3)  
**Accuracy objetivo:** 85-90% (accuracy percibido — la abstención sube el % real)  
**Concepto:** El sistema ya responde bien cuando tiene la información. Ahora necesita saber cuándo NO responder, dar confianza al usuario, y mejorar continuamente.

---

## Contexto para el LLM

ColLawRAG ya tiene un pipeline optimizado con ~80% accuracy. Este sprint agrega features de producto que lo hacen comercializable: abstención inteligente (no responder cuando no sabe), indicador de confianza, citas verificables, y feedback loop. Estos features no mejoran el pipeline directamente pero suben el accuracy percibido dramáticamente (al dejar de dar respuestas malas).

**Archivos clave que debes leer antes de empezar:**
- `lib/rag.ts` — Pipeline principal (aquí se agrega abstención)
- `lib/retrieval.ts` — Scores de retrieval (para calcular confianza)
- `lib/types.ts` — Tipos de respuesta (para agregar campos)
- `app/api/rag/route.ts` — Endpoint API (para exponer nuevos campos)
- `components/ResultsDisplay.tsx` — UI de resultados (para mostrar confianza)
- `app/api/feedback/route.ts` — Endpoint de feedback existente

---

## TAREA 4.1: Abstención inteligente — Umbral de confianza en retrieval

**Problema:** El sistema SIEMPRE responde, incluso cuando no tiene información relevante. Esto produce alucinaciones.

**Qué hacer:**

1. Abrir `lib/rag.ts`. Después de la línea donde se ejecuta el retrieval (`const retrieved = await retrieveRelevantChunks(...)`).

2. Calcular un score de confianza basado en los chunks retornados:
   ```typescript
   function calculateRetrievalConfidence(
     retrieved: Array<{chunk: DocumentChunk; score: number}>
   ): { level: 'alta' | 'media' | 'baja' | 'insuficiente'; score: number; reason: string } {
     if (retrieved.length === 0) {
       return { level: 'insuficiente', score: 0, reason: 'No se encontraron documentos relevantes' }
     }
     
     const topScore = retrieved[0].score
     const avgTop3 = retrieved.slice(0, 3).reduce((sum, r) => sum + r.score, 0) / Math.min(retrieved.length, 3)
     
     if (topScore < 0.25 || avgTop3 < 0.20) {
       return { level: 'insuficiente', score: avgTop3, reason: 'Los documentos encontrados tienen baja relevancia' }
     }
     if (topScore < 0.45 || avgTop3 < 0.35) {
       return { level: 'baja', score: avgTop3, reason: 'Información parcial disponible' }
     }
     if (topScore < 0.65 || avgTop3 < 0.50) {
       return { level: 'media', score: avgTop3, reason: 'Información disponible con cobertura moderada' }
     }
     return { level: 'alta', score: avgTop3, reason: 'Información relevante disponible' }
   }
   ```

3. En `runRagPipeline`, después del retrieval, evaluar confianza:
   ```typescript
   const confidence = calculateRetrievalConfidence(retrieved)
   
   if (confidence.level === 'insuficiente') {
     return {
       answer: `No tengo información suficiente para responder esta consulta con precisión.\n\n**Razón:** ${confidence.reason}\n\n**Recomendación:** Consulta con un abogado especializado en ${detectedLegalArea || 'derecho colombiano'} para obtener asesoría personalizada sobre este tema.`,
       citations: [],
       retrieved: 0,
       requestId,
       detectedLegalArea,
       confidence: { level: 'insuficiente', score: confidence.score },
       metadata: { responseTime: Date.now() - startTime }
     }
   }
   ```

4. Para confianza 'baja', agregar advertencia al inicio de la respuesta (después de generar):
   ```typescript
   if (confidence.level === 'baja') {
     response.answer = `⚠️ **Confianza baja:** La información disponible puede ser incompleta. Verifica con un abogado.\n\n${response.answer}`
   }
   ```

5. Agregar campo `confidence` al tipo `RagResponse` en `lib/types.ts`:
   ```typescript
   confidence?: {
     level: 'alta' | 'media' | 'baja' | 'insuficiente'
     score: number
   }
   ```

**Validación:**
- Query sobre tema NO cubierto ("ley de inteligencia artificial en Colombia"): debe retornar abstención
- Query sobre tema cubierto ("vacaciones empleado"): debe retornar respuesta con confianza alta/media
- Los umbrales deben calibrarse con 20 queries de prueba (10 cubiertas, 10 no cubiertas)

---

## TAREA 4.2: Indicador de confianza en la UI

**Qué hacer:**

1. Abrir `components/ResultsDisplay.tsx`.

2. Agregar un badge visual de confianza antes de la respuesta:
   ```tsx
   {result.confidence && (
     <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-4 ${
       result.confidence.level === 'alta' ? 'bg-green-100 text-green-800' :
       result.confidence.level === 'media' ? 'bg-yellow-100 text-yellow-800' :
       result.confidence.level === 'baja' ? 'bg-orange-100 text-orange-800' :
       'bg-red-100 text-red-800'
     }`}>
       {result.confidence.level === 'alta' ? '✓ Alta confianza' :
        result.confidence.level === 'media' ? '~ Confianza media' :
        result.confidence.level === 'baja' ? '⚠ Baja confianza' :
        '✗ Información insuficiente'}
     </div>
   )}
   ```

3. Si hay `vigenciaValidation.warnings`, mostrarlos con estilo de alerta:
   ```tsx
   {result.vigenciaValidation?.warnings?.length > 0 && (
     <div className="bg-amber-50 border-l-4 border-amber-400 p-3 mb-4 text-sm text-amber-800">
       <strong>Vigencia:</strong>
       <ul>{result.vigenciaValidation.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
     </div>
   )}
   ```

**Validación:**
- Verificar visualmente que el badge aparece en diferentes queries
- Confianza alta = verde, media = amarillo, baja = naranja, insuficiente = rojo

---

## TAREA 4.3: Citas verificables con texto fuente

**Qué hacer:**

1. Abrir `app/api/rag/route.ts`. Las citas ya se incluyen en la respuesta como array `citations`.

2. Enriquecer cada cita con un fragmento del texto fuente. En `lib/rag.ts`, donde se construyen las citas (buscar `const citations = chunksForGeneration.map`):
   ```typescript
   const citations = chunksForGeneration.map((r) => ({
     id: r.chunk.metadata.id || r.chunk.id,
     title: r.chunk.metadata.title,
     type: r.chunk.metadata.type,
     url: r.chunk.metadata.url,
     article: r.chunk.metadata.article,
     score: r.score,
     excerpt: r.chunk.content.substring(0, 300) + (r.chunk.content.length > 300 ? '...' : ''),
     hierarchy: r.chunk.metadata.articleHierarchy
   }))
   ```

3. Actualizar `RagResponse` en `lib/types.ts` para incluir `excerpt` y `hierarchy` en citations:
   ```typescript
   citations: Array<{
     id: string
     title: string
     type: DocType
     url?: string
     article?: string
     score?: number
     excerpt?: string
     hierarchy?: string
   }>
   ```

4. En `components/ResultsDisplay.tsx`, hacer las citas expandibles:
   ```tsx
   {citation.excerpt && (
     <details className="mt-1">
       <summary className="cursor-pointer text-blue-600 text-sm">Ver texto fuente</summary>
       <blockquote className="mt-2 pl-3 border-l-2 border-gray-300 text-sm text-gray-600 italic">
         {citation.excerpt}
       </blockquote>
     </details>
   )}
   ```

**Validación:**
- Cada cita en la respuesta debe tener un `excerpt` con texto real de la norma
- El usuario puede expandir/colapsar el texto fuente
- Las URLs (si existen) deben ser clickeables

---

## TAREA 4.4: Feedback loop — Thumbs up/down

**Qué hacer:**

1. Ya existe `app/api/feedback/route.ts`. Verificar que funciona y qué datos guarda.

2. En `components/ResultsDisplay.tsx`, agregar botones de feedback después de cada respuesta:
   ```tsx
   <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-200">
     <span className="text-sm text-gray-500">¿Fue útil esta respuesta?</span>
     <button
       onClick={() => submitFeedback(result.requestId, 'positive')}
       className="px-3 py-1 text-sm rounded-md border border-green-300 text-green-700 hover:bg-green-50"
     >
       👍 Sí
     </button>
     <button
       onClick={() => submitFeedback(result.requestId, 'negative')}
       className="px-3 py-1 text-sm rounded-md border border-red-300 text-red-700 hover:bg-red-50"
     >
       👎 No
     </button>
   </div>
   ```

3. La función `submitFeedback`:
   ```typescript
   async function submitFeedback(requestId: string, type: 'positive' | 'negative') {
     await fetch('/api/feedback', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ requestId, type, timestamp: new Date().toISOString() })
     })
   }
   ```

4. En el backend, guardar el feedback asociado al `requestId` para poder correlacionar con la query y respuesta.

5. Cuando el feedback es negativo, guardar la query + respuesta en `data/eval/negative-feedback.json` para revisión manual posterior y alimentar el dataset de evaluación.

**Validación:**
- Los botones aparecen después de cada respuesta
- Al hacer click, se envía POST a `/api/feedback` exitosamente
- Los feedbacks negativos se acumulan en un archivo consultable

---

## TAREA 4.5: Contexto enriquecido para el LLM (vigencia + jerarquía en fuentes)

**Qué hacer:**

1. Abrir `lib/generation.ts`. Buscar donde se construye el contexto (la función `generateAnswerSpanish`), específicamente donde se crea `block` para cada chunk.

2. Enriquecer el formato de cada fuente:
   ```typescript
   // ANTES:
   const block = `Fuente [${i + 1}] (${r.chunk.metadata.title}${articleInfo}):
   ${r.chunk.content}`
   
   // DESPUÉS:
   const vigenciaTag = '' // Se llenará abajo
   const hierarchyTag = r.chunk.metadata.articleHierarchy ? ` | ${r.chunk.metadata.articleHierarchy}` : ''
   
   // Verificar vigencia
   let vigenciaInfo = '[VIGENTE]'
   try {
     const normaId = inferNormaIdFromTitle(r.chunk.metadata.title)
     if (normaId) {
       const vigencia = consultarVigencia(normaId)
       if (vigencia?.estado === 'derogada') {
         vigenciaInfo = `[DEROGADA${vigencia.derogadaPor ? ' por ' + vigencia.derogadaPor : ''}]`
       } else if (vigencia?.estado === 'parcialmente_derogada') {
         vigenciaInfo = '[PARCIALMENTE MODIFICADA]'
       }
     }
   } catch {}
   
   const block = `Fuente [${i + 1}] (${r.chunk.metadata.title}${articleInfo}) ${vigenciaInfo}${hierarchyTag}:
   ${r.chunk.content}`
   ```

3. Importar `inferNormaIdFromTitle` y `consultarVigencia` en `lib/generation.ts` si no están importados.

**Validación:**
- El contexto enviado al LLM debe mostrar `[VIGENTE]` o `[DEROGADA]` en cada fuente
- El LLM debe advertir en su respuesta cuando cita una fuente derogada
- Verificar en logs que el contexto se construye correctamente

---

## TAREA 4.6: Benchmark final — medir accuracy comercial

**Qué hacer:**

1. Ejecutar benchmark completo:
   ```bash
   node scripts/evaluate-accuracy.mjs --output data/benchmarks/sprint4-final-$(date +%Y-%m-%d).json --copy-to-history
   ```

2. Ejecutar evaluación de retrieval:
   ```bash
   node scripts/evaluate-retrieval.mjs --output data/benchmarks/sprint4-retrieval.json
   ```

3. Calcular accuracy ajustado por abstención:
   - Accuracy bruto = respuestas correctas / total queries
   - Accuracy ajustado = respuestas correctas / (total queries - abstenciones)
   - El ajustado debe ser significativamente más alto

4. Generar reporte final en `docs/sprints/SPRINT_4_RESULTADOS.md`:
   ```
   | Métrica | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 |
   |---------|----------|----------|----------|----------|
   | Accuracy bruto | X% | X% | X% | X% |
   | Accuracy ajustado | — | — | — | X% |
   | Recall@10 | — | X | X | X |
   | Abstenciones | 0 | 0 | 0 | X |
   ```

5. Comparar progresión desde el baseline de 32.7%

**Validación:**
- Accuracy bruto ≥ 80%
- Accuracy ajustado ≥ 85%
- Recall@10 ≥ 0.85
- Tasa de abstención < 15% (no debe abstenerse en exceso)

---

## Orden de ejecución

```
4.1 Abstención inteligente ──┐
4.5 Contexto enriquecido ────┘── (backend, pueden ser paralelas)
         │
         ▼
4.2 Indicador confianza UI ──┐
4.3 Citas verificables ──────┤── (frontend, pueden ser paralelas)
4.4 Feedback loop ────────────┘
         │
         ▼
4.6 Benchmark final
```

---

## Checklist del sprint

- [ ] 4.1 — Abstención inteligente implementada (umbral de confianza)
- [ ] 4.2 — Badge de confianza visible en UI (verde/amarillo/naranja/rojo)
- [ ] 4.3 — Citas con `excerpt` expandible y `hierarchy`
- [ ] 4.4 — Botones de feedback (thumbs up/down) funcionales
- [ ] 4.5 — Contexto del LLM incluye vigencia y jerarquía por fuente
- [ ] 4.6 — Benchmark final ejecutado y documentado
- [ ] Accuracy bruto ≥ 80%
- [ ] Accuracy ajustado (sin abstenciones) ≥ 85%
- [ ] Tasa de abstención entre 5-15%
