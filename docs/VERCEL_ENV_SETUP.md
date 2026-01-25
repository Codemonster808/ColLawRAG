# Guía de Configuración de Variables de Entorno en Vercel

Esta guía te ayudará a configurar todas las variables de entorno necesarias en Vercel Dashboard para que el servicio RAG funcione correctamente en producción.

## Prerequisitos

- Cuenta en Vercel (gratis): https://vercel.com
- Proyecto creado en Vercel (o listo para crear)
- API Key de Hugging Face (ver sección siguiente)

---

## Paso 1: Obtener API Key de Hugging Face

### 1.1 Crear cuenta en Hugging Face (si no tienes)

1. Ve a https://huggingface.co/join
2. Crea una cuenta gratuita
3. Verifica tu email

### 1.2 Generar API Token

1. Ve a https://huggingface.co/settings/tokens
2. Haz clic en **"New token"**
3. Completa el formulario:
   - **Name**: `ColLawRAG-Production` (o el nombre que prefieras)
   - **Type**: Selecciona **"Read"** (suficiente para usar la API)
   - **Expiration**: Opcional (puedes dejarlo sin expiración)
4. Haz clic en **"Generate token"**
5. **IMPORTANTE**: Copia el token inmediatamente (empieza con `hf_`)
   - No podrás verlo de nuevo después
   - Guárdalo en un lugar seguro

**Formato del token**: `hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Paso 2: Acceder a Vercel Dashboard

1. Ve a https://vercel.com/dashboard
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto (o créalo si no existe)

---

## Paso 3: Configurar Variables de Entorno

### 3.1 Navegar a Environment Variables

1. En tu proyecto, ve a **Settings** (Configuración)
2. En el menú lateral, haz clic en **Environment Variables**

### 3.2 Agregar Variables Requeridas

#### ⚠️ Variable Crítica: HUGGINGFACE_API_KEY

1. Haz clic en **"Add New"**
2. Completa:
   - **Name**: `HUGGINGFACE_API_KEY`
   - **Value**: Pega tu token de Hugging Face (el que empieza con `hf_`)
   - **Environment**: Selecciona:
     - ✅ **Production**
     - ✅ **Preview**
     - ❌ **Development** (NO seleccionar - esto es para desarrollo local)
3. Haz clic en **Save**

**⚠️ Importante**: Sin esta variable, el servicio NO funcionará.

---

### 3.3 Agregar Variables Opcionales (Recomendadas)

Puedes agregar estas variables para personalizar el comportamiento:

#### Modelos

```
Name: HF_EMBEDDING_MODEL
Value: sentence-transformers/paraphrase-multilingual-mpnet-base-v2
Environment: Production, Preview
```

```
Name: HF_GENERATION_MODEL
Value: meta-llama/llama-3.3-70b-instruct
Environment: Production, Preview
```

```
Name: EMB_PROVIDER
Value: hf
Environment: Production, Preview
```

```
Name: GEN_PROVIDER
Value: hf
Environment: Production, Preview
```

#### Seguridad (Recomendado para Producción)

```
Name: RAG_API_KEY
Value: [generar con: openssl rand -hex 32]
Environment: Production, Preview
```

**Nota**: Si configuras `RAG_API_KEY`, las requests al endpoint `/api/rag` deben incluir el header:
```
x-api-key: <valor_de_RAG_API_KEY>
```

#### Rate Limiting

```
Name: RATE_LIMIT_REQUESTS
Value: 10
Environment: Production, Preview
```

```
Name: RATE_LIMIT_WINDOW_MS
Value: 60000
Environment: Production, Preview
```

#### Timeouts

```
Name: PIPELINE_TIMEOUT_MS
Value: 60000
Environment: Production, Preview
```

```
Name: HF_API_TIMEOUT_MS
Value: 30000
Environment: Production, Preview
```

#### CORS

```
Name: ALLOWED_ORIGINS
Value: *
Environment: Production, Preview
```

**Para producción con dominio específico**:
```
Name: ALLOWED_ORIGINS
Value: https://tudominio.com,https://www.tudominio.com
Environment: Production, Preview
```

---

## Paso 4: Verificar Configuración

### 4.1 Verificar Variables Configuradas

1. En la página de Environment Variables, verifica que:
   - ✅ `HUGGINGFACE_API_KEY` está configurada
   - ✅ Está aplicada a **Production** y **Preview**
   - ✅ El valor no está visible (mostrado como `••••••••`)

### 4.2 Verificar Localmente (Opcional)

Puedes verificar que tienes todas las variables necesarias ejecutando:

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
npm run verify-env
```

Este script te mostrará qué variables están configuradas y cuáles faltan.

---

## Paso 5: Hacer Deploy

Una vez configuradas las variables:

1. **Opción A - Deploy desde CLI**:
   ```bash
   vercel --prod
   ```

2. **Opción B - Deploy desde Dashboard**:
   - Ve a la pestaña **Deployments**
   - Haz clic en **"Redeploy"** en el último deployment
   - O haz push a tu repositorio conectado (si está configurado)

3. **Opción C - Deploy automático desde GitHub**:
   - Si tienes GitHub conectado, cada push a `main` desplegará automáticamente

---

## Paso 6: Verificar Post-Deploy

Después del deploy, verifica que todo funciona:

### 6.1 Health Check

```bash
curl https://tu-proyecto.vercel.app/api/health
```

Debería retornar:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "checks": {
    "indexFile": { "status": "ok" },
    "huggingFace": { "status": "ok" }
  }
}
```

### 6.2 Test de API RAG

```bash
curl -X POST https://tu-proyecto.vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -d '{"query": "¿Qué es la acción de tutela?"}'
```

Debería retornar una respuesta con `answer` y `citations`.

---

## Troubleshooting

### Error: "HUGGINGFACE_API_KEY not configured"

**Causa**: La variable no está configurada o no está aplicada al ambiente correcto.

**Solución**:
1. Ve a Vercel Dashboard → Settings → Environment Variables
2. Verifica que `HUGGINGFACE_API_KEY` existe
3. Verifica que está aplicada a **Production** y **Preview**
4. Si acabas de agregarla, haz un nuevo deploy

---

### Error: "Invalid HUGGINGFACE_API_KEY format"

**Causa**: El token no tiene el formato correcto (debe empezar con `hf_`).

**Solución**:
1. Verifica que copiaste el token completo
2. Genera un nuevo token en Hugging Face
3. Actualiza la variable en Vercel
4. Haz un nuevo deploy

---

### Error: "data/index.json not found"

**Causa**: El archivo de índice no está en el repositorio o no se incluyó en el build.

**Solución**:
1. Verifica que `data/index.json` existe localmente:
   ```bash
   ls -lh data/index.json
   ```
2. Verifica que está en el repositorio:
   ```bash
   git ls-files | grep index.json
   ```
3. Si no está, agrégalo:
   ```bash
   git add data/index.json
   git commit -m "Add index.json"
   git push
   ```

---

### Health Check retorna "unhealthy"

**Diagnóstico**:
```bash
curl https://tu-proyecto.vercel.app/api/health
```

**Verificar**:
- `checks.indexFile.status`: Si es `error`, verifica que `data/index.json` existe
- `checks.huggingFace.status`: Si es `error`, verifica `HUGGINGFACE_API_KEY`

---

### Rate Limit Exceeded en Pruebas

**Causa**: Estás haciendo demasiadas requests muy rápido.

**Solución**:
- Espera 1 minuto entre pruebas
- O aumenta temporalmente `RATE_LIMIT_REQUESTS` en Vercel

---

### Variables no se aplican después del deploy

**Causa**: Las variables se aplican solo a nuevos deploys.

**Solución**:
1. Verifica que las variables están configuradas correctamente
2. Haz un nuevo deploy (Redeploy desde Dashboard o push nuevo)
3. Las variables se aplicarán al nuevo deployment

---

## Checklist de Configuración

Antes de considerar la configuración completa, verifica:

- [ ] `HUGGINGFACE_API_KEY` configurada y aplicada a Production y Preview
- [ ] Variables opcionales configuradas según necesidades
- [ ] Health check retorna `healthy` después del deploy
- [ ] API RAG responde correctamente a consultas de prueba
- [ ] Rate limiting funciona (hacer 11 requests rápidas, el 11vo debe retornar 429)
- [ ] Headers de seguridad presentes (verificar con `curl -I`)

---

## Seguridad

### Mejores Prácticas

1. **Nunca expongas tokens en código o logs**
   - Los tokens deben estar solo en variables de entorno
   - No los incluyas en commits

2. **Rota las API keys periódicamente**
   - Genera nuevos tokens cada 3-6 meses
   - Actualiza en Vercel Dashboard
   - Revoca los tokens antiguos en Hugging Face

3. **Usa diferentes tokens para diferentes ambientes**
   - Token para Production
   - Token diferente para Preview/Staging

4. **Protege el endpoint con RAG_API_KEY en producción**
   - Genera una clave segura: `openssl rand -hex 32`
   - Configura `RAG_API_KEY` en Vercel
   - Usa el header `x-api-key` en tus requests

---

## Recursos Adicionales

- [Documentación de Vercel sobre Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Documentación de Hugging Face API](https://huggingface.co/docs/api-inference)
- [Guía de Deployment Completa](./DEPLOYMENT_CHECKLIST.md)
- [Troubleshooting de Deployment](./DEPLOYMENT_STATUS.md)

---

**Última actualización**: 2024-01-15
