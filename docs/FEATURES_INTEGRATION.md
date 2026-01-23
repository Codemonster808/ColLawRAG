# Integración de Features - RAG Derecho Colombiano

## Resumen

Este documento describe las features que han sido integradas en el sistema RAG.

**Fecha:** $(date +%Y-%m-%d)

---

## Features Integradas

### 1. Autenticación y Sistema de Tiers

**Estado:** ✅ Integrado

**Archivos modificados:**
- `app/api/rag/route.ts` - Integración de autenticación y verificación de límites

**Funcionalidad:**
- Verificación de API key (opcional)
- Autenticación de usuario via header `x-user-id`
- Verificación de límites de uso por tier
- Tracking de uso por usuario
- Ajuste automático de parámetros según tier

**Uso:**
```typescript
// En la API, se verifica automáticamente:
// 1. API key (si está configurada)
// 2. Usuario y tier (si hay header x-user-id)
// 3. Límites de uso
// 4. Parámetros ajustados según tier
```

---

### 2. Mejora de Extracción de Parámetros

**Estado:** ✅ Mejorado

**Archivos modificados:**
- `lib/rag.ts` - Función `detectCalculationNeeds`

**Mejoras:**
- Extracción mejorada de horas extras (múltiples patrones)
- Detección de trabajo dominical sin pago
- Estimación inteligente cuando no hay números explícitos
- Extracción de años y meses trabajados mejorada

**Ejemplos de detección:**
- "Trabajé 10 horas diarias" → detecta 2 horas extras diarias
- "Trabajé los domingos sin pagarme" → detecta trabajo dominical
- "3 años y 8 meses" → detecta 44 meses trabajados

---

### 3. Cálculo de Indemnización

**Estado:** ✅ Integrado

**Archivos modificados:**
- `lib/rag.ts` - Función `performCalculations`

**Funcionalidad:**
- Cálculo automático de indemnización por despido sin justa causa
- Soporte para años completos y meses adicionales
- Integración con detección automática de necesidad de cálculos

**Uso:**
Cuando se detecta "despido sin justa causa" en la query, se calcula automáticamente la indemnización.

---

### 4. Integración de Procedimientos

**Estado:** ✅ Integrado

**Archivos modificados:**
- `lib/rag.ts` - Detección y carga de procedimientos

**Funcionalidad:**
- Detección automática de necesidad de procedimientos
- Carga de procedimientos desde `data/procedures/laboral.json`
- Filtrado por relevancia basado en términos de la query
- Inclusión en respuesta cuando aplica

**Uso:**
Cuando la query menciona "procedimiento", "pasos", "trámite", "reclamar", etc., se buscan procedimientos relevantes y se incluyen en la respuesta.

---

## Configuración

### Variables de Entorno

Las siguientes variables controlan las features:

- `RAG_API_KEY` - Protege el endpoint (opcional)
- `RATE_LIMIT_REQUESTS` - Límite de requests por minuto (default: 10)
- `PIPELINE_TIMEOUT_MS` - Timeout del pipeline (default: 60000)
- `HF_API_TIMEOUT_MS` - Timeout de API de Hugging Face (default: 30000)

### Flags de Features

En `runRagPipeline`:
- `enableFactualValidation` - Habilita validación factual
- `enableStructuredResponse` - Habilita respuesta estructurada
- `enableCalculations` - Habilita cálculos y procedimientos

---

## Ejemplos de Uso

### Consulta con Cálculos

```json
POST /api/rag
{
  "query": "Trabajé 3 años y 8 meses con salario de $3.500.000. Me despidieron sin justa causa. ¿Cuánto me deben?",
  "locale": "es"
}
```

**Respuesta incluye:**
- Cálculo de cesantías
- Cálculo de vacaciones
- Cálculo de prima de servicios
- Cálculo de indemnización
- Procedimientos para reclamar

### Consulta con Procedimientos

```json
POST /api/rag
{
  "query": "¿Qué procedimiento debo seguir para reclamar horas extras no pagadas?",
  "locale": "es"
}
```

**Respuesta incluye:**
- Procedimientos legales relevantes
- Pasos a seguir
- Plazos legales
- Documentos necesarios

---

## Próximas Mejoras

1. **Expansión de procedimientos**
   - Agregar procedimientos para otras áreas legales
   - Mejorar matching de procedimientos relevantes

2. **Mejora de extracción**
   - Extracción de más parámetros (días trabajados, fechas, etc.)
   - Validación de parámetros extraídos

3. **Integración de autenticación real**
   - Sistema de autenticación robusto (Auth0, Firebase, etc.)
   - Base de datos de usuarios
   - Tracking persistente de uso

---

## Notas Técnicas

### Dependencias

- `lib/tiers.ts` - Sistema de tiers
- `lib/auth.ts` - Autenticación básica
- `lib/legal-calculator.ts` - Cálculos legales
- `data/procedures/` - Base de datos de procedimientos

### Performance

- La carga de procedimientos es asíncrona y solo se ejecuta cuando se detecta necesidad
- Los procedimientos se filtran por relevancia para evitar respuestas muy largas
- Máximo 3 procedimientos por respuesta

---

**Última actualización:** $(date +%Y-%m-%d)
