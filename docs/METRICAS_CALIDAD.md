# Sistema de Diagnóstico y Métricas de Calidad

## Estado del Sistema

✅ **Sistema de diagnóstico COMPLETO y FUNCIONANDO**

El sistema fue implementado y probado exitosamente con 25 consultas de prueba, obteniendo:
- **98.2% de precisión promedio**
- **96.2% de precisión de citas** (100/104 citas válidas)
- **0% de fallos** en las consultas

---

## Métricas Implementadas

### 1. Métricas de Precisión de Citas

#### 1.1 Precisión General (`precision`)
- **Definición**: `validCitations / totalCitations`
- **Rango**: 0.0 - 1.0 (0% - 100%)
- **Interpretación**: 
  - 1.0 = Todas las citas son válidas
  - 0.0 = Ninguna cita es válida
- **Estado**: ✅ Implementado y funcionando

#### 1.2 Total de Citas (`totalCitations`)
- **Definición**: Número total de referencias [1], [2], etc. encontradas en la respuesta
- **Uso**: Identifica cuántas citas genera el modelo por respuesta
- **Estado**: ✅ Implementado

#### 1.3 Citas Válidas (`validCitations`)
- **Definición**: Número de citas que corresponden a fuentes reales en el contexto
- **Validación**: 
  - La referencia [N] existe en el rango de chunks disponibles
  - El índice corresponde a un chunk válido
- **Estado**: ✅ Implementado

#### 1.4 Citas Inválidas (`invalidCitations`)
- **Definición**: Array de citas que fallan la validación
- **Tipos de errores detectados**:
  - `Cita fuera de rango`: [9] cuando solo hay 8 fuentes
  - `Formato de cita inválido`: Referencias mal formateadas
- **Estado**: ✅ Implementado con mensajes de error detallados

### 2. Métricas de Validación de Artículos

#### 2.1 Coincidencia de Artículos (`articleMatch`)
- **Definición**: Verifica que los artículos mencionados (ej: "Artículo 86") existan en el documento citado
- **Patrones detectados**:
  - "Artículo X"
  - "Art. X"
  - "artículo X"
- **Estado**: ✅ Implementado (básico, puede mejorarse)

#### 2.2 Confianza (`confidence`)
- **Definición**: Score de 0.0 a 1.0 que indica la confiabilidad de la validación
- **Valores**:
  - 1.0 = Cita válida y artículo encontrado
  - 0.5 = Cita válida pero artículo no encontrado
  - 0.0 = Cita inválida
- **Estado**: ✅ Implementado

### 3. Métricas Agregadas por Categoría

#### 3.1 Precisión por Categoría
- **Categorías evaluadas**:
  - `constitucional`: Consultas sobre Constitución
  - `laboral`: Consultas sobre derecho laboral
  - `seguridad_social`: Consultas sobre seguridad social
- **Métrica**: Precisión promedio de citas por categoría
- **Estado**: ✅ Implementado y reportado

#### 3.2 Total de Consultas por Categoría
- **Definición**: Número de consultas evaluadas en cada categoría
- **Estado**: ✅ Implementado

### 4. Métricas de Rendimiento del Sistema

#### 4.1 Tasa de Éxito (`successfulQueries / totalQueries`)
- **Definición**: Porcentaje de consultas que se procesaron sin errores
- **Resultado actual**: 100% (25/25)
- **Estado**: ✅ Implementado

#### 4.2 Tasa de Fallos (`failedQueries`)
- **Definición**: Número de consultas que fallaron por errores técnicos
- **Resultado actual**: 0 fallos
- **Estado**: ✅ Implementado

---

## Componentes del Sistema

### 1. Validador de Citas (`lib/citation-validator.ts`)
✅ **Completo**
- Extrae referencias de citas del texto
- Valida que las referencias correspondan a chunks válidos
- Verifica menciones de artículos
- Genera reportes de validación

### 2. Script de Evaluación (`scripts/evaluate-citations.mjs`)
✅ **Completo**
- Ejecuta consultas de prueba contra el RAG
- Valida cada respuesta automáticamente
- Genera reportes JSON y texto
- Agrupa métricas por categoría

### 3. Dataset de Pruebas (`data/eval/test-queries.json`)
✅ **Completo**
- 25 consultas legales de prueba
- Categorizadas por área (constitucional, laboral, seguridad_social)
- Incluye fuentes esperadas para validación

### 4. Generador de Reportes (`scripts/generate-quality-report.mjs`)
✅ **Completo**
- Genera reportes legibles en texto
- Exporta métricas en JSON
- Muestra resumen por categoría

---

## Métricas Actuales (Última Evaluación)

```
RESUMEN GENERAL
------------------------------------------------------------
Total de consultas: 25
Consultas exitosas: 25
Consultas fallidas: 0
Precisión promedio: 98.2%
Total de citas: 104
Citas válidas: 100
Precisión de citas: 96.2%

POR CATEGORÍA
------------------------------------------------------------
constitucional:
  Consultas: 8
  Citas válidas: 32/33
  Precisión: 97.0%

laboral:
  Consultas: 11
  Citas válidas: 43/45
  Precisión: 95.6%

seguridad_social:
  Consultas: 6
  Citas válidas: 25/26
  Precisión: 96.2%
```

---

## Limitaciones Actuales

1. **Validación de Artículos**: La validación de artículos mencionados es básica. Puede mejorarse para:
   - Detectar mejor los formatos de artículos
   - Validar contra el contenido real del chunk
   - Manejar referencias cruzadas entre documentos

2. **Métricas Adicionales No Implementadas**:
   - Relevancia semántica de las respuestas
   - Completitud de la información
   - Verificación factual contra fuentes oficiales
   - Feedback del usuario (thumbs up/down)

---

## Cómo Usar el Sistema

### Ejecutar Evaluación
```bash
npm run evaluate
```

### Ver Reporte
```bash
npm run quality-report
```

### Reportes Generados
- `data/eval/quality-report.json` - Datos estructurados
- `data/eval/quality-report.txt` - Reporte legible

---

## Próximas Mejoras Sugeridas

1. **Métricas de Relevancia**: Medir qué tan relevante es la respuesta a la pregunta
2. **Métricas de Completitud**: Verificar que la respuesta cubra todos los aspectos de la pregunta
3. **Sistema de Feedback**: Permitir a los usuarios calificar respuestas
4. **Validación Factual**: Comparar respuestas contra fuentes oficiales verificadas
5. **Métricas de Latencia**: Medir tiempo de respuesta del sistema

