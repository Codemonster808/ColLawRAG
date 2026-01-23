# API Documentation - RAG Derecho Colombiano

## Base URL

**Production:** `https://tu-proyecto.vercel.app`  
**Development:** `http://localhost:3000`

## Endpoints

### 1. Health Check

Verifica el estado del sistema y sus dependencias.

**Endpoint:** `GET /api/health`

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "indexFile": {
      "status": "ok"
    },
    "huggingFace": {
      "status": "ok"
    }
  },
  "version": "1.0.0"
}
```

**Status Codes:**
- `200` - Healthy: Todos los checks pasaron
- `200` - Degraded: Algunos checks fallaron pero el servicio puede funcionar parcialmente
- `503` - Unhealthy: El servicio no puede funcionar

---

### 2. RAG Query

Consulta el sistema RAG con una pregunta legal.

**Endpoint:** `POST /api/rag`

**Headers:**
```
Content-Type: application/json
x-api-key: YOUR_API_KEY (opcional, solo si RAG_API_KEY está configurado)
```

**Request Body:**

```json
{
  "query": "¿Qué dice la ley colombiana sobre horas extras?",
  "filters": {
    "type": "estatuto"
  },
  "locale": "es"
}
```

**Parámetros:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `query` | string | Sí | Pregunta legal (1-2000 caracteres) |
| `filters` | object | No | Filtros opcionales |
| `filters.type` | enum | No | Tipo de documento: `"estatuto"`, `"jurisprudencia"`, `"reglamento"` |
| `locale` | enum | No | Idioma: `"es"` (default) o `"en"` |

**Response:**

```json
{
  "answer": "Según el Código Sustantivo del Trabajo...",
  "citations": [
    {
      "id": "doc-123",
      "title": "Código Sustantivo del Trabajo",
      "type": "estatuto",
      "url": "https://...",
      "article": "Artículo 159",
      "score": 0.95
    }
  ],
  "retrieved": 8,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "detectedLegalArea": "laboral",
  "metadata": {
    "responseTime": 2341,
    "complexity": "media"
  },
  "structuredResponse": {
    "hechosRelevantes": "...",
    "normasAplicables": "...",
    "analisisJuridico": "...",
    "conclusion": "...",
    "recomendacion": "..."
  },
  "factualValidation": {
    "isValid": true,
    "warnings": [],
    "validatedFacts": {
      "articles": [],
      "numbers": []
    }
  },
  "calculations": [
    {
      "type": "cesantias",
      "amount": 18480000,
      "formula": "Cesantías = (Salario / 12) × Meses + Intereses",
      "breakdown": {
        "salarioMensual": 3500000,
        "mesesTrabajados": 44
      }
    }
  ],
  "cached": false
}
```

**Status Codes:**
- `200` - Success: Consulta procesada exitosamente
- `400` - Bad Request: Consulta inválida o mal formada
- `401` - Unauthorized: API key inválida (si está configurada)
- `413` - Payload Too Large: Request body excede el tamaño máximo
- `429` - Too Many Requests: Rate limit excedido
- `500` - Internal Server Error: Error en el servidor
- `504` - Gateway Timeout: Timeout en el procesamiento

**Rate Limiting:**

- **Límite:** 10 requests por minuto por IP (configurable)
- **Headers de respuesta:**
  - `X-RateLimit-Limit`: Límite de requests
  - `X-RateLimit-Remaining`: Requests restantes
  - `X-RateLimit-Reset`: Timestamp de reset
  - `Retry-After`: Segundos hasta el próximo intento (cuando se excede el límite)

---

## Ejemplos de Uso

### Ejemplo 1: Consulta Básica

```bash
curl -X POST https://tu-proyecto.vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -d '{
    "query": "¿Cuáles son los requisitos para la acción de tutela?"
  }'
```

### Ejemplo 2: Consulta con Filtros

```bash
curl -X POST https://tu-proyecto.vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Jurisprudencia sobre horas extras",
    "filters": {
      "type": "jurisprudencia"
    }
  }'
```

### Ejemplo 3: Con API Key

```bash
curl -X POST https://tu-proyecto.vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "query": "Ley laboral sobre vacaciones"
  }'
```

### Ejemplo 4: JavaScript/TypeScript

```typescript
async function queryRAG(query: string) {
  const response = await fetch('https://tu-proyecto.vercel.app/api/rag', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'x-api-key': 'YOUR_API_KEY' // Si está configurado
    },
    body: JSON.stringify({
      query,
      locale: 'es'
    })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Error en la consulta')
  }
  
  return await response.json()
}

// Uso
const result = await queryRAG('¿Qué es la acción de tutela?')
console.log(result.answer)
console.log(result.citations)
```

---

## Códigos de Error

### 400 Bad Request

```json
{
  "error": "Consulta inválida",
  "details": {
    "fieldErrors": {
      "query": ["String must contain at least 1 character(s)"]
    }
  },
  "message": "Request validation failed"
}
```

**Causas comunes:**
- Query vacío o muy largo (>2000 caracteres)
- Tipo de filtro inválido
- Locale inválido

### 401 Unauthorized

```json
{
  "error": "No autorizado",
  "message": "Invalid API key"
}
```

**Causa:** API key incorrecta o no proporcionada cuando `RAG_API_KEY` está configurado.

### 413 Payload Too Large

```json
{
  "error": "Request too large",
  "message": "Request body exceeds maximum size of 1048576 bytes"
}
```

**Causa:** El body del request excede 1MB (configurable).

### 429 Too Many Requests

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 45 seconds.",
  "retryAfter": 45
}
```

**Causa:** Se excedió el límite de 10 requests por minuto.

**Solución:** Esperar el tiempo indicado en `retryAfter` antes de intentar nuevamente.

### 500 Internal Server Error

```json
{
  "error": "Error interno",
  "message": "Error description here",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Causas comunes:**
- Error en el pipeline RAG
- Error de conexión con Hugging Face
- Error al procesar el índice

### 504 Gateway Timeout

```json
{
  "error": "Request timeout",
  "message": "Request timeout after 60000ms",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Causa:** El procesamiento tomó más de 60 segundos (configurable).

**Solución:** Simplificar la consulta o intentar nuevamente.

---

## Límites y Restricciones

### Límites de Request

- **Tamaño máximo del query:** 2000 caracteres
- **Tamaño máximo del body:** 1MB (configurable via `MAX_REQUEST_SIZE`)
- **Timeout del pipeline:** 60 segundos (configurable via `PIPELINE_TIMEOUT_MS`)
- **Timeout de API externa:** 30 segundos (configurable via `HF_API_TIMEOUT_MS`)

### Rate Limiting

- **Límite por IP:** 10 requests/minuto (configurable via `RATE_LIMIT_REQUESTS`)
- **Ventana de tiempo:** 60 segundos (configurable via `RATE_LIMIT_WINDOW_MS`)

### Cache

- **TTL:** 60 segundos
- **Alcance:** Por query exacta (query + filters + locale)
- **Headers:** `X-Cache: HIT` o `X-Cache: MISS`

---

## Variables de Entorno

### Requeridas

- `HUGGINGFACE_API_KEY` - API key de Hugging Face (obtener en https://huggingface.co/settings/tokens)

### Opcionales

- `HF_EMBEDDING_MODEL` - Modelo para embeddings (default: `sentence-transformers/paraphrase-multilingual-mpnet-base-v2`)
- `HF_GENERATION_MODEL` - Modelo para generación (default: `meta-llama/llama-3.3-70b-instruct`)
- `EMB_PROVIDER` - Proveedor de embeddings (default: `hf`)
- `GEN_PROVIDER` - Proveedor de generación (default: `hf`)
- `RAG_API_KEY` - API key para proteger el endpoint (opcional)
- `RATE_LIMIT_REQUESTS` - Límite de requests por ventana (default: `10`)
- `RATE_LIMIT_WINDOW_MS` - Ventana de tiempo en ms (default: `60000`)
- `PIPELINE_TIMEOUT_MS` - Timeout del pipeline en ms (default: `60000`)
- `HF_API_TIMEOUT_MS` - Timeout de API externa en ms (default: `30000`)
- `MAX_REQUEST_SIZE` - Tamaño máximo del request en bytes (default: `1048576`)
- `ALLOWED_ORIGINS` - Orígenes permitidos para CORS (default: `*`)

---

## Mejores Prácticas

1. **Manejo de Errores:** Siempre verifica el status code antes de procesar la respuesta
2. **Rate Limiting:** Implementa retry con exponential backoff cuando recibas 429
3. **Cache:** Usa el header `X-Cache` para optimizar tus requests
4. **Timeouts:** Configura timeouts apropiados en tu cliente
5. **API Key:** Si usas API key, guárdala de forma segura (variables de entorno)
6. **Logging:** Usa el `requestId` para tracking y debugging

---

## Soporte

Para reportar problemas o solicitar features:
- Revisa los logs en Vercel Dashboard
- Verifica el endpoint `/api/health` para diagnóstico
- Consulta la documentación en `docs/`

---

## Changelog

### v1.0.0 (2024-01-15)
- Implementación inicial de API RAG
- Health check endpoint
- Rate limiting
- Timeout handling
- Validación de entrada mejorada
