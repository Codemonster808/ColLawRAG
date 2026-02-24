# SPRINT 3: Pipeline de Calidad — Optimizar cada capa del RAG

**Duración:** Semana 5-6  
**Accuracy entrada:** ~70-75% (post Sprint 2)  
**Accuracy objetivo:** 80-85%  
**Concepto:** Con corpus y modelo ya mejorados, ahora cada optimización del pipeline tiene impacto medible.

---

## Contexto para el LLM

ColLawRAG ya tiene embeddings correctos, un modelo 70B+, y un corpus expandido (~800+ docs). Este sprint optimiza las 4 capas del pipeline RAG: chunking, retrieval, reranking y generación. Cada cambio se mide con las métricas de Recall@K y accuracy.

**Archivos clave que debes leer antes de empezar:**
- `scripts/ingest.mjs` — Chunking y embeddings
- `lib/retrieval.ts` — Búsqueda vectorial + BM25
- `lib/bm25.ts` — Implementación BM25
- `lib/reranking.ts` — Reranking heurístico
- `lib/generation.ts` — Llamadas al LLM
- `lib/prompt-templates.ts` — Prompts del sistema y usuario

---

## TAREA 3.1: Chunking — Prefijo jerárquico en cada chunk

**Qué hacer:**

1. Abrir `scripts/ingest.mjs`. Buscar la función `splitByArticles()`.

2. Dentro de la función, trackear el Título, Capítulo y Sección actuales mientras se parsea el texto. Cada vez que se detecta un nuevo "TÍTULO", "CAPÍTULO" o "SECCIÓN", actualizar variables:
   ```javascript
   let currentTitulo = ''
   let currentCapitulo = ''
   let currentSeccion = ''
   ```

3. Al crear cada chunk, prepend un prefijo al contenido:
   ```javascript
   const prefix = `[${docTitle}${currentTitulo ? ' > ' + currentTitulo : ''}${currentCapitulo ? ' > ' + currentCapitulo : ''}${articleId ? ' > ' + articleId : ''}]\n`
   chunk.content = prefix + chunk.content
   ```

4. Guardar la jerarquía en metadata:
   ```javascript
   chunk.metadata.articleHierarchy = `${docTitle} > ${currentTitulo} > ${currentCapitulo} > ${articleId}`
   ```

**Validación:**
- Después de re-ingest, tomar 10 chunks aleatorios y verificar que cada uno empieza con `[Ley X > Título Y > ...]`
- Los embeddings deben capturar mejor el contexto (verificar con una query específica)

---

## TAREA 3.2: Chunking — No cortar artículos, aumentar límite a 2000 chars

**Qué hacer:**

1. En `scripts/ingest.mjs`, buscar `splitLargeChunk(acc, 1000, 150)` o `splitTextBySize(text, 1000, 150)`.

2. Cambiar el límite de 1000 a **2000 caracteres**:
   ```javascript
   splitTextBySize(text, 2000, 300)
   ```

3. Cambiar overlap de 150 a **300 caracteres** (más contexto compartido entre chunks).

4. Modificar la lógica de corte para que respete oraciones completas:
   - En lugar de cortar en el caracter 2000, buscar el último punto (`.`) o punto y coma (`;`) antes de 2000
   - Si no hay punto en los últimos 500 chars, cortar en el último salto de línea

5. El overlap debe empezar desde la última oración completa, no desde un número fijo de caracteres.

**Validación:**
- Ningún chunk debe tener > 2200 chars (2000 + prefijo jerárquico)
- Ningún chunk debe empezar con oración incompleta (sin mayúscula, excepto numerales)
- Ejecutar: `node -e "const d=JSON.parse(require('fs').readFileSync('data/index.json','utf-8')); const short=d.filter(c=>c.content.length<100); console.log('Chunks cortos (<100):', short.length)"` — debe ser < 5% del total

---

## TAREA 3.3: Retrieval — BM25 sobre corpus completo con RRF

**Qué hacer:**

1. Abrir `lib/retrieval.ts`. Actualmente el BM25 solo puntúa chunks que ya fueron seleccionados por vector search (líneas 321-332).

2. Cambiar para que BM25 busque sobre TODO el corpus:
   ```typescript
   // Obtener top-K por BM25 independientemente
   const bm25Results: Array<{id: string, score: number}> = []
   if (bm25Index) {
     const allDocIds = Object.keys(bm25Index.docLengths)
     for (const docId of allDocIds) {
       const score = calculateBM25(query, docId, bm25Index)
       if (score > 0) bm25Results.push({id: docId, score})
     }
     bm25Results.sort((a,b) => b.score - a.score)
   }
   const bm25TopK = bm25Results.slice(0, initialTopK)
   ```

3. Implementar Reciprocal Rank Fusion (RRF) en lugar de weighted sum. Agregar función en `lib/bm25.ts`:
   ```typescript
   export function reciprocalRankFusion(
     vectorResults: Array<{id: string, score: number}>,
     bm25Results: Array<{id: string, score: number}>,
     k: number = 60
   ): Array<{id: string, score: number}> {
     const scores = new Map<string, number>()
     
     vectorResults.forEach((r, rank) => {
       const current = scores.get(r.id) || 0
       scores.set(r.id, current + 1 / (k + rank + 1))
     })
     
     bm25Results.forEach((r, rank) => {
       const current = scores.get(r.id) || 0
       scores.set(r.id, current + 1 / (k + rank + 1))
     })
     
     return Array.from(scores.entries())
       .map(([id, score]) => ({id, score}))
       .sort((a, b) => b.score - a.score)
   }
   ```

4. En `lib/retrieval.ts`, reemplazar el bloque de hybrid scoring (líneas 321-332) con RRF:
   - Obtener vector top-K
   - Obtener BM25 top-K sobre corpus completo
   - Fusionar con RRF
   - Los chunks resultantes de RRF se buscan en el índice local para recuperar su contenido

**Validación:**
- Query exacta: "artículo 64 código sustantivo del trabajo" debe retornar ese artículo en top-3
- Query semántica: "despido sin justa causa" debe retornar artículos relevantes del CST
- Recall@5 debe mejorar vs baseline del Sprint 2

---

## TAREA 3.4: Reranking — Recalibrar heurísticas

**Qué hacer:**

1. Abrir `lib/reranking.ts`. El problema principal es que `hierarchyBoost` de Constitución es +0.60, dominando todo.

2. Reducir TODOS los boosts a rango [0, 0.15]:
   ```typescript
   const LEGAL_HIERARCHY_BOOST: Record<string, number> = {
     constitucion: 0.15,
     codigo: 0.12,
     ley_organica: 0.10,
     ley_estatutaria: 0.10,
     ley: 0.08,
     decreto_ley: 0.06,
     decreto: 0.04,
     resolucion: 0.02,
     jurisprudencia_corte_constitucional: 0.08,
     jurisprudencia_corte_suprema: 0.06,
     jurisprudencia_consejo_estado: 0.06,
     jurisprudencia: 0.04,
     concepto: 0.01,
     default: 0
   }
   ```

3. Corregir la normalización del score en `rerankChunksAdvanced` (línea ~296):
   ```typescript
   // ANTES (incorrecto — asume rango [-1,1]):
   const normalizedScore = Math.max(0, Math.min(1, (score + 1) / 2))
   
   // DESPUÉS (correcto — el score ya está en [0,1] después de RRF):
   const normalizedScore = Math.max(0, Math.min(1, score))
   ```

4. Reducir el `keywordBoost` para evitar que palabras comunes dominen:
   - Filtrar terms de < 4 caracteres antes de calcular keyword boost
   - Reducir boost por título de 0.05 a 0.03
   - Reducir boost por contenido de 0.02 a 0.01

**Validación:**
- Query sobre tutela: chunks constitucionales deben rankear alto SOLO si son relevantes
- Query sobre vacaciones: chunks del CST deben rankear más alto que la Constitución
- Comparar ranking antes y después en 10 queries

---

## TAREA 3.5: Generación — Expandir ventana de contexto

**Qué hacer:**

1. Abrir `lib/generation.ts`. Cambiar los límites (líneas ~40-44):
   ```typescript
   const MAX_CITATIONS_BASE = 12      // de 8
   const MAX_CITATIONS_COMPLEX = 20   // de 16
   const MAX_CONTEXT_CHARS_BASE = 12000   // de 4000
   const MAX_CONTEXT_CHARS_COMPLEX = 24000  // de 8000
   ```

2. Aumentar max_tokens para la respuesta en `.env.example`:
   ```
   HF_MAX_TOKENS=3000  # de 2000
   ```

**Validación:**
- Queries complejas deben recibir más chunks de contexto (verificar en logs)
- Respuestas no deben truncarse (siempre incluyen conclusión y recomendación)

---

## TAREA 3.6: Generación — Simplificar system prompt

**Qué hacer:**

1. Abrir `lib/prompt-templates.ts`. Buscar la función `generateSystemPrompt`.

2. El prompt actual tiene ~700 tokens con duplicaciones. Reducir a ~300 tokens:
   - Eliminar la numeración duplicada (hay dos "2." y dos "3.")
   - Comprimir INSTRUCCIONES HNAC a un bloque corto:
     ```
     FORMATO OBLIGATORIO — Estructura SIEMPRE tu respuesta así:
     **HECHOS RELEVANTES:** [situación del caso]
     **NORMAS APLICABLES:** [normas con citas [1]-[N]]
     **ANÁLISIS JURÍDICO:** [aplicación al caso]
     **CONCLUSIÓN:** [respuesta fundamentada]
     **RECOMENDACIÓN:** [pasos concretos, opcional]
     ```
   - Comprimir regla anti-alucinación a una sola línea:
     ```
     ANTI-ALUCINACIÓN: SOLO cita artículos que aparezcan en las fuentes [1]-[N]. Si no está en las fuentes, di "la información disponible no incluye este aspecto".
     ```
   - Mover las advertencias legales (plazos, prescripción) al user prompt

3. NO eliminar instrucciones — solo comprimir y desduplicar.

**Validación:**
- Contar tokens del system prompt antes y después (objetivo: < 350 tokens)
- Ejecutar 5 queries de prueba — las respuestas deben seguir teniendo estructura HNAC
- La tasa de regeneraciones HNAC debe bajar (verificar en logs de generation.ts)

---

## TAREA 3.7: Re-indexar y benchmark post-pipeline

**Qué hacer:**

1. Re-indexar con nuevo chunking (Tareas 3.1-3.2):
   ```bash
   node scripts/ingest.mjs
   npx tsx scripts/build-bm25.ts
   ```

2. Ejecutar evaluación de retrieval:
   ```bash
   node scripts/evaluate-retrieval.mjs --output data/benchmarks/sprint3-retrieval.json
   ```

3. Ejecutar benchmark completo:
   ```bash
   node scripts/evaluate-accuracy.mjs --output data/benchmarks/sprint3-completo-$(date +%Y-%m-%d).json --copy-to-history
   ```

4. Comparar con Sprint 2 y documentar en `docs/sprints/SPRINT_3_RESULTADOS.md`

**Validación:**
- Recall@10 ≥ 0.80 (mejora vs Sprint 2)
- Accuracy ≥ 75% (objetivo: 80-85%)
- Latencia < 10 segundos

---

## Orden de ejecución

```
3.1 Prefijo jerárquico ──┐
3.2 Chunks más grandes ──┘
         │
         ▼
3.7a Re-indexar ──────────── (OBLIGATORIO después de cambiar chunking)
         │
    ┌────┴────┐
    ▼         ▼
3.3 BM25+RRF  3.4 Recalibrar
              reranking
         │         │
         └────┬────┘
              ▼
3.5 Expandir contexto ──┐
3.6 Simplificar prompts ┘
              │
              ▼
3.7b Benchmark post-pipeline
```

---

## Checklist del sprint

- [ ] 3.1 — Cada chunk tiene prefijo jerárquico [Ley > Título > Artículo]
- [ ] 3.2 — Chunks de hasta 2000 chars, overlap 300, corte por oraciones
- [ ] 3.3 — BM25 busca sobre corpus completo, fusión con RRF
- [ ] 3.4 — Boosts de jerarquía reducidos a [0, 0.15], normalización corregida
- [ ] 3.5 — Contexto expandido a 12,000-24,000 chars
- [ ] 3.6 — System prompt < 350 tokens, sin duplicaciones
- [ ] 3.7 — Re-indexado + benchmark ejecutado y documentado
- [ ] Recall@10 ≥ 0.80
- [ ] Accuracy post-sprint ≥ 75%
