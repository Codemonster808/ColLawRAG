# Query Splitter - Descomponedor de Consultas Multi-Parte

**Versión:** 1.0.0  
**Creado:** 2026-02-10  
**Ubicación:** `lib/query-splitter.ts`  
**Depende de:** `lib/query-decomposer.ts`

---

## 📋 Descripción

Módulo que divide consultas multi-parte en sub-preguntas independientes, manteniendo el contexto común y detectando dependencias entre sub-consultas.

Extiende el **Query Decomposer** para generar sub-consultas que puedan ser procesadas independientemente por el sistema RAG.

---

## 🚀 Uso

### Importación

```typescript
import { splitQuery, splitQuerySimple } from './lib/query-splitter';
```

### Función Principal: `splitQuery()`

Divide una consulta y retorna análisis completo con contexto y dependencias:

```typescript
const result = splitQuery("¿Cuáles son los requisitos para la acción de tutela y cuánto tiempo tarda?");

console.log(result);
// {
//   subQueries: [
//     {
//       query: "¿Cuáles son los requisitos para la acción de tutela",
//       context: { procedures: ["acción de tutela"] },
//       order: 0,
//       dependsOn: []
//     },
//     {
//       query: "y cuánto tiempo tarda (en el contexto de acción de tutela)?",
//       context: { procedures: ["acción de tutela"] },
//       order: 1,
//       dependsOn: [0]  // Depende de la primera sub-consulta
//     }
//   ],
//   commonContext: { procedures: ["acción de tutela"] },
//   complexity: 'multi',
//   dependencies: [
//     { from: 1, to: 0, reason: "Pregunta por atributo de procedimiento mencionado antes" }
//   ]
// }
```

### Función Simplificada: `splitQuerySimple()`

Retorna solo las sub-consultas como strings:

```typescript
const subQueries = splitQuerySimple("¿Qué es la tutela? ¿Cuánto cuesta?");

console.log(subQueries);
// ["¿Qué es la tutela?", "¿Cuánto cuesta (en el contexto de tutela)?"]
```

---

## 📊 Tipos

### `QueryContext`

Contexto extraído de la consulta:

```typescript
interface QueryContext {
  dates?: string[];        // Fechas mencionadas
  people?: string[];       // Nombres de personas
  procedures?: string[];   // Procedimientos legales
  topics?: string[];       // Temas legales
  entities?: string[];     // Entidades mencionadas
  amounts?: string[];      // Montos, cantidades
}
```

### `SubQuery`

Sub-consulta independiente:

```typescript
interface SubQuery {
  query: string;           // Pregunta completa y enriquecida
  context: QueryContext;   // Contexto relevante
  order: number;           // Orden (0-indexed)
  dependsOn: number[];     // IDs de sub-consultas de las que depende
}
```

### `SplitResult`

Resultado completo de la descomposición:

```typescript
interface SplitResult {
  subQueries: SubQuery[];
  commonContext: QueryContext;
  complexity: QueryComplexity;
  dependencies: Array<{
    from: number;
    to: number;
    reason: string;
  }>;
}
```

---

## 🔍 Extracción de Contexto

El módulo extrae automáticamente:

### 1. **Fechas**
- Años: "2024", "2025"
- Fechas completas: "enero de 2024", "20 de diciembre de 2023"
- Fechas relativas: "hace 3 meses", "hace 2 años"

### 2. **Personas**
- Nombres propios con mayúsculas: "Juan Pérez", "María González"

### 3. **Procedimientos Legales**
- tutela, cumplimiento, grupo, acción popular
- proceso laboral, civil, penal, administrativo
- demanda, denuncia, querella
- recurso, apelación, casación

### 4. **Entidades**
- Juzgados, tribunales, cortes
- Superintendencias, ministerios, alcaldías
- Policía, fiscalía, procuraduría
- EPS, IPS, hospitales
- Empresas, sociedades

### 5. **Montos y Cantidades**
- Dinero: "$1,000,000", "$2,500,000.00"
- SMLMV: "20 SMLMV", "100 salarios mínimos"
- Otros: "5 millones", "3 mil pesos"

### 6. **Temas Legales**
- Derechos: fundamentales, humanos, laborales
- Conceptos: pensión, salario, despido, contrato
- Daños: perjuicios, indemnización

---

## 🔗 Detección de Dependencias

Una sub-consulta **depende** de otra si:

### 1. **Usa pronombres que refieren a la anterior**
```
"¿Qué es la tutela?"
"¿Cuánto cuesta ESA?" → Depende de la primera
```

### 2. **Pregunta por atributos de algo mencionado antes**
```
"Explícame la acción de tutela"
"¿Cuánto tiempo tarda?" → Depende de la primera (tarda ¿QUÉ?)
```

### 3. **Es una comparación implícita**
```
"Háblame del proceso ordinario"
"Compáralo con el verbal" → Depende de la primera
```

---

## 🎯 Enriquecimiento de Sub-Consultas

Si una sub-consulta **no menciona explícitamente el contexto**, el módulo lo añade:

**Antes:**
```
"¿Cuáles son los requisitos para la acción de tutela y cuánto tiempo tarda?"
```

**Después:**
```
Sub-consulta 1: "¿Cuáles son los requisitos para la acción de tutela"
Sub-consulta 2: "y cuánto tiempo tarda (en el contexto de acción de tutela)?"
```

El contexto se añade entre paréntesis para claridad.

---

## 🧪 Tests

El módulo incluye 6 tests unitarios:

1. ✅ Simple query - no splitting needed
2. ✅ Multi-part - two questions with shared context
3. ✅ Multi-part - two different procedures
4. ✅ Comparative query
5. ✅ Query with dates and amounts
6. ✅ Query with entity names

### Ejecutar Tests

```bash
node scripts/test-query-splitter.mjs
```

**Resultado esperado:** 6 passed, 0 failed (6/6) + splitQuerySimple test

---

## 💡 Ejemplos

### Ejemplo 1: Sub-consultas con dependencia

```typescript
const result = splitQuery("¿Cuáles son los requisitos para la acción de tutela y cuánto tiempo tarda?");

// Sub-consulta 1: Independiente
result.subQueries[0].query; // "¿Cuáles son los requisitos para la acción de tutela"
result.subQueries[0].dependsOn; // []

// Sub-consulta 2: Depende de la primera
result.subQueries[1].query; // "y cuánto tiempo tarda (en el contexto de acción de tutela)?"
result.subQueries[1].dependsOn; // [0]
```

### Ejemplo 2: Sub-consultas independientes

```typescript
const result = splitQuery("Explícame la acción de cumplimiento y además cuéntame sobre la acción de grupo");

// Ambas son independientes
result.subQueries[0].dependsOn; // []
result.subQueries[1].dependsOn; // []
```

### Ejemplo 3: Extracción de contexto

```typescript
const result = splitQuery("¿Cuánto debo pagar de pensión desde enero de 2024 si mi salario es $2,000,000?");

result.commonContext;
// {
//   dates: ["2024", "enero de 2024"],
//   amounts: ["$2,000,000"],
//   topics: ["pensión", "salario"]
// }
```

---

## 🚀 Integración con RAG Recursivo

Este módulo es el **Paso 2** del RAG Recursivo:

```
1. Detectar multi-parte → query-decomposer.ts (✅ Tarea 5)
2. Dividir en sub-consultas → query-splitter.ts (✅ Tarea 6)
3. Procesar cada sub-consulta independientemente → TODO
4. Combinar resultados → TODO
```

### Flujo de uso

```typescript
// Paso 1: Detectar si es multi-parte
import { analyzeQuery } from './lib/query-decomposer.js';
const analysis = analyzeQuery(query);

if (analysis.isMultiPart) {
  // Paso 2: Dividir en sub-consultas
  import { splitQuery } from './lib/query-splitter.js';
  const split = splitQuery(query);
  
  // Paso 3: Procesar cada sub-consulta
  for (const subQuery of split.subQueries) {
    // Si tiene dependencias, esperar a que se procesen primero
    if (subQuery.dependsOn.length > 0) {
      // Usar resultados de sub-consultas previas
    }
    
    // Procesar subQuery.query con el RAG
    const result = await processWithRAG(subQuery.query, subQuery.context);
  }
  
  // Paso 4: Combinar resultados
}
```

---

## 🔧 Configuración

Los patrones de extracción están en `EXTRACTION_PATTERNS`:

```typescript
const EXTRACTION_PATTERNS = {
  dates: [...],       // Patrones para fechas
  people: [...],      // Patrones para nombres
  procedures: [...],  // Patrones para procedimientos
  entities: [...],    // Patrones para entidades
  amounts: [...],     // Patrones para montos
  topics: [...],      // Patrones para temas
};
```

Puedes extender estos patrones para mejorar la extracción.

---

## 📈 Precisión

**Tests actuales:** 6/6 (100%)

**Casos cubiertos:**
- ✅ Consultas simples (no se dividen)
- ✅ Consultas multi-parte con contexto compartido
- ✅ Consultas multi-parte independientes
- ✅ Consultas comparativas
- ✅ Extracción de fechas, montos, entidades

**Limitaciones conocidas:**
- Puede fallar en consultas muy complejas con >3 niveles de dependencia
- La extracción de nombres propios puede incluir falsos positivos
- Requiere ajuste manual de patrones según dominio legal específico

---

## 🐛 Troubleshooting

### Dependencia no detectada

Si una sub-consulta depende de otra pero no se detecta:

1. Verifica que la consulta original usa pronombres explícitos
2. Verifica que la segunda consulta pregunta por atributos (tiempo, costo, requisitos)
3. Ajusta los patrones en `identifyDependencies()`

### Contexto no extraído

Si no se extrae el contexto esperado:

1. Verifica que el patrón existe en `EXTRACTION_PATTERNS`
2. Prueba el patrón regex aisladamente
3. Agrega el patrón si no existe

---

## 📝 Changelog

### v1.0.0 (2026-02-10)
- ✅ Implementación inicial
- ✅ Extracción de contexto (fechas, personas, procedimientos, entidades, montos, temas)
- ✅ Enriquecimiento automático de sub-consultas
- ✅ Detección de dependencias (pronombres, atributos, comparaciones)
- ✅ 6 tests unitarios (100% pass rate)
- ✅ Integración con query-decomposer.ts

---

## 🤝 Contribuciones

Para agregar nuevos patrones de extracción:

1. Edita `EXTRACTION_PATTERNS` en `lib/query-splitter.ts`
2. Agrega tests en `scripts/test-query-splitter.mjs`
3. Ejecuta tests: `node scripts/test-query-splitter.mjs`

---

## 📚 Referencias

- **Proyecto:** ColLawRAG
- **Fase:** 2 - RAG Recursivo
- **Tarea:** 6 - Descomponedor de consultas
- **Anterior:** Tarea 5 - Detector de consultas multi-parte
- **Siguiente:** Tarea 10 - Scraper jurisprudencia

---

**Última actualización:** 2026-02-10
