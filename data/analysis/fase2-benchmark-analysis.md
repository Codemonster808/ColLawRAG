# FASE 2 - Análisis de Benchmark (2026-02-24)

## Resumen Ejecutivo

**Hallazgo crítico:** La regresión de 35.9% → 32.7% NO se debe a alucinaciones. El problema principal es **RETRIEVAL FAILURE**.

## Métricas Clave del Benchmark

- **Total casos:** 180
- **Evaluados:** 178 (2 timeouts)
- **Score promedio:** 3.21/10 (32.1%)
- **Veredictos:**
  - DEFICIENTE: 47 casos
  - REGULAR: 123 casos
  - ACEPTABLE: 6 casos
  - BUENO: 2 casos

### Criterios Desglosados

| Criterio | Score | Interpretación |
|---|---|---|
| ausencia_alucinaciones | 9.17/10 | ✅ **MUY BUENO** - El modelo NO inventa artículos |
| articulos_correctos | 0.71/10 | ❌ **MUY MALO** - Cita artículos incorrectos o no los encuentra |
| precision_normativa | 1.60/10 | ❌ **MALO** - No identifica las normas correctas |
| interpretacion_valida | 2.25/10 | ⚠️ **DEFICIENTE** - Interpretación legal débil |
| completitud | 2.31/10 | ⚠️ **DEFICIENTE** - Respuestas incompletas |

## Patrón Común en Casos Fallidos

### Ejemplo 1: TRI-009 (ICA)
- **Pregunta:** ¿Qué es el impuesto de industria y comercio (ICA)?
- **Referencia:** Menciona Decreto 1333 de 1986
- **RAG respondió:** Cita Art. 904, 907, 910 del Estatuto Tributario (sobre régimen SIMPLE, no ICA)
- **Score:** 4.0/10
- **Alucinaciones:** 10/10 (ninguna alucinación)
- **Problema:** **Retrieval incorrecto** - recuperó artículos del ET sobre SIMPLE en vez del Decreto 1333

### Ejemplo 2: TRI-010 (Beneficio de auditoría)
- **Pregunta:** ¿Qué es el beneficio de auditoría en el impuesto de renta?
- **Referencia:** Art. 689-1 ET
- **RAG respondió:** Cita Art. 689 ET (genérico, no el 689-1 específico)
- **Score:** 3.8/10
- **Alucinaciones:** 10/10 (ninguna alucinación)
- **Problema:** **Retrieval impreciso** - encontró art. relacionado pero no el correcto

### Ejemplo 3: TRI-013 (Tarifa general renta sociedades)
- **Pregunta:** ¿Cuál es la tarifa general del impuesto de renta para sociedades?
- **Referencia:** Art. 240 ET, modificado por Ley 2277 de 2022
- **RAG respondió:** "Las fuentes disponibles no permiten identificar la tarifa general..."
- **Score:** 3.6/10
- **Alucinaciones:** 10/10 (ninguna alucinación)
- **Problema:** **Retrieval failure** - Art. 240 ET debería estar en el índice pero no se recuperó

## Conclusiones

### ✅ Lo que SÍ funciona:
1. **Regla anti-alucinación:** El prompt actual con la instrucción "SOLO puedes mencionar artículos que aparezcan TEXTUALMENTE en las fuentes" está funcionando perfectamente (9.17/10).
2. **Honestidad del modelo:** Cuando no encuentra info, lo dice explícitamente ("Las fuentes disponibles no incluyen...")
3. **Estructura HNAC:** El modelo sigue el formato requerido

### ❌ Lo que NO funciona:
1. **Retrieval accuracy:** El sistema híbrido (BM25 + embeddings) no está recuperando los chunks correctos
2. **Citation precision:** Cuando recupera chunks relacionados, no siempre son los más relevantes
3. **Coverage:** Artículos que DEBERÍAN estar en el índice no se están recuperando

## Hipótesis sobre la Regresión

La adición de corpus en FASE 1 (ET, CC, CP, CPACA, CGP) pudo haber:
1. **Diluido la relevancia:** Más chunks similares compiten por los top-K
2. **Desbalanceado los pesos:** BM25 + embedding puede estar favoreciendo chunks incorrectos
3. **Reducido la granularidad:** El chunking puede estar agrupando múltiples artículos, haciendo más difícil encontrar el específico

## Recomendación

**NO continuar con FASE 2** (prompt tuning). El prompt anti-alucinación ya funciona.

**Pasar directo a FASE 3** (Retrieval Tuning):
- Ajustar pesos BM25 vs embeddings
- Mejorar metadata de chunks (asegurar `articulo` exacto)
- Aumentar top-K o mejorar re-ranking
- Considerar filtros por tipo de norma

**Evidencia:** Con ausencia_alucinaciones = 9.17/10, el problema NO es el prompt, es el retrieval.
