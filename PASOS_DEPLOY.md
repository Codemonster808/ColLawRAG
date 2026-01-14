# 🚀 Pasos para Desplegar RAG Derecho Colombiano en Vercel

## ✅ Pasos Automáticos Completados

Los siguientes pasos ya fueron ejecutados automáticamente:

- ✅ Código commiteado en Git
- ✅ Archivos sensibles excluidos (.gitignore actualizado)
- ✅ Configuración de Vercel creada (vercel.json)
- ✅ Índice vectorial generado (data/index.json - 1.3MB)
- ✅ 10 documentos legales indexados

---

## 📋 Pasos que Requieren tu Acción

### Paso 1: Instalar Vercel CLI (si no está instalado)

Abre una terminal y ejecuta:

```bash
npm install -g vercel
```

**Verificación:**
```bash
vercel --version
```

Si ya está instalado, puedes saltar este paso.

---

### Paso 2: Login en Vercel

Ejecuta en la terminal:

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
vercel login
```

Esto abrirá tu navegador para autenticarte. Si no tienes cuenta:
1. Ve a https://vercel.com/signup
2. Crea una cuenta (puedes usar GitHub, GitLab, o email)
3. Vuelve a ejecutar `vercel login`

---

### Paso 3: Linkear Proyecto con Vercel (Sin Deploy Aún)

**⚠️ IMPORTANTE:** Este paso solo linkea el proyecto. **NO** haremos deploy todavía. Primero debemos configurar las variables de entorno.

#### Opción A: Desde CLI

Ejecuta:

```bash
vercel link
```

**Preguntas que te hará Vercel:**
- `Set up and deploy "~/Documentos/Cursor/ColLawRAG"?` → **Y** (Yes)
- `Which scope do you want to deploy to?` → Selecciona tu cuenta
- `Link to existing project?` → **N** (No, crear nuevo proyecto)
- `What's your project's name?` → `col-law-rag` (o el nombre que prefieras)
- `In which directory is your code located?` → **./** (presiona Enter)
- `Want to override the settings?` → **N** (No)

**Resultado esperado:** Verás el mensaje "🔗 Linked to [tu-proyecto]". Esto crea el archivo `.vercel/project.json`.

**Si ves error de telemetría/Docker:**
Si ves un error como `ENXIO: no such device or address` o `spawn ENOMEM`, **no te preocupes**. El proyecto SÍ se linkeó correctamente si viste "🔗 Linked to...".

**Solución rápida:**
```bash
# Deshabilitar telemetría
export VERCEL_TELEMETRY_DISABLED=1
vercel link
```

#### Opción B: Desde Dashboard (Si CLI da problemas)

1. Ve a https://vercel.com/dashboard
2. Haz clic en **Add New...** → **Project**
3. Si tienes repositorio en GitHub:
   - Selecciona tu repositorio `col-law-rag`
   - Vercel detectará automáticamente Next.js
   - **NO hagas clic en Deploy todavía** - primero configura variables
4. Si NO tienes repositorio:
   - Puedes crear el proyecto manualmente desde el Dashboard
   - O usar `vercel link` después de crear el proyecto

**Verificación:**
```bash
# Verificar que el proyecto está linkeado
ls -la .vercel
cat .vercel/project.json
```

---

### Paso 4: Configurar Variables de Entorno en Vercel

**⚠️ CRÍTICO:** Este paso **DEBE** hacerse **ANTES** de cualquier deploy. Si intentas deployar sin las variables de entorno, verás un error como `Environment Variable "HUGGINGFACE_API_KEY" references Secret "...", which does not exist.`

**📝 Obtener tu Hugging Face API Key:**
1. Ve a https://huggingface.co/settings/tokens
2. Haz clic en **New token**
3. Dale un nombre (ej: "ColLawRAG")
4. Selecciona permisos **Read** (suficiente para la API)
5. Copia el token (empieza con `hf_`)

#### Opción A: Desde el Dashboard (Recomendado)

1. Ve a https://vercel.com/dashboard
2. Haz clic en tu proyecto `col-law-rag`
3. Ve a **Settings** → **Environment Variables**
4. Agrega las siguientes variables una por una:

| Variable | Valor |
|----------|-------|
| `HUGGINGFACE_API_KEY` | `TU_HUGGINGFACE_API_KEY` (obtén tu token en https://huggingface.co/settings/tokens) |
| `HF_EMBEDDING_MODEL` | `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` |
| `HF_GENERATION_MODEL` | `mistralai/Mistral-7B-Instruct-v0.3` |
| `EMB_PROVIDER` | `hf` |
| `GEN_PROVIDER` | `hf` |

5. Para **TODAS** las variables, selecciona **SOLO** estos ambientes:
   - ✅ **Production**
   - ✅ **Preview**
   - ❌ **Development** (NO seleccionar - Development es para desarrollo local con `.env.local`, no para Vercel)

   **Nota:** Las variables de entorno en Vercel son para los deploys en Vercel (Production y Preview). Para desarrollo local, usa un archivo `.env.local` en tu máquina.

6. Haz clic en **Save** después de cada variable

#### Opción B: Desde CLI

**⚠️ IMPORTANTE:** Para **TODAS** las variables, selecciona **SOLO** Production y Preview. **NO** selecciones Development (es para desarrollo local, no para Vercel).

```bash
# Para TODAS las variables, cuando pregunte por ambientes, selecciona:
#   - ✅ Production
#   - ✅ Preview
#   - ❌ Development (NO seleccionar)

vercel env add HUGGINGFACE_API_KEY
# Pega: TU_HUGGINGFACE_API_KEY (obtén tu token en https://huggingface.co/settings/tokens)
# Selecciona: Production, Preview (NO Development)

vercel env add HF_EMBEDDING_MODEL
# Pega: sentence-transformers/paraphrase-multilingual-mpnet-base-v2
# Selecciona: Production, Preview (NO Development)

vercel env add HF_GENERATION_MODEL
# Pega: mistralai/Mistral-7B-Instruct-v0.3
# Selecciona: Production, Preview (NO Development)

vercel env add EMB_PROVIDER
# Pega: hf
# Selecciona: Production, Preview (NO Development)

vercel env add GEN_PROVIDER
# Pega: hf
# Selecciona: Production, Preview (NO Development)
```

**Nota:** Development en Vercel es para desarrollo local usando `vercel dev`. Si necesitas variables de entorno localmente, créalas en un archivo `.env.local` en tu proyecto.

**✅ Verificación:** Una vez agregadas todas las variables, deberías ver 5 variables en la lista (HUGGINGFACE_API_KEY, HF_EMBEDDING_MODEL, HF_GENERATION_MODEL, EMB_PROVIDER, GEN_PROVIDER).

---

### Paso 5: Primer Deploy (Preview)

**Ahora sí podemos hacer el deploy.** Las variables de entorno ya están configuradas.

#### Opción A: Desde CLI

```bash
# Si tienes problemas con telemetría
export VERCEL_TELEMETRY_DISABLED=1

# Deploy preview
vercel --prod=false
```

O simplemente:

```bash
vercel
```

Esto creará un deploy de preview. Anota la URL que te dé (algo como `https://col-law-rag-xxxxx.vercel.app`)

#### Opción B: Desde Dashboard

1. Ve a https://vercel.com/dashboard
2. Haz clic en tu proyecto `col-law-rag`
3. Haz clic en **Deploy** (si no aparece, ve a **Deployments** → **Create Deployment**)
4. Espera a que termine el build (3-5 minutos)

**Si ves errores durante el build:**
- Revisa los logs en el Dashboard
- Verifica que todas las variables de entorno estén configuradas
- Asegúrate de que `data/index.json` esté en el repositorio

---

### Paso 6: Deploy a Producción

Una vez que el deploy preview funcione correctamente:

```bash
vercel --prod
```

O desde el Dashboard:
1. Ve a **Deployments**
2. Haz clic en los tres puntos (...) del último deploy
3. Selecciona **Promote to Production**

Esto desplegará tu aplicación a producción. Te dará una URL como:
`https://col-law-rag.vercel.app`

---

### Paso 7: Verificar el Deploy

1. Visita la URL de producción
2. Prueba una consulta:
   - "Ley laboral colombiana sobre horas extras"
   - "¿Qué es la acción de tutela?"
   - "Requisitos de la acción de cumplimiento"

**Si ves errores:**
- Revisa los logs en Vercel Dashboard → **Deployments** → Click en el último deploy → **Functions** → Ver logs
- Verifica que todas las variables de entorno estén configuradas
- Asegúrate de que `data/index.json` esté en el repositorio (debe estar commiteado)

---

## 🔗 Conectar con GitHub (Opcional pero Recomendado)

Para deploys automáticos cada vez que hagas push:

### 1. Crear Repositorio en GitHub

```bash
# Si no tienes repositorio remoto
git remote add origin https://github.com/TU_USUARIO/col-law-rag.git
git branch -M main
git push -u origin main
```

### 2. Conectar en Vercel

1. Ve a Vercel Dashboard
2. **Settings** → **Git**
3. **Connect Git Repository**
4. Selecciona GitHub y autoriza
5. Selecciona el repositorio `col-law-rag`
6. Vercel detectará automáticamente Next.js y desplegará

**Beneficio:** Cada `git push` desplegará automáticamente.

---

## 🐛 Troubleshooting

### Error: "ENXIO: no such device or address" o "spawn ENOMEM" en Paso 3

Este error ocurre cuando Vercel CLI intenta enviar telemetría y encuentra problemas con Docker o recursos del sistema. **¡Buenas noticias!** Si viste el mensaje "🔗 Linked to...", el proyecto SÍ se configuró correctamente.

**Soluciones:**

1. **Deshabilitar telemetría:**
   ```bash
   export VERCEL_TELEMETRY_DISABLED=1
   vercel link  # O vercel --prod=false para deploy
   ```

2. **Usar Dashboard de Vercel (Recomendado):**
   - Ve a https://vercel.com/dashboard
   - El proyecto `col-law-rag` debería aparecer en tu lista
   - Configura las variables de entorno (Paso 4)
   - Luego haz clic en **Deploy**

3. **Verificar estado del proyecto:**
   ```bash
   # Verificar que el proyecto está linkeado
   cat .vercel/project.json
   
   # Si existe, puedes continuar con el Paso 4 (variables) y luego deployar
   ```

4. **Si Docker está causando problemas:**
   ```bash
   # Cerrar Docker Desktop si está corriendo
   # O ignorar el error y continuar con el Dashboard
   ```

**Importante:** Este error NO impide el linkeo ni el deploy. El proyecto está linkeado y puedes continuar con el Paso 4.

### Error: "data/index.json not found"

**Solución:**
```bash
# Verifica que esté en el commit
git ls-files | grep index.json

# Si no está, agrégalo
git add data/index.json
git commit -m "Add index.json"
git push
```

### Error: "HUGGINGFACE_API_KEY not set"

**Solución:**
1. Verifica en Vercel Dashboard → Settings → Environment Variables
2. Asegúrate de que esté en **Production** y **Preview** (NO Development)
3. Si acabas de agregar variables, haz un nuevo deploy:
   ```bash
   vercel --prod=false  # Para preview
   # O
   vercel --prod        # Para producción
   ```

### Error: "Command 'npm run build' exited with 1"

Este error indica un problema de compilación TypeScript o de build. Para diagnosticarlo:

**1. Ejecuta el build localmente para ver el error específico:**
```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
npm run build
```

**2. Errores comunes y soluciones:**

- **Error de tipos TypeScript:**
  - Revisa los mensajes de error en la salida del build
  - Los errores más comunes están en `lib/embeddings.ts` o archivos de tipos
  - Asegúrate de que todos los tipos estén correctamente definidos

- **Dependencias faltantes:**
  ```bash
  npm install
  ```

- **Problemas con `data/index.json`:**
  - Asegúrate de que el archivo existe: `ls -la data/index.json`
  - Si no existe, ejecuta: `npm run ingest`

**3. Si el build funciona localmente pero falla en Vercel:**
- Verifica que todas las dependencias estén en `package.json` (no solo en `node_modules`)
- Revisa los logs detallados en Vercel Dashboard → Deployments → [tu deploy] → Build Logs

### Error: Build timeout

**Solución:**
- El build puede tardar 3-5 minutos la primera vez
- Si supera 45 minutos, verifica los logs
- Considera optimizar el tamaño de `data/index.json` si crece mucho

### Error: Function size exceeded

**Solución:**
- Vercel tiene límite de 50MB por función
- Si `data/index.json` crece mucho, considera migrar a Pinecone
- Por ahora, 1.3MB está bien dentro del límite

### Error: "api-inference.huggingface.co is no longer supported"

**Síntoma:** La aplicación no devuelve resultados y en los logs aparece:
```
Error: "https://api-inference.huggingface.co is no longer supported. Please use https://router.huggingface.co instead."
```

**Solución:**
Este error ya está corregido en el código. El SDK de Hugging Face ahora usa el nuevo endpoint `router.huggingface.co` automáticamente. Si ves este error:

1. **Asegúrate de tener la versión más reciente del SDK:**
   ```bash
   npm install @huggingface/inference@latest
   ```

2. **Verifica que el código esté actualizado:**
   - Los archivos `lib/generation.ts` y `lib/embeddings.ts` ya están configurados para usar el nuevo endpoint
   - El script `scripts/ingest.mjs` también está actualizado

3. **Haz un nuevo deploy:**
   ```bash
   git add .
   git commit -m "Fix: Update Hugging Face endpoint to router.huggingface.co"
   git push
   # O
   vercel --prod
   ```

**Nota:** Este fix ya está incluido en el código actual. Si aún ves el error, asegúrate de que el deploy incluya los cambios más recientes.

---

## 📊 Verificación Final

Después del deploy exitoso, deberías poder:

- ✅ Acceder a la URL de producción
- ✅ Ver la interfaz de búsqueda
- ✅ Hacer consultas en español
- ✅ Recibir respuestas con citas
- ✅ Ver las fuentes legales referenciadas

---

## 🎯 Próximos Pasos (Opcional)

Una vez en producción, puedes:

1. **Agregar más documentos:**
   ```bash
   npm run ingest
   git add data/index.json
   git commit -m "Update index with new documents"
   git push
   ```

2. **Migrar a Pinecone** (para mejor rendimiento):
   - Crea cuenta en https://pinecone.io
   - Obtén API key
   - Configura `PINECONE_API_KEY` y `PINECONE_INDEX` en Vercel
   - Re-ejecuta `npm run ingest`

3. **Agregar dominio personalizado:**
   - Vercel Dashboard → Settings → Domains
   - Agrega tu dominio

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs en Vercel Dashboard
2. Verifica que todas las variables de entorno estén configuradas
3. Asegúrate de que Node.js >= 18.18 (Vercel lo maneja automáticamente)

---

**¡Listo! Tu RAG de Derecho Colombiano estará en producción en ~10 minutos.** 🚀

