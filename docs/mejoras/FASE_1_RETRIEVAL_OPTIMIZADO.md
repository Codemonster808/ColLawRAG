# FASE 1: Retrieval Optimizado — De búsqueda lineal a índice vectorial

**Prioridad:** Alta — El retrieval es el cuello de botella #1 del pipeline  
**Impacto estimado:** +10-20% accuracy, -80% latencia de búsqueda  
**Esfuerzo:** Medio (3-5 días)  
**Dependencias:** FASE 0 completada (embeddings unificados)

---

## Diagnóstico

### Cuello de botella 4: Búsqueda lineal O(n) sobre 33k chunks

**Archivo afectado:** `lib/retrieval.ts` (líneas 313-317)

El retrieval actual carga los ~33k chunks en memoria y calcula cosine similarity contra **cada uno**:

```typescript
// lib/retrieval.ts línea 313-317
retrieved = raw
  .filter(c => (filters?.type ? c.metadata.type === filters.type : true))
  .map(c => ({ chunk: c, score: cosineSimilarity(queryEmbedding, c.embedding || []) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, initialTopK)
```

Con 33k chunks y vectores de 768 dimensiones: ~33,000 × 768 multiplicaciones + sort = **lento y no escala**. Si el corpus crece a 100k+ chunks, esto será inviable.

### Cuello de botella 5: Índice BM25 en JSON completo en memoria

**Archivo afectado:** `lib/bm25.ts` y `lib/retrieval.ts` (líneas 321-332)

El índice BM25 con inverted index de 33k documentos se carga completo en RAM como JSON. Cada query recalcula BM25 contra los chunks ya recuperados por vector (no sobre todo el corpus), lo cual limita la calidad del BM25 porque solo puntúa chunks que ya pasaron el filtro vectorial.

### Cuello de botella 6: Híbrido 70/30 sin calibración

**Archivo afectado:** `lib/bm25.ts` (línea 161-174)

El peso `alpha=0.7` (70% vector, 30% BM25) es fijo y no fue calibrado empíricamente. Para consultas con terminología legal exacta (artículo X de la ley Y), BM25 debería pesar más. Para consultas conceptuales, vector debería pesar más.

---

## Tareas

### Tarea 1.1: Implementar índice vectorial con búsqueda ANN (Approximate Nearest Neighbors)

**Qué hacer:**

Reemplazar la búsqueda lineal con un índice vectorial que soporte búsqueda ANN. Opciones por orden de recomendación:

**Opción A — HNSWLIB-node (recomendada para este proyecto):**
- Librería: `hnswlib-node` (npm)
- Ventajas: índice en disco, búsqueda O(log n), compatible con Node.js, sin dependencia externa
- Tamaño en disco: ~100MB para 33k chunks × 768d

1. Instalar `hnswlib-node`
2. Crear `lib/vector-index.ts`:
   - Función `buildHNSWIndex(chunks)`: construye índice HNSW desde array de chunks
   - Función `searchHNSW(queryEmbedding, topK)`: búsqueda ANN
   - Función `loadHNSWIndex(path)`: carga índice precompilado
   - Función `saveHNSWIndex(index, path)`: guarda índice a disco
3. Modificar `scripts/ingest.mjs`:
   - Después de generar embeddings, construir y guardar índice HNSW en `data/vector.index`
   - Guardar un mapping `data/chunk-mapping.json` (index_id → chunk)
4. Modificar `lib/retrieval.ts`:
   - Reemplazar el bloque lineal (líneas 313-317) con `searchHNSW(queryEmbedding, initialTopK)`
   - Mantener el fallback a Pinecone si `USE_PINECONE` está activo

**Opción B — Usar Pinecone como primario:**
- Ya está integrado parcialmente
- Subir todos los chunks con embeddings a Pinecone
- Ventaja: zero mantenimiento de índice local
- Desventaja: latencia de red, costo

**Opción C — SQLite con extensión vectorial (sqlite-vss):**
- Usar `better-sqlite3` (ya es dependencia) + `sqlite-vss`
- Unificar BM25 + vectorial en una sola base de datos

**Validación:**
- Medir latencia de retrieval antes (lineal) y después (ANN): objetivo < 50ms para top-20
- Medir Recall@20: los 20 resultados del ANN deben incluir al menos 18 de los 20 que retornaría búsqueda exacta

### Tarea 1.2: BM25 sobre corpus completo (no solo sobre resultados vectoriales)

**Qué hacer:**

Actualmente BM25 solo puntúa chunks que ya fueron seleccionados por vector search. Esto pierde documentos que serían relevantes lexicalmente pero no semánticamente.

1. Modificar `lib/retrieval.ts`:
   - Ejecutar BM25 sobre **todo el corpus** (no solo sobre `retrieved`)
   - Obtener top-K por BM25 independientemente
   - Fusionar resultados de vector y BM25 usando **Reciprocal Rank Fusion (RRF)** en lugar de weighted sum

2. Implementar RRF en `lib/bm25.ts`:
   ```
   RRF_score(doc) = Σ 1/(k + rank_in_list_i) para cada lista i
   ```
   donde k=60 (constante estándar) y las listas son: vector_results y bm25_results

3. Los pesos 70/30 ya no son necesarios con RRF — cada lista contribuye por ranking, no por score absoluto

**Validación:**
- Crear 10 queries de prueba con terminología legal exacta (e.g., "artículo 64 código sustantivo del trabajo")
- Medir si el artículo correcto aparece en top-3 antes y después
- Objetivo: Recall@3 ≥ 0.8 para queries con terminología exacta

### Tarea 1.3: Query expansion para mejorar recall

**Qué hacer:**

Muchas consultas usan lenguaje coloquial que no coincide con el texto legal. Ejemplo: "me echaron del trabajo sin razón" → debería encontrar "terminación unilateral del contrato sin justa causa".

1. Crear `lib/query-expansion.ts`:
   - Mantener un diccionario de sinónimos legales colombianos (hardcoded inicialmente):
     ```
     "echar del trabajo" → "terminación unilateral contrato"
     "despido" → "terminación contrato sin justa causa"
     "pensión" → "prestación pensional seguridad social"
     "tutela" → "acción de tutela artículo 86 constitución"
     ```
   - Función `expandQuery(query)`: retorna la query original + términos expandidos
   - Usar la query expandida para BM25 (no para vector, donde la semántica ya lo captura)

2. En `lib/retrieval.ts`:
   - Llamar `expandQuery(query)` antes de BM25
   - Usar query original para vector search
   - Usar query expandida para BM25 search

**Validación:**
- 10 queries en lenguaje coloquial
- Medir si los chunks correctos aparecen en top-5 con y sin expansion
- Objetivo: +20% en Recall@5 para queries coloquiales

### Tarea 1.4: Filtrado por metadatos más inteligente

**Qué hacer:**

Actualmente solo se filtra por `type` (estatuto, jurisprudencia, etc.). Agregar filtros por:

1. **Área legal** (`metadata.area`): si el query analyzer detecta "laboral", priorizar chunks con `area: 'laboral'`
2. **Entidad emisora** (`metadata.entidadEmisora`): si se menciona "Corte Constitucional", filtrar por esa entidad
3. **Fecha**: si la query menciona un año específico, priorizar documentos de ese período

Implementar como **boost** (no como filtro excluyente) para no perder documentos cross-area relevantes.

Modificar en `lib/retrieval.ts`:
- Después del retrieval, aplicar un boost de +0.1 al score de chunks cuya área coincida con la detectada
- No eliminar chunks de otras áreas (podrían ser relevantes por jerarquía constitucional)

**Validación:**
- Query sobre tutela laboral: chunks de constitucional Y laboral deben aparecer
- Query sobre despido: chunks laborales deben rankear más alto que tributarios

---

## Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `lib/vector-index.ts` | CREAR — índice HNSW |
| `lib/query-expansion.ts` | CREAR — expansión de queries |
| `lib/retrieval.ts` | MODIFICAR — usar índice ANN, RRF, filtros inteligentes |
| `lib/bm25.ts` | MODIFICAR — agregar función RRF, BM25 sobre corpus completo |
| `scripts/ingest.mjs` | MODIFICAR — generar índice HNSW durante ingest |
| `package.json` | MODIFICAR — agregar dependencia hnswlib-node |

---

## Criterio de éxito

- [ ] Latencia de retrieval < 100ms (actualmente ~500ms-2s con búsqueda lineal)
- [ ] Recall@10 ≥ 0.85 medido contra dataset de evaluación
- [ ] Queries con terminología exacta (artículo X, ley Y) retornan el chunk correcto en top-3
- [ ] Queries coloquiales retornan chunks relevantes en top-5
- [ ] BM25 ejecutado sobre corpus completo, fusionado via RRF
