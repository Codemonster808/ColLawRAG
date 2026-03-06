# Fix Deploy 2026-03-06 — Rutas de scripts tras migración DDD

**Commit que falló:** `8e46472` (fix S7/S8 umbrales + migración src/)

---

## Causa del fallo

Tras la migración a estructura `src/` (DDD), los scripts se reorganizaron en subdirectorios:
- `scripts/download-indices.mjs` → `scripts/scraping/download-indices.mjs`
- `scripts/ingest.mjs` → `scripts/ingestion/ingest.mjs`
- etc.

El `package.json` seguía apuntando a las rutas antiguas. El build de Vercel ejecuta:

```
npm run download-indices && npm run build
```

**Error:** `Cannot find module '.../scripts/download-indices.mjs'` → el build fallaba antes de compilar.

---

## Correcciones aplicadas

### 1. package.json — Rutas de scripts

| Script | Ruta antigua | Ruta nueva |
|--------|--------------|------------|
| download-indices | scripts/download-indices.mjs | scripts/scraping/download-indices.mjs |
| convert-jurisprudencia | scripts/convert-jurisprudencia-to-docs.mjs | scripts/ingestion/convert-jurisprudencia-to-docs.mjs |
| scrape, scrape:dry-run, etc. | scripts/scrape-colombia-legal.mjs | scripts/scraping/scrape-colombia-legal.mjs |
| vigencia | scripts/vigencia-normas.mjs | scripts/ingestion/vigencia-normas.mjs |
| upload-indices | scripts/upload-indices-to-github.mjs | scripts/deployment/upload-indices-to-github.mjs |
| evaluate, benchmark, etc. | scripts/*.mjs | scripts/evaluation/*.mjs |
| verify-env, pre-deploy-check, deploy-check | scripts/*.mjs | scripts/deployment/*.mjs |
| toon, test-production, test-complex | scripts/*.mjs | scripts/utils/*.mjs |

### 2. Stripe session — Dynamic rendering

**Error durante build:** `Route /api/stripe/session couldn't be rendered statically because it used nextUrl.searchParams`

**Fix:** Añadir `export const dynamic = 'force-dynamic'` en `src/app/api/stripe/session/route.ts`

### 3. test:integration

Ruta actualizada: `tests/api.test.ts` → `src/tests/api.test.ts`

---

## Verificación

```bash
npm run download-indices   # ✅
npm run build             # ✅
```

---

**Fecha:** 2026-03-06
