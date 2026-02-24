# FASE 0: Correcciones Críticas — Inconsistencias que destruyen accuracy

**Prioridad:** URGENTE — Sin esto, ninguna otra mejora tendrá efecto real  
**Impacto estimado:** +15-25% accuracy  
**Esfuerzo:** Bajo (1-2 días)  
**Dependencias:** Ninguna

---

## Diagnóstico

### Cuello de botella 1: Modelos de embeddings INCOMPATIBLES entre ingest y query

**Archivo afectado:** `lib/embeddings.ts` (líneas 1-3) y `scripts/ingest.mjs`

El sistema usa **modelos diferentes** para indexar vs buscar:

- **Ingest** (`scripts/ingest.mjs`): usa `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384 dimensiones)
- **Query local** (`lib/embeddings.ts` línea 3): usa `Xenova/all-MiniLM-L6-v2` (384 dimensiones, pero espacio vectorial diferente)
- **Query HF** (`lib/embeddings.ts` línea 1): usa `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` (768 dimensiones)

**Consecuencia:** La similitud coseno entre vectores generados por modelos distintos es **aleatoria**. El retrieval está roto silenciosamente. Es como buscar en español en un índice en chino.

**Evidencia en código:**

```
// lib/embeddings.ts
const HF_MODEL = process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2'  // 768d
const EMB_MODEL = process.env.EMB_MODEL || 'Xenova/all-MiniLM-L6-v2'  // 384d, distinto a ingest
```

### Cuello de botella 2: Doble retrieval innecesario en el pipeline

**Archivo afectado:** `lib/rag.ts` (líneas 271-284)

El pipeline ejecuta **dos retrievals completos** por cada consulta:

1. Línea 271: `quickRetrieval = await retrieveRelevantChunks(query, filters, 5)` — solo para detectar complejidad
2. Línea 284: `retrieved = await retrieveRelevantChunks(query, filters, adaptiveTopK)` — el retrieval real

Cada retrieval calcula embeddings de la query + escaneo lineal de ~33k chunks. Esto **duplica la latencia** (~2x) sin beneficio real porque `detectComplexity()` solo necesita saber cuántos chunks hay (podría estimarse sin retrieval).

### Cuello de botella 3: Fallback a embeddings aleatorios sin advertencia

**Archivo afectado:** `lib/embeddings.ts` (línea 32, 48, 108)

Cuando `EMB_PROVIDER === 'local'`, el sistema genera **vectores pseudoaleatorios** (`fakeEmbed`). Esto está diseñado para desarrollo, pero si la configuración no es correcta en producción, el retrieval se basa en ruido puro. No hay ningún log de error ni advertencia.

---

## Tareas

### Tarea 0.1: Unificar modelo de embeddings

**Qué hacer:**

1. Decidir UN modelo para todo el pipeline. Recomendación: `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` (768d, mejor calidad multilingüe) si se usa HF API, o `Xenova/paraphrase-multilingual-MiniLM-L12-v2` si se prefiere local.

2. Modificar `lib/embeddings.ts`:
   - Cambiar `EMB_MODEL` default para que coincida con el modelo usado en ingest
   - O mejor: leer el modelo desde una constante compartida o variable de entorno `EMBEDDING_MODEL` que se use tanto en ingest como en query

3. Modificar `scripts/ingest.mjs`:
   - Que lea la misma variable de entorno `EMBEDDING_MODEL`
   - O importar la constante desde un módulo compartido

4. **RE-INDEXAR** todos los documentos después del cambio. Este paso es obligatorio.

**Validación:**
- Ejecutar una query conocida antes y después del cambio
- Comparar los top-5 chunks retornados
- El score de cosine similarity del primer resultado debe ser > 0.6 (antes probablemente es < 0.3)

### Tarea 0.2: Eliminar el doble retrieval

**Qué hacer:**

1. En `lib/rag.ts`, eliminar el `quickRetrieval` (línea 271)
2. Calcular la complejidad **solo con la query** (sin necesidad de chunks):
   - `detectComplexity(query, 8)` — usar 8 como valor default en lugar de hacer un retrieval
   - O mejor: refactorizar `detectComplexity` para que no requiera `chunksCount`
3. Ejecutar un solo `retrieveRelevantChunks` con topK=16 (máximo) y luego truncar según complejidad detectada

**Validación:**
- Medir latencia antes y después (debería reducirse ~40-50%)
- Verificar que la calidad de respuestas no cambia (mismos chunks retornados)

### Tarea 0.3: Agregar warnings y eliminar fake embeddings en producción

**Qué hacer:**

1. En `lib/embeddings.ts`, cuando se usa `fakeEmbed`:
   - Log a nivel `error` (no debug): `"CRITICAL: Using fake embeddings. Retrieval quality is zero."`
   - En `NODE_ENV === 'production'`, lanzar error en lugar de fallback silencioso
2. Verificar que `.env.local` y `.env` en producción tienen `EMB_PROVIDER` y `HUGGINGFACE_API_KEY` correctamente configurados
3. En `embedTexts()`, validar que las dimensiones del vector retornado coinciden con las del índice cargado (verificar dimensión del primer chunk en el índice vs dimensión del embedding generado)

**Validación:**
- En desarrollo sin API key: debe aparecer un warning claro en logs
- En producción sin API key: debe fallar con error descriptivo
- Si las dimensiones no coinciden: error inmediato descriptivo

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `lib/embeddings.ts` | Unificar modelo default, agregar warnings, validar dimensiones |
| `scripts/ingest.mjs` | Usar misma variable de modelo que embeddings.ts |
| `lib/rag.ts` | Eliminar quickRetrieval, refactorizar detectComplexity |
| `lib/prompt-templates.ts` | Ajustar `detectComplexity` para no requerir chunksCount |
| `.env.example` | Agregar `EMBEDDING_MODEL` como variable unificada |

---

## Criterio de éxito

- [ ] Un solo modelo de embeddings usado en ingest Y en query (verificable vía logs)
- [ ] Cosine similarity del top-1 resultado > 0.5 para queries de prueba
- [ ] Latencia del pipeline reducida >30% (un solo retrieval)
- [ ] Zero fallbacks a fake embeddings en producción
- [ ] Re-indexación completa ejecutada después de unificar modelos
