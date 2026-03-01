# Diagnóstico ColLawRAG - 2026-02-28

## 📊 ESTADO ACTUAL

- **Accuracy real:** 32.7% (179/180 casos, benchmark 2026-02-19)
- **Objetivo:** 70%+
- **Brecha:** -37.3pp

## 🔍 ANÁLISIS POR COMPONENTE

### 1. CORPUS (✅ OK)
- **Total chunks:** 33,053
- **Distribución por área:**
  - Constitucional: 7,923 (24%)
  - General: 5,703 (17%)
  - Civil: 5,027 (15%)
  - Administrativo: 3,999 (12%)
  - Comercial: 2,893 (9%)
  - Tributario: 2,788 (8%)
  - Laboral: 2,698 (8%)
  - Penal: 2,022 (6%)
- **Metadata quality:** 82.3% de chunks con metadata.article válida

**VEREDICTO:** El corpus es adecuado en tamaño y cobertura. NO es el cuello de botella.

---

### 2. METADATA EXTRACTION (⚠️ PROBLEMA MENOR)
- **Issue:** 17.7% de chunks tienen `article: "No article"` aunque el contenido SÍ menciona artículos
- **Ejemplo:** Chunks del CST con contenido "Art. 186" pero metadata.article = "No article"
- **Impacto estimado en accuracy:** -3 a -5pp

**VEREDICTO:** Problema identificado pero NO es el cuello de botella principal.

---

### 3. RETRIEVAL (❌ CUELLO DE BOTELLA CRÍTICO)

**Scores por criterio (benchmark 2026-02-19):**
- **articulos_correctos:** 0.74/10 ← ⚠️ CRÍTICO
- **precision_normativa:** 1.64/10 ← ⚠️ MUY BAJO
- interpretacion_valida: 2.28/10
- completitud: 2.40/10
- **ausencia_alucinaciones:** 9.31/10 ← ✅ EXCELENTE

**Prueba manual - Caso "vacaciones laborales":**
- ✅ El Art. 186 CST (vacaciones) SÍ existe en el índice
- ❌ El retrieval devuelve Art. 1186, 1190 del Código Civil (irrelevantes)
- ❌ NO recupera el Art. 186 CST correcto

**Causas raíz identificadas:**

#### 3.1 Embedding semántico débil
- **Modelo:** Xenova/paraphrase-multilingual-MiniLM-L12-v2 (384 dim)
- **Problema:** No diferencia "vacaciones" (civil) vs "vacaciones laborales"
- **Solución:** Necesita embeddings más potentes o mejor query expansion

#### 3.2 BM25 matching incorrecto
- **Problema:** Hace match "1186" con query que busca "186"
- **Solución:** Mejorar tokenización o agregar filtros por área legal

#### 3.3 Query expansion insuficiente
- **Status:** Implementada (lib/query-expansion.ts) pero NO está mejorando retrieval
- **Problema:** El diccionario es muy básico o no se está aplicando correctamente

#### 3.4 Metadata boost no efectivo
- **Status:** Implementado (+15% boost) pero NO compensa el embedding débil
- **Problema:** El boost no es suficiente para superar bad matches

**VEREDICTO:** El RETRIEVAL es el cuello de botella #1. Impacto estimado: -25 a -30pp en accuracy.

---

### 4. RERANKING (⚠️ PROBLEMA MODERADO)

**Configuración actual:**
- Cross-encoder: RERANK_PROVIDER no especificado (probablemente heurístico)
- Cache: Implementado (5 min)
- Penalización normas derogadas: Implementada (-0.30)

**Problemas:**
- Si NO usa cross-encoder real (HF API), el reranking heurístico es débil
- El reranking no puede arreglar retrieval que ya falló en capturar chunks correctos

**VEREDICTO:** El reranking NO puede compensar el retrieval failure. Impacto estimado: -5 a -8pp.

---

### 5. GENERACIÓN LLM (✅ OK)

**Modelo:** qwen2.5:7b-instruct (Ollama local)
- **Puntos fuertes:**
  - ausencia_alucinaciones: 9.31/10 ← Excelente
  - El modelo NO inventa cosas
- **Problema:**
  - Si recibe chunks INCORRECTOS (civil en vez de laboral), genera respuesta INCORRECTA

**VEREDICTO:** La generación NO es el problema. El modelo hace buen trabajo con los chunks que recibe.

---

### 6. JUEZ LLM (⚠️ POSIBLE SESGO)

**Modelo:** qwen2.5:7b-instruct
**Dataset:** qa-abogados.json NO tiene `articulos_esperados` en los casos

**Problemas potenciales:**
- El juez debe INFERIR cuáles artículos son correctos
- Posible sesgo o inconsistencia en evaluación
- Modelo 7B puede tener conocimiento legal limitado

**Impacto estimado:** -3 a -5pp (si el juez evalúa muy estricto o inconsistente)

**VEREDICTO:** Posible problema menor, pero NO es el cuello de botella.

---

## 🎯 CUELLO DE BOTELLA PRINCIPAL

**RETRIEVAL FAILURE (articulos_correctos: 0.74/10)**

El sistema NO está recuperando los chunks correctos para responder las preguntas. Aunque el corpus tiene los documentos necesarios y el LLM no alucina, el retrieval está devolviendo chunks irrelevantes.

**Impacto estimado total:** -25 a -30pp de los -37.3pp de brecha

---

## 🚀 PLAN DE ACCIÓN PRIORIZADO

### PRIORIDAD 1 (Crítico, +20-25pp): Arreglar Retrieval

**Opción A: Query expansion agresiva**
- Expandir diccionario colombiano 10x (más términos coloquiales → artículos específicos)
- Agregar sinónimos legales (liquidación = cesantías + prima + vacaciones)
- Agregar filtro por área legal detectada (query "vacaciones laborales" → SOLO chunks laborales)

**Opción B: Embeddings más potentes**
- Swap a modelo más grande: text-embedding-3-small (OpenAI) o jina-embeddings-v3
- Re-ingest completo con nuevos embeddings
- Costo: API calls, tiempo de re-ingest

**Opción C: Hybrid retrieval recalibrado**
- Aumentar peso de BM25 vs embedding (actual: probablemente 50/50)
- Agregar filtro post-retrieval por área legal
- Ajustar RRF_K (actual: probablemente 60)

**RECOMENDACIÓN:** Ejecutar A + C primero (bajo costo, rápido). Si no alcanza 60%, hacer B.

---

### PRIORIDAD 2 (Moderado, +5-8pp): Mejorar Reranking

**Acciones:**
- Confirmar que RERANK_PROVIDER=hf esté configurado (usar cross-encoder real)
- Si no hay HUGGINGFACE_API_KEY, usar modelo Ollama para reranking
- Recalibrar pesos: semantic (0.3) → BM25 (0.4) → cross-encoder (0.3)

---

### PRIORIDAD 3 (Menor, +3-5pp): Metadata extraction

**Acciones:**
- Arreglar regex de extracción de artículos en chunker
- Re-ingest solo chunks con `article: "No article"` que SÍ tengan artículos en contenido
- Verificar que prefijo jerárquico (Código > Libro > Título > Art.) esté completo

---

### PRIORIDAD 4 (Validación, +0-2pp): Mejorar Juez

**Acciones:**
- Agregar `articulos_esperados` a qa-abogados.json (ground truth manual)
- Usar modelo más grande (14B+ o API) para evaluación
- No truncar respuesta antes de juzgar

---

## 📋 PAYLOADS ACTUALIZADOS

### SPRINT 3: RETRIEVAL RESCUE (URGENTE)

**Objetivo:** Subir de 32.7% → 55%+ (mínimo +22pp)

**Tareas (ejecutar en orden):**

1. **Query expansion 10x** (OpenClaw)
   - Expandir `lib/query-expansion.ts` de 5 términos → 50+ términos
   - Agregar sinónimos: cesantías, liquidación, despido, etc.
   - Agregar mapeo área legal → keywords prioritarios

2. **Filtro por área legal** (Cursor)
   - Detectar área legal en query (expandQuery ya lo hace)
   - En retrieval: boost +50% chunks del área detectada (vs actual +15%)
   - Si área clara (ej: "laboral"), filtrar SOLO esa área (no mixing)

3. **Recalibrar hybrid retrieval** (Cursor)
   - Ajustar pesos BM25 vs embedding: probar 60/40, 70/30
   - Reducir RRF_K de 60 → 40 (más peso a top results)
   - Agregar filtro post-retrieval: eliminar chunks con score < 0.3

4. **Re-ingest selectivo metadata** (Cursor)
   - Arreglar extracción de `metadata.article` en chunker
   - Re-ingest solo chunks con article="No article" pero contenido válido
   - No re-ingest completo (solo ~6000 chunks)

5. **Benchmark incremental** (Cursor)
   - Mini-benchmark 30 casos después de cada cambio
   - Tracking: guardar resultados en data/benchmarks/sprint3-*
   - Meta intermedia: alcanzar 50% antes de benchmark completo

**Tiempo estimado:** 4-6 horas

---

### SPRINT 4: RERANKING BOOST (MEDIO)

**Objetivo:** Subir de ~55% → 65%+ (+10pp)

**Tareas:**

1. **Cross-encoder real** (Cursor)
   - Configurar RERANK_PROVIDER=hf con HUGGINGFACE_API_KEY
   - Fallback: usar Ollama para reranking si no hay API key
   - Modelo HF: cross-encoder/ms-marco-MiniLM-L-6-v2

2. **Recalibrar pesos reranking** (Cursor)
   - Probar: semantic 0.25, BM25 0.45, cross-encoder 0.30
   - A/B test: comparar con pesos actuales

3. **Benchmark completo** (Cursor)
   - Ejecutar 180 casos
   - Comparar con baseline 32.7%

**Tiempo estimado:** 2-3 horas

---

### SPRINT 5: POLISH & DEPLOY (FINAL)

**Objetivo:** Subir de ~65% → 70%+ (+5pp) y deployar

**Tareas:**

1. **Juez mejorado** (Cursor)
   - Agregar articulos_esperados a 50 casos clave
   - No truncar respuesta en evaluación
   - Considerar modelo 14B+ para juzgar

2. **Prompts generación** (Cursor)
   - Refinar system prompt (si completitud sigue baja)
   - Agregar ejemplos few-shot

3. **Deploy a producción** (Cursor)
   - Upload índices a GitHub Releases
   - Deploy Vercel con nuevos índices
   - Benchmark en prod vs local

**Tiempo estimado:** 2-3 horas

---

## ⏱️ TIMELINE ESTIMADO

- **Sprint 3:** 4-6h → Accuracy 55%+
- **Sprint 4:** 2-3h → Accuracy 65%+
- **Sprint 5:** 2-3h → Accuracy 70%+ → DEPLOY

**Total:** 8-12 horas de trabajo → Objetivo alcanzado

---

## 🔄 SIGUIENTE ACCIÓN INMEDIATA

1. Matar proceso `full-diagnostic.mjs` (está atascado)
2. Actualizar HEARTBEAT.md con accuracy real (32.7%)
3. Ejecutar Sprint 3 Tarea 1 (Query expansion 10x)
4. Mini-benchmark 30 casos
5. Evaluar mejora y continuar

---

**Generado:** 2026-02-28 06:54 AM (OpenClaw autonomous diagnostic)
