# Diagnóstico: Stack y tecnologías por capa del pipeline RAG

**Proyecto:** ColLawRAG  
**Fecha:** 2026-02  
**Objetivo:** Mapa de herramientas/tecnologías por capa y enfoque de diagnóstico alineado al pipeline RAG.

---

## Resumen ejecutivo

| Capa | Stack actual ColLawRAG | Referencia en el mapa |
|------|-------------------------|------------------------|
| Ingesta y extracción | Solo `.txt`; frontmatter YAML; metadatos por cabeceras | Piragi / PyMuPDF (no aplica PDF nativo) |
| Fragmentación | Por artículos (Título/Capítulo/Artículo) + tamaño fijo 1000 chars, overlap 150 | sqlrooms-rag (híbrido encabezados vs tamaño) |
| Embeddings | Xenova (local), HuggingFace API (opcional) | sentence-transformers / Rankify |
| Almacenamiento vectorial | JSON local + opcional Pinecone; BM25 en JSON; Vercel Blob para índices | Piragi (LanceDB, pgvector); htRAG (Vectorize) |
| Recuperación | Cosine similarity + BM25 híbrido (70% vector, 30% BM25); filtro por vigencia | Rankify; Piragi (HyDE, híbrido) |
| Re-ranking | Heurístico (jerarquía legal + recencia + keywords); opcional HF sentence-similarity | RAGFlow (bge-reranker); Rankify (cross-encoders) |
| Generación | HuggingFace (Qwen2.5-7B / Llama-3.2-3B) o Novita (DeepSeek) | RAGFlow; LangChain; Piragi |
| Evaluación y observabilidad | Script `evaluate-accuracy.mjs` (LLM-as-judge); logger estructurado; sin RAGAS/tracing | RAGAS; Future AGI; RAGFlow |
| Todo-en-uno | No; pipeline propio Next.js + scripts | RAGFlow; Piragi; htRAG |

---

## 1. Ingesta y extracción

| Aspecto | Detalle |
|--------|--------|
| **Herramientas actuales** | Lectura de archivos `.txt` desde `data/documents/`. Sin parser de PDF/Word/Excel. Frontmatter YAML (`---` ... `---`) y cabeceras tipo `Clave: valor` antes de `========` o `---`. Detección de área legal por `tema`/`tipo` y por contenido (`detectLegalAreaFromContent`). Scripts de scraping (leyes, jurisprudencia, decretos) generan HTML → texto que luego se convierte a `.txt` para ingest. |
| **Referencia en el mapa** | RAGFlow (parser con layout), Piragi (PDF, Word, Excel, URLs, imágenes, audio), PyMuPDF/pdfminer. |
| **Enfoque para diagnóstico** | **Evaluar:** ¿Se extrae bien el texto de tablas, encabezados y formatos complejos? Hoy **solo se ingesta texto plano (.txt)**; no hay extracción nativa de PDF/Word. Probar con documentos que tengan estructuras variadas (artículos, numerales, tablas en texto). Si se añaden PDFs, valorar RAGFlow/Piragi o un proyecto con PyMuPDF/pdfminer para extracción robusta. |

---

## 2. Fragmentación (chunking)

| Aspecto | Detalle |
|--------|--------|
| **Herramientas actuales** | `splitByArticles()`: segmentación por estructura legal (Título, Capítulo, Sección, Artículo, numerales). `splitTextBySize(text, 1000, 150)`: máximo 1000 caracteres, overlap 150, respetando líneas. `splitLargeChunk(acc, 1000, 150)` aplicado a cada parte para garantizar que ningún chunk supere 1000 caracteres. Chunking listo en ~33k fragmentos para ~746 documentos. |
| **Referencia en el mapa** | RAGFlow (chunking semántico/híbrido), sqlrooms-rag (por encabezados Markdown vs tamaño fijo), Piragi (semántico, jerárquico, contextual). |
| **Enfoque para diagnóstico** | **Evaluar:** ¿Los chunks tienen coherencia semántica? ¿Se cortan ideas importantes (p. ej. un artículo a la mitad)? Comparar rendimiento de recuperación con estrategia actual (artículos + tamaño fijo) frente a solo tamaño fijo o solo por artículos. Medir Recall@k/Precisión@k al cambiar overlap o max size. |

---

## 3. Embeddings y vectorización

| Aspecto | Detalle |
|--------|--------|
| **Herramientas actuales** | **Local (por defecto):** `@xenova/transformers` (Xenova), modelo `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (ingest) o `Xenova/all-MiniLM-L6-v2` (lib/embeddings.ts). **Opcional API:** HuggingFace `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` vía `HUGGINGFACE_API_KEY` y `EMB_PROVIDER=hf`. Fallback "fake" (vector aleatorio normalizado por hash del texto) para desarrollo. |
| **Referencia en el mapa** | sqlrooms-rag (HuggingFace, OpenAI), Rankify (BM25, DPR, ColBERT, BGE, etc.), sentence-transformers. |
| **Enfoque para diagnóstico** | **Evaluar:** ¿El modelo de embeddings captura la semántica del dominio legal colombiano? Comparar Xenova multilingüe vs HF mpnet en benchmarks (e.g. `evaluate-accuracy.mjs`). Valorar fine-tuning o modelos específicos de dominio si la precisión se estanca. |

---

## 4. Almacenamiento vectorial

| Aspecto | Detalle |
|--------|--------|
| **Herramientas actuales** | **Principal:** Índice en `data/index.json` (o `index.json.gz`); array de chunks con `id`, `content`, `metadata`, `embedding`. **BM25:** `data/bm25-index.json` (o `.gz`); índice BM25 propio (tokenización español, stopwords, df, docLengths, invertedIndex). **Opcional:** Pinecone si `PINECONE_API_KEY` y `PINECONE_INDEX`. **Vercel:** Índices descargables desde URLs en `data/indices-urls.json` o desde Vercel Blob (`BLOB_INDEX_URL`, `BLOB_BM25_URL`) para cold start <3s. |
| **Referencia en el mapa** | RAGFlow (Qdrant, Weaviate, Pinecone), sqlrooms-rag (DuckDB), Piragi (LanceDB, pgvector, Pinecone, Supabase), htRAG (Cloudflare Vectorize, D1). |
| **Enfoque para diagnóstico** | **Evaluar:** ¿La búsqueda híbrida (vector + BM25) y el filtrado por metadatos (tipo, área) son suficientes? ¿El rendimiento de consulta es aceptable para el volumen actual (~33k chunks)? Medir latencia de carga de índice (local vs .gz vs Blob) y de retrieval. |

---

## 5. Recuperación (retrieval)

| Aspecto | Detalle |
|--------|--------|
| **Herramientas actuales** | **Vector:** similitud coseno entre embedding de la query y cada chunk (o Pinecone). **Híbrido:** `hybridScore(cosineScore, bm25Score, ...)` con peso configurable (0.7 vector). **Filtros:** por `metadata.type`, filtro de vigencia (normas derogadas). **Re-ranking** aplicado después (más chunks iniciales si `USE_RERANKING`). Top-K por defecto 8; hasta 20 si hay reranking para luego recortar. |
| **Referencia en el mapa** | Rankify (retrievers y rerankers), LangChain + Future AGI (tracing y evaluación), Piragi (HyDE, búsqueda híbrida). |
| **Enfoque para diagnóstico** | **Evaluar:** ¿Los documentos recuperados son realmente relevantes? Medir Recall@k y Precisión@k con el dataset `qa-abogados.json`. Probar distintas proporciones vector/BM25 y top-K. Considerar HyDE o query expansion si la recall es baja. |

---

## 6. Re-ranking

| Aspecto | Detalle |
|--------|--------|
| **Herramientas actuales** | **Heurístico (siempre):** `rerankChunksAdvanced`: jerarquía legal (Constitución > Ley > Decreto > Jurisprudencia > …), recencia (año del documento), coincidencia de términos en título/contenido, match de artículo citado en la query, penalización por normas no vigentes. **Opcional (CU-06):** `USE_CROSS_ENCODER=true` + `HUGGINGFACE_API_KEY`: `rerankWithHFSimilarity()` con `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` (sentence similarity, no cross-encoder estricto). Se aplica a los primeros 16 chunks y se reordenan por score HF. |
| **Referencia en el mapa** | RAGFlow (bge-reranker-large), Rankify (24 modelos, cross-encoders), Piragi (cross-encoder), htRAG (Cohere, Jina). |
| **Enfoque para diagnóstico** | **Evaluar:** El reranker es uno de los cambios de mayor impacto. Comparar calidad del ranking (y accuracy end-to-end) con y sin reranking heurístico, y con y sin HF sentence-similarity. Valorar un cross-encoder dedicado (p. ej. bge-reranker) para mejorar relevancia del contexto final. |

---

## 7. Generación y orquestación

| Aspecto | Detalle |
|--------|--------|
| **Herramientas actuales** | **LLM:** HuggingFace (Qwen2.5-7B-Instruct por defecto, Llama-3.2-3B fallback) o Novita (DeepSeek V3) con `GEN_PROVIDER=novita`. **Orquestación:** `lib/generation.ts`: construcción de contexto desde chunks, prompts desde `prompt-templates`, validación de estructura HNAC, citaciones. **Límites:** MAX_CITATIONS_BASE 8, MAX_CITATIONS_COMPLEX 16; MAX_CONTEXT_CHARS_BASE 4000, COMPLEX 8000. API `/api/rag`: rate limit, tiers (Neon Postgres), caché en memoria. |
| **Referencia en el mapa** | RAGFlow (pipelines, LLMs), LangChain (cadenas), FastAPI + Gemini, Piragi (API unificada). |
| **Enfoque para diagnóstico** | **Evaluar:** ¿El LLM sigue las instrucciones del prompt (citar fuentes, no inventar)? ¿Alucina con información fuera del contexto? Ajustar temperatura (0.1 actual) e instrucciones tipo "cita o silencia". Medir groundedness con evaluate-accuracy (juez LLM). |

---

## 8. Evaluación y observabilidad

| Aspecto | Detalle |
|--------|--------|
| **Herramientas actuales** | **Benchmark de accuracy:** `scripts/evaluate-accuracy.mjs`: consultas a `/api/rag`, juez LLM (Ollama qwen2.5:7b-instruct o endpoint OpenAI-compatible / HuggingFace) que devuelve JSON con criterios (precision_normativa, articulos_correctos, interpretacion_valida, completitud, ausencia_alucinaciones) y veredicto. Resultados en `data/benchmarks/results-YYYY-MM-DD.json`. **Calidad de citas:** `evaluate-citations.mjs`, `generate-quality-report.mjs`. **Logging:** `lib/logger.ts` (estructurado JSON en producción). No hay RAGAS, ni tracing tipo LangSmith/Future AGI, ni métricas de groundedness/fidelidad en tiempo real. |
| **Referencia en el mapa** | RAGAS, Future AGI (tracing, groundedness, contexto), RAGFlow (seguridad y evaluación). |
| **Enfoque para diagnóstico** | **Diagnosticar:** Este es el punto clave. Medir fidelidad (groundedness), relevancia de la respuesta y del contexto. El juez en evaluate-accuracy aproxima eso con criterios explícitos; se puede complementar con RAGAS o un pipeline tipo Future AGI para ver cómo mejoran las métricas al cambiar chunking o recuperación. |

---

## 9. Plataformas todo-en-uno

| Aspecto | Detalle |
|--------|--------|
| **Stack actual** | No se usa una plataforma todo-en-uno. Pipeline propio: Next.js, scripts Node (ingest.mjs, build-bm25.ts, evaluate-accuracy.mjs), lib TypeScript (embeddings, retrieval, reranking, generation), Neon Postgres (auth/tiers), Stripe, Vercel Blob (índices). |
| **Referencia en el mapa** | RAGFlow, Piragi, htRAG. |
| **Enfoque para diagnóstico** | Para diagnóstico rápido, se puede usar RAGFlow o Piragi como línea base y comparar contra el pipeline actual en las mismas preguntas. Profundizar en capas concretas (chunking, retrieval, reranker) si el rendimiento no es el esperado. |

---

## Tabla resumen: mapa de herramientas por capa

| Capa / Función | Herramientas / Opciones en ColLawRAG | Enfoque para diagnóstico |
|---------------|--------------------------------------|---------------------------|
| **Ingesta y extracción** | Solo `.txt`; frontmatter YAML; cabeceras `Clave: valor`; scraping HTML→texto | ¿Se extrae bien texto de estructuras complejas? Valorar parser PDF/Word (RAGFlow, Piragi, PyMuPDF) si se añaden fuentes no TXT. |
| **Fragmentación (chunking)** | Por artículos (Título/Capítulo/Artículo) + tamaño 1000 chars, overlap 150 | ¿Chunks coherentes? ¿Se cortan ideas? Comparar estrategias; medir Recall@k/Precisión@k. |
| **Embeddings y vectorización** | Xenova (local), HuggingFace API (opcional), fallback fake | ¿El modelo captura semántica legal? Comparar Xenova vs HF; valorar fine-tuning. |
| **Almacenamiento vectorial** | JSON local / .gz; BM25 en JSON; Pinecone opcional; Vercel Blob (índices) | ¿Híbrido y filtros por metadatos suficientes? ¿Rendimiento aceptable? Medir latencia carga y retrieval. |
| **Recuperación** | Cosine + BM25 híbrido (70/30); filtro vigencia; top-K 8 (hasta 20 con rerank) | ¿Documentos recuperados relevantes? Recall@k, Precisión@k; probar HyDE o query expansion. |
| **Re-ranking** | Heurístico (jerarquía + recencia + keywords); opcional HF sentence-similarity | Comparar ranking con/sin reranker; valorar cross-encoder (bge-reranker) para más impacto. |
| **Generación y orquestación** | HF (Qwen2.5-7B / Llama-3.2-3B) o Novita (DeepSeek); prompts + HNAC | ¿LLM sigue instrucciones? ¿Alucina? Ajustar temperatura e instrucciones "cita o silencia". |
| **Evaluación y observabilidad** | evaluate-accuracy.mjs (LLM-as-judge); logger estructurado; sin RAGAS/tracing | Medir groundedness y relevancia; complementar con RAGAS o tracing (Future AGI) por capa. |
| **Plataformas todo-en-uno** | No; pipeline propio Next.js + scripts + Neon + Vercel | Usar RAGFlow/Piragi como baseline para comparar; profundizar en capas concretas. |

---

## Archivos clave del stack

- **Ingesta:** `scripts/ingest.mjs` (extracción, chunking, embeddings, escritura índice).
- **Chunking:** `splitByArticles`, `splitTextBySize`, `splitLargeChunk` en `ingest.mjs`.
- **Embeddings:** `lib/embeddings.ts`; ingest usa misma lógica en `embedBatch()`.
- **BM25:** `lib/bm25.ts`; construcción `scripts/build-bm25.ts`.
- **Retrieval:** `lib/retrieval.ts` (carga índice, cosine, BM25, reranking, vigencia).
- **Reranking:** `lib/reranking.ts` (jerarquía, recencia, HF similarity).
- **Generación:** `lib/generation.ts`, `lib/prompt-templates`, `lib/hnac-validator`.
- **Evaluación:** `scripts/evaluate-accuracy.mjs`, `scripts/evaluate-citations.mjs`.
- **Observabilidad:** `lib/logger.ts`; API `/api/rag` (logs, rate limit, tiers).
