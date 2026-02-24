# FASE 3: Reranking con Cross-Encoder Real — De heurísticas a relevancia semántica profunda

**Prioridad:** Alta — El reranking es el cambio individual de mayor impacto en RAG  
**Impacto estimado:** +10-15% accuracy (especialmente en precisión normativa y reducción de alucinaciones)  
**Esfuerzo:** Medio (2-3 días)  
**Dependencias:** FASE 0 completada. Mejora con FASE 1 y 2 pero puede implementarse independientemente.

---

## Diagnóstico

### Cuello de botella 8: Reranking heurístico con boosts arbitrarios

**Archivo afectado:** `lib/reranking.ts` (líneas 22-37 y 246-318)

El "reranking avanzado" actual (`rerankChunksAdvanced`) es una combinación de heurísticas:

```typescript
// lib/reranking.ts — Score calculado así:
const finalScore = normalizedScore + hierarchyBoost + recencyBoost + keywordBoost + vigenciaPenalty
```

**Problemas:**

1. **hierarchyBoost de hasta +0.60 (Constitución)**: Este boost es ENORME. Un chunk de la Constitución con score vectorial de 0.2 (poco relevante) obtiene finalScore 0.8 y supera a un chunk del CST con score 0.7 (muy relevante). La Constitución domina artificialmente los resultados en **toda** consulta.

2. **Los boosts no son proporcionales al score base**: Si el score vectorial va de 0.3 a 0.9 (rango 0.6), y el hierarchyBoost va de 0 a 0.60, la jerarquía puede importar más que la relevancia semántica real.

3. **Normalización incorrecta del score**: Línea 296: `normalizedScore = Math.max(0, Math.min(1, (score + 1) / 2))`. Esto asume scores en rango [-1, 1], pero después del hybridScore (BM25+cosine) los scores están en [0, 1]. La normalización los comprime a [0.5, 1], reduciendo el rango efectivo.

4. **keywordBoost por coincidencia superficial**: `titleLower.includes(term)` cuenta cualquier coincidencia, incluyendo stopwords filtradas. Si la query es "trabajo doméstico en Colombia", "colombia" da boost a cualquier chunk con "colombia" en el título (= todos).

5. **El "cross-encoder" HF no es un cross-encoder**: `rerankWithHFSimilarity` usa `sentenceSimilarity` (bi-encoder) no un cross-encoder real. Un bi-encoder calcula embeddings independientemente y compara. Un cross-encoder procesa query+document juntos, lo que captura interacciones cruzadas y es significativamente más preciso para ranking.

---

## Tareas

### Tarea 3.1: Implementar cross-encoder real via API

**Qué hacer:**

Usar un modelo cross-encoder real para reranking. Opciones:

**Opción A — HuggingFace cross-encoder (recomendada):**

1. Modelo: `cross-encoder/ms-marco-MiniLM-L-6-v2` (inglés) o `jeffwan/mmarco-mMiniLMv2-L12-H384-v1` (multilingüe, recomendado para español)
2. Alternativa de mayor calidad: `BAAI/bge-reranker-v2-m3` (multilingüe, estado del arte)

3. Modificar `lib/reranking.ts`:
   - Crear función `rerankWithCrossEncoder(chunks, query)`:
     ```
     Para cada chunk:
       - Enviar a la API: { inputs: { source_sentence: query, sentences: [chunk.content] } }
       - O usar endpoint de text-classification con pair: [query, chunk.content]
     Ordenar por score del cross-encoder
     ```
   - El cross-encoder recibe pares (query, documento) y retorna un score de relevancia

4. Llamar al cross-encoder solo sobre los **top-20 chunks** del retrieval (no sobre todo el corpus — sería muy lento)

5. Limitar el contenido del chunk a 512 tokens para el cross-encoder (truncar si es necesario)

**Opción B — Cohere Rerank API:**
- API dedicada a reranking: `cohere.com/rerank`
- Muy simple: enviar query + list of documents, retorna scores
- Tiene modelo multilingüe que soporta español
- Requiere API key de Cohere (plan free disponible)

**Opción C — Cross-encoder local con Xenova:**
- `@xenova/transformers` puede cargar modelos cross-encoder
- Modelo: `Xenova/ms-marco-MiniLM-L-6-v2`
- Ventaja: sin dependencia de API externa
- Desventaja: solo inglés; modelos multilingües más pesados

**Validación:**
- Tomar 20 queries del dataset qa-abogados.json
- Para cada query, comparar el ranking del cross-encoder vs el ranking heurístico actual
- El cross-encoder debe rankear el chunk correcto más alto en ≥70% de los casos
- Medir NDCG@5 antes y después

### Tarea 3.2: Recalibrar heurísticas legales como señal secundaria

**Qué hacer:**

No eliminar las heurísticas (jerarquía, vigencia, recencia), sino usarlas como **señal secundaria** después del cross-encoder:

1. Nuevo scoring pipeline:
   ```
   Score final = 0.70 × cross_encoder_score + 0.15 × hierarchy_normalized + 0.10 × recency_normalized + 0.05 × vigencia_bonus
   ```

2. Normalizar los boosts al rango [0, 1]:
   - `hierarchy_normalized`: 0 a 1 basado en la pirámide legal (Constitución=1.0, concepto=0.05)
   - `recency_normalized`: 0 a 1 basado en antigüedad (< 3 años=1.0, > 15 años=0)
   - `vigencia_bonus`: 1.0 si vigente, 0.0 si derogada

3. El cross-encoder es el factor dominante (70%). Las heurísticas solo desempatan.

4. Corregir la normalización del score base (eliminar el `(score + 1) / 2`):
   - Si el score viene del cross-encoder, ya está en [0, 1]
   - Si viene del hybrid retrieval, ya está en [0, 1]
   - No aplicar transformación adicional

**Validación:**
- Verificar que chunks de la Constitución NO dominen resultados cuando no son relevantes
- Verificar que chunks vigentes rankean por encima de derogados cuando ambos son relevantes
- El score final del top-1 debe ser > 0.5 para queries válidas

### Tarea 3.3: Optimizar latencia del reranking

**Qué hacer:**

El cross-encoder agrega latencia (~200-500ms por API call). Optimizar:

1. **Batching**: Enviar todos los 20 pares (query, chunk) en una sola request a la API
2. **Caching**: Si la misma query se ejecuta 2 veces, cachear los scores del cross-encoder por 5 minutos
3. **Truncamiento inteligente**: En lugar de truncar a 512 chars fijos, truncar a la última oración completa antes de 512 chars
4. **Paralelismo**: Si la API no soporta batch, enviar requests en paralelo (Promise.all) con concurrency limit de 5

5. Si la latencia total (retrieval + reranking) excede 3 segundos:
   - Reducir chunks a reranquear de 20 a 12
   - O usar un modelo cross-encoder más pequeño

**Validación:**
- Latencia total de reranking < 1 segundo
- Latencia end-to-end del pipeline < 5 segundos

### Tarea 3.4: Penalización precisa por normas derogadas

**Qué hacer:**

La penalización actual por vigencia es `-0.10` flat. Esto es insuficiente para normas que fueron completamente reemplazadas y peligroso para normas solo parcialmente derogadas.

1. Refinar la penalización:
   - Norma totalmente derogada: penalizar fuertemente (-0.30) pero NO eliminar — podría ser útil para contexto histórico
   - Norma parcialmente derogada: sin penalización general, pero agregar metadata indicando qué artículos están derogados
   - Norma vigente con modificaciones: boost neutro pero agregar nota de "verificar versión vigente"

2. En el resultado final, siempre incluir la información de vigencia como metadata para que el LLM la use:
   - Agregar al contenido del chunk: `"[NOTA: Esta norma fue derogada por Ley X de YYYY]"` si aplica
   - El LLM puede entonces decidir si la cita es relevante y advertir al usuario

---

## Archivos a modificar

| Archivo | Acción |
|---------|--------|
| `lib/reranking.ts` | MODIFICAR — agregar cross-encoder, recalibrar heurísticas, normalizar scores |
| `lib/retrieval.ts` | MODIFICAR — integrar nuevo pipeline de reranking |
| `.env.example` | MODIFICAR — agregar `RERANK_MODEL`, `RERANK_PROVIDER` |
| `package.json` | MODIFICAR — agregar dependencia si se usa Cohere SDK |

---

## Criterio de éxito

- [ ] Cross-encoder implementado y activo por defecto
- [ ] NDCG@5 mejora ≥ 15% vs reranking heurístico solo
- [ ] Chunks de Constitución no dominan resultados cuando la query es sobre otra área
- [ ] Latencia de reranking < 1 segundo
- [ ] Score final usa cross-encoder como factor dominante (≥70% del peso)
- [ ] Normas derogadas penalizadas proporcionalmente, no eliminadas
- [ ] `evaluate-accuracy.mjs`: mejora en "precision_normativa" y "ausencia_alucinaciones"
