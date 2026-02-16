# 📚 ColLawRAG — Documentación del Proyecto

> **Sistema RAG (Retrieval-Augmented Generation) para consultas de derecho colombiano**
> 🌐 **Producción:** https://col-law-rag.vercel.app

> 💡 **¿Eres nuevo o no eres técnico?** Lee primero [`DOCUMENTACION_SIMPLE.md`](./DOCUMENTACION_SIMPLE.md) para una explicación más accesible de cómo funciona el sistema.

---

## Tabla de Contenidos

1. [¿Qué es ColLawRAG?](#1-qué-es-collawrag)
2. [Tech Stack](#2-tech-stack)
3. [Diagrama de Arquitectura](#3-diagrama-de-arquitectura)
4. [Cómo está hecho — Explicación del sistema](#4-cómo-está-hecho)
5. [Estructura del Proyecto](#5-estructura-del-proyecto)
6. [API Reference](#6-api-reference)
7. [Variables de Entorno](#7-variables-de-entorno)
8. [Posibles Mejoras](#8-posibles-mejoras)

---

## 1. ¿Qué es ColLawRAG?

ColLawRAG es una aplicación web de inteligencia artificial que permite hacer consultas sobre legislación colombiana en lenguaje natural. El sistema:

- **Recupera** los fragmentos más relevantes de un corpus de ~33 documentos legales (leyes, jurisprudencia, reglamentos)
- **Genera** una respuesta fundamentada en español, con citas a las fuentes exactas
- **Valida** la vigencia de las normas citadas (detecta normas derogadas)
- **Calcula** prestaciones sociales, indemnizaciones y recargos laborales automáticamente
- **Detecta** contradicciones entre fuentes y explica la jerarquía normativa

**Casos de uso:**
- Consultas laborales (horas extras, cesantías, despidos)
- Acciones constitucionales (tutela, cumplimiento)
- Jurisprudencia de la Corte Constitucional
- Cálculo de prestaciones sociales

---

## 2. Tech Stack

### Frontend
| Tecnología | Versión | Rol |
|---|---|---|
| **Next.js** | 14.x (App Router) | Framework fullstack |
| **React** | 18.x | UI reactiva |
| **TypeScript** | 5.x | Tipado estático |
| **Tailwind CSS** | 3.x | Estilos utilitarios |

### Backend / API
| Tecnología | Versión | Rol |
|---|---|---|
| **Next.js API Routes** | 14.x | Endpoints serverless (`/api/*`) |
| **Zod** | 3.x | Validación de schemas en runtime |
| **better-sqlite3** | 12.x | Cache persistente local + auth |
| **LRU Cache** | 10.x | Cache en memoria para embeddings |
| **uuid** | 9.x | Request IDs únicos |

### IA / Modelos
| Tecnología | Modelo | Rol |
|---|---|---|
| **HuggingFace Inference** | `@huggingface/inference` | SDK para LLMs remotos |
| **@xenova/transformers** | 2.x | Embeddings locales (ONNX) |
| **DeepSeek V3.2** | via Novita/HF Router | LLM principal de generación |
| **Qwen 2.5 72B** | via HF Router | LLM fallback |
| **sentence-transformers** | `paraphrase-multilingual-mpnet-base-v2` | Vectorización (768 dims) |

### Búsqueda / Recuperación
| Componente | Tecnología | Detalle |
|---|---|---|
| **Vectorial** | Índice local `.json.gz` + Pinecone (opcional) | Cosine similarity |
| **Léxica** | BM25 propio (`lib/bm25.ts`) | k1=1.5, b=0.75 |
| **Hybrid scoring** | α·cosine + (1-α)·BM25 | α=0.7 por defecto |
| **Reranking** | Heurístico (`lib/reranking.ts`) | Reordenamiento post-retrieval |

### Datos & Almacenamiento
| Recurso | Tecnología | Detalle |
|---|---|---|
| **Índice vectorial** | `data/index.json.gz` | 12,468 chunks + embeddings |
| **Índice BM25** | `data/bm25-index.json.gz` | Índice invertido |
| **Corpus** | `data/documents/*.txt` | 33 documentos legales |
| **Base usuarios** | SQLite (`data/users.db`) | Tiers freemium + usage |
| **Fuente de índices** | GitHub Releases (`indices-v1`) | Descarga en build/runtime |

### Infraestructura
| Servicio | Rol |
|---|---|
| **Vercel** (Hobby) | Hosting serverless, región `iad1` (US East) |
| **GitHub** | Versión + almacenamiento de índices en Releases |
| **HuggingFace / Novita** | Proxy a LLMs de generación |
| **Pinecone** *(opcional)* | Índice vectorial en la nube |

### Herramientas de Desarrollo
| Herramienta | Rol |
|---|---|
| **Jest + ts-jest** | Tests unitarios y de integración |
| **ESLint** | Linting TypeScript |
| **Puppeteer / Cheerio** | Scraping de fuentes legales oficiales |
| **Docker** | Contenedor para desarrollo local |

---

## 3. Diagrama de Arquitectura

### Vista General

```
╔══════════════════════════════════════════════════════════════╗
║                    USUARIO (Browser)                         ║
║              https://col-law-rag.vercel.app                  ║
╚═══════════════════════════╦══════════════════════════════════╝
                            ║ HTTPS / App Router
                            ▼
╔══════════════════════════════════════════════════════════════╗
║               VERCEL SERVERLESS — Next.js 14                 ║
║                                                              ║
║  ┌──────────────┐  ┌────────────────────────────────────┐   ║
║  │  /app/page   │  │         API Routes                 │   ║
║  │  (React UI)  │  │  /api/rag      → Pipeline RAG      │   ║
║  │              │  │  /api/health   → Health check      │   ║
║  │  SearchBar   │  │  /api/analytics→ Dashboard         │   ║
║  │  Filters     │  │  /api/feedback → Feedback          │   ║
║  │  Results     │  │  /api/legal/*  → Legal docs        │   ║
║  └──────────────┘  └────────────┬───────────────────────┘   ║
║                                 │                            ║
║          ╔══════════════════════▼═══════════════════════╗   ║
║          ║              RAG PIPELINE                    ║   ║
║          ║                                              ║   ║
║          ║  [1] query-analyzer    → clasificar query    ║   ║
║          ║  [2] query-decomposer  → sub-queries         ║   ║
║          ║  [3] embeddings        → vectorizar query    ║   ║
║          ║  [4] retrieval         → buscar chunks       ║   ║
║          ║       ├── cosine sim (vectores)              ║   ║
║          ║       └── BM25 (léxico)  → hybrid score      ║   ║
║          ║  [5] reranking         → reordenar           ║   ║
║          ║  [6] norm-vigencia     → validar vigencia    ║   ║
║          ║  [7] procedures        → inyectar pasos      ║   ║
║          ║  [8] prompt-templates  → construir prompt    ║   ║
║          ║  [9] generation        → LLM → respuesta     ║   ║
║          ║  [10] pii-filter       → limpiar PII         ║   ║
║          ║  [11] validators       → factual + citas     ║   ║
║          ║  [12] legal-calculator → cálculos laborales  ║   ║
║          ╚══════════════════════════════════════════════╝   ║
║                                                              ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │              CAPA DE DATOS LOCAL                     │   ║
║  │                                                      │   ║
║  │  index.json.gz ────► Cosine Similarity ──┐          │   ║
║  │  (12,468 chunks)                          ├─► Score  │   ║
║  │  bm25-index.json.gz ► BM25 Score ─────────┘  híbrid │   ║
║  │                                          α=0.7/0.3   │   ║
║  │  data/users.db ────► SQLite (auth/tiers/cache)       │   ║
║  └──────────────────────────────────────────────────────┘   ║
╚═══════════════════════╦══════════════════════════════════════╝
                        ║
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
┌──────────────┐  ┌──────────┐  ┌────────────────┐
│  HUGGINGFACE │  │ PINECONE │  │ GITHUB RELEASES│
│  / NOVITA    │  │(opcional)│  │  (índices .gz) │
│              │  │          │  │                │
│ DeepSeek V3.2│  │ Vectores │  │ index.json.gz  │
│ (generación) │  │ en nube  │  │ bm25-index.gz  │
│ Qwen 2.5 72B │  │          │  │ descarga en    │
│ (fallback)   │  │          │  │ build/runtime  │
└──────────────┘  └──────────┘  └────────────────┘
```

### Flujo de datos — Una consulta

```
Usuario escribe query
        │
        ▼
[Rate Limiting: 50 req/hora/IP]
        │
        ▼
[Validación Zod + Auth tier]
        │
        ▼
[Cache check — SQLite/LRU]
        │ miss
        ▼
[Detectar área legal + complejidad]
  (laboral / constitucional / penal...)
        │
        ▼
[¿Multi-parte? → RAG Recursivo]
        │
        ▼
[Query → Embeddings (768 dims)]
        │
        ├──► Cosine Similarity sobre index.json.gz
        └──► BM25 sobre bm25-index.json.gz
                 │
                 ▼
        [Hybrid Score α=0.7/0.3]
                 │
                 ▼
        [Reranking + top-K adaptativo]
        (K=8 simple / 12 media / 16 alta)
                 │
                 ├──► [Inyectar chunks procedimentales]
                 └──► [Extraer normas aplicables]
                          │
                          ▼
                 [Prompt HNAC + contexto legal]
                 (Hechos, Normas, Análisis, Conclusión)
                          │
                          ▼
                 [LLM → DeepSeek V3.2 / Qwen 2.5 72B]
                          │
                          ▼
                 [Filtro PII + Validación factual]
                          │
                          ├──► [Vigencia de normas]
                          ├──► [Cálculos laborales]
                          ├──► [Comparación de fuentes]
                          └──► [Jerarquía legal]
                                   │
                                   ▼
                         [Respuesta final + citas]
                                   │
                                   ▼
                           Cache + Retornar JSON
```



---

## 4. Cómo está hecho

### 4.0. Explicación simple: ¿Cómo funciona debajo del capó?

**Para personas no técnicas:** Esta sección explica cómo funciona el sistema de manera sencilla, usando analogías del mundo real.

#### La analogía de la biblioteca inteligente

Imagina que ColLawRAG es como una **biblioteca gigante** con un bibliotecario muy inteligente que nunca se cansa:

1. **Tú haces una pregunta** → "¿Cuántos días de vacaciones tiene un trabajador?"
2. **El bibliotecario entiende** → "Esto es sobre derecho laboral, pregunta simple"
3. **Busca en dos formas diferentes:**
   - **Por significado**: Encuentra documentos que hablan de lo mismo aunque usen palabras diferentes
   - **Por palabras exactas**: Encuentra documentos que contienen las palabras que mencionaste
4. **Combina ambos resultados** → Toma lo mejor de ambas búsquedas
5. **Selecciona los mejores fragmentos** → Los 8-16 más relevantes
6. **Un asistente IA lee y sintetiza** → Genera una respuesta clara y estructurada
7. **Verifica que todo sea correcto** → Asegura que las leyes citadas sigan vigentes
8. **Te da la respuesta** → Con todas las citas exactas

#### Conceptos técnicos explicados de forma simple

**¿Qué es un "embedding" o vector?**
- Cada palabra o frase tiene un "código de barras" numérico único
- Palabras con significado similar tienen códigos similares
- El sistema usa estos códigos para encontrar documentos relacionados, aunque usen palabras diferentes
- *Ejemplo:* "vacaciones" y "días libres" tienen códigos similares porque significan lo mismo

**¿Qué es "cosine similarity"?**
- Una forma matemática de medir qué tan similares son dos códigos numéricos
- Si dos documentos tienen códigos muy parecidos, hablan de lo mismo
- Es como comparar dos códigos de barras y ver qué tan parecidos son

**¿Qué es BM25?**
- Un algoritmo clásico de búsqueda que cuenta cuántas veces aparecen tus palabras clave
- Mientras más veces aparezcan tus palabras, más relevante es el documento
- Es como usar Ctrl+F pero en miles de documentos a la vez

**¿Qué es un LLM (Large Language Model)?**
- Un modelo de inteligencia artificial entrenado con millones de textos
- Puede leer, entender y generar texto en lenguaje natural
- Es como tener un escritor muy inteligente que puede sintetizar información compleja
- En este sistema, usa DeepSeek V3.2 o Qwen 2.5 como "cerebro"

**¿Qué es RAG (Retrieval-Augmented Generation)?**
- **Retrieval (Recuperación)**: Busca información relevante en documentos reales
- **Augmented (Aumentado)**: Usa esa información para mejorar la respuesta
- **Generation (Generación)**: Un modelo de IA genera la respuesta final
- **En palabras simples:** En lugar de inventar cosas, primero busca información real y luego genera una respuesta basada en esa información

**¿Por qué usar búsqueda híbrida (vectores + BM25)?**
- **Búsqueda vectorial**: Encuentra documentos por significado (aunque usen palabras diferentes)
- **BM25**: Encuentra documentos por palabras exactas (más preciso para términos técnicos)
- **Combinados**: Obtienes lo mejor de ambos mundos
- *Ejemplo:* Si preguntas "horas extras", la búsqueda vectorial encuentra documentos que dicen "tiempo adicional", y BM25 encuentra documentos que dicen exactamente "horas extras"

**¿Cómo funciona el cache?**
- El sistema guarda respuestas para no tener que buscar de nuevo
- Si alguien más hizo la misma pregunta hace poco, te da la respuesta guardada
- Tiene 3 niveles: memoria (ultra rápido), disco (rápido), y navegador (muy rápido)
- *Ejemplo:* Si 10 personas preguntan lo mismo en 5 minutos, solo busca una vez

**¿Qué significa "validación de vigencia"?**
- Las leyes pueden ser derogadas o modificadas con el tiempo
- El sistema verifica que las leyes que cita sigan vigentes
- Si una ley fue derogada, te advierte en la respuesta
- *Ejemplo:* Si cita una ley de 1990 que fue derogada en 2015, te lo dice

---

## 4. Cómo está hecho — Detalles técnicos

### 4.1. Pipeline RAG

El corazón del sistema es `lib/rag.ts` — un pipeline de 12 pasos que convierte una pregunta en texto libre en una respuesta jurídica fundamentada.

#### Paso 1 — Clasificación de query
```typescript
// lib/query-analyzer.ts
detectLegalArea(query)  // → 'laboral' | 'constitucional' | 'penal' | ...
detectComplexity(query) // → 'baja' | 'media' | 'alta'
```
Determina el área legal y la complejidad para ajustar parámetros downstream.

#### Paso 2 — Descomposición de queries complejas
```typescript
// lib/query-decomposer.ts
// Si la query es multi-parte (ej: "¿Qué dice X y también Y?")
// la divide en sub-queries y las procesa en paralelo (RAG recursivo)
shouldUseRecursiveRag(query, config) → boolean
runRecursiveRag(params, config)      → RagResponse
```

#### Paso 3 — Retrieval híbrido
```typescript
// lib/retrieval.ts
retrieveRelevantChunks(query, filters, topK)
// 1. Vectoriza query → 768 dims (sentence-transformers)
// 2. Cosine similarity contra index.json.gz (12,468 chunks)
// 3. BM25 score contra bm25-index.json.gz
// 4. Hybrid score = 0.7 * cosine + 0.3 * BM25
```
- Top-K adaptativo: 8 (baja) / 12 (media) / 16 (alta complejidad)
- Si está configurado Pinecone, usa ANN en la nube

#### Paso 4 — Reranking
```typescript
// lib/reranking.ts
// Reordena chunks por relevancia usando heurísticas
// (presencia de términos exactos, frecuencia, posición en documento)
```

#### Paso 5 — Validación de vigencia
```typescript
// lib/norm-vigencia.ts
consultarVigencia(normaId) // → { vigente, estado, derogadaPor, derogadaDesde }
// Detecta normas derogadas y agrega advertencias a la respuesta
```

#### Paso 6 — Inyección de procedimientos
```typescript
// lib/procedures.ts
isProcedureRelatedQuery(query) // ¿La consulta es sobre un procedimiento?
getProcedureChunksForQuery(query, legalArea)
// Inyecta pasos, plazos y etapas de acciones como tutela, cumplimiento, etc.
```

#### Paso 7 — Generación con LLM
```typescript
// lib/generation.ts
generateAnswerSpanish({
  query, chunks, legalArea,
  complexity,
  enforceHNAC: true  // Formato: Hechos → Normas → Análisis → Conclusión
})
// Llama a DeepSeek V3.2 vía HuggingFace/Novita
// Fallback: Qwen 2.5 72B
```

#### Paso 8 — Filtros y validaciones (opcionales, lazy-loaded)
| Módulo | Función | Activación |
|---|---|---|
| `pii.ts` | Eliminar emails, teléfonos, cédulas | Siempre |
| `factual-validator.ts` | Verificar hechos contra chunks | `ENABLE_FACTUAL_VALIDATION=true` |
| `citation-validator.ts` | Verificar citas del LLM | `ENABLE_CITATION_VALIDATION=true` |
| `legal-calculator.ts` | Calcular prestaciones/indemnizaciones | `ENABLE_CALCULATIONS=true` |
| `source-comparator.ts` | Detectar contradicciones entre fuentes | Siempre (try/catch) |
| `hierarchy-explainer.ts` | Explicar jerarquía normativa | Siempre (try/catch) |

### 4.2. Sistema de Tiers (Freemium)

```
Usuario free   → 10 consultas/mes, sin validaciones avanzadas
Usuario premium → ilimitado, factual + citation validation habilitadas
```

Identificación: header `x-user-id` en requests. Sin header = anónimo (límite por IP).

### 4.3. Cache en capas

```
L1: LRU en memoria  (ultra-rápido, se resetea por cold start)
L2: SQLite local    (persiste entre requests en el mismo worker)
L3: Response cache  (Cache-Control: s-maxage=60)
```

### 4.4. Scraping y construcción del corpus

```bash
# Scraper de Corte Constitucional (tutela, C-xxx, SU-xxx)
npm run scrape:jurisprudencia -- --year=2024 --type=tutela

# Scraper de leyes generales
npm run scrape:leyes

# Convertir JSONs a .txt para ingesta
npm run convert-jurisprudencia

# Vectorizar todo el corpus → genera index.json + bm25-index.json
npm run ingest

# Subir índices a GitHub Releases para deployment
npm run upload-indices
```

### 4.5. Despliegue (Vercel)

```
GitHub Push → Vercel Build
                    │
                    ├── npm install
                    ├── npm run download-indices  ← descarga .gz de GitHub Releases
                    └── npm run build  (Next.js)
                              │
                              ▼
                    Serverless Functions listas
                    Cold start: ~5-15s (descarga índices si no persisten)
                    Warm requests: ~2-5s
```

### 4.6. Estructura de datos de un chunk

```typescript
interface DocumentChunk {
  id: string
  content: string          // Texto del fragmento
  embedding: number[]      // Vector 768 dims
  metadata: {
    id: string
    title: string          // "Ley 1755 de 2015"
    type: string           // 'ley' | 'jurisprudencia' | 'decreto' | ...
    url?: string           // URL oficial
    article?: string       // "Artículo 25"
    date?: string
    source?: string
  }
}
```

---

## 5. Estructura del Proyecto

```
ColLawRAG/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Página principal (UI búsqueda)
│   ├── layout.tsx                # Layout global + metadata
│   ├── analytics/                # Dashboard de analytics
│   ├── status/                   # Dashboard de estado del servicio
│   ├── terminos/                 # Página de términos
│   └── api/
│       ├── rag/                  # ⭐ Endpoint principal RAG
│       │   ├── route.ts          # Handler POST /api/rag
│       │   └── schema.ts         # Validación Zod
│       ├── health/               # GET /api/health
│       ├── analytics/            # GET /api/analytics
│       ├── feedback/             # POST /api/feedback
│       ├── legal/[doc]/          # GET /api/legal/disclaimer|terms|privacy
│       └── debug/                # GET /api/debug (diagnóstico)
│
├── lib/                          # Lógica de negocio
│   ├── rag.ts                    # ⭐ Pipeline RAG principal (12 pasos)
│   ├── rag-recursive.ts          # RAG recursivo para queries multi-parte
│   ├── embeddings.ts             # Vectorización de texto
│   ├── retrieval.ts              # Búsqueda híbrida (cosine + BM25)
│   ├── reranking.ts              # Reordenamiento de resultados
│   ├── generation.ts             # Llamada a LLM
│   ├── prompt-templates.ts       # Prompts especializados por área legal
│   ├── query-analyzer.ts         # Clasificación de queries
│   ├── query-decomposer.ts       # Descomposición de queries complejas
│   ├── query-splitter.ts         # División de sub-queries
│   ├── bm25.ts                   # Implementación BM25
│   ├── types.ts                  # Interfaces TypeScript
│   ├── tiers.ts                  # Sistema freemium
│   ├── auth.ts                   # Autenticación + logging
│   ├── pii.ts                    # Filtro de datos personales
│   ├── logger.ts                 # Logging estructurado
│   ├── cache-persistent.ts       # Cache SQLite
│   ├── rate-limit-persistent.ts  # Rate limiting SQLite
│   ├── norm-vigencia.ts          # Validación de vigencia normativa
│   ├── norm-extractor.ts         # Extracción de normas de texto
│   ├── procedures.ts             # Base de procedimientos legales
│   ├── legal-calculator.ts       # Cálculos laborales
│   ├── factual-validator.ts      # Validación factual (lazy)
│   ├── citation-validator.ts     # Validación de citas (lazy)
│   ├── response-structure.ts     # Estructuración HNAC (lazy)
│   ├── response-synthesizer.ts   # Síntesis de respuestas
│   ├── source-comparator.ts      # Detección de contradicciones
│   ├── hierarchy-explainer.ts    # Jerarquía normativa
│   └── legal-docs.ts             # Documentos legales estáticos
│
├── components/                   # React components
│   ├── SearchBar.tsx             # Input de búsqueda
│   ├── Filters.tsx               # Filtros por tipo de norma
│   ├── ResultsDisplay.tsx        # Visualización de respuesta + citas
│   ├── CalculationsDisplay.tsx   # Visualización de cálculos
│   ├── VigenciaWarnings.tsx      # Alertas de normas derogadas
│   ├── ProceduresDisplay.tsx     # Visualización de procedimientos
│   └── LoadingSpinner.tsx        # Spinner de carga
│
├── data/
│   ├── documents/                # 33 documentos legales (.txt)
│   ├── index.json.gz             # Índice vectorial (12,468 chunks)
│   ├── bm25-index.json.gz        # Índice BM25
│   ├── users.db                  # SQLite (usuarios, queries, cache)
│   └── procedures/               # Procedimientos legales en JSON
│
├── scripts/                      # Utilidades de línea de comandos
│   ├── ingest.mjs                # Vectorización del corpus
│   ├── build-bm25.ts             # Construcción del índice BM25
│   ├── scrape-jurisprudencia.mjs # Scraper Corte Constitucional
│   ├── scrape-colombia-legal.mjs # Scraper leyes generales
│   ├── upload-indices.mjs        # Subir índices a GitHub Releases
│   ├── download-indices.mjs      # Descargar índices en build
│   ├── evaluate-citations.mjs    # Evaluación de calidad
│   └── generate-toon-payloads.mjs# Payloads TOON para LLMs
│
├── tests/                        # Tests Jest
├── docs/                         # Documentación adicional
├── middleware.ts                 # Middleware Next.js
├── next.config.mjs               # Configuración Next.js
├── vercel.json                   # Config Vercel
├── docker-compose.yml            # Docker para desarrollo local
└── package.json
```

---

## 6. API Reference

### `POST /api/rag` — Consulta principal

**Request:**
```json
{
  "query": "¿Qué dice la ley colombiana sobre horas extras?",
  "filters": {
    "type": "ley"
  },
  "locale": "es"
}
```

**Headers opcionales:**
```
x-user-id: <uuid>      → Identificar usuario (tiers)
x-api-key: <key>       → Para requests externas (si RAG_API_KEY está configurado)
```

**Response exitosa:**
```json
{
  "answer": "Según el Código Sustantivo del Trabajo...",
  "citations": [
    {
      "id": "cst-art-159",
      "title": "Código Sustantivo del Trabajo",
      "type": "codigo",
      "url": "https://...",
      "article": "Artículo 159",
      "score": 0.89
    }
  ],
  "retrieved": 8,
  "requestId": "uuid-v4",
  "detectedLegalArea": "laboral",
  "calculations": [...],
  "vigenciaValidation": {
    "warnings": [],
    "byNorma": []
  },
  "procedures": [...],
  "factualValidation": {...},
  "sourceComparison": {...},
  "hierarchyExplanation": {...},
  "metadata": {
    "responseTime": 3240,
    "complexity": "media"
  }
}
```

**Códigos de error:**
| Código | Significado |
|---|---|
| 400 | Query inválida (Zod validation) |
| 401 | API key inválida |
| 413 | Request demasiado grande (>1MB) |
| 429 | Rate limit excedido (50 req/hora) |
| 504 | Timeout del pipeline (>60s) |
| 500 | Error interno |

---

### `GET /api/health` — Estado del servicio

```json
{
  "status": "ok",
  "timestamp": "2026-02-16T16:00:00Z",
  "checks": {
    "index": true,
    "embeddings": true
  },
  "version": "0.1.0"
}
```

---

### `GET /api/analytics` — Métricas

Requiere `?key=<ANALYTICS_SECRET>` si está configurado.

```json
{
  "totalQueries": 1234,
  "successRate": 0.97,
  "avgResponseTime": 3200,
  "queriesByArea": { "laboral": 450, "constitucional": 280 },
  "topUsers": [...]
}
```

---

## 7. Variables de Entorno

```env
# === LLM / Embeddings ===
HUGGINGFACE_API_KEY=hf_...         # API key de HuggingFace (requerido)
HF_EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-mpnet-base-v2
HF_GENERATION_MODEL=deepseek/deepseek-v3.2
EMB_PROVIDER=hf                   # 'hf' | 'local' | 'openai'
GEN_PROVIDER=hf                   # 'hf' | 'ollama' | 'openai'

# === Pinecone (opcional) ===
PINECONE_API_KEY=...
PINECONE_INDEX=col-law-rag

# === Seguridad ===
RAG_API_KEY=...                   # API key para requests externas
ANALYTICS_SECRET=...              # Proteger /analytics

# === Rate limiting ===
RATE_LIMIT_PER_HOUR=50            # Consultas por hora por IP

# === Pipeline ===
PIPELINE_TIMEOUT_MS=60000         # Timeout total del pipeline
ENABLE_FACTUAL_VALIDATION=true    # Validación factual
ENABLE_CITATION_VALIDATION=true   # Validación de citas
ENABLE_CALCULATIONS=true          # Cálculos laborales
ENABLE_STRUCTURED_RESPONSE=true   # Formato HNAC
ENABLE_RECURSIVE_RAG=true         # RAG recursivo para queries multi-parte
ENABLE_NORM_EXTRACTION=true       # Extracción de normas
ENFORCE_HNAC=true                 # Forzar estructura Hechos-Normas-Análisis-Conclusión

# === Índices ===
GITHUB_TOKEN=...                  # Para descargar índices de GitHub Releases
INDICES_REPO=owner/repo           # Repo con los índices
```

---

## 8. Posibles Mejoras

### 🔴 Alta Prioridad

#### 1. Persistencia de índices en Vercel
**Problema:** Los índices `.gz` se descargan en runtime, agregando 10–15 segundos al cold start.  
**Solución:** Usar **Vercel Blob Storage** o **Cloudflare R2** para servir los índices cerca del serverless function. Alternativamente, `outputFileTracingIncludes` en `next.config.mjs`.

#### 2. Base de datos persistente en producción
**Problema:** SQLite (`users.db`) se pierde en cada re-deploy en Vercel porque el filesystem es efímero.  
**Solución:** Migrar a **Vercel Postgres** (Neon) o **PlanetScale** para persistencia real entre deploys.

#### 3. Cache distribuido
**Problema:** Cada instancia serverless tiene su propio cache en memoria; no se comparte entre workers.  
**Solución:** Implementar **Redis** (Upstash, que tiene tier gratuito compatible con Vercel) para cache compartido.

#### 4. Cold start
**Problema:** Primer request tarda 10–15s por descarga y descompresión de índices.  
**Solución:** Warm-up con cron job que llame a `/api/health` cada 5 minutos. Vercel Pro permite warm instances.

---

### 🟡 Prioridad Media

#### 5. Cross-encoder real para reranking
**Problema actual:** El reranking usa heurísticas simples (frecuencia de términos).  
**Mejora:** Implementar un **cross-encoder** real (ej: `cross-encoder/ms-marco-MiniLM-L-6-v2` adaptado para español) que evalúe relevancia query-chunk.

#### 6. Chunking semántico
**Problema:** Los chunks actuales pueden cortar artículos a mitad, perdiendo contexto.  
**Mejora:** Implementar **chunking jerárquico** (ley → título → capítulo → artículo → párrafo) con solapamiento de contexto entre chunks.

#### 7. Expansión del corpus
**Estado actual:** 33 documentos, 12,468 chunks.  
**Objetivo:** 
- Agregar Código de Procedimiento Administrativo (CPACA)
- Jurisprudencia del Consejo de Estado
- Decretos reglamentarios 2020–2025
- Resoluciones de la SIC, MinTrabajo, SFC
- Actualizaciones automáticas via scraper programado

#### 8. Streaming de respuestas
**Mejora:** Implementar **Server-Sent Events (SSE)** para mostrar la respuesta del LLM token a token, mejorando la percepción de velocidad.

#### 9. Evaluación automatizada (RAGAs)
**Mejora:** Integrar **RAGAs** (Retrieval Augmented Generation Assessment) para medir automáticamente:
- Faithfulness (¿la respuesta está soportada por el contexto?)
- Answer relevancy (¿responde la pregunta?)
- Context precision y recall

---

### 🟢 Prioridad Baja / Largo Plazo

#### 10. Autenticación de usuarios real
Implementar OAuth2/JWT con Google, GitHub u otro proveedor. Actualmente la "autenticación" es solo un UUID en header.

#### 11. Feedback loop
Recolectar evaluaciones de los usuarios (👍/👎) y usar los datos para ajustar pesos del reranking o hacer fine-tuning del modelo de embeddings.

#### 12. API pública documentada
Publicar documentación OpenAPI/Swagger interactiva en `/api/docs`. Crear SDK cliente en Python/JS.

#### 13. Exportación de respuestas
Permitir exportar respuestas como **PDF** con formato de informe jurídico, incluyendo citas formateadas.

#### 14. Motor de búsqueda dedicado
Para escalar a >100,000 chunks, reemplazar el índice local `.json.gz` por **Qdrant** o **Weaviate** self-hosted, o **Pinecone** en producción permanente.

#### 15. Multimodalidad
Procesar documentos legales en PDF directamente (sin convertir a texto), preservando estructura de tablas y artículos usando **PDF parsing** semántico.

#### 16. Alertas de cambios normativos
Sistema de suscripción donde los usuarios puedan registrarse para recibir alertas cuando una norma que les interesa sea modificada o derogada.

---

## Resumen de Estado Actual

| Aspecto | Estado |
|---|---|
| 🌐 **Producción** | ✅ https://col-law-rag.vercel.app |
| 📚 **Corpus** | ✅ 33 docs / 12,468 chunks |
| 🔍 **Retrieval** | ✅ Hybrid (cosine + BM25) |
| 🤖 **LLM** | ✅ DeepSeek V3.2 + Qwen fallback |
| 📐 **Formato HNAC** | ✅ Hechos-Normas-Análisis-Conclusión |
| ⚖️ **Vigencia** | ✅ Detección de normas derogadas |
| 🧮 **Cálculos** | ✅ Prestaciones, indemnizaciones, recargos |
| 🔒 **Rate limiting** | ✅ 50 req/hora/IP |
| 💾 **Cache** | ✅ SQLite + LRU (sin Redis aún) |
| 🗃️ **DB Producción** | ⚠️ SQLite efímero en Vercel |
| ❄️ **Cold start** | ⚠️ 10–15s (descarga de índices) |
| 🧪 **Tests** | 🔶 Parcial (Jest + integración básica) |

---

*Generado el 2026-02-16 — ColLawRAG v0.1.0*
