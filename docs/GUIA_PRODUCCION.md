# Guía para Llevar el Sistema a Producción

## 📋 Checklist Pre-Deployment

### 1. Variables de Entorno en Vercel

**Acción requerida:** Configurar todas las variables de entorno en el dashboard de Vercel.

#### Variables REQUERIDAS (debes configurarlas):

1. **`HUGGINGFACE_API_KEY`** ⚠️ CRÍTICA
   - Obtener en: https://huggingface.co/settings/tokens
   - Crear un token con permisos de lectura
   - **Sin esto, el sistema NO funcionará**

#### Variables OPCIONALES (recomendadas):

2. **`HF_EMBEDDING_MODEL`**
   - Default: `sentence-transformers/paraphrase-multilingual-mpnet-base-v2`
   - Solo cambiar si quieres usar otro modelo

3. **`HF_GENERATION_MODEL`**
   - Default: `meta-llama/llama-3.3-70b-instruct`
   - Solo cambiar si quieres usar otro modelo

4. **`RAG_API_KEY`** (Recomendado para producción)
   - Generar una clave secreta aleatoria
   - Ejemplo: `openssl rand -hex 32`
   - Protege el endpoint `/api/rag` de acceso no autorizado

5. **`RATE_LIMIT_REQUESTS`**
   - Default: `10` (requests por minuto)
   - Ajustar según tus necesidades

6. **`PIPELINE_TIMEOUT_MS`**
   - Default: `60000` (60 segundos)
   - Aumentar si las queries son muy complejas

7. **`HF_API_TIMEOUT_MS`**
   - Default: `30000` (30 segundos)
   - Ajustar según latencia de Hugging Face

#### Cómo configurar en Vercel:

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto (o créalo si no existe)
3. Ve a **Settings** → **Environment Variables**
4. Agrega cada variable:
   - **Name:** Nombre de la variable (ej: `HUGGINGFACE_API_KEY`)
   - **Value:** Valor de la variable
   - **Environment:** Selecciona:
     - ✅ Production
     - ✅ Preview
     - ✅ Development (opcional)
5. Haz clic en **Save**

**Verificación:** Ejecuta `npm run verify-env` localmente para verificar que tienes todas las variables.

---

### 2. Preparar Base de Conocimiento

**Acción requerida:** Asegurar que `data/index.json` existe y está actualizado.

```bash
# Verificar que existe el índice
ls -lh data/index.json

# Si no existe o quieres actualizarlo:
npm run ingest
```

**Importante:** El archivo `data/index.json` debe estar en el repositorio o ser generado durante el build.

**Opción A:** Incluir `data/index.json` en el repositorio (recomendado para producción)
- Asegúrate de que esté en `.gitignore` solo si es muy grande
- O usa Git LFS si es necesario

**Opción B:** Generar durante el build en Vercel
- Agregar script de build que ejecute `npm run ingest`
- Modificar `package.json`:
  ```json
  {
    "scripts": {
      "build": "npm run ingest && next build"
    }
  }
  ```

---

### 3. Verificar Build Local

**Acción requerida:** Ejecutar build local antes de deployar.

```bash
# Instalar dependencias
npm install

# Verificar variables de entorno
npm run verify-env

# Ejecutar build
npm run build

# Verificar que el build fue exitoso
# Deberías ver: "✓ Compiled successfully"
```

**Si hay errores:**
- Revisar logs de compilación
- Verificar que todas las dependencias estén instaladas
- Verificar que TypeScript compile sin errores

---

### 4. Configurar Vercel Project

**Acción requerida:** Crear/configurar proyecto en Vercel.

#### Si es primera vez:

1. Instalar Vercel CLI (si no lo tienes):
   ```bash
   npm i -g vercel
   ```

2. Login en Vercel:
   ```bash
   vercel login
   ```

3. Inicializar proyecto:
   ```bash
   cd ColLawRAG
   vercel
   ```
   - Sigue las instrucciones interactivas
   - Selecciona tu cuenta/organización
   - Confirma configuración

#### Si ya tienes proyecto:

1. Verificar configuración:
   ```bash
   vercel
   ```

2. Verificar `vercel.json` existe y está correcto:
   ```json
   {
     "framework": "nextjs",
     "buildCommand": "npm run build",
     "devCommand": "npm run dev"
   }
   ```

---

### 5. Deploy a Preview

**Acción requerida:** Hacer deploy a preview primero para probar.

```bash
# Deploy a preview
vercel

# O si quieres especificar:
vercel --env HUGGINGFACE_API_KEY=tu_key_aqui
```

**Después del deploy:**

1. Obtener URL de preview (se mostrará en la terminal)
2. Verificar health check:
   ```bash
   curl https://tu-preview-url.vercel.app/api/health
   ```

3. Ejecutar script de verificación:
   ```bash
   DEPLOY_URL=https://tu-preview-url.vercel.app npm run deploy-check
   ```

**Si hay problemas:**
- Revisar logs en Vercel Dashboard → Deployments → [tu deploy] → Logs
- Verificar que todas las variables de entorno estén configuradas
- Verificar que el build fue exitoso

---

### 6. Probar API en Preview

**Acción requerida:** Probar que la API funciona correctamente.

```bash
# Test básico
curl -X POST https://tu-preview-url.vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -d '{
    "query": "¿Qué es la acción de tutela?",
    "locale": "es"
  }'

# Si tienes RAG_API_KEY configurada:
curl -X POST https://tu-preview-url.vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -H "x-api-key: tu_rag_api_key" \
  -d '{
    "query": "¿Qué es la acción de tutela?",
    "locale": "es"
  }'
```

**Verificar:**
- ✅ Respuesta contiene `answer` y `citations`
- ✅ No hay errores 500
- ✅ Tiempo de respuesta razonable (< 60 segundos)

---

### 7. Deploy a Producción

**Acción requerida:** Una vez que preview funciona, deployar a producción.

```bash
# Deploy a producción
vercel --prod

# O desde el dashboard de Vercel:
# 1. Ve a Deployments
# 2. Encuentra el preview que funcionó
# 3. Haz clic en "Promote to Production"
```

**Después del deploy:**

1. Verificar health check:
   ```bash
   curl https://tu-dominio.vercel.app/api/health
   ```

2. Ejecutar verificación completa:
   ```bash
   DEPLOY_URL=https://tu-dominio.vercel.app npm run deploy-check
   ```

3. Probar API:
   ```bash
   curl -X POST https://tu-dominio.vercel.app/api/rag \
     -H "Content-Type: application/json" \
     -H "x-api-key: tu_rag_api_key" \
     -d '{
       "query": "Test de producción",
       "locale": "es"
     }'
   ```

---

### 8. Configurar Dominio Personalizado (Opcional)

**Acción requerida:** Si quieres usar tu propio dominio.

1. Ve a Vercel Dashboard → Tu Proyecto → Settings → Domains
2. Agrega tu dominio
3. Sigue las instrucciones para configurar DNS
4. Espera a que se propague (puede tomar hasta 24 horas)

---

### 9. Monitoreo y Logging

**Acción requerida:** Configurar monitoreo básico.

#### Vercel Analytics (Recomendado):

1. Ve a Vercel Dashboard → Tu Proyecto → Analytics
2. Habilita Analytics (si está disponible en tu plan)
3. Monitorea:
   - Requests por minuto
   - Tiempo de respuesta
   - Errores

#### Logs:

- Los logs están disponibles en Vercel Dashboard → Deployments → [tu deploy] → Logs
- Revisa regularmente para detectar errores

#### Health Check Monitoring:

Configura un servicio de monitoreo (opcional):
- UptimeRobot (gratis)
- Pingdom
- Cron job que llame a `/api/health` cada 5 minutos

---

### 10. Seguridad Adicional

**Acción requerida:** Revisar y configurar medidas de seguridad.

#### ✅ Ya implementado:
- Rate limiting
- Headers de seguridad
- Validación de entrada
- Timeouts
- API key protection (opcional)

#### ⚠️ Recomendaciones adicionales:

1. **Configurar `RAG_API_KEY`** (si no lo has hecho)
   - Protege el endpoint de acceso público
   - Genera una clave fuerte: `openssl rand -hex 32`

2. **Revisar `ALLOWED_ORIGINS`**
   - Si tienes frontend, configurar CORS correctamente
   - Ejemplo: `ALLOWED_ORIGINS=https://tudominio.com,https://www.tudominio.com`

3. **Limitar tamaño de requests**
   - Ya configurado en `MAX_REQUEST_SIZE` (default: 1MB)
   - Ajustar si es necesario

4. **Revisar rate limits**
   - Ajustar `RATE_LIMIT_REQUESTS` según tu uso esperado
   - Considerar diferentes límites para diferentes endpoints

---

## 🚨 Problemas Comunes y Soluciones

### Error: "HUGGINGFACE_API_KEY not set"

**Solución:**
- Verificar que la variable esté configurada en Vercel Dashboard
- Verificar que esté aplicada a Production environment
- Hacer redeploy después de agregar variables

### Error: "data/index.json not found"

**Solución:**
- Ejecutar `npm run ingest` localmente
- Commitear `data/index.json` al repositorio
- O modificar build para generarlo automáticamente

### Error: Build falla en Vercel

**Solución:**
- Revisar logs de build en Vercel Dashboard
- Verificar que `package.json` tenga todas las dependencias
- Verificar que Node.js version sea compatible (>=18.18.0)

### Error: API retorna 500

**Solución:**
- Revisar logs en Vercel Dashboard
- Verificar que Hugging Face API key sea válida
- Verificar que el modelo especificado exista
- Revisar timeouts (puede ser que la query sea muy compleja)

### Error: Rate limit exceeded

**Solución:**
- Aumentar `RATE_LIMIT_REQUESTS` en variables de entorno
- O implementar sistema de autenticación para usuarios específicos

---

## 📊 Verificación Final

Antes de considerar el sistema "listo para producción", verifica:

- [ ] Todas las variables de entorno configuradas en Vercel
- [ ] `data/index.json` existe y está actualizado
- [ ] Build local funciona sin errores
- [ ] Deploy a preview funciona
- [ ] Health check retorna `healthy`
- [ ] API responde correctamente a queries de prueba
- [ ] Rate limiting funciona
- [ ] Headers de seguridad presentes
- [ ] Logs no muestran errores críticos
- [ ] Tiempo de respuesta aceptable (< 60 segundos)

---

## 🎯 Próximos Pasos Después de Producción

1. **Monitoreo continuo**
   - Revisar logs semanalmente
   - Monitorear métricas de uso
   - Ajustar rate limits según necesidad

2. **Mejoras incrementales**
   - Agregar más documentos a la base de conocimiento
   - Mejorar prompts según feedback
   - Optimizar performance

3. **Escalabilidad**
   - Considerar usar Pinecone para índices grandes
   - Implementar cache más robusto (Redis)
   - Considerar CDN para assets estáticos

---

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs en Vercel Dashboard
2. Ejecuta `npm run verify-env` para verificar variables
3. Ejecuta `npm run deploy-check` para verificar deployment
4. Revisa la documentación en `docs/`

---

**Última actualización:** $(date +%Y-%m-%d)
