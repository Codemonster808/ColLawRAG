# 📚 ColLawRAG — Documentación Simplificada

> **Sistema de Inteligencia Artificial para consultas de derecho colombiano**  
> 🌐 **Producción:** https://col-law-rag.vercel.app

---

## Tabla de Contenidos

1. [¿Qué es ColLawRAG?](#1-qué-es-collawrag)
2. [¿Cómo funciona? — Explicación simple](#2-cómo-funciona-explicación-simple)
3. [Tech Stack (Resumen)](#3-tech-stack-resumen)
4. [Arquitectura del Sistema](#4-arquitectura-del-sistema)
5. [Cómo está hecho — Detalles técnicos](#5-cómo-está-hecho-detalles-técnicos)
6. [Posibles Mejoras](#6-posibles-mejoras)

---

## 1. ¿Qué es ColLawRAG?

ColLawRAG es como un **asistente legal inteligente** que puedes consultar en lenguaje natural. Imagina que tienes acceso a una biblioteca gigante de leyes colombianas y un abogado experto que puede buscar y explicarte cualquier cosa en segundos.

**¿Qué hace?**
- 📖 Busca información relevante en miles de documentos legales
- 💬 Responde tus preguntas en español, como si fuera un abogado
- 📎 Te muestra las fuentes exactas (qué ley, qué artículo)
- ✅ Verifica si las leyes que cita siguen vigentes o fueron derogadas
- 🧮 Calcula automáticamente prestaciones laborales, indemnizaciones, etc.

**Ejemplos de uso:**
- "¿Cuántos días de vacaciones tiene un trabajador con 2 años de antigüedad?"
- "¿Qué dice la ley sobre el pago de horas extras?"
- "¿Cómo funciona una acción de tutela?"

---

## 2. ¿Cómo funciona? — Explicación simple

### La analogía de la biblioteca

Imagina que ColLawRAG es como una **biblioteca inteligente** con un bibliotecario muy eficiente:

#### Paso 1: Entiende tu pregunta
Cuando escribes "¿Cuántos días de vacaciones tiene un trabajador?", el sistema:
- **Clasifica** tu pregunta: "Esto es sobre derecho laboral"
- **Evalúa la complejidad**: "Es una pregunta simple, no necesita buscar en muchos lugares"

#### Paso 2: Busca en la biblioteca (Retrieval)
El sistema tiene dos formas de buscar:

**Método 1: Búsqueda por significado (Vectores)**
- Convierte tu pregunta en un "código numérico" que representa su significado
- Compara ese código con todos los documentos legales
- Encuentra los que tienen significado similar, aunque usen palabras diferentes
- *Ejemplo:* Si preguntas "horas extras", también encuentra documentos que digan "tiempo adicional" o "jornada suplementaria"

**Método 2: Búsqueda por palabras exactas (BM25)**
- Busca documentos que contengan las palabras exactas de tu pregunta
- Es como usar Ctrl+F en un documento, pero en miles de documentos a la vez
- *Ejemplo:* Si preguntas "vacaciones", encuentra todos los artículos que mencionan "vacaciones"

**Método combinado (Híbrido)**
- Combina ambos métodos para obtener los mejores resultados
- Es como tener dos bibliotecarios trabajando juntos: uno busca por significado, otro por palabras exactas
- Toma lo mejor de ambos mundos

#### Paso 3: Selecciona los mejores fragmentos
De todos los documentos encontrados, el sistema:
- **Ordena** los resultados por relevancia (los más importantes primero)
- **Selecciona** los 8-16 fragmentos más relevantes (dependiendo de qué tan compleja sea tu pregunta)
- **Verifica** si las leyes citadas siguen vigentes o fueron derogadas

#### Paso 4: Genera la respuesta
Un modelo de inteligencia artificial (como ChatGPT, pero especializado):
- **Lee** los fragmentos seleccionados
- **Sintetiza** la información
- **Escribe** una respuesta clara y estructurada en español
- **Incluye** las citas exactas (qué ley, qué artículo)

#### Paso 5: Validaciones y mejoras
Antes de darte la respuesta, el sistema:
- ✅ **Verifica** que la respuesta esté basada en los documentos encontrados (no inventa cosas)
- ✅ **Valida** que las citas sean correctas
- 🧮 **Calcula** automáticamente si tu pregunta requiere números (prestaciones, indemnizaciones)
- ⚠️ **Advierte** si alguna ley citada fue derogada o modificada

### Resumen visual del flujo

```
Tú escribes: "¿Cuántos días de vacaciones?"
        ↓
[El sistema entiende: "derecho laboral, pregunta simple"]
        ↓
[Busca en 12,468 fragmentos legales usando 2 métodos]
        ↓
[Encuentra 8 fragmentos relevantes sobre vacaciones]
        ↓
[Un modelo de IA lee y sintetiza la información]
        ↓
[Genera respuesta: "Según el Art. 186 del CST, tiene derecho a 15 días..."]
        ↓
[Verifica que todo sea correcto y te muestra la respuesta con citas]
```

---

## 3. Tech Stack (Resumen)

### Frontend (Lo que ves)
- **Next.js + React**: La interfaz web donde escribes tus preguntas
- **TypeScript**: Para evitar errores en el código
- **Tailwind CSS**: Para que se vea bonito

### Backend (Lo que procesa)
- **Next.js API Routes**: Los "servidores" que procesan tus consultas
- **SQLite**: Base de datos pequeña para guardar usuarios y cache

### Inteligencia Artificial
- **Modelos de lenguaje (LLMs)**: 
  - **DeepSeek V3.2**: El modelo principal que genera las respuestas
  - **Qwen 2.5 72B**: Un modelo de respaldo por si el principal falla
- **Embeddings (Vectores)**: 
  - **sentence-transformers**: Convierte texto en números para buscar por significado
  - Modelo: `paraphrase-multilingual-mpnet-base-v2` (768 dimensiones)

### Búsqueda
- **Búsqueda vectorial**: Busca por significado usando matemáticas (cosine similarity)
- **BM25**: Busca por palabras exactas (algoritmo clásico de búsqueda)
- **Híbrido**: Combina ambos métodos

### Datos
- **33 documentos legales**: Leyes, códigos, jurisprudencia colombiana
- **12,468 fragmentos**: Cada documento dividido en pedazos pequeños para buscar mejor
- **Índices**: Archivos que permiten buscar rápido (como el índice de un libro)

### Infraestructura
- **Vercel**: Donde está alojada la aplicación (servidores en la nube)
- **GitHub**: Donde se guarda el código y los índices
- **HuggingFace**: Servicio que proporciona acceso a los modelos de IA

---

## 4. Arquitectura del Sistema

### Vista simplificada

```
┌─────────────────────────────────────────┐
│         TÚ (Navegador Web)              │
│    https://col-law-rag.vercel.app       │
└──────────────────┬──────────────────────┘
                   │ Escribes pregunta
                   ▼
┌─────────────────────────────────────────┐
│      SERVIDOR (Vercel / Next.js)        │
│                                          │
│  ┌──────────────────────────────────┐  │
│  │  1. Recibe tu pregunta            │  │
│  │  2. La convierte en números       │  │
│  │     (vectores)                    │  │
│  │  3. Busca en los índices          │  │
│  │  4. Encuentra fragmentos          │  │
│  │  5. Envía a modelo de IA          │  │
│  │  6. Genera respuesta              │  │
│  │  7. Valida y mejora               │  │
│  │  8. Te devuelve la respuesta      │  │
│  └──────────────────────────────────┘  │
│                                          │
│  ┌──────────────────────────────────┐  │
│  │     DATOS LOCALES                 │  │
│  │  • 12,468 fragmentos legales     │  │
│  │  • Índices de búsqueda           │  │
│  │  • Base de datos usuarios        │  │
│  └──────────────────────────────────┘  │
└──────────────────┬───────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────┐    ┌──────────────┐
│ HuggingFace  │    │   GitHub     │
│ (Modelos IA) │    │  (Índices)   │
└──────────────┘    └──────────────┘
```

### Flujo completo paso a paso

1. **Tú escribes una pregunta** en la página web
2. **El servidor recibe** tu pregunta
3. **Clasifica** la pregunta (¿es laboral? ¿constitucional? ¿simple o compleja?)
4. **Convierte** tu pregunta en un vector (números que representan significado)
5. **Busca** en dos índices:
   - Índice vectorial: busca por significado
   - Índice BM25: busca por palabras exactas
6. **Combina** los resultados de ambas búsquedas
7. **Selecciona** los 8-16 fragmentos más relevantes
8. **Verifica** si las leyes citadas siguen vigentes
9. **Envía** todo al modelo de IA (DeepSeek)
10. **El modelo genera** una respuesta estructurada
11. **Valida** que la respuesta sea correcta
12. **Calcula** si hay números involucrados (prestaciones, etc.)
13. **Te devuelve** la respuesta con todas las citas

---

## 5. Cómo está hecho — Detalles técnicos

### 5.1. El Pipeline RAG (12 pasos)

El sistema funciona como una cadena de producción con 12 etapas:

#### Paso 1: Análisis de la consulta
```typescript
// Detecta qué tipo de pregunta es
detectLegalArea(query)  // → 'laboral' | 'constitucional' | 'penal'
detectComplexity(query) // → 'simple' | 'media' | 'compleja'
```
**En palabras simples:** El sistema lee tu pregunta y dice "Esto es sobre trabajo, y es una pregunta fácil".

#### Paso 2: Descomposición (si es necesario)
Si tu pregunta tiene varias partes ("¿Qué dice X y también Y?"), la divide en sub-preguntas y las procesa por separado.

#### Paso 3: Vectorización
```typescript
// Convierte texto en números
query → embedding (768 números)
```
**En palabras simples:** Tu pregunta se convierte en un código numérico único que representa su significado.

#### Paso 4: Búsqueda híbrida
```typescript
// Busca usando dos métodos y los combina
cosine_similarity(query, chunks)  // Búsqueda por significado
BM25_score(query, chunks)         // Búsqueda por palabras
hybrid_score = 0.7 * cosine + 0.3 * BM25
```
**En palabras simples:** Busca en dos formas diferentes y combina los mejores resultados.

#### Paso 5: Reranking
Reordena los resultados para poner los más relevantes primero.

#### Paso 6: Validación de vigencia
```typescript
consultarVigencia(normaId) // → ¿Esta ley sigue vigente?
```
**En palabras simples:** Verifica que las leyes que encontró no hayan sido derogadas.

#### Paso 7: Inyección de procedimientos
Si tu pregunta es sobre un procedimiento legal (como "cómo hacer una tutela"), agrega información sobre pasos y plazos.

#### Paso 8: Generación con LLM
```typescript
generateAnswerSpanish({
  query, chunks, legalArea,
  enforceHNAC: true  // Formato estructurado
})
```
**En palabras simples:** El modelo de IA lee los fragmentos encontrados y escribe una respuesta clara.

#### Pasos 9-12: Validaciones
- **Filtro PII**: Elimina información personal si la hay
- **Validación factual**: Verifica que la respuesta esté basada en los documentos
- **Validación de citas**: Verifica que las citas sean correctas
- **Cálculos**: Si es necesario, calcula prestaciones, indemnizaciones, etc.

### 5.2. Sistema de Cache (3 capas)

Para responder rápido, el sistema guarda respuestas en 3 lugares:

1. **Cache en memoria (LRU)**: Ultra rápido, pero se borra cuando el servidor se reinicia
2. **Cache en SQLite**: Persiste entre requests, pero solo en el mismo servidor
3. **Cache HTTP**: El navegador guarda respuestas por 60 segundos

**En palabras simples:** Si alguien más hizo la misma pregunta hace poco, te da la respuesta guardada en lugar de buscar de nuevo.

### 5.3. Sistema de Tiers (Freemium)

- **Usuario gratuito**: 10 consultas por mes, respuestas básicas
- **Usuario premium**: Consultas ilimitadas, validaciones avanzadas habilitadas

### 5.4. Estructura de datos

Cada fragmento legal tiene esta estructura:

```typescript
{
  id: "cst-art-159",
  content: "Artículo 159. Horas extras...",
  embedding: [0.123, -0.456, ...],  // 768 números
  metadata: {
    title: "Código Sustantivo del Trabajo",
    type: "codigo",
    article: "Artículo 159",
    url: "https://...",
    date: "2024-01-01"
  }
}
```

**En palabras simples:** Cada fragmento tiene el texto, un código numérico para buscar, y información sobre de dónde viene.

---

## 6. Posibles Mejoras

### 🔴 Alta Prioridad

1. **Persistencia de índices**: Actualmente los índices se descargan cada vez que el servidor se inicia (10-15 segundos). Mejoraría guardarlos en un lugar permanente.

2. **Base de datos persistente**: La base de datos actual se borra en cada actualización. Necesita una base de datos en la nube que persista.

3. **Cache compartido**: Cada servidor tiene su propio cache. Un cache compartido (como Redis) haría todo más rápido.

4. **Reducir tiempo de inicio**: El primer request tarda mucho porque descarga índices. Un sistema de "calentamiento" reduciría esto.

### 🟡 Prioridad Media

5. **Mejor reranking**: Usar un modelo más inteligente para ordenar resultados.

6. **Chunking más inteligente**: Dividir documentos de manera que no se corten artículos a la mitad.

7. **Más documentos**: Agregar más leyes, jurisprudencia y decretos.

8. **Respuestas en tiempo real**: Mostrar la respuesta mientras se genera, no esperar a que termine.

### 🟢 Prioridad Baja

9. **Autenticación real**: Sistema de login con Google/GitHub.

10. **Feedback de usuarios**: Permitir que los usuarios califiquen respuestas para mejorar el sistema.

11. **API pública**: Documentación para que otros desarrolladores puedan usar el sistema.

12. **Exportar respuestas**: Permitir descargar respuestas como PDF.

---

## Conceptos clave explicados

### ¿Qué es un "embedding" o vector?

Imagina que cada palabra o frase tiene un "código de barras" numérico único. Palabras similares tienen códigos similares. Por ejemplo:
- "vacaciones" → `[0.1, -0.3, 0.5, ...]`
- "días libres" → `[0.12, -0.28, 0.48, ...]` (similar porque significan lo mismo)

El sistema usa estos códigos para encontrar documentos con significado similar, aunque usen palabras diferentes.

### ¿Qué es "cosine similarity"?

Es una forma matemática de medir qué tan similares son dos códigos numéricos. Si dos documentos tienen códigos muy similares, significa que hablan de lo mismo.

### ¿Qué es BM25?

Es un algoritmo clásico de búsqueda que cuenta cuántas veces aparecen tus palabras clave en un documento. Mientras más veces aparezcan, más relevante es el documento.

### ¿Qué es un LLM (Large Language Model)?

Es un modelo de inteligencia artificial entrenado con millones de textos. Puede leer, entender y generar texto en lenguaje natural. Es como tener un escritor muy inteligente que puede sintetizar información compleja.

### ¿Qué es RAG (Retrieval-Augmented Generation)?

Es la técnica que usa este sistema:
- **Retrieval (Recuperación)**: Busca información relevante en documentos
- **Augmented (Aumentado)**: Usa esa información para mejorar la respuesta
- **Generation (Generación)**: Un modelo de IA genera la respuesta final

**En palabras simples:** En lugar de que el modelo de IA invente cosas, primero busca información real en documentos legales y luego genera una respuesta basada en esa información.

---

## Resumen

ColLawRAG es un sistema que:
1. **Recibe** tu pregunta en lenguaje natural
2. **Busca** información relevante en miles de documentos legales usando dos métodos (significado + palabras)
3. **Selecciona** los fragmentos más relevantes
4. **Genera** una respuesta clara usando inteligencia artificial
5. **Valida** que todo sea correcto
6. **Te muestra** la respuesta con las citas exactas

Todo esto en segundos, como si tuvieras un abogado experto disponible 24/7.

---

*Documentación simplificada — ColLawRAG v0.1.0*  
*Para documentación técnica completa, ver `DOCUMENTACION.md`*
