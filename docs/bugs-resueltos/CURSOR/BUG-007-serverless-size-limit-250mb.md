# BUG-007: Funciones serverless exceden límite de 250 MB en Vercel

**Resuelto por:** Cursor  
**Fecha:** pre-2026-02  
**Archivo(s) afectado(s):** `next.config.mjs`, `lib/retrieval.ts`, `scripts/download-indices.mjs`, `package.json`

---

## Síntoma / error

```
Error: A Serverless Function has exceeded the unzipped maximum size of 250 MB.
```

---

## Causa

Los archivos `data/index.json` (261 MB) y `data/bm25-index.json` (54 MB) se incluían en el bundle de las funciones serverless sin comprimir, excediendo el límite de 250 MB de Vercel.

---

## Solución aplicada

Múltiples cambios coordinados:

1. **`next.config.mjs`**: Excluir JSONs grandes del tracing, incluir solo `.gz`:
   ```javascript
   outputFileTracingExcludes: {
     '*': ['./data/index.json', './data/bm25-index.json', './node_modules/onnxruntime-node/**']
   },
   outputFileTracingIncludes: {
     '/api/rag': ['./data/index.json.gz', './data/bm25-index.json.gz']
   }
   ```

2. **`lib/retrieval.ts`**: Descompresión en memoria/streaming:
   - Primero intenta `index.json` (dev local)
   - Luego `index.json.gz` (Vercel serverless) con `gunzipSync` o streaming readline
   - Luego Vercel Blob (`BLOB_INDEX_URL`)
   - Luego `/tmp` (runtime download fallback)

3. **`scripts/download-indices.mjs`**: No descomprimir en Vercel, solo guardar `.gz`.

4. **`package.json`**: Postbuild acepta ambos formatos.

---

## Cómo comprobar que está resuelto

```bash
cd ColLawRAG && npm run build
```

Si el build es exitoso, las funciones serverless están dentro del límite. Verificar en Vercel Dashboard > Functions > tamaño de `/api/rag`.

---

## Notas

- Los `.gz` reducen de ~315 MB a ~108 MB
- La descompresión en memoria agrega ~2-3s al cold start
- No repetir: intentar subir index.json descomprimido a Vercel — siempre excederá 250 MB
- Bug relacionado: BUG-008 (índices no disponibles en runtime)
- Si el índice crece más, considerar: Pinecone, o HNSW binario que es más compacto
