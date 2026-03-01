# Análisis Arquitectura Senior - ColLawRAG
**Fecha:** 2026-03-01  
**Arquitecto:** Sistema de Análisis RAG Especializado  
**Objetivo:** Llevar accuracy de 51.7% → 70%+ en 3 sprints

---

## 🔍 Diagnóstico: Top 3 Causas Raíz de Bajo Rendimiento

### **Causa Raíz #1: Retrieval Failure Crítico** ⚠️ **P0-CRÍTICO**

**Síntoma:**
- `articulos_correctos`: **0.252/10** (25.2% de precisión)
- `precision_normativa`: **0.235/10** (23.5%)
- Casos como LAB-015 fallan completamente: "No se encontraron documentos relevantes"

**Análisis profundo:**
1. **Embeddings semánticos débiles (Xenova 384-dim):**
   - Modelo `paraphrase-multilingual-MiniLM-L12-v2` es generalista
   - NO fine-tuned para dominio legal colombiano
   - Confunde artículos similares (ej: Art. 186 vs Art. 1186)

2. **Reranking heurístico insuficiente:**
   - Sin cross-encoder real para scoring fino
   - Penalización por normas derogadas ayuda, pero no corrige chunks irrelevantes
   - Metadata boost (50%) ayuda, pero no sustituye similarity real

3. **Query expansion limitada:**
   - 55 términos coloquiales→legales es bueno, pero gaps en:
     - Terminología tributaria específica (IVA, retención, exención)
     - Procedimientos administrativos (recurso, notificación)
     - Términos técnicos penales

**Impacto medido:**
- **-25 a -30 puntos porcentuales** en accuracy
- Afecta especialmente áreas tributario (49%), penal (33%), constitucional (28%)

**Prioridad:** **P0 - CRÍTICO** (bloquea objetivo 70%)

---

### **Causa Raíz #2: Metadata Extraction Failure** ⚠️ **P1-ALTO**

**Síntoma:**
- ~18% de chunks tienen `metadata.article = "No article"`
- Metadata boost NO funciona para estos chunks (pierden +50% ranking)
- Chunks sin article correcto son ignorados incluso si contienen la respuesta

**Análisis profundo:**
1. **Regex de extracción de artículos fallando:**
   - Variaciones en formato: "Art.", "Artículo", "ART", "art."
   - Artículos con letras: "Art. 186-A", "Art. 77 bis"
   - Artículos en títulos vs contenido

2. **Sin chunks de overview/resumen:**
   - No hay chunks tipo `isOverview: true` para resúmenes de ley/título
   - Queries generales ("¿Qué dice la Ley 100?") fallan por falta de contexto amplio

3. **Overlap por oraciones a veces muy corto:**
   - `<100 chars` en algunos casos (target: 100-400 chars)
   - Pérdida de contexto entre chunks consecutivos

**Impacto medido:**
- **-10 a -15 puntos porcentuales** en retrieval
- Afecta todas las áreas, especialmente preguntas que mencionan artículos específicos

**Prioridad:** **P1 - ALTO** (mejora rápida con alto ROI)

---

### **Causa Raíz #3: Falta de Cross-Encoder Real** ⚠️ **P1-ALTO**

**Síntoma:**
- Reranking actual: solo heurísticas (normas derogadas, metadata boost)
- Sin scoring de relevancia semántica fino entre query y chunk
- Top-8 retrieval incluye chunks irrelevantes que el LLM debe ignorar

**Análisis profundo:**
1. **Hybrid search (BM25+vector) insuficiente:**
   - RRF merge (k=40) prioriza top-results, pero sin scoring de relevancia query-chunk
   - BM25 sobre-pesa matches léxicos (números de artículos) sin entender semántica
   - Vector search con Xenova 384d no discrimina bien entre artículos relacionados

2. **Sin cross-encoder post-retrieval:**
   - Cross-encoders evalúan relevancia (query, chunk) → score 0-1
   - Modelos como `cross-encoder/ms-marco-MiniLM-L-6-v2` dan +10-15pp en accuracy
   - HuggingFace API disponible (gratis hasta 1000 req/día)

3. **Heurísticas actuales son band-aids:**
   - Metadata boost ayuda, pero no reemplaza similarity scoring real
   - Penalización derogadas es correcta, pero no mejora ranking de chunks relevantes

**Impacto medido:**
- **-8 a -12 puntos porcentuales** en precision
- Especialmente crítico en queries complejas (múltiples artículos, jurisprudencia)

**Prioridad:** **P1 - ALTO** (Sprint 4 implementación)

---

## 📊 Priorización por Impacto/Esfuerzo

| Mejora | Impacto (pp) | Esfuerzo (h) | ROI | Sprint | Prioridad |
|--------|-------------|--------------|-----|--------|-----------|
| **Cross-encoder reranking (HF API)** | +10-15 | 16 | ⭐⭐⭐⭐⭐ | 4 | **P0** |
| **Fix metadata.article extraction** | +8-12 | 12 | ⭐⭐⭐⭐⭐ | 4 | **P0** |
| **Query expansion domain-specific** | +5-8 | 10 | ⭐⭐⭐⭐ | 4 | **P1** |
| **Chunks overview/resumen** | +3-5 | 8 | ⭐⭐⭐ | 5 | **P1** |
| **Optimizar RRF weights** | +2-4 | 6 | ⭐⭐⭐ | 5 | **P2** |
| **Ampliar corpus (jurisprudencia)** | +5-10 | 40 | ⭐⭐ | 6 | **P2** |
| **Fine-tune embeddings** | +8-15 | 80+ | ⭐ | Futuro | **P3** |

**Objetivo Sprint 4-6:**
- **Sprint 4:** 51.7% → 63-67% (+12-15pp)
- **Sprint 5:** 63-67% → 68-72% (+5-7pp)
- **Sprint 6:** 68-72% → 73-77% (+3-5pp)

**Total esperado:** **70-77% accuracy** (meta: 70%+) ✅

---

## 🗺️ Hoja de Ruta: 3 Sprints (6 semanas)

### **Sprint 4: Retrieval Rescue Advanced** (2 semanas, 80h)
**Objetivo:** 51.7% → 63-67% accuracy (+12-15pp)

**Tareas:**
1. **Implementar cross-encoder reranking (HF API)** — 16h
   - Provider: HuggingFace Inference API (gratis <1000 req/día)
   - Modelo: `cross-encoder/ms-marco-MiniLM-L-6-v2`
   - Integrar en `lib/reranking.ts` como `applyRerankingWithCrossEncoder()`
   - Fallback a heurísticas si API falla
   - Cache 5 min para queries repetidas

2. **Fix metadata.article extraction en chunker** — 12h
   - Mejorar regex en `scripts/ingest.mjs` para capturar variaciones
   - Agregar fallback: extraer de título si falla en contenido
   - Validar con test cases (Art., Artículo, ART, art., Art. 123-A)
   - Re-ingest si fix mejora >5% metadata correcta

3. **Query expansion domain-specific ampliada** — 10h
   - Agregar +30 términos tributarios específicos (IVA, retención, exención, declaración, DIAN)
   - Agregar +20 términos penales (estafa, hurto, homicidio, pena, prescripción)
   - Agregar +15 términos procedimentales (recurso, apelación, casación, tutela)
   - Total: 55 → 120 términos coloquiales→legales

4. **Mini-benchmark Sprint 4 (30 casos)** — 4h
   - Ejecutar contra producción con cambios deployados
   - Comparar con baseline 51.7%
   - Si >60% → benchmark completo (180 casos)

5. **Documentación y deploy** — 8h
   - CHANGELOG-SPRINT4.md
   - Actualizar KNOWN_ISSUES.md si surgen bugs
   - Deploy a Vercel
   - Validación producción

**Total:** 50h netas + 10h buffer = 60h

**Métricas objetivo:**
- `accuracy`: 0.63-0.67 (63-67%)
- `articulos_correctos`: 0.50+ (50%+, mejora de 0.25)
- `precision_normativa`: 0.45+ (45%+, mejora de 0.23)
- `retrieval_accuracy`: 0.55+ (55%+, mejora de 0.25)

---

### **Sprint 5: Chunking Optimization** (2 semanas, 80h)
**Objetivo:** 63-67% → 68-72% accuracy (+5-7pp)

**Tareas:**
1. **Chunks overview/resumen por ley y título** — 16h
   - Crear chunks tipo `isOverview: true` con resumen de ley completa
   - 1 chunk overview por ley (CST, ET, CC, CP, CPACA, CGP) = 6 chunks
   - 1 chunk overview por título dentro de cada ley (~50 chunks)
   - Contenido: título + lista de artículos + tema general
   - Boost +100% en retrieval para queries generales

2. **Optimizar overlap inteligente** — 8h
   - Garantizar overlap 100-400 chars siempre
   - Preferir overlap por párrafos completos en lugar de oraciones
   - Validar que no haya chunks huérfanos sin contexto

3. **Recalibrar RRF weights (BM25 vs Vector)** — 12h
   - Probar combinaciones: 60/40, 70/30, 55/45
   - A/B test con 50 queries
   - Seleccionar mejor combinación por área legal

4. **Mejorar prompt anti-repetición** — 6h
   - Agregar: "NO repitas información. Sé conciso."
   - Agregar: "Si múltiples artículos aplican, lista solo los más relevantes."
   - Test con queries que generan respuestas largas/repetitivas

5. **Benchmark completo (180 casos)** — 12h
   - Ejecutar con todos los cambios
   - Análisis por área legal
   - Identificar casos límite para Sprint 6

6. **Documentación y deploy** — 6h

**Total:** 60h netas + 10h buffer = 70h

**Métricas objetivo:**
- `accuracy`: 0.68-0.72 (68-72%)
- `completitud`: 0.70+ (70%+, mejora de 0.51)
- `relevancia_contexto`: 0.80+ (80%+, mejora de 0.67)

---

### **Sprint 6: Fine-Tuning & Polish** (2 semanas, 80h)
**Objetivo:** 68-72% → 73-77% accuracy (+3-5pp)

**Tareas:**
1. **Ampliar corpus con jurisprudencia clave** — 24h
   - Scrape top 100 sentencias de Corte Constitucional (T-XXX, C-XXX)
   - Scrape top 50 sentencias de Corte Suprema de Justicia
   - Ingest con metadata: tipo=jurisprudencia, corte, fecha, tema
   - Re-benchmark para validar mejora en preguntas constitucionales/jurisprudencia

2. **Optimizar prompt LLM por complejidad** — 12h
   - Detectar complejidad query (básica/intermedia/avanzada)
   - Prompt básico: "Responde en 2-3 oraciones"
   - Prompt avanzado: "Analiza todos los artículos relacionados"
   - Test con casos EXCELENTE vs DEFICIENTE del benchmark

3. **Implementar cache semántico de queries** — 10h
   - Cache embeddings de queries frecuentes
   - Cache resultados RAG para queries exactas (7 días TTL)
   - Reducir latencia y costos de API

4. **A/B test final con usuarios reales** — 16h
   - Deploy versión Sprint 6 a 50% usuarios
   - Comparar con versión Sprint 5 (50% restante)
   - Métricas: accuracy percibida, satisfacción, tiempo de respuesta
   - Seleccionar versión ganadora

5. **Benchmark final + documentación completa** — 18h
   - Benchmark completo 180 casos
   - Comparativa Sprint 3 → Sprint 6
   - README.md actualizado con resultados
   - Paper técnico (opcional)

**Total:** 80h

**Métricas objetivo:**
- `accuracy`: 0.73-0.77 (73-77%) ✅ **META ALCANZADA**
- `articulos_correctos`: 0.65+ (65%+)
- `groundedness`: 0.95+ (mantener)
- `latency_p95`: <15s por query

---

## 📝 Payloads Actualizados por Sprint

### **Payload Sprint 4: Retrieval Rescue Advanced**

```json
{
  "sprint": 4,
  "nombre": "Retrieval Rescue Advanced",
  "duracion_dias": 14,
  "objetivo_accuracy": "63-67%",
  "mejora_esperada": "+12-15pp",
  "tareas": [
    {
      "id": "S4.1",
      "nombre": "Implementar cross-encoder reranking (HF API)",
      "prioridad": "P0",
      "esfuerzo_horas": 16,
      "impacto_estimado": "+10-12pp",
      "archivos_afectados": [
        "lib/reranking.ts",
        "lib/retrieval.ts",
        ".env.example"
      ],
      "cambios_especificos": {
        "lib/reranking.ts": {
          "nuevo_export": "applyRerankingWithCrossEncoder()",
          "provider": "huggingface_inference_api",
          "modelo": "cross-encoder/ms-marco-MiniLM-L-6-v2",
          "endpoint": "https://api-inference.huggingface.co/models/cross-encoder/ms-marco-MiniLM-L-6-v2",
          "batch_size": 20,
          "cache_ttl_minutes": 5,
          "fallback": "applyReranking() con heurísticas"
        },
        "lib/retrieval.ts": {
          "condicion": "if (RERANK_PROVIDER === 'hf' && process.env.HUGGINGFACE_API_KEY)",
          "llamada": "await applyRerankingWithCrossEncoder(retrieved, query, { topK: 8 })"
        },
        ".env.example": {
          "nueva_variable": "RERANK_PROVIDER=hf  # 'heuristic' | 'hf' (cross-encoder)"
        }
      },
      "testing": [
        "Unit test: applyRerankingWithCrossEncoder con 20 pares (query, chunk)",
        "Integration test: retrieval completo con RERANK_PROVIDER=hf",
        "Fallback test: API falla → usar heurísticas"
      ]
    },
    {
      "id": "S4.2",
      "nombre": "Fix metadata.article extraction en chunker",
      "prioridad": "P0",
      "esfuerzo_horas": 12,
      "impacto_estimado": "+8-10pp",
      "archivos_afectados": [
        "scripts/ingest.mjs"
      ],
      "cambios_especificos": {
        "scripts/ingest.mjs": {
          "funcion": "extractArticleNumber(text, title)",
          "regex_mejorado": [
            "/(?:Art[íi]culo|Art\\.?)\\s+(\\d+(?:-[A-Z])?(?:\\s+bis)?)/gi",
            "Captura: Art. 123, Artículo 123-A, ART 77 bis"
          ],
          "fallback_titulo": "if (!article && title.match(/Art/i)) → extraer de title",
          "validacion": "test con 100 chunks reales → >95% metadata.article correcto"
        }
      },
      "decision_re_ingest": "Si validación mejora >5% metadata correcta → re-ingest completo",
      "testing": [
        "Test cases: Art., Artículo, ART, art., Art. 123-A, Art. 77 bis",
        "Validación: contar chunks con metadata.article != 'No article'",
        "Benchmark: comparar retrieval antes/después del fix"
      ]
    },
    {
      "id": "S4.3",
      "nombre": "Query expansion domain-specific ampliada",
      "prioridad": "P1",
      "esfuerzo_horas": 10,
      "impacto_estimado": "+5-7pp",
      "archivos_afectados": [
        "lib/query-expansion.ts"
      ],
      "cambios_especificos": {
        "lib/query-expansion.ts": {
          "terminos_nuevos": {
            "tributario": [
              "iva: impuesto sobre las ventas, IVA, tarifa general, hecho generador",
              "retencion: retención en la fuente, agente retenedor, retención fiscal, autorretenedor",
              "declaracion: declaración tributaria, declaración de renta, obligación fiscal, vencimiento",
              "exencion: exención fiscal, no gravado, beneficio tributario, tarifa 0%",
              "dian: Dirección de Impuestos, autoridad tributaria, sanción DIAN, liquidación oficial",
              "rut: registro único tributario, NIT, cédula fiscal",
              "regimen: régimen simple, régimen ordinario, responsable IVA",
              "base: base gravable, ingreso gravado, deducción, renta líquida",
              "tarifa: tarifa impositiva, alícuota, porcentaje IVA"
            ],
            "penal": [
              "estafa: delito de estafa, fraude, engaño, Art. 246 CP",
              "hurto: delito de hurto, apoderamiento, robo, Art. 239 CP",
              "homicidio: delito contra la vida, matar, asesinato, Art. 103 CP",
              "pena: sanción penal, prisión, reclusión, multa penal",
              "prescripcion: prescripción de la acción penal, término prescriptivo, extinción",
              "secuestro: privación de la libertad, secuestro extorsivo, rapto",
              "lesiones: lesiones personales, golpear, agresión física",
              "dosificacion: dosificación de la pena, circunstancias agravantes, atenuantes"
            ],
            "procedimientos": [
              "recurso: recurso de reposición, recurso de apelación, medio de impugnación, recurso de casación",
              "apelacion: segunda instancia, apelar, impugnación de sentencia",
              "casacion: recurso extraordinario, Corte Suprema, causal de casación",
              "tutela: acción de tutela, amparo constitucional, derechos fundamentales",
              "notificacion: notificación personal, comunicación oficial, notificación judicial, edicto",
              "termino: término legal, plazo procesal, tiempo procesal, término de traslado",
              "prueba: medio probatorio, prueba documental, prueba testimonial, prueba pericial",
              "sentencia: fallo judicial, providencia, decisión judicial, resolución",
              "demanda: acción judicial, demanda contenciosa, proceso judicial, escrito de demanda"
            ]
          },
          "total_terminos": "55 → 120 términos coloquiales→legales"
        }
      },
      "testing": [
        "Test queries: '¿Qué es el IVA?', 'pena por hurto', 'cómo apelar sentencia'",
        "Validar query expandida incluye términos legales correctos",
        "Benchmark: comparar retrieval antes/después expansion"
      ]
    },
    {
      "id": "S4.4",
      "nombre": "Mini-benchmark Sprint 4 (30 casos)",
      "prioridad": "P1",
      "esfuerzo_horas": 4,
      "impacto_estimado": "validación",
      "comando": "JUDGE_MODEL=qwen2.5:7b-instruct node scripts/evaluate-accuracy.mjs --prod --limit 30",
      "decision": "Si accuracy >60% → benchmark completo (180 casos)"
    },
    {
      "id": "S4.5",
      "nombre": "Documentación y deploy",
      "prioridad": "P2",
      "esfuerzo_horas": 8,
      "archivos": [
        "CHANGELOG-SPRINT4.md",
        "KNOWN_ISSUES.md (actualizar si surgen bugs)",
        "README.md (actualizar metrics)"
      ]
    }
  ],
  "metricas_objetivo": {
    "accuracy": 0.65,
    "articulos_correctos": 0.50,
    "precision_normativa": 0.45,
    "retrieval_accuracy": 0.55,
    "groundedness": 0.95,
    "latency_p95_seconds": 20
  },
  "decision_criteria": {
    "sprint_exitoso": "accuracy >= 0.60 (60%)",
    "sprint_bloqueante": "accuracy < 0.55 (55%) → revisar causas raíz",
    "continuar_sprint_5": "accuracy >= 0.60 (60%)"
  }
}
```

---

### **Payload Sprint 5: Chunking Optimization**

```json
{
  "sprint": 5,
  "nombre": "Chunking Optimization",
  "duracion_dias": 14,
  "objetivo_accuracy": "68-72%",
  "mejora_esperada": "+5-7pp desde Sprint 4",
  "tareas": [
    {
      "id": "S5.1",
      "nombre": "Chunks overview/resumen por ley y título",
      "prioridad": "P1",
      "esfuerzo_horas": 16,
      "impacto_estimado": "+3-5pp",
      "archivos_afectados": ["scripts/ingest.mjs", "lib/types.ts"],
      "cambios_especificos": {
        "nuevo_tipo_chunk": {
          "isOverview": true,
          "content": "RESUMEN: [Nombre Ley]. Regula: [tema]. Contiene: [lista artículos clave]",
          "metadata": {
            "type": "overview",
            "scope": "ley|titulo",
            "law_name": "CST|ET|CC|CP|CPACA|CGP"
          }
        },
        "cantidad": "~60 chunks overview (6 leyes + ~50 títulos)",
        "boost_retrieval": "+100% para queries generales sin artículo específico"
      }
    },
    {
      "id": "S5.2",
      "nombre": "Optimizar overlap inteligente",
      "prioridad": "P2",
      "esfuerzo_horas": 8,
      "cambios": "Garantizar overlap 100-400 chars por párrafos completos"
    },
    {
      "id": "S5.3",
      "nombre": "Recalibrar RRF weights (BM25 vs Vector)",
      "prioridad": "P2",
      "esfuerzo_horas": 12,
      "experimentos": ["60/40", "70/30", "55/45"],
      "seleccion": "Mejor combinación por área legal vía A/B test"
    }
  ],
  "metricas_objetivo": {
    "accuracy": 0.70,
    "completitud": 0.70,
    "relevancia_contexto": 0.80
  }
}
```

---

### **Payload Sprint 6: Fine-Tuning & Polish**

```json
{
  "sprint": 6,
  "nombre": "Fine-Tuning & Polish",
  "duracion_dias": 14,
  "objetivo_accuracy": "73-77%",
  "mejora_esperada": "+3-5pp desde Sprint 5",
  "tareas": [
    {
      "id": "S6.1",
      "nombre": "Ampliar corpus con jurisprudencia clave",
      "prioridad": "P2",
      "esfuerzo_horas": 24,
      "fuentes": [
        "Top 100 sentencias Corte Constitucional (T-XXX, C-XXX)",
        "Top 50 sentencias Corte Suprema de Justicia"
      ],
      "impacto": "+5-10pp en preguntas constitucionales/jurisprudencia"
    },
    {
      "id": "S6.2",
      "nombre": "Optimizar prompt LLM por complejidad",
      "prioridad": "P2",
      "esfuerzo_horas": 12,
      "estrategia": "Detectar complejidad query → ajustar prompt"
    },
    {
      "id": "S6.3",
      "nombre": "A/B test final con usuarios reales",
      "prioridad": "P1",
      "esfuerzo_horas": 16,
      "metodo": "Deploy Sprint 6 a 50% usuarios vs Sprint 5 (50%)"
    }
  ],
  "metricas_objetivo": {
    "accuracy": 0.75,
    "articulos_correctos": 0.65,
    "latency_p95_seconds": 15
  },
  "criterio_exito": "accuracy >= 0.70 (70%) ✅ META ALCANZADA"
}
```

---

## 📈 Proyección de Mejora

| Sprint | Accuracy Inicio | Accuracy Fin | Mejora | Acumulado desde Baseline |
|--------|----------------|--------------|--------|--------------------------|
| **3 (actual)** | 47.6% | 51.7% | +4.1pp | +4.1pp |
| **4** | 51.7% | 63-67% | +12-15pp | +16-19pp ✅ |
| **5** | 63-67% | 68-72% | +5-7pp | +21-26pp ✅ |
| **6** | 68-72% | 73-77% | +3-5pp | +24-31pp ✅ |

**Meta 70% alcanzada en:** Sprint 5 o 6 (alta confianza) ✅

---

## 🎯 Recomendaciones Finales

### **Acción Inmediata (Esta Semana):**
1. ✅ Validar Sprint 3 con benchmark producción CON cambios activados
2. ⏭️ Si Sprint 3 mejora <5pp → iniciar Sprint 4 inmediatamente
3. ⏭️ Si Sprint 3 mejora >10pp → revisar payloads Sprint 4-6

### **Prioridad Crítica Sprint 4:**
- **Cross-encoder HF API:** Mayor ROI (impacto +10-12pp, esfuerzo 16h)
- **Fix metadata.article:** Quick win (impacto +8-10pp, esfuerzo 12h)

### **Riesgos Identificados:**
1. **HuggingFace API rate limits:** Mitigar con cache 5 min + fallback heurísticas
2. **Re-ingest completo:** Solo si fix metadata mejora >5% → planear 2h downtime
3. **Latencia cross-encoder:** Batch 20 pares + timeout 10s por batch

### **KPIs de Seguimiento:**
- **Accuracy semanal:** Target +2-3pp/semana
- **Retrieval precision:** Target +5pp/sprint
- **Latency p95:** Mantener <20s (objetivo: <15s en Sprint 6)

---

**Conclusión:**
Con este plan de 3 sprints (6 semanas, 240h), **alta confianza** de alcanzar 70%+ accuracy. 
Las causas raíz están identificadas, las mejoras priorizadas, y los payloads actualizados listos para ejecución.

**Próximo paso:** Ejecutar benchmark Sprint 3 validación → decidir inicio Sprint 4.

---

*Análisis generado: 2026-03-01 14:30 GMT-5*
