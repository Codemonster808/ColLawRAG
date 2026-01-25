# Guía de Monitoreo - RAG Derecho Colombiano

Esta guía te ayudará a monitorear el servicio RAG en producción para detectar problemas tempranamente y mantener el servicio funcionando correctamente.

---

## Health Check

### Verificación Básica

El endpoint `/api/health` proporciona información sobre el estado del servicio:

```bash
curl https://tu-proyecto.vercel.app/api/health
```

### Respuesta Esperada

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "checks": {
    "indexFile": {
      "status": "ok"
    },
    "huggingFace": {
      "status": "ok"
    }
  },
  "version": "0.1.0"
}
```

### Estados Posibles

- **`healthy`**: Todo funciona correctamente
- **`degraded`**: Algunos componentes no funcionan pero el servicio puede responder (ej: Hugging Face API down pero índice local disponible)
- **`unhealthy`**: El servicio no puede funcionar correctamente

### Interpretación de Checks

#### `indexFile.status`

- **`ok`**: El archivo `data/index.json` existe y es válido
- **`error`**: El archivo no existe, está vacío, o no es JSON válido
  - **Solución**: Verificar que `data/index.json` está en el repositorio y se incluyó en el build

#### `huggingFace.status`

- **`ok`**: La API key está configurada y tiene formato válido
- **`error`**: La API key no está configurada o tiene formato inválido
  - **Solución**: Verificar `HUGGINGFACE_API_KEY` en Vercel Dashboard

---

## Métricas en Vercel Dashboard

### Acceso a Métricas

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a la pestaña **Analytics** o **Metrics**

### Métricas Importantes

#### 1. Response Time (Tiempo de Respuesta)

**Qué monitorear**:
- **Promedio**: < 5 segundos (ideal)
- **P95**: < 10 segundos
- **P99**: < 15 segundos

**Qué hacer si es alto**:
- Verificar logs para identificar queries lentas
- Considerar optimizar el modelo de generación
- Verificar latencia de Hugging Face API
- Considerar habilitar cache si no está habilitado

#### 2. Error Rate (Tasa de Errores)

**Qué monitorear**:
- **Ideal**: < 1%
- **Aceptable**: < 5%
- **Crítico**: > 10%

**Qué hacer si es alto**:
- Revisar logs para identificar errores comunes
- Verificar que `HUGGINGFACE_API_KEY` es válida
- Verificar que los modelos configurados existen
- Revisar rate limiting (puede estar bloqueando requests legítimas)

#### 3. Request Count (Número de Requests)

**Qué monitorear**:
- Tendencias de uso
- Picos de tráfico
- Patrones de uso

**Qué hacer**:
- Ajustar rate limits según uso real
- Planificar escalamiento si el tráfico crece
- Identificar posibles abusos o bots

#### 4. Function Invocations (Invocaciones de Función)

**Qué monitorear**:
- Número de invocaciones por día/semana
- Costos asociados (si aplica)

**Límites de Vercel**:
- **Hobby**: 100 GB-hours/mes
- **Pro**: Ilimitado (con límites de función)

---

## Logs

### Acceso a Logs

1. Ve a Vercel Dashboard → Tu Proyecto
2. Ve a **Deployments**
3. Selecciona un deployment
4. Haz clic en **Functions** → Selecciona una función
5. Verás los logs en tiempo real

### Tipos de Logs

#### Logs de API RAG (`/api/rag`)

**Logs normales**:
```
[api/rag] Request received: query="..."
[api/rag] GEN_PROVIDER=hf, EMB_PROVIDER=hf
[generation] using HF model=meta-llama/llama-3.3-70b-instruct
[generation] chunks used: 5 of 8
[api/rag] Response generated in 3456ms
```

**Logs de error**:
```
[api/rag] Error: HUGGINGFACE_API_KEY not set
[api/rag] Error: Timeout after 60000ms
[generation] Ollama HTTP error 500
```

#### Logs de Health Check (`/api/health`)

**Logs normales**:
```
[health] Health check requested
[health] All checks passed
```

**Logs de error**:
```
[health] Index file check failed: data/index.json not found
[health] Hugging Face check failed: Invalid API key format
```

### Interpretación de Logs

#### Errores Comunes

1. **"HUGGINGFACE_API_KEY not set"**
   - **Causa**: Variable no configurada en Vercel
   - **Solución**: Configurar en Vercel Dashboard

2. **"Timeout after 60000ms"**
   - **Causa**: La API de Hugging Face tarda demasiado
   - **Solución**: Aumentar `PIPELINE_TIMEOUT_MS` o `HF_API_TIMEOUT_MS`

3. **"data/index.json not found"**
   - **Causa**: Archivo no incluido en el build
   - **Solución**: Verificar que está en el repositorio y se incluyó en el build

4. **"Rate limit exceeded"**
   - **Causa**: Demasiadas requests muy rápido
   - **Solución**: Ajustar `RATE_LIMIT_REQUESTS` o esperar

---

## Alertas Recomendadas

### Configurar Alertas en Vercel

1. Ve a Vercel Dashboard → Tu Proyecto
2. Ve a **Settings** → **Notifications**
3. Configura alertas para:

#### 1. Error Rate > 5%

**Configuración**:
- **Trigger**: Error rate > 5% en últimos 5 minutos
- **Canales**: Email, Slack (si está configurado)

**Acción**: Revisar logs inmediatamente

#### 2. Response Time > 10s

**Configuración**:
- **Trigger**: P95 response time > 10 segundos en últimos 10 minutos
- **Canales**: Email

**Acción**: Investigar queries lentas o problemas de latencia

#### 3. Health Check Unhealthy

**Configuración**:
- **Trigger**: Health check retorna `unhealthy` o `degraded`
- **Canales**: Email, Slack (crítico)

**Acción**: Verificar inmediatamente variables de entorno y estado del servicio

#### 4. Function Invocations Limit

**Configuración**:
- **Trigger**: 80% del límite de invocaciones alcanzado
- **Canales**: Email

**Acción**: Considerar upgrade de plan o optimización

---

## Monitoreo Continuo

### Checklist Diario (Opcional)

- [ ] Health check retorna `healthy`
- [ ] Error rate < 5%
- [ ] Response time promedio < 5s
- [ ] No hay errores críticos en logs

### Checklist Semanal

- [ ] Revisar métricas de uso
- [ ] Verificar costos (si aplica)
- [ ] Revisar logs para patrones de error
- [ ] Verificar que las API keys siguen siendo válidas

### Checklist Mensual

- [ ] Revisar y optimizar rate limits según uso
- [ ] Actualizar documentación si hay cambios
- [ ] Revisar y rotar API keys si es necesario
- [ ] Analizar tendencias de uso y planificar escalamiento

---

## Troubleshooting de Problemas Comunes

### Problema: Health Check Retorna "unhealthy"

**Diagnóstico**:
```bash
curl https://tu-proyecto.vercel.app/api/health
```

**Verificar**:
1. `checks.indexFile.status`: Si es `error`, verificar que `data/index.json` existe
2. `checks.huggingFace.status`: Si es `error`, verificar `HUGGINGFACE_API_KEY`

**Solución**:
- Si `indexFile` falla: Verificar que `data/index.json` está en el repositorio
- Si `huggingFace` falla: Verificar `HUGGINGFACE_API_KEY` en Vercel Dashboard

---

### Problema: API RAG No Responde o Tarda Mucho

**Diagnóstico**:
1. Revisar logs en Vercel Dashboard
2. Verificar response time en Analytics
3. Hacer test manual:
   ```bash
   curl -X POST https://tu-proyecto.vercel.app/api/rag \
     -H "Content-Type: application/json" \
     -d '{"query": "test"}' \
     -w "\nTime: %{time_total}s\n"
   ```

**Posibles Causas**:
1. **Timeout de Hugging Face API**
   - **Solución**: Aumentar `HF_API_TIMEOUT_MS` o `PIPELINE_TIMEOUT_MS`

2. **Modelo muy lento**
   - **Solución**: Cambiar a un modelo más rápido o usar Ollama local

3. **Queries muy complejas**
   - **Solución**: Optimizar prompts o reducir número de chunks

---

### Problema: Rate Limit Exceeded Frecuentemente

**Diagnóstico**:
- Revisar logs para ver frecuencia de errores 429
- Verificar número de requests en Analytics

**Solución**:
1. Aumentar `RATE_LIMIT_REQUESTS` en Vercel
2. Aumentar `RATE_LIMIT_WINDOW_MS` si es necesario
3. Implementar autenticación para usuarios legítimos

---

### Problema: Errores 500 Frecuentes

**Diagnóstico**:
1. Revisar logs en Vercel Dashboard
2. Identificar patrón de errores

**Posibles Causas**:
1. **API Key inválida o expirada**
   - **Solución**: Generar nuevo token y actualizar en Vercel

2. **Modelo no disponible**
   - **Solución**: Verificar que el modelo configurado existe en Hugging Face

3. **Timeout frecuente**
   - **Solución**: Aumentar timeouts o cambiar modelo

---

## Herramientas de Monitoreo Externas

### Uptime Monitoring

**Herramientas recomendadas**:
- **UptimeRobot** (gratis): https://uptimerobot.com
- **Pingdom**: https://www.pingdom.com
- **StatusCake**: https://www.statuscake.com

**Configuración**:
- **URL**: `https://tu-proyecto.vercel.app/api/health`
- **Intervalo**: 5 minutos
- **Alerta**: Si retorna código != 200 o `status != "healthy"`

### Log Aggregation (Opcional)

Para proyectos más grandes, considera:
- **Logtail**: Integración con Vercel
- **Datadog**: Monitoreo completo
- **New Relic**: APM y monitoreo

---

## Métricas de Performance

### Métricas Esperadas

| Métrica | Objetivo | Aceptable | Crítico |
|---------|----------|-----------|---------|
| **Tiempo de respuesta promedio** | < 5s | < 10s | > 15s |
| **Tiempo de respuesta P95** | < 10s | < 20s | > 30s |
| **Tiempo de respuesta P99** | < 15s | < 25s | > 40s |
| **Cold start** | < 5s | < 10s | > 15s |
| **Error Rate** | < 0.5% | < 2% | > 5% |
| **Cache Hit Rate** | > 60% | > 40% | < 20% |
| **Uptime** | > 99.9% | > 99.5% | < 99% |
| **Throughput** | 10 req/min/IP | 5 req/min/IP | < 2 req/min/IP |

### Optimizaciones Implementadas

#### Cold Start Optimization

- **Lazy Loading**: Módulos pesados (validación factual, cálculos legales, estructuración) se cargan solo cuando se necesitan
- **Imports Optimizados**: Reducción de imports síncronos en el pipeline principal
- **Tiempo esperado**: < 5s para cold start inicial

#### Caching

- **TTL**: 60 segundos por defecto
- **Cache Key**: Basado en query, filters y locale
- **Cache Headers**: `Cache-Control: public, s-maxage=60, stale-while-revalidate=60`
- **Métrica**: Cache hit rate visible en headers `X-Cache: HIT/MISS`

#### Structured Logging

- **Formato JSON en producción**: Logs estructurados para mejor parsing
- **Request ID**: Tracking de requests individuales
- **Métricas automáticas**: Logging de tiempos de respuesta y métricas clave
- **Niveles**: debug, info, warn, error

### Métricas de Calidad

1. **Cache Hit Rate**
   - **Ideal**: > 60%
   - **Aceptable**: > 40%
   - **Acción si bajo**: Optimizar cache o queries, aumentar TTL

2. **Average Response Time**
   - **Ideal**: < 5s
   - **Aceptable**: < 10s
   - **Acción si alto**: Optimizar modelo, reducir chunks, habilitar cache

3. **Error Rate**
   - **Ideal**: < 0.5%
   - **Aceptable**: < 2%
   - **Acción si alto**: Investigar y corregir errores, revisar logs

4. **Uptime**
   - **Ideal**: > 99.9%
   - **Aceptable**: > 99.5%
   - **Acción si bajo**: Investigar causas de downtime, configurar alertas

---

## Recursos Adicionales

- [Documentación de Vercel Analytics](https://vercel.com/docs/analytics)
- [Documentación de Vercel Logs](https://vercel.com/docs/observability/logs)
- [Guía de Deployment](./DEPLOYMENT_CHECKLIST.md)
- [Troubleshooting de Deployment](./DEPLOYMENT_STATUS.md)

---

**Última actualización**: 2024-01-15
