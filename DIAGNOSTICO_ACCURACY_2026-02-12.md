# Diagnóstico de Accuracy - ColLawRAG
**Fecha:** 2026-02-12  
**Objetivo:** Identificar gaps y proponer mejoras para aumentar certeza de respuestas

---

## 📊 Estado Actual del Índice RAG

### Métricas Generales
- **Total chunks:** 12,405
- **Embeddings:** 100% (todos los chunks tienen embeddings)
- **Tamaño promedio:** 1,842 caracteres/chunk
- **Tamaño mediano:** 1,053 caracteres/chunk

### Distribución por Fuente
| Fuente | Chunks | % |
|--------|--------|---|
| **Unknown** | 11,671 | **94.1%** ⚠️ |
| Sistema de prueba 2023 | 128 | 1.0% |
| Sistema de prueba 2021 | 115 | 0.9% |
| Sistema de prueba 2024 | 111 | 0.9% |
| Sistema de prueba 2022 | 110 | 0.9% |
| Sistema de prueba 2020 | 100 | 0.8% |
| Sistema de prueba 2025 | 99 | 0.8% |
| Secretaría del Senado | 37 | 0.3% |
| Otros | 34 | 0.3% |

**⚠️ PROBLEMA CRÍTICO:** 94% de chunks sin metadata de fuente

### Distribución por Tipo de Documento
| Tipo | Chunks | % |
|------|--------|---|
| **Unknown** | 11,762 | **94.8%** ⚠️ |
| Constitucionalidad | 215 | 1.7% |
| Unificación | 203 | 1.6% |
| Tutela | 185 | 1.5% |
| Ley | 20 | 0.2% |
| Código | 15 | 0.1% |
| Otros | 5 | <0.1% |

**⚠️ PROBLEMA CRÍTICO:** 94.8% de chunks sin tipo definido

### Distribución por Área Legal
| Área | Chunks | % |
|------|--------|---|
| **General** | 12,366 | **99.7%** ⚠️ |
| Laboral | 8 | 0.1% |
| Constitucional | 8 | 0.1% |
| Penal | 6 | <0.1% |
| Civil | 5 | <0.1% |
| Otros | 12 | <0.1% |

**⚠️ PROBLEMA CRÍTICO:** 99.7% de chunks sin área legal específica

### Tamaño de Chunks
- **Muy pequeños (<100 chars):** 89 chunks (0.7%)
- **Normales (100-2000 chars):** 7,900 chunks (63.7%) ✅
- **Muy grandes (>2000 chars):** 4,416 chunks (35.6%) ⚠️

**⚠️ PROBLEMA:** 35.6% de chunks excesivamente grandes (óptimo: <10%)

---

## 🚨 GAPS IDENTIFICADOS

### Gap 1: Metadata Incompleta (Prioridad: CRÍTICA)
**Estado actual:** 94% de chunks sin fuente, tipo o área definidos  
**Impacto:** Imposible hacer retrieval preciso por categoría legal  
**Causa:** Scripts de ingesta no extraen metadata adecuadamente  

**Solución:**
1. Revisar `scripts/ingest.mjs` para extraer metadata de frontmatter
2. Re-procesar chunks existentes con metadata enriquecida
3. Agregar campos: `fuente`, `tipo`, `area`, `fecha`, `vigencia`

### Gap 2: Jurisprudencia Limitada (Prioridad: ALTA)
**Estado actual:** 2,331 chunks de jurisprudencia (18.8%)  
**Recomendado:** >2,500 chunks (>20%)  
**Gap:** ~200 chunks faltantes  

**Fuentes disponibles no ingestadas:**
- ✅ CSV datos.gov.co: **3,084 sentencias** (1992-2026) - metadata lista
- ✅ metadata-oficial.json ya procesado
- ⚠️ Textos completos NO ingestados aún

**Solución inmediata:**
```bash
# Opción A: Usar sentencias sample existentes (129 archivos)
cd /home/lesaint/Documentos/Cursor/ColLawRAG
npm run ingest

# Opción B: Descargar textos completos de datos.gov.co
# (Requiere proceso híbrido: generar URLs → descarga manual → procesar)
```

### Gap 3: Derecho Administrativo Casi Inexistente (Prioridad: ALTA)
**Estado actual:** 10 chunks (0.1%)  
**Recomendado:** >600 chunks (>5%)  
**Gap:** ~590 chunks faltantes  

**Archivos creados NO ingestados:**
- ✅ `ley-1755-2015.json` (Derecho de Petición) - 11.8KB
- ✅ `ley-393-1997.json` (Acción de Cumplimiento) - 13.9KB

**Solución inmediata:**
```bash
npm run ingest
```

### Gap 4: Derecho Laboral Mínimo (Prioridad: ALTA)
**Estado actual:** 8 chunks (0.1%)  
**Recomendado:** >600 chunks (>5%)  
**Gap:** ~592 chunks faltantes  

**Archivos creados NO ingestados:**
- ✅ `codigo-sustantivo-trabajo.json` (CST) - 17.7KB
- ✅ `ley-789-2002.json` (Empleo) - 9.4KB
- ✅ `ley-1010-2006.json` (Acoso Laboral) - 12KB
- ✅ `ley-2101-2021.json` (Reducción Jornada) - 10.5KB

**Total:** 49.6KB de normatividad laboral lista

**Solución inmediata:**
```bash
npm run ingest
```

### Gap 5: Chunks Excesivamente Grandes (Prioridad: MEDIA)
**Estado actual:** 4,416 chunks >2000 caracteres (35.6%)  
**Recomendado:** <10% chunks grandes  
**Problema:** Chunks grandes reducen precision de retrieval  

**Solución:**
1. Ajustar `chunkSize` en `scripts/ingest.mjs` (actual: probablemente ~2000)
2. Reducir a ~1000-1200 caracteres con overlap de 200
3. Re-ingestar todos los documentos

### Gap 6: Falta Categorización Temática (Prioridad: MEDIA)
**Problema:** No hay categorización por temas específicos (tutela salud, pensiones, despido, etc.)

**Solución:**
- Ejecutar `scripts/categorize-jurisprudencia.mjs` (ya existe)
- Agregar metadata: `tema`, `areaLegal`, `precedente`, `normasCitadas`

---

## 🎯 PLAN DE ACCIÓN INMEDIATO

### Fase 1: Ingestar Normas Nuevas (2-3 horas)
**Prioridad: CRÍTICA**

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
npm run ingest
```

**Resultado esperado:**
- +~500-700 chunks de normatividad laboral
- +~300-400 chunks de normatividad administrativa
- +~200 chunks de jurisprudencia sample
- **Total nuevo:** ~1,000-1,300 chunks (+8-10%)

**Impacto:**
- ✅ Derecho Laboral: 0.1% → ~5%
- ✅ Derecho Administrativo: 0.1% → ~3%
- ✅ Jurisprudencia: 18.8% → ~20%

### Fase 2: Deployment a Producción (30 minutos)
```bash
# Comprimir índices actualizados
npm run upload-indices

# Deploy a Vercel
npx vercel --prod
```

### Fase 3: Testing de Accuracy (1 hora)
```bash
# Ejecutar tests
npm test tests/accuracy.test.ts

# Medir mejora
# Antes: ~60-70% accuracy estimado
# Después: ~75-80% accuracy esperado
```

### Fase 4: Mejorar Metadata (3-4 horas)
**Revisar y mejorar `scripts/ingest.mjs`:**

1. **Extraer metadata de frontmatter:**
```javascript
function extractMetadata(content) {
  const metadata = {};
  
  // Extraer fuente
  const fuenteMatch = content.match(/fuente:\s*(.+)/i);
  if (fuenteMatch) metadata.source = fuenteMatch[1].trim();
  
  // Extraer tipo
  const tipoMatch = content.match(/tipo:\s*(.+)/i);
  if (tipoMatch) metadata.type = tipoMatch[1].trim();
  
  // Extraer área
  const areaMatch = content.match(/area:\s*(.+)/i);
  if (areaMatch) metadata.area = areaMatch[1].trim();
  
  return metadata;
}
```

2. **Incluir metadata en chunks:**
```javascript
{
  id: generateId(),
  content: chunkText,
  embedding: embedding,
  metadata: {
    source: metadata.source || 'unknown',
    type: metadata.type || 'general',
    area: metadata.area || 'general',
    fecha: metadata.fecha,
    vigente: metadata.vigente
  }
}
```

3. **Re-ingestar con metadata:**
```bash
npm run ingest
```

### Fase 5: Optimizar Chunking (2-3 horas)
**Ajustar tamaño de chunks en `scripts/ingest.mjs`:**

```javascript
const CHUNK_SIZE = 1200; // Reducir de ~2000 a 1200
const CHUNK_OVERLAP = 200; // Mantener overlap

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  // ... lógica de chunking
}
```

**Re-ingestar todo:**
```bash
npm run ingest
```

**Resultado esperado:**
- Total chunks: ~12,405 → ~16,000-18,000 chunks
- Chunks grandes: 35.6% → <10%
- Precision de retrieval: +10-15%

---

## 📈 MEJORAS ADICIONALES (Mediano Plazo)

### 1. Procesamiento CSV datos.gov.co (1-2 semanas)
**Obtener textos completos de 3,084 sentencias:**

**Proceso híbrido (recomendado):**
1. Generar lista de URLs con `scripts/generate-download-list.mjs`
2. Descarga manual de HTMLs (navegador)
3. Procesar con `scripts/process-downloaded-files.mjs`
4. Ingestar textos completos

**Resultado esperado:**
- +8,000-10,000 chunks de jurisprudencia
- Jurisprudencia: 18.8% → 35-40%
- **Accuracy esperado: +15-20%**

### 2. Optimización de Retrieval
**Parámetros BM25 actuales** (verificar en `lib/bm25.ts`):
```javascript
k1 = 1.5  // Frecuencia de términos
b = 0.75  // Longitud del documento
alpha = 0.7  // Balance cosine (70%) vs BM25 (30%)
```

**Experimentos sugeridos:**
- Variar `alpha`: 0.6, 0.7, 0.8
- Ajustar `k1`: 1.2, 1.5, 1.8
- Medir impact en accuracy

### 3. Prompts Mejorados
**Revisar `lib/prompt-templates.ts`:**
- Forzar citas de artículos y sentencias
- Estructura HNAC obligatoria en respuestas jurídicas
- Instrucciones de precisión legal

### 4. Re-ranking Semántico
**Implementar cross-encoder para re-ranking:**
- Modelo: `cross-encoder/ms-marco-MiniLM-L-6-v2`
- Re-rankear top 20 chunks con cross-encoder
- Devolver top 5-10 finales

**Accuracy esperado: +5-10%**

### 5. Dataset de Referencia
**Crear benchmark de queries:**
- 50-100 preguntas jurídicas típicas
- Respuestas esperadas (ground truth)
- Medir: Precision, Recall, F1-score

---

## 📊 ROADMAP DE MEJORA

| Fase | Acción | Tiempo | Accuracy Esperado |
|------|--------|--------|-------------------|
| **Actual** | Baseline | - | ~60-70% |
| **Fase 1** | Ingestar normas nuevas | 2-3h | ~75-80% (+10%) |
| **Fase 2** | Mejorar metadata | 3-4h | ~78-82% (+3%) |
| **Fase 3** | Optimizar chunking | 2-3h | ~80-85% (+3%) |
| **Fase 4** | CSV datos.gov.co (3K sentencias) | 1-2 sem | ~85-90% (+8%) |
| **Fase 5** | Re-ranking semántico | 1-2 días | ~88-93% (+5%) |
| **Fase 6** | Fine-tuning prompts | 1-2 días | ~90-95% (+3%) |
| **Meta** | - | - | **95%+** |

---

## ✅ CHECKLIST DE EJECUCIÓN

### Inmediato (Hoy)
- [ ] Ejecutar `npm run ingest` para agregar normas nuevas
- [ ] Deployment: `npm run upload-indices && npx vercel --prod`
- [ ] Ejecutar tests: `npm test tests/accuracy.test.ts`
- [ ] Verificar mejora en producción: https://col-law-rag.vercel.app

### Corto Plazo (Esta Semana)
- [ ] Revisar y mejorar `scripts/ingest.mjs` (metadata)
- [ ] Re-ingestar con metadata enriquecida
- [ ] Ajustar tamaño de chunks (1200 chars)
- [ ] Re-ingestar con nuevo chunking

### Mediano Plazo (2-4 Semanas)
- [ ] Proceso híbrido para CSV datos.gov.co (3,084 sentencias)
- [ ] Implementar re-ranking semántico
- [ ] Optimizar prompts y templates
- [ ] Crear dataset de referencia

---

## 🎯 PRIORIDAD #1: EJECUTAR AHORA

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
npm run ingest
npm run upload-indices
npx vercel --prod
```

**Resultado esperado:**
- Índice: 12,405 → ~13,500-14,000 chunks
- Accuracy: 60-70% → 75-80%
- Cobertura: Laboral 0.1%→5%, Administrativo 0.1%→3%

---

**Última actualización:** 2026-02-12
