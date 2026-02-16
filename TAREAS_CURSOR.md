# 💻 TAREAS CURSOR — ColLawRAG
**Generado:** 2026-02-16  
**Prioridad:** Ordenadas de mayor a menor impacto  
**Contexto:** Ver `DIAGNOSTICO_COMERCIAL_2026-02-16.md`

---

## 🔴 CU-00 — Fix endpoint en `scripts/evaluate-accuracy.mjs` [BUG BLOQUEANTE]

**Impacto:** Sin esto el benchmark no funciona y no podemos medir accuracy  
**Tiempo estimado:** 2 minutos

**Bug:** El script llama a `/api/query` pero el endpoint real es `/api/rag`.  
Además el body envía `{ question }` pero la API espera `{ query }`.

```javascript
// scripts/evaluate-accuracy.mjs — línea ~93

// ANTES (incorrecto):
const url = `${API_URL}/api/query`;
body: JSON.stringify({ question }),

// DESPUÉS (correcto):
const url = `${API_URL}/api/rag`;
body: JSON.stringify({ query: question }),
```

También verificar que el parser de respuesta usa `data.answer` (ya está correcto).

---

## 🔴 CU-01 — Arreglar metadata en `scripts/ingest.mjs` [CRÍTICO]

**Impacto:** +20–25% accuracy (el mayor fix disponible)

**Bug raíz encontrado:** El código tiene DOS problemas simultáneos:

**Problema 1 — Los `.txt` tienen frontmatter YAML que el ingest ignora:**
```
# Código Civil (Ley 84 de 1873)
slug: codigo_civil
tipo: codigo           ← está aquí pero no se lee
area: civil            ← está aquí pero no se lee
fuente: Secretaría del Senado
url: http://...
```

**Problema 2 — Field name mismatch:**
```javascript
// ingest.mjs guarda:
metadata: { areaLegal: 'civil', ... }   // ← "areaLegal"

// pero retrieval.ts filtra por:
metadata.area   // ← "area" (nunca se setea → siempre undefined/unknown)
```

**Fix requerido en `scripts/ingest.mjs`:**

```javascript
// AÑADIR esta función ANTES de main():
function parseFrontmatter(content) {
  const meta = {}
  const lines = content.split('\n')
  
  // Leer hasta la primera línea vacía después del header
  // o hasta encontrar contenido de ley (ARTÍCULO, CAPÍTULO, etc.)
  for (const line of lines.slice(0, 25)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (/^(artículo|capítulo|título|ARTÍCULO)/i.test(trimmed)) break
    
    // Parsear "clave: valor"
    const match = trimmed.match(/^([a-z_]+):\s*(.+)$/i)
    if (match) {
      const key = match[1].toLowerCase()
      const value = match[2].trim()
      if (['slug', 'tipo', 'area', 'fuente', 'url', 'fecha_extraccion', 'fecha', 'vigente'].includes(key)) {
        meta[key] = value
      }
    }
  }
  return meta
}
```

**En la función `main()`, cambiar el bloque que crea chunks:**
```javascript
// ANTES (línea ~420):
const type = guessTypeFromFilename(file)
// ... más adelante:
const areaLegal = detectLegalAreaFromContent(title, part.text)
const metadata = {
  ...
  areaLegal,   // ← INCORRECTO: field name mal y no usa frontmatter
  ...
}

// DESPUÉS:
const frontmatter = parseFrontmatter(raw)

// Tipo: usar frontmatter si existe, si no heurística
const type = frontmatter.tipo || guessTypeFromFilename(file)

// Normalizar tipo a valores conocidos del sistema:
const normalizedType = {
  'codigo': 'estatuto',
  'ley': 'estatuto', 
  'decreto': 'decreto',
  'jurisprudencia': 'jurisprudencia',
  'resolucion': 'reglamento',
  'tutela': 'jurisprudencia',
  'constitucion': 'estatuto'
}[type?.toLowerCase()] || type || 'estatuto'

// Área: usar frontmatter si existe, si no detectar del contenido
const area = frontmatter.area || detectLegalAreaFromContent(title, part.text)

// URL: usar frontmatter si existe
const url = frontmatter.url || undefined

// Fuente: usar frontmatter si existe
const fuente = frontmatter.fuente || detectEntityFromFilename(file)

const metadata = {
  id: `doc-${path.parse(file).name}`,
  title,
  type: normalizedType,
  area,              // ← CORREGIDO: 'area' (no 'areaLegal')
  source: fuente,    // ← CORREGIDO: 'source' (no 'entidadEmisora')
  article: part.article,
  articleHierarchy: articleHierarchy.length > 0 ? articleHierarchy.join(' > ') : undefined,
  chapter: part.chapter,
  section: part.section,
  url,               // ← CORREGIDO: extraer del frontmatter
  fechaVigencia: frontmatter.fecha || extractVigenciaFromFilename(file),
  sourcePath: `data/documents/${file}`
}
```

**Verificar consistencia con `lib/types.ts`** — confirmar que los campos del metadata del chunk coinciden con los que usa `lib/retrieval.ts` para filtrar.

---

## 🔴 CU-02 — Reducir chunk size en `scripts/ingest.mjs` [CRÍTICO]

**Impacto:** +8–12% retrieval precision  
**Estado actual:** `splitLargeChunk(acc, 3000, 200)` — max 3000 chars

**Fix en `scripts/ingest.mjs`:**

```javascript
// Buscar TODAS las llamadas a splitLargeChunk (hay 2) y cambiar:
// ANTES:
const splits = splitLargeChunk(acc, 3000, 200)

// DESPUÉS:
const splits = splitLargeChunk(acc, 1000, 150)
```

También en la función de merge, ajustar límites:
```javascript
// ANTES:
if (sameArticle && totalLength < 1500) {
// DESPUÉS:
if (sameArticle && totalLength < 800) {

// ANTES:
} else if (!sameArticle && totalLength < 800 && acc.text.length < 400) {
// DESPUÉS:
} else if (!sameArticle && totalLength < 500 && acc.text.length < 250) {
```

Y ajustar el min para ignorar buffers muy pequeños:
```javascript
// ANTES:
if (articleText.length < 50) return
// DESPUÉS:
if (articleText.length < 80) return
```

---

## 🔴 CU-03 — Migrar SQLite → Neon Postgres [COMERCIAL BLOQUEANTE]

**Impacto:** Persistencia real de usuarios, historial y tiers en Vercel

**Pasos:**
1. Crear cuenta en https://neon.tech (tier gratuito, compatible Vercel)
2. Instalar: `npm install @neondatabase/serverless`
3. Agregar `DATABASE_URL` a variables de entorno de Vercel

**Archivos a modificar:**
- `lib/auth.ts` — reemplazar `better-sqlite3` con `@neondatabase/serverless`
- `lib/tiers.ts` — misma migración
- `lib/cache-persistent.ts` — migrar a Redis (Upstash) o Postgres
- `lib/rate-limit-persistent.ts` — migrar a Redis o Postgres

**Schema SQL a crear en Neon:**
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  tier TEXT DEFAULT 'free',
  query_count INTEGER DEFAULT 0,
  last_reset TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE queries (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  query TEXT NOT NULL,
  response_time INTEGER,
  success BOOLEAN DEFAULT true,
  legal_area TEXT,
  complexity TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quality_metrics (
  id SERIAL PRIMARY KEY,
  query_id INTEGER REFERENCES queries(id),
  citation_precision FLOAT,
  chunks_retrieved INTEGER,
  response_length INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'inactive',
  plan TEXT DEFAULT 'free',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🟡 CU-04 — Implementar NextAuth.js [COMERCIAL]

**Impacto:** Auth real sin depender de UUID en headers

**Instalar:**
```bash
npm install next-auth @auth/core
```

**Archivos a crear/modificar:**
- `app/api/auth/[...nextauth]/route.ts` (nuevo)
- `lib/auth-config.ts` (nuevo — providers: Google, email/password)
- `middleware.ts` (actualizar para proteger `/app/*`)
- `app/login/page.tsx` (nuevo)

**Providers mínimos:**
```typescript
// lib/auth-config.ts
providers: [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  }),
  CredentialsProvider({
    // email + password con bcrypt
  })
]
```

**Variables de entorno a agregar:**
```
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://col-law-rag.vercel.app
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## 🟡 CU-05 — Integrar Stripe Checkout [COMERCIAL]

**Impacto:** Poder cobrar por el tier premium

**Instalar:**
```bash
npm install stripe @stripe/stripe-js
```

**Archivos a crear:**
- `lib/stripe.ts` — cliente Stripe + helpers
- `app/api/stripe/checkout/route.ts` — crear sesión de checkout
- `app/api/stripe/webhook/route.ts` — actualizar tier tras pago
- `app/pricing/page.tsx` — página de precios
- `app/success/page.tsx` — confirmación de pago

**Precios a configurar en Stripe Dashboard:**
- Plan Premium: $29.000 COP/mes (≈ $7 USD)
- Plan Pro (firmas): $149.000 COP/mes (≈ $36 USD)

**Variables de entorno:**
```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PREMIUM_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
```

---

## 🟡 CU-06 — Cross-encoder real en `lib/reranking.ts` [ACCURACY]

**Impacto:** +5–10% relevancia en top-K resultados

**Archivo:** `lib/reranking.ts`

**Cambio:** Agregar función de reranking semántico vía HF Inference:

```typescript
// lib/reranking.ts — agregar función
async function semanticRerank(
  query: string,
  chunks: Array<{ chunk: DocumentChunk; score: number }>,
  topK: number = 10
): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
  if (!process.env.HUGGINGFACE_API_KEY || chunks.length <= 1) {
    return chunks
  }
  
  try {
    const { HfInference } = await import('@huggingface/inference')
    const hf = new HfInference(process.env.HUGGINGFACE_API_KEY)
    
    // Usar text-classification o sentence-similarity para reranking
    // Modelo sugerido: cross-encoder/ms-marco-MiniLM-L-6-v2
    const scores = await Promise.all(
      chunks.slice(0, 20).map(async ({ chunk }) => {
        const result = await hf.textClassification({
          model: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
          inputs: `Query: ${query} Document: ${chunk.content.slice(0, 512)}`
        })
        return result[0]?.score || 0
      })
    )
    
    return chunks
      .map((item, i) => ({ ...item, score: scores[i] || item.score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  } catch (error) {
    // Fallback silencioso al reranking actual
    return chunks
  }
}
```

**Activar con variable de entorno:**
```
ENABLE_SEMANTIC_RERANKING=true
```

---

## 🟡 CU-07 — Subir índices a Vercel Blob [PERFORMANCE]

**Impacto:** Reducir cold start de 10–15s a <3s

**Instalar:**
```bash
npm install @vercel/blob
```

**Modificar `scripts/upload-indices-to-github.mjs`** para subir también a Vercel Blob:
```javascript
import { put } from '@vercel/blob'

// Subir index.json.gz
const indexBlob = await put('indices/index.json.gz', 
  fs.readFileSync('data/index.json.gz'), 
  { access: 'public', contentType: 'application/gzip' }
)

// Subir bm25-index.json.gz
const bm25Blob = await put('indices/bm25-index.json.gz',
  fs.readFileSync('data/bm25-index.json.gz'),
  { access: 'public', contentType: 'application/gzip' }
)

// Guardar URLs en data/indices-urls.json
```

**Modificar `lib/retrieval.ts`** para usar Vercel Blob como fuente primaria:
```typescript
// Antes de intentar GitHub Releases, verificar Vercel Blob
const blobIndexUrl = process.env.BLOB_INDEX_URL
if (blobIndexUrl) {
  // Download desde Vercel Blob (misma red → ~1–2s)
}
```

**Variables de entorno:**
```
BLOB_READ_WRITE_TOKEN=vercel_blob_...
BLOB_INDEX_URL=https://...vercel-storage.com/indices/index.json.gz
BLOB_BM25_URL=https://...vercel-storage.com/indices/bm25-index.json.gz
```

---

## 🟢 CU-08 — Landing page con pricing [CONVERSIÓN]

**Impacto:** Primera impresión, conversión de visitantes

**Refactor de `app/page.tsx`:**
```
/ → Landing (hero + demo + pricing + CTA "Empieza gratis")
/app → Buscador (acceso directo, sin login obligatorio)
/pricing → Precios detallados
/login → Login/registro
```

**Secciones de la landing:**
1. Hero: "Consulta el derecho colombiano con IA" + demo embebido
2. Funcionalidades: RAG con citas, vigencia normas, cálculos laborales
3. Precios: Free / Premium / Pro
4. Testimonios (3–5 usuarios beta)
5. FAQ legal (disclaimer, privacidad)

---

## 🟢 CU-09 — Historial de consultas [RETENCIÓN]

**Archivos nuevos:**
- `app/historial/page.tsx`
- `app/api/historial/route.ts`

**Query SQL:**
```sql
SELECT query, legal_area, created_at, response_time
FROM queries 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 50
```

---

## 🟢 CU-10 — Exportar respuesta a PDF [VALOR PERCIBIDO]

**Librería:** Puppeteer (ya en deps) o `@react-pdf/renderer`

**UI:** Botón "📄 Exportar PDF" en `components/ResultsDisplay.tsx`

**Contenido del PDF:**
- Header: logo + fecha + disclaimer
- Consulta original
- Respuesta HNAC estructurada
- Citas con URLs y artículos
- Advertencias de vigencia
- Footer: "Este documento es informativo y no constituye asesoría legal"

---

## 📋 Orden de ejecución recomendado

```
Semana 1: CU-01 → CU-02 (mayor impacto en accuracy, OpenClaw re-ingesta después)
Semana 2: CU-03 → CU-04 (infraestructura comercial)
Semana 2: CU-05 (pagos, paralelo con auth)
Semana 3: CU-06 → CU-07 (mejoras de performance)
Semana 4: CU-08 → CU-09 → CU-10 (UX y conversión)
```

---

## 🔗 Archivos clave para referencia

| Archivo | Qué hace |
|---|---|
| `scripts/ingest.mjs` | Vectoriza documentos → genera index.json |
| `lib/retrieval.ts` | Búsqueda híbrida (cosine + BM25) |
| `lib/reranking.ts` | Reordenamiento de chunks por relevancia |
| `lib/rag.ts` | Pipeline completo RAG (12 pasos) |
| `lib/generation.ts` | Llamada al LLM (DeepSeek V3.2) |
| `lib/auth.ts` | Auth + logging de queries |
| `lib/tiers.ts` | Sistema freemium (SQLite) |
| `app/api/rag/route.ts` | Endpoint principal /api/rag |
| `data/benchmarks/qa-abogados.json` | 20 casos QA para medir accuracy |

---

*Actualizar este archivo cuando se complete cada tarea (✅ o ❌ con notas)*
