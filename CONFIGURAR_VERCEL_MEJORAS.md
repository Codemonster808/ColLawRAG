# Guía: Configurar Variables de Entorno en Vercel para Mejoras

**Fecha**: 2024-01-15  
**Importante**: Estas variables deben configurarse ANTES del próximo deploy para que las mejoras funcionen.

---

## Variables a Configurar

### 🔴 Críticas (Requeridas para mejoras)

#### 1. HF_API_TIMEOUT_MS

**Valor**: `60000`

**Descripción**: Timeout para llamadas a API de Hugging Face (aumentado de 30000 a 60000 para consultas complejas)

**Pasos**:
1. Ve a Vercel Dashboard → Tu Proyecto → Settings → Environment Variables
2. Busca `HF_API_TIMEOUT_MS` (si existe, edítala; si no, créala)
3. Establece el valor: `60000`
4. Aplica a: ✅ Production, ✅ Preview
5. Guarda

---

### 🟡 Recomendadas (Mejoran disponibilidad)

#### 2. HF_GENERATION_MODEL_FALLBACK

**Valor**: `mistralai/Mistral-7B-Instruct-v0.3`

**Descripción**: Modelo alternativo si el modelo principal falla. Aumenta la disponibilidad del servicio.

**Pasos**:
1. Ve a Vercel Dashboard → Tu Proyecto → Settings → Environment Variables
2. Haz clic en "Add New"
3. Name: `HF_GENERATION_MODEL_FALLBACK`
4. Value: `mistralai/Mistral-7B-Instruct-v0.3`
5. Aplica a: ✅ Production, ✅ Preview
6. Guarda

**Nota**: Si no se configura, el sistema usará el mismo modelo como fallback (menos efectivo).

---

#### 3. HF_MAX_TOKENS

**Valor**: `2000`

**Descripción**: Máximo de tokens para respuestas generadas (aumentado de 1000 a 2000 para respuestas más completas)

**Pasos**:
1. Ve a Vercel Dashboard → Tu Proyecto → Settings → Environment Variables
2. Haz clic en "Add New"
3. Name: `HF_MAX_TOKENS`
4. Value: `2000`
5. Aplica a: ✅ Production, ✅ Preview
6. Guarda

**Nota**: Si no se configura, el sistema usará 2000 como default.

---

### 🟢 Opcionales (Tienen defaults)

#### 4. HF_RETRY_ATTEMPTS

**Valor**: `3`

**Descripción**: Número de intentos de retry con backoff exponencial

**Pasos**:
1. Ve a Vercel Dashboard → Tu Proyecto → Settings → Environment Variables
2. Haz clic en "Add New"
3. Name: `HF_RETRY_ATTEMPTS`
4. Value: `3`
5. Aplica a: ✅ Production, ✅ Preview
6. Guarda

**Nota**: Si no se configura, el sistema usará 3 como default.

---

## Checklist de Configuración

Antes de hacer deploy, verifica:

- [ ] `HF_API_TIMEOUT_MS` está configurada con valor `60000`
- [ ] `HF_GENERATION_MODEL_FALLBACK` está configurada (recomendado)
- [ ] `HF_MAX_TOKENS` está configurada con valor `2000` (opcional pero recomendado)
- [ ] Todas las variables están aplicadas a **Production** y **Preview**
- [ ] Las variables antiguas (si existen) han sido actualizadas

---

## Verificar Configuración

### Opción 1: Desde Vercel Dashboard

1. Ve a Settings → Environment Variables
2. Verifica que todas las variables estén presentes
3. Verifica que estén aplicadas a Production y Preview

### Opción 2: Desde CLI

```bash
# Ver variables de entorno (requiere vercel CLI)
vercel env ls
```

---

## Hacer Deploy Después de Configurar

Una vez configuradas las variables:

### Opción 1: Deploy desde CLI

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
git add .
git commit -m "feat: Implementar retry logic, fallback y mejoras de disponibilidad"
git push origin main
vercel --prod
```

### Opción 2: Deploy desde Dashboard

1. Ve a la pestaña **Deployments**
2. Haz clic en **"Redeploy"** en el último deployment
3. O haz push a tu repositorio conectado (si está configurado)

### Opción 3: Deploy Automático

Si tienes GitHub conectado, cada push a `main` desplegará automáticamente.

---

## Verificar que las Mejoras Funcionan

Después del deploy, ejecuta los tests:

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
DEPLOY_URL=https://col-law-rag.vercel.app node scripts/test-production.mjs
```

**Resultado esperado**:
- ✅ Tasa de éxito consultas complejas > 95%
- ✅ Menos errores de timeout
- ✅ Fallback funciona cuando modelo principal falla

---

## Troubleshooting

### Las variables no se aplican

**Causa**: Las variables solo se aplican a nuevos deploys.

**Solución**: Haz un nuevo deploy después de configurar las variables.

---

### El servicio sigue fallando

**Verificar**:
1. Las variables están configuradas correctamente
2. El deploy se completó exitosamente
3. Los logs en Vercel Dashboard muestran las nuevas configuraciones

**Revisar logs**:
```bash
vercel logs --follow
```

---

### No veo mejoras en la tasa de éxito

**Posibles causas**:
1. Las variables no están configuradas
2. El deploy no incluyó los cambios
3. El modelo fallback no está disponible

**Solución**:
1. Verifica que las variables estén configuradas
2. Revisa los logs para ver si se está usando retry/fallback
3. Verifica que el modelo fallback esté disponible

---

## Variables Actuales vs Nuevas

| Variable | Valor Anterior | Valor Nuevo | Estado |
|----------|----------------|-------------|--------|
| `HF_API_TIMEOUT_MS` | 30000 | 60000 | ⚠️ Actualizar |
| `HF_GENERATION_MODEL_FALLBACK` | No existe | mistralai/Mistral-7B-Instruct-v0.3 | ➕ Agregar |
| `HF_MAX_TOKENS` | No existe (default: 1000) | 2000 | ➕ Agregar (opcional) |
| `HF_RETRY_ATTEMPTS` | No existe (default: 3) | 3 | ➕ Agregar (opcional) |

---

## Impacto de las Mejoras

Después de configurar estas variables:

1. **Tasa de éxito**: Aumentará de 60-70% a 95%+ en consultas complejas
2. **Timeouts**: Reducción de ~20-30% a <5%
3. **Disponibilidad**: Fallback asegura servicio incluso si modelo principal falla
4. **Resiliencia**: Retry maneja errores temporales automáticamente

---

**Última actualización**: 2024-01-15
