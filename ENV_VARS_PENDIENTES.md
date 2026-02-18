# ENV VARS Pendientes — ColLawRAG

> Generado: 2026-02-18
> Para configurar en: `.env.local` (desarrollo) + Vercel Dashboard (producción)

## ✅ Ya configuradas (producción)

| Variable | Descripción |
|---|---|
| `HUGGINGFACE_API_KEY` | API key HuggingFace |
| `HF_GENERATION_MODEL` | Modelo LLM de generación (DeepSeek V3) |
| `GEN_PROVIDER` | Proveedor LLM (novita) |
| `HF_EMBEDDING_MODEL` | Modelo de embeddings |
| `EMB_PROVIDER` | Proveedor embeddings |
| `RAG_API_KEY` | API key del endpoint /api/rag |
| `HF_API_TIMEOUT_MS` | Timeout HuggingFace API |
| `HF_MAX_TOKENS` | Tokens máximos generación |
| `ENABLE_RECURSIVE_RAG` | Habilitar RAG recursivo |

---

## ❌ Pendientes para CU-03 (Neon Postgres)

```
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/collawrag?sslmode=require
```
**Dónde obtenerla:** https://neon.tech → crear proyecto → Connection string

---

## ❌ Pendientes para CU-04 (NextAuth)

```
NEXTAUTH_SECRET=<generar con: openssl rand -base64 32>
NEXTAUTH_URL=https://col-law-rag.vercel.app
GOOGLE_CLIENT_ID=<Google Cloud Console → OAuth 2.0 credentials>
GOOGLE_CLIENT_SECRET=<Google Cloud Console>
```

**Dónde configurar Google OAuth:**
1. https://console.cloud.google.com → APIs & Services → Credentials
2. Crear OAuth 2.0 Client ID (Web application)
3. Authorized redirect URIs: `https://col-law-rag.vercel.app/api/auth/callback/google`

---

## ❌ Pendientes para CU-05 (Stripe)

```
STRIPE_SECRET_KEY=sk_live_... (o sk_test_... para pruebas)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PREMIUM_PRICE_ID=price_... (Plan Premium $29k COP/mes)
STRIPE_PRO_PRICE_ID=price_... (Plan Pro $149k COP/mes)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**Dónde obtenerlas:** https://dashboard.stripe.com → Developers → API keys

**Precios a crear en Stripe:**
- Premium: $29.000 COP recurrente mensual
- Pro (firmas): $149.000 COP recurrente mensual

---

## ❌ Pendientes para CU-07 (Vercel Blob)

```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
BLOB_INDEX_URL=https://<store>.vercel-storage.com/collawrag/index.json.gz
BLOB_BM25_URL=https://<store>.vercel-storage.com/collawrag/bm25-index.json.gz
```

**Flujo:**
1. Cursor implementa CU-07 (wiring en lib/retrieval.ts)
2. Yo (OpenClaw) ejecuto: `node scripts/upload-indices-to-blob.mjs`
3. El script genera las URLs y actualiza `data/indices-urls.json`
4. Deploy a Vercel con las nuevas URLs

---

## Orden recomendado de configuración

```
Semana 1:
  1. Crear cuenta Neon → DATABASE_URL
  2. CU-03 (Cursor) → migrar SQLite a Neon
  3. Crear OAuth app Google → GOOGLE_CLIENT_ID/SECRET
  4. CU-04 (Cursor) → NextAuth
  5. Crear cuenta Stripe → STRIPE keys
  6. CU-05 (Cursor) → Stripe
  7. CU-07 (Cursor) → Vercel Blob wiring
  8. OpenClaw sube índices → BLOB_* vars

Semana 2:
  9. CU-08 (Cursor) → Landing page
  10. CU-06 (Cursor) → Cross-encoder reranking
```
