# Uso del Pipeline RAG Mejorado

## Resumen

El pipeline RAG (`lib/rag.ts`) ha sido completamente integrado con todas las mejoras implementadas. Ahora incluye:

- ✅ Detección automática de área legal
- ✅ Re-ranking inteligente con jerarquía legal
- ✅ Validación factual opcional
- ✅ Estructuración de respuestas opcional
- ✅ Detección y ejecución de cálculos legales opcional
- ✅ Logging mejorado y métricas

---

## Uso Básico

### Consulta Simple

```typescript
import { runRagPipeline } from './lib/rag'

const response = await runRagPipeline({
  query: "¿Tengo derecho a horas extras trabajando 10 horas diarias?",
  locale: 'es'
})

console.log(response.answer)
console.log('Citas:', response.citations.length)
console.log('Área legal detectada:', response.detectedLegalArea)
```

### Respuesta Incluye:

```typescript
{
  answer: string                    // Respuesta generada
  citations: Array<{...}>          // Fuentes citadas
  retrieved: number                // Número de chunks recuperados
  requestId: string                // ID único de la consulta
  detectedLegalArea?: string       // Área legal detectada automáticamente
  metadata?: {
    responseTime?: number          // Tiempo de respuesta en ms
    complexity?: string            // Complejidad detectada
  }
}
```

---

## Features Avanzadas

### 1. Validación Factual

Habilita la validación de artículos, números y fechas mencionados en la respuesta:

```typescript
const response = await runRagPipeline({
  query: "¿Cuánto es el recargo por horas extras según el Artículo 159?",
  enableFactualValidation: true
})

if (response.factualValidation) {
  console.log('Validación factual:')
  console.log('- Es válida:', response.factualValidation.isValid)
  console.log('- Advertencias:', response.factualValidation.warnings)
  console.log('- Artículos validados:', response.factualValidation.validatedFacts.articles)
  console.log('- Números validados:', response.factualValidation.validatedFacts.numbers)
}
```

**Output de validación:**
```typescript
{
  isValid: true,
  warnings: [],
  validatedFacts: {
    articles: [
      { article: "159", exists: true, source: "Código Sustantivo del Trabajo" }
    ],
    numbers: [
      { value: "25%", verified: true, source: "Código Sustantivo del Trabajo" }
    ]
  }
}
```

### 2. Respuesta Estructurada

Obtén la respuesta en formato estructurado tipo dictamen legal:

```typescript
const response = await runRagPipeline({
  query: "Me despidieron sin justa causa después de 3 años. ¿Qué debo hacer?",
  enableStructuredResponse: true
})

if (response.structuredResponse) {
  console.log('HECHOS RELEVANTES:', response.structuredResponse.hechosRelevantes)
  console.log('NORMAS APLICABLES:', response.structuredResponse.normasAplicables)
  console.log('ANÁLISIS JURÍDICO:', response.structuredResponse.analisisJuridico)
  console.log('CONCLUSIÓN:', response.structuredResponse.conclusion)
  console.log('RECOMENDACIÓN:', response.structuredResponse.recomendacion)
}
```

**Output estructurado:**
```typescript
{
  hechosRelevantes: "Despido sin justa causa después de 3 años de trabajo...",
  normasAplicables: "Según el Artículo 64 del CST...",
  analisisJuridico: "El trabajador tiene derecho a indemnización...",
  conclusion: "Tienes derecho a reclamar indemnización...",
  recomendacion: "1. Recopilar documentos... 2. Presentar demanda..."
}
```

### 3. Cálculos Legales Automáticos

El sistema detecta automáticamente cuando una consulta requiere cálculos y los ejecuta:

```typescript
const response = await runRagPipeline({
  query: "Trabajé 24 meses con salario de $2.000.000. ¿Cuánto me deben de prestaciones?",
  enableCalculations: true
})

if (response.calculations && response.calculations.length > 0) {
  console.log('Cálculos realizados:')
  response.calculations.forEach(calc => {
    console.log(`\n${calc.type}:`)
    console.log(`  Monto: $${calc.amount.toLocaleString()}`)
    console.log(`  Fórmula: ${calc.formula}`)
    console.log(`  Desglose:`, calc.breakdown)
  })
}
```

**Output de cálculos:**
```typescript
[
  {
    type: "cesantias",
    amount: 4000000,
    formula: "Cesantías = (Salario / 12) × Meses + Intereses (12% anual)",
    breakdown: {
      salarioMensual: 2000000,
      mesesTrabajados: 24,
      cesantiasProporcionales: 4000000,
      intereses: 800000,
      total: 4800000
    }
  },
  {
    type: "vacaciones",
    amount: 2000000,
    formula: "Vacaciones = (15 días / 360 días) × Días trabajados × (Salario / 30)",
    breakdown: {...}
  },
  {
    type: "prima_servicios",
    amount: 4000000,
    formula: "Prima de Servicios = (Salario / 12) × Meses trabajados",
    breakdown: {...}
  }
]
```

---

## Configuración por Variables de Entorno

Puedes habilitar/deshabilitar features globalmente con variables de entorno:

```bash
# Habilitar validación factual por defecto
ENABLE_FACTUAL_VALIDATION=true

# Habilitar respuesta estructurada por defecto
ENABLE_STRUCTURED_RESPONSE=true

# Habilitar cálculos automáticos por defecto
ENABLE_CALCULATIONS=true
```

Estos valores pueden ser sobrescritos en cada llamada a `runRagPipeline()`.

---

## Ejemplo Completo

```typescript
import { runRagPipeline } from './lib/rag'

async function consultaCompleta() {
  const response = await runRagPipeline({
    query: "Trabajé 2 años con salario de $3.000.000. Trabajé 20 horas extras el mes pasado. ¿Cuánto me deben?",
    locale: 'es',
    enableFactualValidation: true,
    enableStructuredResponse: true,
    enableCalculations: true,
    userId: 'user-123' // Para tracking (opcional)
  })

  // Respuesta principal
  console.log('RESPUESTA:')
  console.log(response.answer)
  console.log('\n---\n')

  // Área legal detectada
  console.log('Área Legal:', response.detectedLegalArea)
  console.log('Tiempo de respuesta:', response.metadata?.responseTime, 'ms')
  console.log('\n---\n')

  // Citas
  console.log('FUENTES CITADAS:')
  response.citations.forEach((cite, i) => {
    console.log(`${i + 1}. ${cite.title}${cite.article ? ` - ${cite.article}` : ''} (score: ${cite.score?.toFixed(3)})`)
  })
  console.log('\n---\n')

  // Validación factual
  if (response.factualValidation) {
    console.log('VALIDACIÓN FACTUAL:')
    console.log('Válida:', response.factualValidation.isValid)
    if (response.factualValidation.warnings.length > 0) {
      console.log('Advertencias:')
      response.factualValidation.warnings.forEach(w => console.log('  -', w))
    }
    console.log('\n---\n')
  }

  // Respuesta estructurada
  if (response.structuredResponse) {
    console.log('RESPUESTA ESTRUCTURADA:')
    if (response.structuredResponse.hechosRelevantes) {
      console.log('\nHECHOS RELEVANTES:')
      console.log(response.structuredResponse.hechosRelevantes)
    }
    if (response.structuredResponse.normasAplicables) {
      console.log('\nNORMAS APLICABLES:')
      console.log(response.structuredResponse.normasAplicables)
    }
    if (response.structuredResponse.analisisJuridico) {
      console.log('\nANÁLISIS JURÍDICO:')
      console.log(response.structuredResponse.analisisJuridico)
    }
    if (response.structuredResponse.conclusion) {
      console.log('\nCONCLUSIÓN:')
      console.log(response.structuredResponse.conclusion)
    }
    if (response.structuredResponse.recomendacion) {
      console.log('\nRECOMENDACIÓN:')
      console.log(response.structuredResponse.recomendacion)
    }
    console.log('\n---\n')
  }

  // Cálculos
  if (response.calculations && response.calculations.length > 0) {
    console.log('CÁLCULOS LEGALES:')
    response.calculations.forEach(calc => {
      console.log(`\n${calc.type.toUpperCase()}:`)
      console.log(`  Monto: $${calc.amount.toLocaleString('es-CO')}`)
      console.log(`  Fórmula: ${calc.formula}`)
      console.log('  Desglose:')
      Object.entries(calc.breakdown).forEach(([key, value]) => {
        console.log(`    ${key}: ${typeof value === 'number' ? value.toLocaleString('es-CO') : value}`)
      })
    })
  }
}

consultaCompleta()
```

---

## Detección Automática de Cálculos

El sistema detecta automáticamente cuando una consulta requiere cálculos basándose en:

- **Palabras clave**: "cesantías", "vacaciones", "prima", "horas extras", "indemnización", etc.
- **Parámetros extraídos**: Salario, meses trabajados, horas extras, etc.

**Tipos de cálculos soportados:**
- Prestaciones sociales (cesantías, vacaciones, prima)
- Horas extras (con recargo del 25%)
- Recargo dominical y festivo (75%)
- Indemnización por despido sin justa causa

**Ejemplo de detección:**
```typescript
// Esta consulta activará cálculos automáticamente:
"Trabajé 12 meses con salario de $2.500.000. ¿Cuánto me deben de cesantías?"

// El sistema extraerá:
// - salarioMensual: 2500000
// - mesesTrabajados: 12
// Y calculará automáticamente cesantías, vacaciones y prima
```

---

## Logging y Debugging

El pipeline incluye logging detallado para debugging:

```
[rag] Pipeline start { requestId: '...', queryLength: 48, userId: 'user-123' }
[rag] Legal area detected: laboral
[rag] Retrieving chunks...
[rag] Retrieved chunks: 8 scores: [0.856, 0.743, 0.692, ...]
[rag] Generating answer...
[rag] Answer generated, length: 1245
[rag] Running factual validation...
[rag] Factual validation: { isValid: true, warnings: 0, articlesValidated: 3 }
[rag] Structuring response...
[rag] Response successfully structured
[rag] Detecting calculation needs...
[rag] Calculation needed: prestaciones
[rag] Calculations performed: 3
[rag] Pipeline complete { requestId: '...', responseTime: '1234ms', ... }
```

---

## Mejoras de Rendimiento

El pipeline ahora incluye:

1. **Re-ranking inteligente**: Mejora la relevancia de los documentos recuperados
2. **Detección de área legal**: Optimiza los prompts para mejor generación
3. **Validación opcional**: Solo se ejecuta si está habilitada
4. **Cálculos bajo demanda**: Solo se ejecutan si se detecta necesidad

---

## Próximos Pasos

Para usar estas features en producción:

1. **Configurar variables de entorno** según necesidades
2. **Integrar con sistema de tiers** para habilitar features según plan del usuario
3. **Agregar logging a base de datos** para analytics
4. **Implementar cache** para respuestas frecuentes
5. **Testing exhaustivo** con casos reales

---

## Notas Importantes

- Las features avanzadas son **opcionales** y pueden habilitarse/deshabilitarse por consulta
- La **validación factual** puede agregar latencia adicional (~100-200ms)
- Los **cálculos** solo se ejecutan si se detectan parámetros suficientes en la consulta
- La **estructuración** funciona mejor con respuestas que ya siguen el formato dictamen
- El **re-ranking** está siempre activo y mejora la calidad de recuperación

