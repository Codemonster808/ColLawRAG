# ColLawRAG — Documentación Técnica

> Sistema de recuperación y generación aumentada (RAG) para consultas de derecho colombiano.
> **Producción:** https://col-law-rag.vercel.app

---

## Tabla de Contenidos

1. [Stack Tecnológico](#1-stack-tecnológico)
2. [Diagrama de Arquitectura](#2-diagrama-de-arquitectura)
3. [Mapa de Dominio](#3-mapa-de-dominio)
4. [Estructura de Carpetas](#4-estructura-de-carpetas)
5. [Flujo de una Query](#5-flujo-de-una-query)
6. [Pipeline de Datos](#6-pipeline-de-datos)
7. [Variables de Entorno](#7-variables-de-entorno)
8. [Scripts Disponibles](#8-scripts-disponibles)

---

## 1. Stack Tecnológico

### Frontend
| Tecnología | Versión | Rol |
|---|---|---|
| **Next.js** | 14.x | Framework fullstack (App Router) |
| **React** | 18.x | UI components |
| **TypeScript** | 5.x | Tipado estático (strict mode) |
| **Tailwind CSS** | 3.x | Estilos utilitarios |

### Backend / API
| Tecnología | Versión | Rol |
|---|---|---|
| **Next.js API Routes** | 14.x | Endpoints serverless (`/api/*`) |
| **Zod** | 3.x | Validación de schemas en runtime |
| **LRU Cache** | 10.x | Cache en memoria para embeddings y resultados |

### IA / Modelos
| Tecnología | Modelo / Versión | Rol |
|---|---|---|
| **HuggingFace Inference** | `@huggingface/inference` | SDK para embeddings y generación |
| **@xenova/transformers** | 2.x | Embeddings locales (ONNX runtime) |
| **DeepSeek V3.2** | `deepseek/deepseek-v3.2` | LLM principal de generación (vía Novita) |
| **Qwen 2.5 72B** | `qwen/qwen-2.5-72b-instruct` | LLM fallback |
| **Modelo de embeddings** | `sentence-transformers` | Vectorización de chunks (768 dims) |

### Búsqueda / Recuperación
| Componente | Tecnología | Rol |
|---|---|---|
| **Búsqueda vectorial** | Índice local `.json.gz` + Pinecone (opcional) | Cosine similarity sobre embeddings |
| **BM25 híbrido** | Implementación propia (`lib/bm25.ts`) | Búsqueda léxica sobre texto |
| **Hybrid scoring** | α=0.7 cosine + 0.3 BM25 | Puntuación final combinada |
| **Reranking** | `lib/reranking.ts` | Reordenamiento por relevancia |

**Parámetros BM25:** `k1=1.5`, `b=0.75`, `min-max normalization`

### Almacenamiento
| Recurso | Tecnología | Rol |
|---|---|---|
| **Índice vectorial** | `data/index.json.gz` (109 MB comprimido) | 12,468 chunks con embeddings |
| **Índice BM25** | `data/bm25-index.json.gz` | Índice invertido para búsqueda léxica |
| **GitHub Releases** | `indices-v1` tag | Almacenamiento gratuito de índices (2 GB límite) |
| **Cache persistente** | `better-sqlite3` + LRU | Cache local en disco para resultados |
| **Pinecone** | Opcional (`PINECONE_API_KEY`) | Índice vectorial en la nube |

### Infraestructura
| Servicio | Rol |
|---|---|
| **Vercel** (Hobby plan) | Hosting serverless, región `iad1` (US East) |
| **GitHub** | Control de versiones + almacenamiento de índices (Releases) |
| **HuggingFace Router** | Proxy a modelos LLM vía Novita provider |

### Herramientas de Calidad
| Herramienta | Rol |
|---|---|
| **TOON** (`@toon-format/toon`) | Payloads eficientes para LLM (~40% menos tokens) |
| **Jest + ts-jest** | Tests unitarios y de regresión |
| **ESLint** | Linting TypeScript |
| **Puppeteer / Cheerio** | Scraping de fuentes legales oficiales |

---

## 2. Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Browser)                            │
│                    https://col-law-rag.vercel.app                   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP (Next.js App Router)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    VERCEL SERVERLESS (Next.js 14)                   │
│                                                                     │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────────────┐    │
│  │  /app/page  │   │  /api/rag    │   │  /api/analytics       │    │
│  │  (UI React) │   │  (principal) │   │  /api/feedback        │    │
│  └─────────────┘   └──────┬───────┘   │  /api/health          │    │
│                            │           └───────────────────────┘    │
│         ┌──────────────────▼──────────────────────┐                │
│         │           RAG PIPELINE                   │                │
│         │                                          │                │
│         │  1. query-analyzer.ts   (clasificar)     │                │
│         │  2. query-decomposer.ts (sub-queries)    │                │
│         │  3. retrieval.ts        (buscar chunks)  │                │
│         │  4. reranking.ts        (reordenar)      │                │
│         │  5. norm-vigencia.ts    (validar vigencia)│               │
│         │  6. prompt-templates.ts (construir prompt)│               │
│         │  7. generation.ts       (generar respuesta)│              │
│         │  8. citation-validator.ts (verificar citas)│              │
│         └──────────────────────────────────────────┘                │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │                   CAPA DE DATOS LOCAL                       │     │
│  │                                                             │     │
│  │  index.json.gz ──┐                                          │     │
│  │  (12,468 chunks) │──► Cosine Similarity ──┐                │     │
│  │                  │                         │                │     │
│  │  bm25-index.json.gz                        ├──► Hybrid     │     │
│  │  (índice invertido)──► BM25 Score ─────────┘    Score      │     │
│  │                                             (α=0.7/0.3)    │     │
│  └────────────────────────────────────────────────────────────┘     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────────┐
              │                 │                       │
              ▼                 ▼                       ▼
   ┌──────────────────┐  ┌──────────────┐   ┌──────────────────────┐
   │  HUGGINGFACE     │  │   PINECONE   │   │   GITHUB RELEASES    │
   │  ROUTER (Novita) │  │  (opcional)  │   │   (índices .gz)      │
   │                  │  │              │   │                      │
   │  DeepSeek V3.2   │  │  Vectores    │   │  index.json.gz       │
   │  (generación)    │  │  en la nube  │   │  bm25-index.json.gz  │
   │  Qwen 2.5 72B    │  │              │   │  (descarga en build) │
   │  (fallback)      │  │              │   │                      │
   └──────────────────┘  └──────────────┘   └──────────────────────┘
```

### Flujo de índices en Vercel Build

```
  GitHub Release (indices-v1)
         │
         │  npm run download-indices
         ▼
  /tmp/col-law-rag-indices/
  ├── index.json       (descomprimido en memoria)
  └── bm25-index.json  (descomprimido en memoria)
         │
         │  Vercel Build completa
         ▼
  Serverless Function lista ✓
```

---

## 3. Mapa de Dominio

### Áreas Legales Cubiertas

```
DERECHO COLOMBIANO
│
├── 📚 FUENTES PRIMARIAS (749 documentos, 12,468 chunks)
│   │
│   ├── Estatutos (81% del índice)
│   │   ├── Código Civil (Ley 84/1873)
│   │   ├── Código Sustantivo del Trabajo (CST)
│   │   ├── Código Penal (Ley 599/2000)
│   │   ├── Código de Procedimiento Penal (Ley 906/2004)
│   │   ├── Código de Comercio
│   │   ├── Código Contencioso Administrativo (CPACA - Ley 1437/2011)
│   │   └── Estatuto Tributario
│   │
│   └── Jurisprudencia (19% del índice)
│       ├── Corte Constitucional (sentencias T, C, SU)
│       ├── Corte Suprema de Justicia
│       └── Consejo de Estado
│
├── ⚖️ ÁREAS LEGALES
│   ├── General         (17.3% — normas transversales)
│   ├── Comercial       (15.7% — CCo, Ley 222/95, Ley 1480/11)
│   ├── Constitucional  (15.6% — CP, tutelas, acción popular)
│   ├── Civil           (14.3% — CC, prescripción, contratos)
│   ├── Administrativo  (10.6% — CPACA, derecho de petición)
│   ├── Laboral         (10.2% — CST, Ley 50/90, Ley 789/2002)
│   ├── Penal           (8.3%  — Ley 599, Ley 906)
│   └── Tributario      (7.9%  — ET, Ley 1819/2016, Ley 2277/2022)
│
├── 📋 NORMAS DE VIGENCIA (20 archivos JSON)
│   ├── Leyes laborales: CST, Ley 50/1990, Ley 789/2002, Ley 2101/2021
│   ├── Leyes civiles: Ley 57/1887, Ley 222/1995
│   ├── Derecho administrativo: Ley 1437/2011, Ley 1755/2015, Ley 393/1997
│   ├── Derecho penal: Ley 599/2000, Ley 906/2004, Decreto 2591/1991
│   ├── Derecho tributario: ET, Ley 1819/2016, Ley 1943/2018
│   └── Derecho comercial: Código Comercio, Ley 1480/2011
│
├── 🔄 PROCEDIMIENTOS (7 tipos)
│   ├── Laboral ordinario
│   ├── Laboral verbal
│   ├── Ejecutivo
│   ├── Reparación directa (Estado)
│   ├── Acción de grupo
│   └── Acción de cumplimiento
│
└── 📊 BENCHMARK DE ACCURACY (20 casos)
    ├── Laboral (6 casos)
    ├── Civil (4 casos)
    ├── Constitucional (3 casos)
    ├── Administrativo (3 casos)
    ├── Penal (2 casos)
    └── Tributario (2 casos)
```

### Entidades del Dominio

```
DocumentChunk
├── id: UUID
├── content: string          ← texto del chunk (art. 22 CST, etc.)
├── metadata:
│   ├── source: string       ← "codigo-sustantivo-trabajo"
│   ├── title: string        ← "Artículo 22 CST"
│   ├── areaLegal: string    ← "laboral"
│   ├── tipo: string         ← "estatuto" | "jurisprudencia"
│   ├── vigente: boolean     ← estado de vigencia actual
│   ├── fechaVigencia: string
│   ├── articleId: string    ← "art-22"
│   └── hierarchy: string    ← "Título II > Capítulo I"
└── embedding: number[]      ← vector de 768 dimensiones

NormaVigencia
├── id: string               ← "codigo-sustantivo-trabajo"
├── nombre: string
├── tipo: string             ← "codigo" | "ley" | "decreto"
├── area: string
├── vigente: boolean
├── articulos: Articulo[]
├── modificaciones: Mod[]
└── jurisprudencia: Sent[]

BenchmarkCase
├── id: string               ← "LAB-001"
├── area: string
├── dificultad: string       ← "basico" | "intermedio" | "avanzado"
├── pregunta: string
├── respuesta_referencia: string
├── normas_clave: string[]
└── criterio_evaluacion: string
```

---

## 4. Estructura de Carpetas

```
ColLawRAG/
│
├── app/                          ← Next.js App Router
│   ├── page.tsx                  ← UI principal (buscador)
│   ├── layout.tsx                ← Layout raíz
│   ├── analytics/                ← Dashboard de métricas
│   ├── status/                   ← Health check UI
│   ├── terminos/                 ← Términos de uso
│   └── api/
│       ├── rag/                  ← Endpoint principal RAG
│       │   ├── route.ts          ← POST /api/rag
│       │   └── schema.ts         ← Validación Zod
│       ├── analytics/route.ts    ← GET/POST métricas de uso
│       ├── feedback/route.ts     ← POST feedback usuario
│       ├── health/route.ts       ← GET health check
│       ├── legal/[doc]/route.ts  ← GET documento legal por ID
│       └── debug/route.ts        ← GET debug info
│
├── lib/                          ← Core del sistema RAG
│   ├── rag.ts                    ← Orquestador principal
│   ├── retrieval.ts              ← Búsqueda híbrida (vector + BM25)
│   ├── generation.ts             ← Generación LLM con retry
│   ├── embeddings.ts             ← Vectorización de texto
│   ├── bm25.ts                   ← Algoritmo BM25 para español
│   ├── prompt-templates.ts       ← Construcción de prompts
│   ├── query-analyzer.ts         ← Clasificación de queries
│   ├── query-decomposer.ts       ← Descomposición en sub-queries
│   ├── query-splitter.ts         ← División por área legal
│   ├── rag-recursive.ts          ← RAG recursivo multi-paso
│   ├── reranking.ts              ← Reordenamiento de resultados
│   ├── norm-vigencia.ts          ← Validación de vigencia normativa
│   ├── citation-validator.ts     ← Verificación de citas legales
│   ├── factual-validator.ts      ← Detección de alucinaciones
│   ├── hnac-validator.ts         ← Validador HNAC estructural
│   ├── legal-calculator.ts       ← Cálculos jurídicos (liquidación)
│   ├── procedures.ts             ← Datos de procedimientos
│   ├── response-structure.ts     ← Estructura de respuesta
│   ├── response-synthesizer.ts   ← Síntesis multi-fuente
│   ├── source-comparator.ts      ← Comparación de fuentes
│   ├── hierarchy-explainer.ts    ← Jerarquía normativa
│   ├── tiers.ts                  ← Sistema de tiers de usuario
│   ├── rate-limit-persistent.ts  ← Rate limiting con SQLite
│   ├── cache-persistent.ts       ← Cache persistente en disco
│   ├── auth.ts                   ← Autenticación API keys
│   ├── logger.ts                 ← Logging estructurado
│   ├── pii.ts                    ← Detección de datos personales
│   └── types.ts                  ← Tipos TypeScript globales
│
├── components/                   ← Componentes React
│   ├── SearchBar.tsx
│   ├── ResultsDisplay.tsx
│   ├── Filters.tsx
│   ├── VigenciaWarnings.tsx
│   ├── ProceduresDisplay.tsx
│   ├── CalculationsDisplay.tsx
│   └── LoadingSpinner.tsx
│
├── scripts/                      ← Scripts de mantenimiento y datos
│   ├── ingest.mjs                ← Genera embeddings del índice
│   ├── build-bm25.ts             ← Construye índice BM25
│   ├── scrape-colombia-legal.mjs ← Scraper de fuentes oficiales
│   ├── normas-to-txt.mjs         ← Convierte JSON normas a TXT
│   ├── upload-indices-to-github  ← Sube índices a GitHub Releases
│   ├── download-indices.mjs      ← Descarga índices en build
│   ├── evaluate-accuracy.mjs     ← Evaluador LLM-as-judge
│   ├── toon-generator.mjs        ← Generador interactivo TOON
│   ├── generate-toon-payloads.mjs← Payloads TOON para RAG
│   └── [otros scrapers y utils]
│
├── data/
│   ├── index.json.gz             ← Índice vectorial (12,468 chunks)
│   ├── bm25-index.json.gz        ← Índice BM25
│   ├── indices-urls.json         ← URLs GitHub Releases
│   ├── documents/                ← 749 documentos TXT fuente
│   ├── normas-vigencia/          ← 20 JSONs de vigencia normativa
│   ├── procedures/               ← 7 JSONs de procedimientos
│   ├── benchmarks/               ← Dataset de evaluación accuracy
│   ├── jurisprudencia/           ← Metadatos de sentencias
│   └── eval/                     ← Resultados de evaluaciones
│
├── tests/                        ← Tests Jest
├── vercel.json                   ← Configuración Vercel
├── next.config.mjs               ← Config Next.js
├── tailwind.config.ts            ← Config Tailwind
└── tsconfig.json                 ← TypeScript strict, ES2022
```

---

## 5. Flujo de una Query

```
Usuario: "¿Cuánto es la indemnización por despido sin justa causa?"
           │
           ▼
┌─────────────────────────────────┐
│  1. ANÁLISIS DE QUERY           │
│  query-analyzer.ts              │
│                                 │
│  área: laboral                  │
│  tipo: cálculo_jurídico         │
│  complejidad: medium            │
│  entidades: ["indemnización",   │
│    "despido", "justa causa"]    │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  2. EMBEDDING DE LA QUERY       │
│  embeddings.ts                  │
│                                 │
│  vector[768] = embed(query)     │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  3. BÚSQUEDA HÍBRIDA            │
│  retrieval.ts                   │
│                                 │
│  Cosine similarity (topK=12)    │
│    + BM25 léxico                │
│    → hybrid_score = 0.7·cos     │
│                   + 0.3·bm25   │
│                                 │
│  → 12 chunks relevantes         │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  4. VALIDACIÓN DE VIGENCIA      │
│  norm-vigencia.ts               │
│                                 │
│  Art. 64 CST → vigente ✓        │
│  (modificado por Ley 789/2002)  │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  5. CONSTRUCCIÓN DEL PROMPT     │
│  prompt-templates.ts            │
│                                 │
│  System: rol + instrucciones    │
│  Context: chunks en TOON        │
│  User: pregunta original        │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  6. GENERACIÓN LLM              │
│  generation.ts                  │
│                                 │
│  Modelo: DeepSeek V3.2          │
│  Fallback: Qwen 2.5 72B         │
│  Contexto: hasta 12,000 chars   │
│  Citas: hasta 20 fuentes        │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  7. VALIDACIÓN DE CITAS         │
│  citation-validator.ts          │
│  factual-validator.ts           │
│                                 │
│  "Art. 64 CST" → verificado ✓   │
│  Alucinaciones detectadas: 0    │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  RESPUESTA FINAL                │
│                                 │
│  Texto con citas verificadas +  │
│  advertencias de vigencia +     │
│  fuentes citadas                │
└─────────────────────────────────┘
```

---

## 6. Pipeline de Datos

```
FUENTES LEGALES OFICIALES
│
├── Secretaría del Senado (secretariasenado.gov.co) ← fuente primaria
├── Función Pública (funcionpublica.gov.co)
├── Rama Judicial (ramajudicial.gov.co)
└── datos.gov.co (29,211 sentencias, CSV público)
           │
           │  npm run scrape
           ▼
┌─────────────────────────────┐
│  scripts/scrape-*.mjs       │
│  (Puppeteer + Cheerio)      │
│  Rate limit: 1.5s/request   │
│  Retry: 3x con backoff      │
│  → 749 archivos .txt        │
│  → data/documents/          │
└─────────────┬───────────────┘
              │
              │  scripts/normas-to-txt.mjs (convierte JSONs)
              ▼
┌─────────────────────────────┐
│  data/documents/*.txt       │
│  749 docs (10.6 MB texto)   │
│  + 19 normas_vigencia_*.txt │
└─────────────┬───────────────┘
              │
              │  npm run ingest
              ▼
┌─────────────────────────────┐
│  scripts/ingest.mjs         │
│  - Divide por artículos     │
│  - Genera embeddings (768d) │
│  - 12,468 chunks            │
│  → data/index.json          │
└─────────────┬───────────────┘
              │
              │  npm run build-bm25
              ▼
┌─────────────────────────────┐
│  scripts/build-bm25.ts      │
│  - Tokeniza español         │
│  - Construye índice invertido│
│  → data/bm25-index.json     │
└─────────────┬───────────────┘
              │
              │  npm run upload-indices
              ▼
┌─────────────────────────────┐
│  GitHub Releases (indices-v1)│
│  index.json → .gz (109 MB)  │
│  bm25-index.json → .gz      │
└─────────────┬───────────────┘
              │
              │  Vercel build: npm run download-indices
              ▼
┌─────────────────────────────┐
│  /tmp/col-law-rag-indices/  │
│  Disponible para serverless │
└─────────────────────────────┘
```

---

## 7. Variables de Entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `HUGGINGFACE_API_KEY` | ✅ Sí | API key para embeddings y generación LLM |
| `HF_GENERATION_MODEL` | ✅ Sí | Modelo LLM (`deepseek/deepseek-v3.2`) |
| `GITHUB_TOKEN` | ✅ Build | Para descargar índices desde GitHub Releases |
| `PINECONE_API_KEY` | ❌ Opcional | Índice vectorial en la nube |
| `PINECONE_INDEX` | ❌ Opcional | Nombre del índice Pinecone |
| `ENABLE_FACTUAL_VALIDATION` | ❌ Opcional | Activa validador anti-alucinaciones (`true`) |
| `ENABLE_STRUCTURED_RESPONSE` | ❌ Opcional | Respuestas estructuradas (`true`) |
| `ENABLE_CALCULATIONS` | ❌ Opcional | Cálculos jurídicos automáticos (`true`) |
| `ENABLE_CITATION_VALIDATION` | ❌ Opcional | Validación de citas legales (`true`) |
| `USE_BM25` | ❌ Opcional | Búsqueda híbrida BM25 (default: `true`) |
| `USE_RERANKING` | ❌ Opcional | Reranking de resultados (default: `true`) |
| `ALLOWED_ORIGINS` | ❌ Opcional | CORS origins permitidos |

---

## 8. Scripts Disponibles

```bash
# Desarrollo
npm run dev                   # Servidor local en :3000

# Datos
npm run scrape                # Scraping de fuentes legales
npm run ingest                # Generar índice vectorial
npm run build-bm25            # Construir índice BM25
npm run upload-indices        # Subir índices a GitHub Releases
npm run download-indices      # Descargar índices (usado en build)

# Evaluación de Accuracy
npm run evaluate              # vs local (requiere server activo)
npm run evaluate:prod         # vs https://col-law-rag.vercel.app
npm run evaluate:fast         # 3 casos de prueba rápida

# TOON (payloads eficientes)
npm run toon                  # Generador interactivo de payloads TOON
npm run toon:demo             # Demo comparación TOON vs JSON
npm run toon:bench            # Benchmark con datos reales

# Tests
npm test                      # Jest (tests unitarios)
npm run test:coverage         # Con reporte de cobertura

# Deploy
npm run build                 # Build de producción
vercel --prod                 # Deploy a Vercel
```

---

## Métricas del Sistema

| Métrica | Valor |
|---|---|
| Documentos indexados | 749 |
| Chunks en índice | 12,468 |
| Dimensiones de embedding | 768 |
| Tamaño índice comprimido | 109 MB |
| topK de recuperación | 12 chunks |
| Contexto máximo LLM | 12,000 chars |
| Citas máximas por respuesta | 20 |
| Ahorro de tokens con TOON | ~40% |
| Tiempo de build en Vercel | 4–5 min |
| Cobertura de áreas legales | 8 áreas |

---

*Última actualización: 2026-02-13*
