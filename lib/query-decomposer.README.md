# Query Decomposer - Detector de Consultas Multi-Parte

**Versión:** 1.0.0  
**Creado:** 2026-02-10  
**Ubicación:** `lib/query-decomposer.ts`

---

## 📋 Descripción

Módulo que detecta y analiza si una consulta del usuario contiene múltiples partes (preguntas, temas, comparaciones). Identifica automáticamente:

- ✅ Consultas con múltiples preguntas conectadas por conjunciones
- ✅ Consultas comparativas ("compara X con Y")
- ✅ Consultas con enumeraciones (1., 2., 3.)
- ✅ Consultas con múltiples temas legales
- ✅ Preguntas separadas por signos de interrogación

---

## 🚀 Uso

### Importación

```typescript
import { analyzeQuery, detectMultiPart } from './lib/query-decomposer';
```

### Función Principal: `analyzeQuery()`

Analiza una consulta y retorna análisis completo:

```typescript
const result = analyzeQuery("¿Cuáles son los requisitos para la acción de tutela y cuánto tiempo tarda?");

console.log(result);
// {
//   isMultiPart: true,
//   complexity: 'multi',
//   parts: [
//     "¿Cuáles son los requisitos para la acción de tutela",
//     "y cuánto tiempo tarda?"
//   ],
//   indicators: [...],
//   confidence: 1.0,
//   metadata: {
//     questionCount: 1,
//     themeCount: 1,
//     hasComparison: false,
//     hasEnumeration: false
//   }
// }
```

### Función Simplificada: `detectMultiPart()`

Versión simplificada que retorna solo campos básicos:

```typescript
const result = detectMultiPart("Compara el proceso laboral ordinario con el verbal");

console.log(result);
// {
//   isMultiPart: true,
//   parts: ["Compara el proceso laboral ordinario con el verbal"],
//   complexity: 'comparative'
// }
```

---

## 📊 Tipos

### `QueryComplexity`

```typescript
type QueryComplexity = 'simple' | 'multi' | 'comparative';
```

- **`simple`**: Consulta con una sola pregunta/tema
- **`multi`**: Consulta con múltiples preguntas/temas
- **`comparative`**: Consulta que compara dos o más entidades

### `MultiPartIndicator`

```typescript
interface MultiPartIndicator {
  type: 'conjunction' | 'question' | 'theme' | 'comparative' | 'enumeration';
  position: number;
  match: string;
  confidence: number; // 0-1
}
```

Indica qué patrones se detectaron en la consulta.

### `QueryAnalysis`

```typescript
interface QueryAnalysis {
  isMultiPart: boolean;
  complexity: QueryComplexity;
  parts: string[];
  indicators: MultiPartIndicator[];
  confidence: number; // 0-1
  metadata: {
    questionCount: number;
    themeCount: number;
    hasComparison: boolean;
    hasEnumeration: boolean;
  };
}
```

---

## 🧪 Tests

El módulo incluye 8 tests unitarios que cubren:

1. ✅ Consulta simple (single topic)
2. ✅ Multi-parte con "y" + palabra interrogativa
3. ✅ Multi-parte con "además"
4. ✅ Consulta comparativa
5. ✅ Multi-parte con "por otro lado"
6. ✅ Múltiples preguntas con ?
7. ✅ Enumeración (1., 2., 3.)
8. ✅ Consulta simple con conjunción (falso positivo controlado)

### Ejecutar Tests

```bash
node scripts/test-query-decomposer.mjs
```

**Resultado esperado:** 8 passed, 0 failed (8/8)

---

## 🔍 Patrones Detectados

### 1. Conjunciones

- "y además", "y también", "y cuál", "y cuánto", etc.
- "además", "también", "asimismo", "igualmente"
- "por otro lado", "por otra parte", "adicionalmente"
- Punto y coma (;)

### 2. Palabras Interrogativas

- cuál, cuáles, qué, cómo, cuándo, cuánto, cuánta, cuántos, cuántas, dónde, por qué, para qué

### 3. Comparaciones

- comparar, compara, diferencia, vs, versus, entre
- "a diferencia de", "en contraste con", "en comparación con"
- "mejor que", "peor que", "más que", "menos de"

### 4. Enumeraciones

- 1., 2., 3. (números + punto/paréntesis)
- a., b., c. (letras + punto/paréntesis)
- primero, segundo, tercero, cuarto

### 5. Temas Legales

El detector conoce 20+ temas legales comunes:
- tutela, cumplimiento, grupo, laboral, pensión, contrato, etc.

Si detecta 2+ temas en partes diferentes de la consulta (separados por >20 caracteres), marca como multi-parte.

---

## 💡 Ejemplos

### Ejemplo 1: Multi-parte simple

```typescript
analyzeQuery("¿Qué es la tutela? ¿Cuánto cuesta?");
// isMultiPart: true
// parts: ["¿Qué es la tutela?", "¿Cuánto cuesta?"]
// complexity: 'multi'
```

### Ejemplo 2: Comparativa

```typescript
analyzeQuery("Compara el proceso laboral ordinario con el verbal");
// isMultiPart: true
// parts: ["Compara el proceso laboral ordinario con el verbal"]
// complexity: 'comparative'
```

### Ejemplo 3: Enumeración

```typescript
analyzeQuery("1. ¿Qué es la tutela? 2. ¿Cuánto cuesta? 3. ¿Cuánto tarda?");
// isMultiPart: true
// parts: ["1. ¿Qué es la tutela?", "2. ¿Cuánto cuesta?", "3. ¿Cuánto tarda?"]
// complexity: 'multi'
```

### Ejemplo 4: Simple (NO multi-parte)

```typescript
analyzeQuery("¿Cuáles son los requisitos para la acción de tutela?");
// isMultiPart: false
// parts: ["¿Cuáles son los requisitos para la acción de tutela?"]
// complexity: 'simple'
```

---

## 🎯 Criterios de Decisión

Una consulta se marca como **multi-parte** si:

1. **Tiene más de una parte identificada** (después de dividir), o
2. **Tiene alta confianza (≥ 0.7)** de indicadores multi-parte

La **confianza** se calcula como:
- Promedio ponderado de confianzas de indicadores
- Bonus (+0.2) si se detectaron múltiples partes
- Bonus (+0.1) si hay indicadores de tipos diferentes

---

## 🔧 Configuración

Los patrones y pesos están definidos en `MULTI_PART_PATTERNS`:

```typescript
const MULTI_PART_PATTERNS = {
  conjunctions: [...],  // Peso: 0.7-0.95
  questions: [...],     // Peso: 0.6-1.0
  comparisons: [...],   // Peso: 0.7-0.95
  enumerations: [...],  // Peso: 0.7-0.9
};
```

Puedes ajustar los pesos para cambiar la sensibilidad del detector.

---

## 📈 Precisión

**Tests actuales:** 8/8 (100%)

**Casos cubiertos:**
- ✅ Consultas simples (no marca como multi-parte)
- ✅ Consultas multi-parte con conjunciones
- ✅ Consultas comparativas
- ✅ Enumeraciones
- ✅ Múltiples signos de interrogación

**Limitaciones conocidas:**
- Puede fallar en consultas muy complejas con >4 partes
- Requiere ajuste manual de pesos según dominio legal

---

## 🚀 Integración con RAG

Este módulo es el **Paso 1** del RAG Recursivo:

```
1. Detectar si consulta es multi-parte → query-decomposer.ts (✅ HECHO)
2. Dividir en sub-consultas → query-splitter.ts (⏳ SIGUIENTE)
3. Procesar cada sub-consulta independientemente
4. Combinar resultados
```

---

## 📝 Changelog

### v1.0.0 (2026-02-10)
- ✅ Implementación inicial
- ✅ Detección de conjunciones, preguntas, comparaciones, enumeraciones, temas
- ✅ 8 tests unitarios (100% pass rate)
- ✅ Soporte para palabras interrogativas: cuál, qué, cómo, cuándo, cuánto, dónde, por qué
- ✅ División automática de consultas en partes
- ✅ Cálculo de confianza y complejidad

---

## 🤝 Contribuciones

Para agregar nuevos patrones:

1. Edita `MULTI_PART_PATTERNS` en `lib/query-decomposer.ts`
2. Agrega tests en `scripts/test-query-decomposer.mjs`
3. Ejecuta tests: `node scripts/test-query-decomposer.mjs`
4. Verifica que todos los tests pasan

---

## 📚 Referencias

- **Proyecto:** ColLawRAG
- **Fase:** 2 - RAG Recursivo
- **Tarea:** 5 - Detector de consultas multi-parte
- **Siguiente:** Tarea 6 - Descomponedor de consultas

---

**Última actualización:** 2026-02-10
