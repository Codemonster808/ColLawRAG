# FASE 2: Chunking Semántico — De corte por tamaño a segmentación inteligente

**Prioridad:** Alta — Chunks incoherentes = retrieval impreciso = respuestas incorrectas  
**Impacto estimado:** +10-15% accuracy (especialmente en completitud y precisión normativa)  
**Esfuerzo:** Medio (3-4 días)  
**Dependencias:** FASE 0 completada. Idealmente FASE 1 también (para re-evaluar con mejor retrieval).

---

## Diagnóstico

### Cuello de botella 7: Chunking por tamaño fijo corta artículos e ideas

**Archivo afectado:** `scripts/ingest.mjs` — funciones `splitByArticles()`, `splitTextBySize()`, `splitLargeChunk()`

El pipeline actual de chunking es:

1. `splitByArticles()`: intenta segmentar por estructura legal (Título/Capítulo/Artículo)
2. Si un fragmento > 1000 caracteres: `splitLargeChunk(fragment, 1000, 150)` lo corta por tamaño fijo con overlap de 150 chars

**Problemas concretos:**

1. **Artículos largos se cortan a la mitad**: Un artículo del Código Sustantivo del Trabajo con 3000 caracteres se divide en 3 chunks. El chunk 2 pierde el contexto de qué artículo es y a qué título pertenece. Si el retrieval encuentra el chunk 2, el LLM no sabe qué artículo está citando.

2. **Overlap de 150 caracteres es insuficiente**: 150 chars son ~25 palabras. Si un concepto legal ocupa 2-3 oraciones (200-400 chars), el overlap no lo captura completo.

3. **Parágrafos y numerales se separan de su artículo padre**: "Artículo 64. Terminación unilateral..." seguido de "Parágrafo 1: Si el despido fue..." — si se cortan en chunks separados, se pierde la relación artículo-parágrafo.

4. **Sin contexto jerárquico en el contenido del chunk**: El chunk solo tiene `metadata.article` pero el **contenido** del chunk no incluye "Título I > Capítulo 3 > Artículo 64" al inicio. El LLM y los embeddings solo ven el texto del fragmento sin su ubicación en la ley.

### Dato cuantitativo

- ~33,000 chunks para ~746 documentos = promedio 44 chunks/documento
- Un código con 500 artículos a 1000 chars/chunk genera muchos chunks sin contexto

---

## Tareas

### Tarea 2.1: Prefijo de contexto jerárquico en cada chunk

**Qué hacer:**

Agregar al **inicio del contenido** de cada chunk su contexto jerárquico. Esto mejora tanto embeddings (el modelo "entiende" qué es el chunk) como la generación (el LLM sabe exactamente qué artículo cita).

1. Modificar `splitByArticles()` en `scripts/ingest.mjs`:
   - Trackear el Título, Capítulo y Sección actuales mientras se parsea
   - Prepend a cada chunk: `"[Ley 100 de 1993 > Título II > Capítulo 1 > Artículo 33]\n"`
   - Guardar en `metadata.articleHierarchy` (ya existe el campo en types.ts)

2. Formato del prefijo:
   ```
   [Constitución Política de Colombia > Título II — De los derechos, las garantías y los deberes > Capítulo 1 — De los derechos fundamentales > Artículo 86]
   ```

3. Este prefijo ocupa ~100-150 caracteres, así que ajustar el tamaño máximo del chunk a **1200 caracteres** (1000 de contenido + 200 de prefijo) para mantener coherencia.

**Validación:**
- Tomar 20 chunks aleatorios después de re-ingest
- Verificar que cada uno tiene el prefijo correcto y que el contenido sigue siendo coherente
- Medir si los embeddings de chunks con prefijo tienen mayor similitud con queries que mencionan la ley/artículo específico

### Tarea 2.2: No cortar artículos — chunks por unidad semántica legal

**Qué hacer:**

Cambiar la estrategia de chunking para que la **unidad mínima** sea el artículo completo (o parágrafo, o numeral si el artículo es muy largo):

1. Rediseñar `splitByArticles()`:
   - Si un artículo tiene ≤ 2000 caracteres: es un solo chunk (NO cortarlo)
   - Si un artículo tiene > 2000 caracteres: dividir por **parágrafos** o **numerales** como sub-unidades
   - Si un parágrafo/numeral tiene > 2000 caracteres: entonces sí cortar por oraciones (no por tamaño fijo)
   - Overlap: en lugar de 150 chars, repetir el **primer párrafo del artículo** como contexto

2. Jerarquía de corte:
   ```
   Ley/Código
   └─ Título
      └─ Capítulo
         └─ Sección
            └─ Artículo (UNIDAD MÍNIMA IDEAL)
               └─ Parágrafo (sub-unidad si artículo > 2000 chars)
                  └─ Numeral (sub-sub-unidad si parágrafo > 2000 chars)
   ```

3. Cada chunk incluye:
   - Prefijo jerárquico (Tarea 2.1)
   - Contenido completo de la unidad semántica
   - Si es sub-unidad: incluir la primera línea del artículo padre como contexto

**Impacto en número de chunks:**
- Artículos cortos (< 2000 chars): menos chunks, más coherentes
- Artículos largos: misma cantidad de chunks pero mejor segmentados
- Estimación: de ~33k chunks a ~25-28k chunks con mayor calidad cada uno

**Validación:**
- Ningún chunk debe tener menos de 200 caracteres (chunks "huérfanos")
- Ningún chunk debe empezar con "..." o una oración incompleta
- El 90%+ de los chunks deben corresponder a un artículo identificable

### Tarea 2.3: Chunks de "resumen por ley" para retrieval de alto nivel

**Qué hacer:**

Para queries generales ("¿qué dice la ley 100 de 1993?"), el sistema necesita chunks que resuman documentos completos, no solo artículos individuales.

1. Durante ingest, generar un chunk de resumen por cada documento:
   - Contenido: `"[Resumen] {título del documento}. Contiene {N} artículos organizados en {títulos}. Temas principales: {área legal}. Fecha: {año}."`
   - Este chunk tiene un embedding que captura el concepto general de la ley
   - `metadata.type`: mantener el tipo original + marcar como `isOverview: true`

2. Para documentos con estructura clara (Código Sustantivo del Trabajo, Código Civil), generar también un chunk de resumen **por Título/Libro**:
   - "Título I del CST — Derecho Individual del Trabajo. Cubre relaciones laborales, contrato de trabajo, período de prueba, salarios."

3. Estos chunks de resumen participan en el retrieval normalmente. El reranking puede darles boost cuando la query es general.

**Validación:**
- Query "¿qué es la ley 100?" debe retornar el chunk de resumen en top-3
- Query "artículo 33 ley 100" debe retornar el chunk del artículo, no el resumen

### Tarea 2.4: Aumentar overlap inteligente

**Qué hacer:**

Cuando se deba cortar un artículo largo, usar overlap basado en **oraciones completas**, no en caracteres:

1. En lugar de `overlap = 150 chars`:
   - Tomar las últimas 2-3 oraciones del chunk anterior como overlap
   - Una oración = texto entre punto y punto (o punto y mayúscula)
   - Mínimo 100 chars de overlap, máximo 400 chars

2. Implementar función `splitBysentences(text)`:
   - Regex para detectar fin de oración: `/(?<=[.;:])\s+(?=[A-ZÁÉÍÓÚ])/`
   - No cortar en medio de citas legales: "Art. 64" no es fin de oración

**Validación:**
- Ningún chunk debe empezar con una oración incompleta (sin mayúscula inicial ni es numeración)
- El overlap debe contener oraciones completas

---

## Archivos a modificar

| Archivo | Acción |
|---------|--------|
| `scripts/ingest.mjs` | MODIFICAR — rediseñar splitByArticles(), agregar prefijos, chunks de resumen |
| `lib/types.ts` | MODIFICAR — agregar `isOverview?: boolean` a DocumentMetadata |

---

## Criterio de éxito

- [ ] 90%+ de chunks corresponden a un artículo completo o sub-unidad identificable
- [ ] Cada chunk tiene prefijo jerárquico (ley > título > capítulo > artículo)
- [ ] Ningún chunk empieza con oración incompleta
- [ ] Chunks de resumen generados para cada documento
- [ ] Re-indexación completa ejecutada
- [ ] Accuracy medido con `evaluate-accuracy.mjs` mejora en criterio "articulos_correctos" y "completitud"
