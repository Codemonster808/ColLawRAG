# Checklist de Deployment Rápido

Checklist simplificado para deployment rápido una vez resueltos los warnings de dependencias.

**Tiempo estimado total**: 15-20 minutos

---

## Pre-Deploy (5 minutos)

### 1. Verificar Pre-Deploy ✅

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
npm run pre-deploy-check
```

**Verificar**: No debe haber errores críticos.

**Si hay errores**: Corregir antes de continuar.

---

### 2. Verificar Variables de Entorno ✅

```bash
npm run verify-env
```

**Verificar**: `HUGGINGFACE_API_KEY` debe estar documentada (aunque no configurada localmente está bien).

---

## Configuración en Vercel (5 minutos)

### 3. Configurar Variables en Vercel Dashboard ⚙️

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. **Settings** → **Environment Variables**
4. Agrega **solo la variable crítica**:
   - **Name**: `HUGGINGFACE_API_KEY`
   - **Value**: Tu token de Hugging Face (empieza con `hf_`)
   - **Environment**: ✅ Production, ✅ Preview
5. Haz clic en **Save**

**📖 Guía detallada**: Ver [docs/VERCEL_ENV_SETUP.md](docs/VERCEL_ENV_SETUP.md)

**Tiempo estimado**: 3-5 minutos

---

## Build y Deploy (5-10 minutos)

### 4. Build Local (Opcional pero Recomendado) 🔨

```bash
npm run build
```

**Verificar**: Build debe completarse sin errores.

**Si hay warnings**: Pueden ser aceptables si no son críticos.

**Tiempo estimado**: 2-3 minutos

---

### 5. Deploy a Preview 🚀

```bash
vercel
```

O si ya tienes el proyecto linkeado:

```bash
vercel --preview
```

**Verificar**: 
- Deploy debe completarse exitosamente
- Anota la URL de preview (ej: `https://tu-proyecto-xxx.vercel.app`)

**Tiempo estimado**: 3-5 minutos

---

## Verificación Post-Deploy (5 minutos)

### 6. Health Check ✅

```bash
curl https://tu-proyecto-xxx.vercel.app/api/health
```

**Verificar**: Debe retornar:
```json
{
  "status": "healthy",
  "checks": {
    "indexFile": { "status": "ok" },
    "huggingFace": { "status": "ok" }
  }
}
```

**Si retorna "unhealthy"**: Verificar variables de entorno en Vercel.

---

### 7. Test de API RAG 🧪

```bash
curl -X POST https://tu-proyecto-xxx.vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -d '{"query": "¿Qué es la acción de tutela?"}'
```

**Verificar**: Debe retornar respuesta con `answer` y `citations`.

**Tiempo estimado**: 1-2 minutos

---

### 8. Verificación Automatizada (Opcional) 🤖

```bash
DEPLOY_URL=https://tu-proyecto-xxx.vercel.app npm run deploy-check
```

**Verificar**: Todos los checks deben pasar.

**Tiempo estimado**: 1-2 minutos

---

## Deploy a Producción (2 minutos)

### 9. Deploy a Producción 🎯

Si el preview funciona correctamente:

```bash
vercel --prod
```

O desde Vercel Dashboard:
- Ve a **Deployments**
- Selecciona el deployment de preview
- Haz clic en **"..."** → **"Promote to Production"**

**Tiempo estimado**: 2-3 minutos

---

### 10. Verificación Final ✅

```bash
curl https://tu-proyecto.vercel.app/api/health
```

**Verificar**: Health check debe retornar `healthy`.

**Tiempo estimado**: 1 minuto

---

## Checklist Rápido

Marca cada paso cuando lo completes:

- [ ] **Paso 1**: `npm run pre-deploy-check` - Sin errores
- [ ] **Paso 2**: `npm run verify-env` - Variables documentadas
- [ ] **Paso 3**: Configurar `HUGGINGFACE_API_KEY` en Vercel
- [ ] **Paso 4**: `npm run build` - Build exitoso (opcional)
- [ ] **Paso 5**: `vercel` - Deploy a preview exitoso
- [ ] **Paso 6**: Health check en preview - `healthy`
- [ ] **Paso 7**: Test API RAG en preview - Respuesta válida
- [ ] **Paso 8**: `npm run deploy-check` - Todos los checks pasan (opcional)
- [ ] **Paso 9**: `vercel --prod` - Deploy a producción
- [ ] **Paso 10**: Health check en producción - `healthy`

---

## Troubleshooting Rápido

### Build falla

**Causa común**: Warnings de dependencias no resueltos.

**Solución**: Verificar que se resolvieron los warnings del plan anterior.

---

### Health check retorna "unhealthy"

**Causa común**: `HUGGINGFACE_API_KEY` no configurada o formato incorrecto.

**Solución**:
1. Verificar en Vercel Dashboard → Settings → Environment Variables
2. Verificar que está aplicada a Production y Preview
3. Verificar que el token empieza con `hf_`
4. Hacer nuevo deploy

---

### API RAG no responde

**Causa común**: Timeout o error en Hugging Face API.

**Solución**:
1. Verificar logs en Vercel Dashboard
2. Verificar que `HUGGINGFACE_API_KEY` es válida
3. Verificar que el modelo configurado existe

---

## URLs Importantes

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Hugging Face Tokens**: https://huggingface.co/settings/tokens
- **Documentación Completa**: [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md)
- **Guía de Variables**: [docs/VERCEL_ENV_SETUP.md](docs/VERCEL_ENV_SETUP.md)

---

## Próximos Pasos Después del Deploy

1. **Monitorear**: Ver [docs/MONITORING.md](docs/MONITORING.md)
2. **Configurar dominio personalizado** (opcional)
3. **Configurar alertas** en Vercel Dashboard
4. **Optimizar**: Ajustar rate limits según uso real

---

**Última actualización**: 2024-01-15
