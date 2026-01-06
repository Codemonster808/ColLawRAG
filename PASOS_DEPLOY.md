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

### Paso 3: Primer Deploy (Preview)

Ejecuta:

```bash
vercel
```

**Preguntas que te hará Vercel:**
- `Set up and deploy "~/Documentos/Cursor/ColLawRAG"?` → **Y** (Yes)
- `Which scope do you want to deploy to?` → Selecciona tu cuenta
- `Link to existing project?` → **N** (No, crear nuevo proyecto)
- `What's your project's name?` → `col-law-rag` (o el nombre que prefieras)
- `In which directory is your code located?` → **./** (presiona Enter)
- `Want to override the settings?` → **N** (No)

Esto creará un deploy de preview. Anota la URL que te dé (algo como `https://col-law-rag-xxxxx.vercel.app`)

---

### Paso 4: Configurar Variables de Entorno en Vercel

**IMPORTANTE:** Este paso es crítico para que la aplicación funcione.

#### Opción A: Desde el Dashboard (Recomendado)

1. Ve a https://vercel.com/dashboard
2. Haz clic en tu proyecto `col-law-rag`
3. Ve a **Settings** → **Environment Variables**
4. Agrega las siguientes variables una por una:

| Variable | Valor |
|----------|-------|
| `HUGGINGFACE_API_KEY` | `TU_HUGGINGFACE_API_KEY` |
| `HF_EMBEDDING_MODEL` | `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` |
| `HF_GENERATION_MODEL` | `mistralai/Mistral-7B-Instruct-v0.3` |
| `EMB_PROVIDER` | `hf` |
| `GEN_PROVIDER` | `hf` |

5. Para cada variable, selecciona los ambientes:
   - ✅ **Production**
   - ✅ **Preview**
   - ✅ **Development**

6. Haz clic en **Save** después de cada variable

#### Opción B: Desde CLI

```bash
vercel env add HUGGINGFACE_API_KEY
# Pega: TU_HUGGINGFACE_API_KEY
# Selecciona: Production, Preview, Development

vercel env add HF_EMBEDDING_MODEL
# Pega: sentence-transformers/paraphrase-multilingual-mpnet-base-v2
# Selecciona: Production, Preview, Development

vercel env add HF_GENERATION_MODEL
# Pega: mistralai/Mistral-7B-Instruct-v0.3
# Selecciona: Production, Preview, Development

vercel env add EMB_PROVIDER
# Pega: hf
# Selecciona: Production, Preview, Development

vercel env add GEN_PROVIDER
# Pega: hf
# Selecciona: Production, Preview, Development
```

---

### Paso 5: Deploy a Producción

Una vez configuradas las variables de entorno:

```bash
vercel --prod
```

Esto desplegará tu aplicación a producción. Te dará una URL como:
`https://col-law-rag.vercel.app`

---

### Paso 6: Verificar el Deploy

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
2. Asegúrate de que esté en Production, Preview y Development
3. Haz un nuevo deploy después de agregar variables

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

