# 🔬 Diagnóstico Comercial — ColLawRAG
**Fecha:** 2026-02-16  
**Objetivo:** Aumentar accuracy + definir ruta de comercialización  
**URL producción:** https://col-law-rag.vercel.app

---

## 📊 Estado Real del Proyecto (Hoy)

### Índice RAG
| Métrica | Valor | Estado |
|---|---|---|
| Total chunks | 12,468 | ⚠️ Insuficiente para prod comercial |
| Documentos indexados | 746 | ✅ |
| Chunks con metadata unknown | ~94% | 🚨 Crítico |
| Chunks >2000 chars | 35.6% | ⚠️ Reduce precision |
| Benchmark QA creado | 20 casos | ⚠️ Sin evaluar aún |
| Accuracy estimado actual | 60–70% | ❌ No comercializable |
| Accuracy objetivo comercial | 90%+ | 🎯 |

### Infraestructura
| Item | Estado | Bloquea comercial |
|---|---|---|
| Cold start 10-15s | ⚠️ Índices en GitHub Releases | Sí |
| SQLite en Vercel (efímero) | 🚨 Se pierde en re-deploy | Sí |
| Auth = UUID en header | 🚨 Sin login real | Sí |
| Sin pagos | ❌ Freemium no cobra | Sí |
| Monitoring básico | ⚠️ Solo logs Vercel | Parcial |
| Rate limiting por IP | ✅ Funciona | No |
| TOON en prompts | ✅ Implementado | No |

### Cobertura Legal
| Área | Chunks actuales | % | Objetivo |
|---|---|---|---|
| Laboral | ~8 etiquetados | 0.1% | 15% |
| Constitucional | ~8 etiquetados | 0.1% | 15% |
| Administrativo | ~10 etiquetados | 0.1% | 10% |
| Civil | ~5 etiquetados | 0.1% | 10% |
| Penal | ~6 etiquetados | 0.1% | 8% |
| Tributario | 0 | 0% | 8% |
| Desconocido | 11,671 | 94% | <5% |

> **El problema raíz:** los documentos SÍ están, pero el ingesta no les asigna metadata → el retrieval filtrado por área no funciona.

---

## 🚨 BRECHAS CRÍTICAS PARA ACCURACY

### Brecha #1 — Metadata ausente (impacto: -25% accuracy)
**Problema:** `lib/retrieval.ts` aplica filtros por `type` y `area`, pero el 94% de chunks tiene `unknown` en esos campos. Cuando el usuario filtra por "laboral", casi no encuentra nada relevante.

**Causa raíz:** `scripts/ingest.mjs` no extrae metadata del frontmatter de los `.txt`.

**Fix:** Reescribir el extractor de metadata en `ingest.mjs` para parsear el header de cada `.txt` y asignar `tipo`, `area`, `fuente`, `fecha`, `vigente`.

**Ganancia estimada:** +20–25% accuracy (filtros funcionan correctamente).

---

### Brecha #2 — Chunks demasiado grandes (impacto: -10% accuracy)
**Problema:** 35.6% de chunks >2000 chars. En embeddings, chunks grandes "promedian" mucho significado → puntuación cosine menor por query específica.

**Fix:** Reducir `chunkSize` a 800–1000 chars con overlap de 150–200 en `scripts/ingest.mjs`.

**Ganancia estimada:** +8–12% retrieval precision.

---

### Brecha #3 — Sin benchmark ejecutado (impacto: sin medición)
**Problema:** `data/benchmarks/qa-abogados.json` tiene 20 casos con respuestas de referencia de abogados, pero nunca se ejecutó contra la API. No sabemos el accuracy real.

**Fix:** Ejecutar `scripts/evaluate-accuracy.mjs` y generar reporte base.

**Ganancia:** Medir → optimizar → medir ciclo.

---

### Brecha #4 — Retrieval sin cross-encoder (impacto: -8% accuracy)
**Problema:** El reranking actual es heurístico (frecuencia de términos). Un cross-encoder real evalúa semánticamente si el chunk responde la query.

**Fix:** Integrar `cross-encoder/ms-marco-MiniLM-L-6-v2` (o equivalente en español) en `lib/reranking.ts`.

**Ganancia estimada:** +5–10% relevancia en top-K.

---

### Brecha #5 — Normas disponibles no ingestadas
**Disponibles en `data/scrape-meta/` pero no verificadas en índice:**
- Ley 2466/2025 (Reforma Laboral — la más relevante en 2025)
- Ley 100/1993 (Seguridad Social — crítico para pensiones)
- Estatuto Tributario (área tributaria = 0% ahora)
- Código Civil completo
- CPACA (Derecho Administrativo)
- Código General del Proceso

**Ganancia estimada:** +400–800 chunks bien etiquetados → +10% cobertura.

---

## 💰 BRECHAS CRÍTICAS PARA COMERCIALIZACIÓN

### Brecha C1 — Sin autenticación real
**Bloqueante:** Los usuarios no pueden crear cuenta, login, recuperar password. El sistema freemium funciona con UUID en header (inseguro, fácil de saltarse).

**Fix:** Implementar NextAuth.js con Google OAuth + email/password.

---

### Brecha C2 — Sin sistema de pagos
**Bloqueante:** El tier "premium" existe en código pero no hay forma de pagar. Nadie puede convertirse en premium automáticamente.

**Fix:** Integrar Stripe (Checkout + Webhooks) para suscripción mensual/anual.

---

### Brecha C3 — Base de datos efímera
**Bloqueante:** SQLite en Vercel se borra en cada re-deploy. Usuarios, historial, suscripciones → todo se pierde.

**Fix:** Migrar a **Neon Postgres** (serverless, tier gratuito compatible con Vercel) o Vercel Postgres.

---

### Brecha C4 — Cold start de 10–15 segundos
**Bloqueante para retención:** El primer usuario de una instancia fría espera 15s → abandono inmediato.

**Fix:** 
1. Subir índices a **Vercel Blob Storage** (fast download desde misma red Vercel)
2. Cron job de warm-up cada 5 minutos

---

### Brecha C5 — UX básica
**Falta para convertir:** historial de consultas, exportar a PDF, modo oscuro, sugerencias de queries, visualización de jerarquía legal.

---

### Brecha C6 — Sin landing comercial
**Falta:** Página de pricing, testimonios, casos de uso, demo embebido, SEO básico. La `/` actual es directamente el buscador, sin contexto de valor.

---

### Brecha C7 — Cumplimiento legal colombiano
**Falta para operar legalmente:**
- Política de protección de datos (Ley 1581/2012)
- Aviso de privacidad actualizado
- Términos de servicio específicos para asesoría no vinculante
- Registro ante la SIC si maneja datos personales

---

## 🎯 ROADMAP PRIORIZADO

### Sprint 1 — Accuracy mínimo comercial (semana 1-2)
**Objetivo: 60–70% → 85%+**

| # | Tarea | Ejecutor | Impacto |
|---|---|---|---|
| 1.1 | Reescribir extractor metadata en `ingest.mjs` | Cursor | +20% |
| 1.2 | Re-ingestar todos los documentos con metadata correcta | OpenClaw | +metadata |
| 1.3 | Reducir chunk size a 900 chars + overlap 150 | Cursor | +10% |
| 1.4 | Ejecutar benchmark QA 20 casos → medir baseline | OpenClaw | Medición |
| 1.5 | Ingestar normas pendientes (Reforma Laboral, Ley 100, CST, CPACA) | OpenClaw | +cobertura |
| 1.6 | Actualizar índices en GitHub Releases + re-deploy | OpenClaw | Deploy |

### Sprint 2 — Infraestructura comercial (semana 2-3)
**Objetivo: Base técnica para cobrar**

| # | Tarea | Ejecutor | Impacto |
|---|---|---|---|
| 2.1 | Migrar SQLite → Neon Postgres (schema existente) | Cursor | Persistencia |
| 2.2 | Implementar NextAuth.js (Google + email) | Cursor | Auth real |
| 2.3 | Integrar Stripe Checkout + Webhooks | Cursor | Pagos |
| 2.4 | Subir índices a Vercel Blob + warm-up cron | Cursor+OpenClaw | -Cold start |
| 2.5 | Error tracking con Sentry | Cursor | Monitoring |

### Sprint 3 — UX y conversión (semana 3-4)
**Objetivo: Retención y conversión de usuarios**

| # | Tarea | Ejecutor | Impacto |
|---|---|---|---|
| 3.1 | Landing page con pricing + demo | Cursor | Conversión |
| 3.2 | Historial de consultas por usuario | Cursor | Retención |
| 3.3 | Exportar respuesta a PDF | Cursor | Valor percibido |
| 3.4 | Modo oscuro + responsive mejorado | Cursor | UX |
| 3.5 | Políticas LPDP (Ley 1581/2012) | OpenClaw | Compliance |

### Sprint 4 — Accuracy avanzado (semana 4-6)
**Objetivo: 85% → 92%+**

| # | Tarea | Ejecutor | Impacto |
|---|---|---|---|
| 4.1 | Cross-encoder real en `lib/reranking.ts` | Cursor | +8% |
| 4.2 | Chunking semántico jerárquico (artículo → párrafo) | Cursor | +5% |
| 4.3 | Ingestar jurisprudencia completa datos.gov.co (3K sentencias) | OpenClaw | +15% cobertura |
| 4.4 | TOON en contexto del prompt (menos tokens → mejor respuesta) | Cursor | +3% |
| 4.5 | A/B testing de prompts HNAC | OpenClaw | Medición |
| 4.6 | Benchmark ampliado a 100 casos | OpenClaw+Cursor | Medición |

---

## 🤖 TAREAS PARA OPENCLAW (AUTÓNOMO)

OpenClaw puede ejecutar estas tareas en background sin intervención manual.

### OC-01 — Ejecutar benchmark de accuracy ahora
```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
node scripts/evaluate-accuracy.mjs
# Genera reporte en data/benchmarks/results-YYYY-MM-DD.json
```
**Frecuencia:** Cada vez que se re-ingesta el índice  
**Output:** Guardar resultados + notificar por Telegram con el % de accuracy

---

### OC-02 — Re-ingestar índice después de cambios Cursor
```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
npm run ingest
npm run build-bm25
npm run upload-indices
```
**Trigger:** Cuando Cursor confirme que terminó los cambios en `ingest.mjs`  
**Output:** Notificar con tamaño nuevo del índice y chunks totales

---

### OC-03 — Monitoreo de accuracy en producción
```bash
node scripts/test-production.mjs
# Ejecuta 5 queries de prueba contra https://col-law-rag.vercel.app/api/rag
# Verifica tiempo de respuesta y calidad de citas
```
**Frecuencia:** Diaria, 9 AM  
**Output:** Notificar si accuracy cae o tiempo de respuesta >5s

---

### OC-04 — Scraping jurisprudencia nuevas sentencias
```bash
node scripts/scrape-jurisprudencia.mjs --year=2025 --type=tutela
node scripts/scrape-jurisprudencia.mjs --year=2025 --type=constitucionalidad
```
**Frecuencia:** Semanal (domingos 6 AM)  
**Output:** Reportar número de sentencias nuevas descargadas

---

### OC-05 — Generar reporte de calidad semanal
```bash
node scripts/generate-quality-report.mjs
```
**Frecuencia:** Lunes 8 AM  
**Output:** Reporte en `/data/quality-reports/` + resumen por Telegram

---

### OC-06 — Verificar vigencia de normas
```bash
node scripts/vigencia-normas.mjs
# Detecta normas que fueron modificadas/derogadas recientemente
```
**Frecuencia:** Cada 15 días  
**Output:** Lista de normas desactualizadas para actualización manual

---

### OC-07 — Warm-up de la instancia Vercel
```bash
curl -s https://col-law-rag.vercel.app/api/health > /dev/null
```
**Frecuencia:** Cada 5 minutos (cron OpenClaw)  
**Objetivo:** Eliminar cold starts para usuarios reales

---

### OC-08 — Generar dataset de benchmark expandido
**Tarea:** Crear 80 preguntas más (totalizando 100) con respuestas de referencia en formato JSON, cubriendo: laboral, constitucional, administrativo, civil, penal, tributario.

```bash
# OpenClaw genera preguntas y respuestas de referencia usando su propio LLM
# basándose en los documentos de data/documents/
# Output: data/benchmarks/qa-abogados-v2.json
```

---

### OC-09 — Compliance LPDP
**Tarea:** Generar borradores de:
1. Política de Tratamiento de Datos Personales (Ley 1581/2012)
2. Aviso de privacidad
3. Formulario de autorización de tratamiento de datos

Output: `docs/legal/politica-datos.md`, `docs/legal/aviso-privacidad.md`

---

### OC-10 — Análisis de queries reales (cuando haya usuarios)
```bash
node scripts/analyze-legal-advice-quality.mjs
# Analiza las queries reales en SQLite para detectar:
# - Qué áreas piden más
# - Qué preguntas fallan (sin respuesta útil)
# - Patrones para mejorar prompts
```
**Frecuencia:** Semanal

---

## 💻 TAREAS PARA CURSOR (CÓDIGO)

Cursor ejecuta los cambios de código en el repo.

### CU-01 — Reescribir extractor de metadata en `scripts/ingest.mjs`

**Archivo:** `scripts/ingest.mjs`

**Cambio:** La función que crea chunks debe leer el header de cada `.txt` y extraer:
```javascript
function extractMetadata(filename, content) {
  // filename: "codigo_codigo_civil.txt" → tipo=codigo, area=civil
  // content header: buscar líneas "TIPO:", "AREA:", "FUENTE:", "FECHA:", "VIGENTE:"
  
  const metadata = {
    type: 'unknown',
    area: 'general', 
    source: 'unknown',
    date: null,
    active: true
  }
  
  // Inferir del nombre de archivo
  if (filename.includes('codigo_')) metadata.type = 'codigo'
  if (filename.includes('ley_') || filename.includes('ley-')) metadata.type = 'ley'
  if (filename.includes('decreto_')) metadata.type = 'decreto'
  if (filename.includes('jurisprudencia_')) metadata.type = 'jurisprudencia'
  if (filename.includes('resolucion_')) metadata.type = 'resolucion'
  
  // Área legal
  const AREA_KEYWORDS = {
    laboral: ['trabajo', 'laboral', 'sustantivo', 'empleo', 'jornada', 'acoso_lab'],
    constitucional: ['constituc', 'tutela', 'corte_const', 'derecho_fund'],
    administrativo: ['peticion', 'cpaca', 'cumplimiento', 'nulidad', 'contencioso'],
    civil: ['civil', 'familia', 'contratos', 'obligaciones'],
    penal: ['penal', 'delito', 'crimen', 'proceso_penal'],
    tributario: ['tributario', 'impuesto', 'dian', 'renta', 'iva'],
    seguridad_social: ['pension', 'salud', 'seguridad_social', 'ley_100'],
    comercial: ['comercio', 'sociedades', 'mercantil']
  }
  
  for (const [area, keywords] of Object.entries(AREA_KEYWORDS)) {
    if (keywords.some(kw => filename.toLowerCase().includes(kw))) {
      metadata.area = area
      break
    }
  }
  
  return metadata
}
```

---

### CU-02 — Reducir chunk size en `scripts/ingest.mjs`

**Cambio:** 
```javascript
// Antes (aprox):
const CHUNK_SIZE = 2000
const CHUNK_OVERLAP = 200

// Después:
const CHUNK_SIZE = 900   // ~225 tokens — óptimo para retrieval semántico
const CHUNK_OVERLAP = 150 // Preservar contexto entre chunks
```

---

### CU-03 — Migrar SQLite → Neon Postgres

**Archivos:** `lib/auth.ts`, `lib/tiers.ts`, `lib/cache-persistent.ts`, `lib/rate-limit-persistent.ts`

**Cambio:** Reemplazar `better-sqlite3` con `@neondatabase/serverless` (compatible Vercel Edge).

Schema a migrar:
- `users` (id, created_at, tier, query_count, last_reset)
- `queries` (id, user_id, query, response_time, success, legal_area, created_at)
- `quality_metrics` (query_id, citation_precision, chunks_retrieved, response_length)

---

### CU-04 — Implementar NextAuth.js

**Archivos nuevos:** `app/api/auth/[...nextauth]/route.ts`, `lib/session.ts`

**Providers:** Google OAuth + Credentials (email+password con bcrypt)

**Integración con tiers:**
```typescript
// En session callback: consultar DB por tier del usuario
session.user.tier = await getUserTier(session.user.email)
```

---

### CU-05 — Integrar Stripe

**Archivos nuevos:** `app/api/stripe/webhook/route.ts`, `app/pricing/page.tsx`, `lib/stripe.ts`

**Flujo:**
1. Usuario en `/pricing` → clic "Premium" → `stripe.checkout.session.create()`
2. Stripe redirige a `/success` → webhook actualiza `users.tier = 'premium'` en Postgres
3. Cancelación → webhook actualiza a `'free'`

**Precios sugeridos:**
- Free: 10 consultas/mes
- Premium: $29.000 COP/mes (~$7 USD) — ilimitado
- Pro (firmas): $149.000 COP/mes (~$36 USD) — API + analytics

---

### CU-06 — Cross-encoder en `lib/reranking.ts`

**Cambio:** Agregar opción de reranking semántico usando HuggingFace Inference API:

```typescript
// lib/reranking.ts
async function crossEncoderRerank(
  query: string, 
  chunks: DocumentChunk[]
): Promise<DocumentChunk[]> {
  // Usar cross-encoder/ms-marco-MiniLM-L-6-v2 via HF
  // Puntuar cada par (query, chunk) → reordenar
  const scores = await hf.featureExtraction({
    model: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
    inputs: chunks.map(c => ({ text1: query, text2: c.content }))
  })
  return chunks.sort((a, b) => scores[b.id] - scores[a.id])
}
```

---

### CU-07 — Subir índices a Vercel Blob + eliminar cold start

**Archivo:** `scripts/upload-indices.mjs` + `lib/retrieval.ts`

**Cambio:**
```typescript
// En lugar de GitHub Releases, usar Vercel Blob:
import { put, get } from '@vercel/blob'

// Upload (script):
await put('index.json.gz', fs.readFileSync('data/index.json.gz'), { access: 'public' })

// Download (runtime):
const res = await get(process.env.BLOB_INDEX_URL)
const index = JSON.parse(await gunzip(Buffer.from(await res.arrayBuffer())))
```

**Beneficio:** Download desde misma red Vercel → 2–3s vs 10–15s actual.

---

### CU-08 — Landing page en `/` con pricing

**Archivo:** `app/page.tsx` (refactor)

**Estructura:**
```
/ → Landing con hero + demo embebido + pricing + CTA
/app → Aplicación de búsqueda (protegida por auth)
/pricing → Página de precios detallada
/login → Login/registro
```

---

### CU-09 — Historial de consultas

**Archivo nuevo:** `app/historial/page.tsx`

**Funcionalidad:** Lista de últimas 50 queries del usuario con opción de re-ejecutar, copiar respuesta, o exportar.

---

### CU-10 — Exportar respuesta a PDF

**Librería:** `@react-pdf/renderer` o `puppeteer` (ya está en deps)

**UI:** Botón "Exportar PDF" en `components/ResultsDisplay.tsx` que genera un PDF con:
- Consulta original
- Respuesta estructurada HNAC
- Citas con URLs
- Advertencias de vigencia
- Disclaimer legal

---

## 📊 MÉTRICAS DE ÉXITO

### Accuracy (técnico)
| Métrica | Actual | Sprint 1 | Sprint 4 (meta) |
|---|---|---|---|
| Accuracy benchmark 20 casos | ~60% (est.) | 80% | 92% |
| Chunks con metadata válida | 6% | 95% | 99% |
| Cold start | 10–15s | 10–15s | <3s |
| P95 tiempo respuesta | ~5–8s | ~5s | <4s |

### Comercial (negocio)
| Métrica | Sprint 2 | Sprint 3 | Meta 3 meses |
|---|---|---|---|
| Auth funcional | ✅ | ✅ | ✅ |
| Pagos funcional | ✅ | ✅ | ✅ |
| Usuarios registrados | 0 | 10 beta | 100 |
| Usuarios premium | 0 | 2 beta | 15 |
| MRR | $0 | ~$60K COP | ~$450K COP |

---

## 🚀 PRÓXIMO PASO INMEDIATO

**Esta semana (ordenado por impacto/esfuerzo):**

1. **Cursor:** CU-01 + CU-02 (metadata + chunking) → mayor impacto en accuracy
2. **OpenClaw:** OC-01 (benchmark baseline) → medir qué hay ahora
3. **OpenClaw:** OC-02 (re-ingestar con normas pendientes) → tras cambios de Cursor
4. **Cursor:** CU-03 (Neon Postgres) → desbloquea persistencia en prod
5. **Cursor:** CU-04 (NextAuth) → desbloquea auth real

**Estimado para ser comercializable:** 3–4 semanas con trabajo paralelo Cursor + OpenClaw.

---

*Generado: 2026-02-16 | ColLawRAG v0.1.0*
