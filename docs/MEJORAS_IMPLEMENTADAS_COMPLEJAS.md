# Mejoras Implementadas para Consultas Complejas

**Fecha**: 2025-01-27  
**Estado**: ✅ Completado

---

## Resumen

Se han implementado mejoras críticas para mejorar la capacidad del sistema de responder consultas complejas. Estas mejoras incluyen detección de complejidad mejorada, Top-K adaptativo, max_tokens adaptativo, y prompts mejorados para consultas complejas.

---

## Mejoras Implementadas

### ✅ 1. Detección de Complejidad Mejorada

**Archivo**: `lib/prompt-templates.ts`

**Cambios**:
- Sistema de scoring más sofisticado que cuenta múltiples indicadores
- Detecta consultas comparativas (`versus`, `comparar`, `diferencia`)
- Detecta consultas procedimentales completas
- Detecta consultas multi-parte (`incluyendo`, `además`, `también`)
- Detecta consultas que requieren jurisprudencia
- Detecta consultas multi-área legal
- Considera longitud de la consulta
- Considera número de preguntas en la consulta

**Indicadores de Alta Complejidad** (peso 2):
- Múltiples/varios/diferentes/complejo/conflicto/contradicción/comparar
- Procedimiento completo/proceso completo/demanda/recurso/apelación
- Plazo/término/prescripción/caducidad/vencimiento
- Múltiples preguntas (`?.*?`)
- Consultas multi-parte (`incluyendo`, `además`, `también`)
- Consultas comparativas (`versus`, `vs.`, `contra`, `frente a`)
- Consultas exhaustivas (`todos los`, `completo`, `integral`)
- Requiere jurisprudencia (`jurisprudencia`, `sentencia`, `fallo`)

**Clasificación**:
- Score >= 5: `alta`
- Score >= 2: `media`
- Score < 2: `baja`

**Impacto**: Mejor detección de consultas complejas permite ajustar parámetros adecuadamente.

---

### ✅ 2. Top-K Adaptativo

**Archivo**: `lib/rag.ts`

**Cambios**:
- Top-K se ajusta según complejidad detectada:
  - **Alta complejidad**: 16 chunks
  - **Media complejidad**: 12 chunks
  - **Baja complejidad**: 8 chunks (default)

**Implementación**:
```typescript
const adaptiveTopK = detectedComplexity === 'alta' ? 16 : 
                     detectedComplexity === 'media' ? 12 : 8
const retrieved = await retrieveRelevantChunks(query, filters, adaptiveTopK)
```

**Impacto**: Consultas complejas ahora tienen acceso a más contexto, mejorando la calidad de las respuestas.

---

### ✅ 3. Max Tokens Adaptativo

**Archivo**: `lib/generation.ts`

**Cambios**:
- Max tokens se ajusta según complejidad:
  - **Alta complejidad**: `max(baseMaxTokens * 1.5, 3000)` (mínimo 3000 tokens)
  - **Media complejidad**: `max(baseMaxTokens * 1.2, 2400)` (mínimo 2400 tokens)
  - **Baja complejidad**: `baseMaxTokens` (default: 2000)

**Implementación**:
```typescript
const adaptiveMaxTokens = complexity === 'alta' ? Math.max(baseMaxTokens * 1.5, 3000) : 
                          complexity === 'media' ? Math.max(baseMaxTokens * 1.2, 2400) : 
                          baseMaxTokens
```

**Impacto**: Consultas complejas pueden generar respuestas más completas sin truncarse.

---

### ✅ 4. Contexto Adaptativo

**Archivo**: `lib/generation.ts`

**Cambios**:
- Max citations y max context chars se ajustan según complejidad:
  - **Alta complejidad**: 16 citations, 8000 caracteres
  - **Media complejidad**: 12 citations, 6000 caracteres
  - **Baja complejidad**: 8 citations, 4000 caracteres (default)

**Implementación**:
```typescript
const maxCitations = complexity === 'alta' ? MAX_CITATIONS_COMPLEX : 
                     complexity === 'media' ? 12 : MAX_CITATIONS_BASE
const maxContextChars = complexity === 'alta' ? MAX_CONTEXT_CHARS_COMPLEX : 
                        complexity === 'media' ? 6000 : MAX_CONTEXT_CHARS_BASE
```

**Impacto**: Consultas complejas pueden incluir más fuentes y más contexto en el prompt.

---

### ✅ 5. Prompts Mejorados para Consultas Complejas

**Archivo**: `lib/prompt-templates.ts`

**Cambios**:
- Instrucciones especiales para consultas complejas en `generateSystemPrompt`
- Instrucciones adicionales en `generateUserPrompt` para consultas complejas
- Guía específica para:
  - Consultas multi-parte
  - Consultas comparativas
  - Consultas procedimentales
  - Manejo de contradicciones entre fuentes
  - Integración de información multi-área

**Instrucciones Especiales** (solo para complejidad alta):
```
6. CONSULTAS COMPLEJAS - INSTRUCCIONES ESPECIALES:
   - Si la consulta tiene múltiples partes, responde cada parte de forma estructurada
   - Si es una consulta comparativa, organiza la respuesta en secciones claras para cada elemento comparado
   - Si es una consulta procedimental, detalla TODOS los pasos en orden cronológico
   - Si hay contradicciones entre fuentes, explícalas claramente y prioriza según jerarquía legal
   - Si la consulta requiere información de múltiples áreas legales, integra la información de forma coherente
   - Para consultas que requieren jurisprudencia, cita los criterios específicos de las sentencias relevantes
   - Si la información disponible no cubre todos los aspectos de la consulta, indícalo explícitamente en cada sección afectada
```

**Impacto**: El modelo recibe instrucciones más específicas para manejar consultas complejas, mejorando la estructura y completitud de las respuestas.

---

### ✅ 6. Validaciones Mejoradas

**Archivo**: `app/api/rag/route.ts`

**Cambios**:
- Validaciones habilitadas por defecto para usuarios premium
- Validaciones pueden forzarse con variables de entorno
- Validaciones deshabilitadas por defecto para usuarios free (para reducir costo)

**Implementación**:
```typescript
const forceFactualValidation = process.env.ENABLE_FACTUAL_VALIDATION === 'true'
const forceCitationValidation = process.env.ENABLE_CITATION_VALIDATION === 'true'
const enableFactualValidation = forceFactualValidation || 
                                (userTier === 'premium' && process.env.ENABLE_FACTUAL_VALIDATION !== 'false')
const enableCitationValidation = forceCitationValidation || 
                                 (userTier === 'premium' && process.env.ENABLE_CITATION_VALIDATION !== 'false')
```

**Impacto**: Usuarios premium obtienen validaciones automáticas que mejoran la calidad de las respuestas.

---

## Parámetros por Complejidad

| Complejidad | Top-K | Max Citations | Max Context Chars | Max Tokens |
|-------------|-------|---------------|-------------------|------------|
| **Baja** | 8 | 8 | 4000 | 2000 |
| **Media** | 12 | 12 | 6000 | 2400 |
| **Alta** | 16 | 16 | 8000 | 3000+ |

---

## Ejemplos de Consultas que se Benefician

### Consultas Comparativas
```
"Compara los requisitos y plazos para interponer una acción de tutela 
versus una acción de cumplimiento cuando una entidad pública no cumple 
con una sentencia de la Corte Constitucional."
```
**Beneficio**: Ahora recupera 16 chunks, puede usar 16 citations, 8000 chars de contexto, y 3000+ tokens de respuesta.

### Consultas Procedimentales Completas
```
"Explícame el procedimiento completo para interponer una acción de tutela 
en Colombia: requisitos, plazos, competencia, efectos y recursos disponibles."
```
**Beneficio**: Instrucciones específicas para detallar TODOS los pasos, más contexto disponible.

### Consultas Multi-Parte
```
"¿Cuál es el procedimiento para interponer una acción de tutela, incluyendo 
requisitos, plazos, competencia, efectos, recursos disponibles y jurisprudencia 
relevante de la Corte Constitucional?"
```
**Beneficio**: Instrucciones para responder cada parte de forma estructurada, más contexto.

---

## Próximos Pasos Recomendados

1. **Monitoreo**: Agregar métricas para medir el impacto de estas mejoras
2. **Ajuste Fino**: Ajustar los parámetros según resultados reales
3. **RAG Recursivo**: Implementar descomposición de consultas complejas en sub-preguntas
4. **Modelo Mejorado**: Evaluar modelos más grandes (70B+) para mejor razonamiento

---

## Notas Técnicas

- La detección de complejidad se hace antes del retrieval completo para optimizar el top-K
- Los parámetros adaptativos se aplican tanto al retrieval como a la generación
- Las validaciones están habilitadas por defecto para premium pero pueden forzarse con variables de entorno
- Los prompts incluyen instrucciones específicas solo cuando la complejidad es alta
