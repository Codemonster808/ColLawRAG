# BUG-008: Índices RAG no disponibles en runtime de Vercel

**Resuelto por:** Cursor  
**Fecha:** pre-2026-02  
**Archivo(s) afectado(s):** `lib/retrieval.ts`, `.vercelignore`

---

## Síntoma / error

- `/api/debug` reporta: `indexGz: "NOT FOUND"`, `bm25Gz: "NOT FOUND"`
- `/api/rag` retorna: `retrieved: 0`, `citations: []`
- Las queries no encuentran ningún documento

---

## Causa

Los archivos `.gz` se descargan durante el build pero no persisten en el runtime porque:
1. `.vercelignore` excluía `data/*.gz`
2. `outputFileTracingIncludes` no garantiza persistencia
3. Vercel puede limpiar el workspace post-build

---

## Solución aplicada

1. **`.vercelignore`**: Permitir `.gz` de índices:
   ```
   data/index.json
   data/bm25-index.json
   data/*.gz
   !data/index.json.gz
   !data/bm25-index.json.gz
   ```

2. **`lib/retrieval.ts`**: Fallback de descarga en runtime a `/tmp`:
   - Si no encuentra archivos en `data/`, descarga desde URLs en `data/indices-urls.json` a `/tmp`
   - `ensureIndicesAvailableAtRuntime()` con singleton promise para evitar descargas paralelas
   - Busca en orden: `data/index.json` → `data/index.json.gz` → Vercel Blob → `/tmp/index.json.gz`

---

## Cómo comprobar que está resuelto

```bash
# En producción:
curl https://col-law-rag.vercel.app/api/health
# Debe mostrar: indexAvailable: true, indexChunks > 0

curl -X POST https://col-law-rag.vercel.app/api/rag -H 'Content-Type: application/json' -d '{"query":"qué es la tutela"}'
# Debe retornar retrieved > 0 y citations no vacías
```

---

## Notas

- El fallback a `/tmp` agrega ~10-15s al primer request (cold start con descarga)
- `/tmp` persiste durante invocaciones "warm" de la función serverless
- No repetir: asumir que archivos del build están disponibles en runtime en Vercel — no siempre es así
- Bug relacionado: BUG-007 (tamaño de funciones serverless)
- `data/indices-urls.json` debe estar actualizado con URLs válidas de GitHub Releases o Vercel Blob
