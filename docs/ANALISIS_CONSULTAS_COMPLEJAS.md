# Análisis: Por Qué el Sistema No Puede Responder Consultas Complejas

**Fecha**: 2025-01-27  
**Estado del Proyecto**: Re-ingesta completada (11,562 chunks, 32 documentos)

---

## Resumen Ejecutivo

El sistema RAG actual tiene **limitaciones arquitectónicas y de configuración** que impiden responder adecuadamente a consultas complejas. Aunque el retrieval funciona bien, la generación está limitada por:

1. **Capacidad del modelo** (Mistral-7B-Instruct-v0.3)
2. **Límites de contexto** (4000 caracteres, 8 chunks máximo)
3. **Límites de tokens de salida** (2000 tokens)
4. **Falta de razonamiento multi-paso**
5. **No hay capacidad de síntesis de múltiples fuentes**

---

## 1. LIMITACIONES DEL MODELO DE GENERACIÓN

### 1.1 Modelo Actual: Mistral-7B-Instruct-v0.3

**Problemas Identificados:**

- **Capacidad de razonamiento limitada**: Modelos de 7B parámetros tienen dificultades con:
  - Razonamiento jurídico complejo que requiere múltiples pasos
  - Síntesis de información de múltiples fuentes contradictorias
  - Análisis comparativo entre normas
  - Inferencia de consecuencias legales

- **Contexto limitado**: Aunque el modelo puede procesar ~8K tokens de entrada, el sistema solo envía:
  - Máximo 4000 caracteres de contexto (≈1000-1500 tokens)
  - Máximo 8 chunks
  - Esto es insuficiente para consultas que requieren cruzar información de múltiples normas

- **Generación truncada**: Con `max_tokens: 2000` (≈1500 palabras en español), las respuestas complejas pueden quedar incompletas

**Evidencia en el Código:**

```39:41:ColLawRAG/lib/generation.ts
// Maximum number of citations to include in context
const MAX_CITATIONS = 8
// Limit context to avoid API errors (max ~4000 chars to stay within token limits)
const MAX_CONTEXT_CHARS = 4000
```

```283:283:ColLawRAG/lib/generation.ts
    const maxTokens = parseInt(process.env.HF_MAX_TOKENS || '2000', 10)
```

---

## 2. LIMITACIONES DEL RETRIEVAL

### 2.1 Top-K Fijo (8 chunks)

**Problema:**
- El sistema siempre recupera exactamente 8 chunks (o menos)
- Para consultas complejas que requieren:
  - Comparar múltiples normas
  - Analizar jurisprudencia de diferentes cortes
  - Revisar procedimientos multi-etapa
  - 8 chunks pueden ser insuficientes

**Evidencia:**

```226:226:ColLawRAG/lib/rag.ts
  const retrieved = await retrieveRelevantChunks(query, filters, 8)
```

```40:44:ColLawRAG/lib/retrieval.ts
export async function retrieveRelevantChunks(query: string, filters?: RetrieveFilters, topK = 8): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
  const queryEmbedding = await embedText(query)
  
  // Retrieve more chunks initially if re-ranking is enabled (to allow re-ranking to select best)
  const initialTopK = USE_RERANKING ? Math.min(topK * 2, 20) : topK
```

**Nota**: Aunque se recuperan 20 chunks inicialmente para re-ranking, solo se pasan 8 al generador.

### 2.2 No Hay Retrieval Adaptativo

**Problema:**
- El sistema no detecta automáticamente si una consulta requiere más contexto
- No hay "expansión de consulta" para recuperar información relacionada
- No hay "retrieval recursivo" para profundizar en temas específicos

**Ejemplo de Consulta Compleja que Falla:**

```
"¿Cuál es el procedimiento completo para interponer una acción de tutela 
contra una decisión administrativa que viola derechos fundamentales, 
incluyendo requisitos, plazos, competencia, efectos, recursos disponibles 
y jurisprudencia relevante de la Corte Constitucional?"
```

**Por qué falla:**
- Requiere información de múltiples fuentes:
  1. Ley de tutela (procedimiento)
  2. Jurisprudencia de Corte Constitucional (criterios)
  3. Código de Procedimiento Administrativo (recursos)
  4. Ley de Acción de Cumplimiento (alternativas)
- 8 chunks no son suficientes para cubrir todos estos aspectos

---

## 3. LIMITACIONES DEL PROMPT ENGINEERING

### 3.1 Prompt Estático

**Problema:**
- El prompt no se adapta a la complejidad de la consulta
- Siempre usa el mismo formato, independientemente de si la consulta es simple o compleja
- No hay instrucciones específicas para consultas multi-parte

**Evidencia:**

```261:298:ColLawRAG/lib/prompt-templates.ts
export function generateUserPrompt(context: PromptContext): string {
  const { query, chunks, maxCitations, includeWarnings, complexity, legalArea } = context
  
  // Construir contexto con límite explícito de citas
  let contextBlocks = ''
  for (let i = 0; i < chunks.length && i < maxCitations; i++) {
    const r = chunks[i]
    const articleInfo = r.chunk.metadata.article 
      ? ` — ${r.chunk.metadata.article}` 
      : ''
    const chapterInfo = r.chunk.metadata.chapter 
      ? ` (${r.chunk.metadata.chapter})` 
      : ''
    const block = `Fuente [${i + 1}] (${r.chunk.metadata.title}${articleInfo}${chapterInfo}):\n${r.chunk.content}`
    contextBlocks += (i > 0 ? '\n\n' : '') + block
  }
  
  // Advertencia sobre límite de citas si hay más chunks disponibles
  const citationWarning = chunks.length > maxCitations
    ? `\n\n⚠️ NOTA: Solo se proporcionan las primeras ${maxCitations} fuentes más relevantes. Hay ${chunks.length - maxCitations} fuentes adicionales disponibles pero no están incluidas en este contexto.`
    : ''
  
  // Advertencias legales
  const warnings = includeWarnings && legalArea 
    ? generateLegalWarnings(complexity, legalArea)
    : ''
  
  return `CONSULTA LEGAL:
${query}

CONTEXTO LEGAL DISPONIBLE (${chunks.length} fuentes, usando primeras ${Math.min(chunks.length, maxCitations)}):
${contextBlocks}${citationWarning}

INSTRUCCIONES:
Responde como un abogado profesional especializado en ${legalArea || 'derecho colombiano'}, estructurando tu respuesta según el formato indicado.${warnings}

IMPORTANTE: Solo puedes citar fuentes del 1 al ${Math.min(chunks.length, maxCitations)}. Si necesitas más información, indica que la consulta requiere análisis adicional con más fuentes legales.`
}
```

**Problemas específicos:**
- No hay instrucciones para descomponer consultas complejas en sub-preguntas
- No hay guía para sintetizar información de múltiples fuentes
- No hay instrucciones para manejar contradicciones entre fuentes

### 3.2 Detección de Complejidad Básica

**Problema:**
- La detección de complejidad es muy simple (solo busca palabras clave)
- No detecta consultas que requieren razonamiento multi-paso
- No detecta consultas comparativas

**Evidencia:**

```303:335:ColLawRAG/lib/prompt-templates.ts
export function detectComplexity(query: string, chunksCount: number): 'baja' | 'media' | 'alta' {
  const lowerQuery = query.toLowerCase()
  
  // Indicadores de alta complejidad
  const highComplexityIndicators = [
    /\b(múltiples|varios|diferentes|complejo|conflicto|contradicci[oó]n)\b/,
    /\b(procedimiento|proceso|demanda|recurso|apelaci[oó]n)\b/,
    /\b(plazo|término|prescripci[oó]n|caducidad)\b/,
    /\?.*\?/ // Múltiples preguntas
  ]
  
  // Indicadores de media complejidad
  const mediumComplexityIndicators = [
    /\b(cómo|qué hacer|proceder|pasos)\b/,
    /\b(derecho|obligaci[oó]n|requisito)\b/
  ]
  
  const hasHighComplexity = highComplexityIndicators.some(pattern => pattern.test(lowerQuery))
  const hasMediumComplexity = mediumComplexityIndicators.some(pattern => pattern.test(lowerQuery))
  
  // Si hay pocas fuentes, aumenta la complejidad percibida
  const sourceComplexity = chunksCount < 5 ? 1 : chunksCount < 8 ? 0.5 : 0
  
  if (hasHighComplexity || sourceComplexity > 0.5) {
    return 'alta'
  }
  
  if (hasMediumComplexity || sourceComplexity > 0) {
    return 'media'
  }
  
  return 'baja'
}
```

---

## 4. FALTA DE CAPACIDADES AVANZADAS

### 4.1 No Hay Razonamiento Multi-Paso

**Problema:**
- El sistema genera la respuesta en un solo paso
- No puede:
  - Descomponer consultas complejas en sub-preguntas
  - Responder cada sub-pregunta por separado
  - Sintetizar las respuestas parciales
  - Verificar consistencia entre respuestas parciales

**Ejemplo de Consulta que Requiere Multi-Paso:**

```
"Compara los requisitos y plazos para interponer una acción de tutela 
versus una acción de cumplimiento cuando una entidad pública no cumple 
con una sentencia de la Corte Constitucional."
```

**Lo que se necesita:**
1. Paso 1: Recuperar información sobre tutela
2. Paso 2: Recuperar información sobre acción de cumplimiento
3. Paso 3: Comparar requisitos
4. Paso 4: Comparar plazos
5. Paso 5: Sintetizar diferencias

**Lo que hace el sistema actual:**
- Un solo paso: recupera 8 chunks y genera respuesta
- Probablemente no cubre todos los aspectos de la comparación

### 4.2 No Hay Síntesis de Múltiples Fuentes

**Problema:**
- El sistema no puede identificar cuando múltiples fuentes dicen cosas diferentes
- No puede priorizar fuentes según jerarquía legal
- No puede detectar contradicciones

**Ejemplo:**

Si una consulta requiere información de:
- Constitución (jerarquía máxima)
- Ley (jerarquía alta)
- Decreto (jerarquía media)
- Jurisprudencia (interpretación)

El sistema actual no puede:
- Priorizar la Constitución sobre el Decreto
- Identificar si hay contradicción entre Ley y Decreto
- Explicar cómo la jurisprudencia interpreta la Ley

### 4.3 No Hay Validación Post-Generación

**Problema:**
- Aunque existe `factualValidation` y `citationValidation`, están deshabilitadas por defecto
- No hay validación de:
  - Consistencia lógica de la respuesta
  - Completitud de la respuesta (¿se respondieron todas las partes de la consulta?)
  - Relevancia de las citas usadas

**Evidencia:**

```211:214:ColLawRAG/app/api/rag/route.ts
    // Mapear a flags del pipeline
    // Nota: includeFactualValidation no está en tiers, usar variable de entorno
    const enableFactualValidation = process.env.ENABLE_FACTUAL_VALIDATION === 'true'
    const enableStructuredResponse = tierAdjustedParams.includeStructuredResponse
```

---

## 5. LIMITACIONES DE DATOS

### 5.1 Cobertura Limitada

**Estado Actual:**
- 32 documentos indexados
- 11,562 chunks
- Principalmente códigos y leyes básicas
- Solo 3 sentencias de jurisprudencia (C-355/2006, T-760/2008, T-406/1992)

**Problemas:**
- Falta jurisprudencia reciente (últimos 5 años)
- Falta jurisprudencia de diferentes áreas
- Falta decretos reglamentarios específicos
- Falta resoluciones de entidades regulatorias

**Impacto:**
- Consultas sobre jurisprudencia reciente no pueden responderse
- Consultas sobre procedimientos específicos pueden no encontrar información
- Consultas comparativas pueden no tener suficientes fuentes

### 5.2 Calidad de Chunking

**Problema Potencial:**
- Aunque el chunking mejoró, puede haber problemas con:
  - Chunks que cortan artículos a la mitad
  - Chunks que pierden contexto de jerarquía (capítulo, sección, artículo)
  - Chunks muy pequeños que no tienen suficiente contexto

**Evidencia de Mejora Reciente:**

El sistema ahora detecta artículos, capítulos y secciones, pero no está claro si esto se aplica consistentemente a todos los documentos.

---

## 6. RECOMENDACIONES PARA MEJORAR CONSULTAS COMPLEJAS

### 6.1 Corto Plazo (1-2 semanas)

1. **Aumentar Top-K Adaptativo**
   - Detectar complejidad de consulta
   - Si es "alta", recuperar 12-16 chunks en lugar de 8
   - Pasar más contexto al generador

2. **Mejorar Detección de Complejidad**
   - Usar modelo pequeño para clasificar complejidad
   - Detectar consultas comparativas, multi-parte, procedimentales

3. **Aumentar Max Tokens**
   - De 2000 a 3000-4000 tokens para consultas complejas
   - Ajustar según complejidad detectada

4. **Habilitar Validaciones**
   - Activar `ENABLE_FACTUAL_VALIDATION=true`
   - Activar `ENABLE_CITATION_VALIDATION=true`
   - Usar validaciones para mejorar respuestas

### 6.2 Mediano Plazo (1-2 meses)

1. **Implementar RAG Recursivo**
   - Descomponer consultas complejas en sub-preguntas
   - Recuperar información para cada sub-pregunta
   - Sintetizar respuestas parciales

2. **Mejorar Modelo de Generación**
   - Evaluar modelos más grandes (Llama-3-70B, Mistral-Large)
   - Usar modelos especializados en español jurídico si están disponibles
   - Considerar modelos con mejor razonamiento (GPT-4, Claude)

3. **Implementar Retrieval Adaptativo**
   - Expansión de consulta automática
   - Retrieval iterativo para profundizar
   - Re-ranking mejorado con cross-encoder

4. **Expandir Base de Datos**
   - Aumentar a 100+ documentos
   - Incluir más jurisprudencia (últimos 5 años)
   - Agregar decretos reglamentarios específicos

### 6.3 Largo Plazo (3-6 meses)

1. **Arquitectura Multi-Agente**
   - Agente de descomposición de consultas
   - Agente de retrieval especializado
   - Agente de síntesis y validación
   - Agente de generación final

2. **Fine-tuning de Modelo**
   - Entrenar modelo específico para derecho colombiano
   - Usar dataset de consultas y respuestas legales
   - Optimizar para razonamiento jurídico

3. **Sistema de Memoria**
   - Guardar contexto de conversaciones anteriores
   - Permitir seguimiento de consultas relacionadas
   - Mantener historial de análisis

---

## 7. CONCLUSIÓN

El sistema actual **funciona bien para consultas simples y medianas**, pero tiene limitaciones arquitectónicas que impiden responder adecuadamente a consultas complejas:

1. **Modelo limitado** (7B parámetros) para razonamiento jurídico complejo
2. **Contexto insuficiente** (4000 chars, 8 chunks) para consultas multi-fuente
3. **Generación de un solo paso** sin capacidad de síntesis multi-paso
4. **Falta de validación** post-generación activa
5. **Base de datos limitada** (32 documentos, poca jurisprudencia)

**Prioridad de Mejoras:**

1. **ALTA**: Aumentar top-K adaptativo, mejorar detección de complejidad
2. **MEDIA**: Implementar RAG recursivo, mejorar modelo de generación
3. **BAJA**: Arquitectura multi-agente, fine-tuning

**Nota sobre el Nuevo Wrapper de Modelo:**

Si estás construyendo un nuevo wrapper de modelo, considera:
- Soporte para modelos más grandes (70B+)
- Capacidad de razonamiento multi-paso (chain-of-thought)
- Mejor manejo de contexto largo (32K+ tokens)
- Especialización en español jurídico
