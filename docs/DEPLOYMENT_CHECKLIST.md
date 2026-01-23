# Checklist de Deployment - RAG Derecho Colombiano

## Pre-Deployment

### Configuración de Variables de Entorno

- [ ] **HUGGINGFACE_API_KEY** configurada en Vercel Dashboard
  - Obtener en: https://huggingface.co/settings/tokens
  - Permisos: Read (suficiente)
  - Aplicar a: Production y Preview

- [ ] **HF_EMBEDDING_MODEL** (opcional)
  - Default: `sentence-transformers/paraphrase-multilingual-mpnet-base-v2`
  - Aplicar a: Production y Preview

- [ ] **HF_GENERATION_MODEL** (opcional)
  - Default: `meta-llama/llama-3.3-70b-instruct`
  - Aplicar a: Production y Preview

- [ ] **EMB_PROVIDER** (opcional)
  - Default: `hf`
  - Aplicar a: Production y Preview

- [ ] **GEN_PROVIDER** (opcional)
  - Default: `hf`
  - Aplicar a: Production y Preview

- [ ] **RAG_API_KEY** (opcional, para proteger endpoint)
  - Generar una clave segura
  - Aplicar a: Production y Preview

- [ ] **RATE_LIMIT_REQUESTS** (opcional)
  - Default: `10`
  - Aplicar a: Production y Preview

- [ ] **RATE_LIMIT_WINDOW_MS** (opcional)
  - Default: `60000` (1 minuto)
  - Aplicar a: Production y Preview

- [ ] **PIPELINE_TIMEOUT_MS** (opcional)
  - Default: `60000` (60 segundos)
  - Aplicar a: Production y Preview

- [ ] **HF_API_TIMEOUT_MS** (opcional)
  - Default: `30000` (30 segundos)
  - Aplicar a: Production y Preview

- [ ] **MAX_REQUEST_SIZE** (opcional)
  - Default: `1048576` (1MB)
  - Aplicar a: Production y Preview

- [ ] **ALLOWED_ORIGINS** (opcional)
  - Default: `*` (todos los orígenes)
  - Aplicar a: Production y Preview

### Verificación de Archivos

- [ ] **data/index.json** existe y está en el repositorio
  ```bash
  ls -la data/index.json
  git ls-files | grep index.json
  ```

- [ ] **data/index.json** no está en `.gitignore`
  ```bash
  git check-ignore data/index.json
  # No debe retornar nada
  ```

- [ ] Todos los archivos necesarios están commiteados
  ```bash
  git status
  ```

### Build Local

- [ ] Build exitoso localmente
  ```bash
  npm run build
  ```

- [ ] Sin errores de TypeScript
  ```bash
  npx tsc --noEmit
  ```

- [ ] Sin errores de linting
  ```bash
  npm run lint
  ```

### Verificación de Código

- [ ] Rate limiting implementado (`middleware.ts`)
- [ ] Health check endpoint creado (`app/api/health/route.ts`)
- [ ] Headers de seguridad configurados (`next.config.mjs`)
- [ ] Timeout handling implementado
- [ ] Manejo de errores mejorado
- [ ] Documentación actualizada

---

## Deployment

### Opción 1: Vercel CLI

```bash
# 1. Login (si no estás logueado)
vercel login

# 2. Link proyecto (si no está linkeado)
vercel link

# 3. Deploy a preview
vercel

# 4. Verificar preview
# Visitar URL proporcionada

# 5. Deploy a producción
vercel --prod
```

### Opción 2: Vercel Dashboard

1. Ir a https://vercel.com/dashboard
2. Seleccionar proyecto
3. Click en **Deploy** o **Redeploy**
4. Esperar a que termine el build (3-5 minutos)

### Opción 3: GitHub Integration

1. Push a repositorio conectado
2. Vercel despliega automáticamente

---

## Post-Deployment

### Verificación Básica

- [ ] **Health Check funciona**
  ```bash
  curl https://tu-proyecto.vercel.app/api/health
  ```
  Debe retornar `200` con status `healthy`

- [ ] **Frontend carga correctamente**
  - Visitar URL de producción
  - Verificar que la interfaz se carga sin errores

- [ ] **API responde correctamente**
  ```bash
  curl -X POST https://tu-proyecto.vercel.app/api/rag \
    -H "Content-Type: application/json" \
    -d '{"query": "test"}'
  ```
  Debe retornar `200` con respuesta válida

### Verificación de Funcionalidades

- [ ] **Rate limiting funciona**
  - Hacer 11 requests rápidas
  - El 11vo debe retornar `429`

- [ ] **Cache funciona**
  - Hacer la misma consulta dos veces
  - Segunda respuesta debe tener `"cached": true`

- [ ] **Timeout funciona**
  - (Difícil de probar, pero verificar logs)

- [ ] **Headers de seguridad presentes**
  ```bash
  curl -I https://tu-proyecto.vercel.app/api/rag
  ```
  Verificar presencia de:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-RateLimit-Limit`

### Verificación de Logs

- [ ] Revisar logs en Vercel Dashboard
  - Ir a: Deployments → [último deploy] → Functions → Ver logs
  - Verificar que no hay errores críticos

- [ ] Verificar métricas
  - Response times razonables (< 5s típicamente)
  - Tasa de errores baja (< 1%)

---

## Troubleshooting

### Error: "data/index.json not found"

**Solución:**
```bash
# Verificar que existe localmente
ls -la data/index.json

# Verificar que está en Git
git ls-files | grep index.json

# Si no está, agregarlo
git add data/index.json
git commit -m "Add index.json"
git push
```

### Error: "HUGGINGFACE_API_KEY not set"

**Solución:**
1. Ir a Vercel Dashboard → Settings → Environment Variables
2. Verificar que `HUGGINGFACE_API_KEY` está configurada
3. Verificar que está aplicada a **Production** y **Preview**
4. Hacer nuevo deploy

### Error: "Rate limit exceeded" en pruebas

**Solución:**
- Esperar 1 minuto entre pruebas
- O aumentar `RATE_LIMIT_REQUESTS` temporalmente

### Error: Build timeout

**Solución:**
- Verificar que `data/index.json` no es demasiado grande (< 50MB)
- Optimizar el proceso de ingestion si es necesario
- Considerar migrar a Pinecone si el índice crece mucho

### Error: Function size exceeded

**Solución:**
- Vercel tiene límite de 50MB por función
- Si `data/index.json` crece mucho, considerar:
  - Migrar a Pinecone
  - Optimizar el tamaño del índice
  - Usar external storage

### Health Check retorna "unhealthy"

**Diagnóstico:**
```bash
curl https://tu-proyecto.vercel.app/api/health
```

**Verificar:**
- `checks.indexFile.status` - Si es `error`, verificar que `data/index.json` existe
- `checks.huggingFace.status` - Si es `error`, verificar `HUGGINGFACE_API_KEY`

---

## Monitoreo Continuo

### Métricas a Monitorear

- [ ] Response time promedio (< 5s)
- [ ] Tasa de errores (< 1%)
- [ ] Rate limit hits (monitorear abuso)
- [ ] Uso de API de Hugging Face (costos)
- [ ] Cache hit rate (optimizar si es bajo)

### Alertas Recomendadas

- Error rate > 5%
- Response time > 10s
- Health check unhealthy
- Rate limit abuse detectado

---

## Rollback

Si algo sale mal:

```bash
# Ver deployments anteriores
vercel ls

# Promover deployment anterior a producción
vercel promote [deployment-url]
```

O desde Dashboard:
1. Ir a Deployments
2. Seleccionar deployment anterior
3. Click en "..." → "Promote to Production"

---

## Checklist Final

- [ ] Todas las variables de entorno configuradas
- [ ] Build exitoso
- [ ] Health check pasa
- [ ] API funciona correctamente
- [ ] Rate limiting funciona
- [ ] Headers de seguridad presentes
- [ ] Logs sin errores críticos
- [ ] Documentación actualizada
- [ ] Monitoreo configurado

---

## Próximos Pasos

Una vez en producción:

1. **Monitorear uso y costos**
   - Revisar métricas en Vercel Dashboard
   - Monitorear uso de Hugging Face API

2. **Optimizar según necesidad**
   - Ajustar rate limits si es necesario
   - Optimizar cache si hit rate es bajo
   - Considerar Pinecone si el tráfico crece

3. **Mejorar seguridad**
   - Configurar dominio personalizado
   - Implementar autenticación si es necesario
   - Configurar WAF si es necesario

4. **Escalar**
   - Migrar a Pinecone para mejor rendimiento
   - Implementar CDN para assets estáticos
   - Considerar múltiples regiones si es necesario

---

**Última actualización:** 2024-01-15
