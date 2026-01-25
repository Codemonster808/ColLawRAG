# Acceso Público - RAG Derecho Colombiano

Esta guía proporciona información sobre cómo acceder y usar el servicio RAG de Derecho Colombiano en producción.

---

## URL del Servicio

**Producción**: `https://col-law-rag.vercel.app` (o tu URL personalizada de Vercel)

**Health Check**: `https://col-law-rag.vercel.app/api/health`

---

## Endpoints Disponibles

### 1. Health Check

Verifica el estado del servicio.

**Endpoint**: `GET /api/health`

**Ejemplo**:
```bash
curl https://col-law-rag.vercel.app/api/health
```

**Respuesta**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "checks": {
    "indexFile": { "status": "ok" },
    "huggingFace": { "status": "ok" }
  },
  "version": "1.0.0"
}
```

---

### 2. API RAG (Consulta Legal)

Realiza consultas sobre derecho colombiano.

**Endpoint**: `POST /api/rag`

**Headers**:
- `Content-Type: application/json`
- `x-api-key: YOUR_API_KEY` (opcional, solo para requests externas)

**Body**:
```json
{
  "query": "¿Qué dice la ley colombiana sobre horas extras?",
  "filters": {
    "type": "estatuto"
  },
  "locale": "es"
}
```

**Ejemplo con cURL**:
```bash
curl -X POST https://col-law-rag.vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -d '{
    "query": "¿Qué es la acción de tutela?",
    "locale": "es"
  }'
```

**Respuesta**:
```json
{
  "answer": "La acción de tutela es un mecanismo constitucional...",
  "citations": [
    {
      "id": "doc-1",
      "title": "Constitución Política de Colombia",
      "type": "constitucion",
      "url": "https://...",
      "article": "Artículo 86",
      "score": 0.92
    }
  ],
  "retrieved": 3,
  "requestId": "uuid-here",
  "detectedLegalArea": "constitucional",
  "metadata": {
    "responseTime": 3456,
    "complexity": "media"
  }
}
```

**Campos Adicionales** (según configuración):

- `structuredResponse`: Respuesta estructurada en formato dictamen
- `factualValidation`: Validación de artículos y números mencionados
- `calculations`: Cálculos legales automáticos (prestaciones, horas extras, etc.)
- `procedures`: Procedimientos legales paso a paso

---

## Rate Limits

**Límite por defecto**: 10 requests por minuto por IP

**Headers de respuesta**:
- `X-RateLimit-Limit`: Límite de requests
- `X-RateLimit-Remaining`: Requests restantes
- `X-RateLimit-Reset`: Tiempo de reset (Unix timestamp)

**Respuesta cuando se excede el límite**:
```json
{
  "error": "Límite de uso excedido",
  "message": "Too many requests. Please try again later."
}
```
**Status Code**: `429 Too Many Requests`

---

## Formato de Respuestas

### Respuesta Exitosa

**Status Code**: `200 OK`

**Estructura**:
```json
{
  "answer": "string",
  "citations": [...],
  "retrieved": number,
  "requestId": "uuid",
  "detectedLegalArea": "string",
  "metadata": {
    "responseTime": number,
    "complexity": "baja" | "media" | "alta"
  }
}
```

### Respuesta con Error

**Status Codes**:
- `400 Bad Request`: Consulta inválida o mal formateada
- `401 Unauthorized`: API key inválida (solo para requests externas)
- `413 Payload Too Large`: Request body demasiado grande (>1MB)
- `429 Too Many Requests`: Rate limit excedido
- `500 Internal Server Error`: Error interno del servidor
- `504 Gateway Timeout`: Timeout del pipeline (>60s)

**Estructura de error**:
```json
{
  "error": "Error interno",
  "message": "Descripción del error",
  "requestId": "uuid" // Si está disponible
}
```

---

## Ejemplos de Uso

### Ejemplo 1: Consulta Simple

```bash
curl -X POST https://col-law-rag.vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Ley laboral colombiana sobre horas extras"
  }'
```

### Ejemplo 2: Consulta con Filtros

```bash
curl -X POST https://col-law-rag.vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Requisitos de la acción de cumplimiento",
    "filters": {
      "type": "estatuto"
    }
  }'
```

### Ejemplo 3: Consulta con Cálculo Legal

```bash
curl -X POST https://col-law-rag.vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Calcular prestaciones sociales para un salario de $2.000.000 mensuales trabajando 12 meses"
  }'
```

**Respuesta incluirá**:
```json
{
  "answer": "...",
  "calculations": [
    {
      "type": "cesantias",
      "amount": 2400000,
      "formula": "salario * meses / 12",
      "breakdown": {
        "salario": 2000000,
        "meses": 12
      }
    }
  ]
}
```

---

## Troubleshooting Común

### Problema: "Request timeout"

**Causa**: La consulta es muy compleja o el modelo tarda demasiado.

**Solución**:
- Reformular la consulta de forma más específica
- Dividir la consulta en partes más pequeñas
- Esperar unos segundos y reintentar

---

### Problema: "No se encontraron documentos relevantes"

**Causa**: La consulta no coincide con ningún documento indexado.

**Solución**:
- Reformular la consulta usando términos legales más específicos
- Verificar que la consulta esté en español
- Intentar con sinónimos o términos relacionados

---

### Problema: "Rate limit exceeded"

**Causa**: Demasiadas requests en poco tiempo.

**Solución**:
- Esperar 1 minuto antes de hacer otra request
- Implementar retry con backoff exponencial
- Contactar al administrador si necesitas límites más altos

---

### Problema: "HUGGINGFACE_API_KEY not set"

**Causa**: Error de configuración del servidor (no debería ocurrir en producción).

**Solución**:
- Reportar el problema al administrador
- Verificar el estado del servicio en `/api/health`

---

## Seguridad y Privacidad

### Filtrado de PII

El servicio filtra automáticamente información personal identificable (PII) de las respuestas:
- Emails
- Números de teléfono
- Cédulas
- NITs

### Autenticación

- **Requests del mismo origen**: No requieren API key
- **Requests externas**: Requieren header `x-api-key` con API key válida

---

## Monitoreo

### Health Check

Verifica el estado del servicio:
```bash
curl https://col-law-rag.vercel.app/api/health
```

### Status Dashboard

Visita `/status` para ver el dashboard de estado del servicio (si está disponible).

---

## Límites y Cuotas

### Tier Free (Por defecto)

- 10 requests/minuto por IP
- Respuestas básicas
- Sin cálculos avanzados
- Sin procedimientos detallados

### Tier Premium

- 50 requests/minuto
- Respuestas estructuradas
- Cálculos legales automáticos
- Procedimientos paso a paso
- Validación factual

**Nota**: Los tiers se configuran mediante autenticación de usuario. Contacta al administrador para acceso premium.

---

## Soporte

### Reportar Problemas

Si encuentras un problema o tienes una pregunta:

1. Verifica primero el estado del servicio: `/api/health`
2. Revisa esta documentación
3. Revisa los logs del servicio (si tienes acceso)
4. Contacta al administrador con:
   - Request ID (si está disponible)
   - Descripción del problema
   - Query que causó el problema (sin información sensible)

---

## Changelog

### v1.0.0 (2024-01-15)
- Lanzamiento inicial
- API RAG básica
- Health check
- Rate limiting
- Filtrado de PII

---

**Última actualización**: 2024-01-15
