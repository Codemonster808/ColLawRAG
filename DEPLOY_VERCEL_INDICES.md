# Despliegue en Vercel con Generación Automática de Índices RAG

Este documento explica cómo desplegar ColLawRAG en Vercel generando los índices RAG automáticamente durante el build, evitando subir archivos pesados a GitHub.

## 🎯 Problema

Los archivos `data/index.json` (262 MB) y `data/bm25-index.json` son demasiado grandes para incluirlos en el repositorio Git. GitHub tiene límites de tamaño de archivos y el repositorio se volvería muy pesado.

## ✅ Solución

Los índices se generan automáticamente en Vercel durante el proceso de build usando el script `npm run ingest`, que:

1. Lee todos los documentos de `data/documents/*.txt` (estos sí están en el repo, ~14 MB total)
2. Genera embeddings usando HuggingFace API
3. Crea `data/index.json` con chunks y embeddings
4. Crea `data/bm25-index.json` con estadísticas BM25

## 📋 Configuración en Vercel

### 1. Variables de entorno requeridas

En **Vercel → Project Settings → Environment Variables**, configurar:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `HUGGINGFACE_API_KEY` | `hf_xxxxxxxxxxxxx` | **OBLIGATORIO** - API key de HuggingFace para generar embeddings |
| `NODE_OPTIONS` | `--max-old-space-size=4096` | **Opcional** - Aumenta memoria disponible si el build falla por OOM |

**Importante**: Sin `HUGGINGFACE_API_KEY` el build fallará porque no podrá generar embeddings.

### 2. Build Command

El archivo `vercel.json` ya está configurado con:

```json
{
  "buildCommand": "npm run ingest && npm run build"
}
```

Esto ejecuta:
1. `npm run ingest` → Genera `data/index.json` y `data/bm25-index.json`
2. `npm run build` → Build de Next.js

### 3. Timeout del build

El proceso de ingest puede tardar **5-15 minutos** dependiendo de:
- Cantidad de documentos (~30 actualmente)
- Velocidad de la API de HuggingFace
- Recursos asignados en Vercel

**Si el build hace timeout:**

#### Opción 1: Aumentar timeout en Vercel (si tu plan lo permite)
1. Ir a **Vercel → Project Settings → General → Build & Development Settings**
2. Buscar **Build Timeout**
3. Aumentar a 15-20 minutos (disponible en planes Pro+)

#### Opción 2: Reducir documentos temporalmente
1. Comentar temporalmente algunos documentos en `scripts/ingest.mjs`
2. Hacer deploy con menos documentos
3. Ir agregando documentos gradualmente

#### Opción 3: Usar pre-build local y subir índices
Si el build en Vercel sigue fallando, puedes:
1. Generar los índices localmente: `npm run ingest`
2. Subir `data/index.json` y `data/bm25-index.json` a Vercel Storage o similar
3. Modificar el código para descargarlos en runtime

## 🚀 Proceso de Despliegue

### Despliegue automático (GitHub)

Si tienes Vercel conectado a tu repositorio GitHub:

1. Hacer cambios en el código
2. Commit y push a `main`:
   ```bash
   git add .
   git commit -m "Update: [descripción]"
   git push origin main
   ```
3. Vercel detecta el push y automáticamente:
   - Ejecuta `npm install`
   - Ejecuta `npm run ingest` (genera índices)
   - Ejecuta `npm run build`
   - Despliega la aplicación

### Despliegue manual (Vercel CLI)

Si prefieres desplegar manualmente:

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG

# Despliegue a producción
vercel --prod

# O despliegue a preview
vercel
```

## ✅ Verificación del Despliegue

Después del despliegue, verificar que todo funciona:

### 1. Health Check

```bash
curl https://[tu-dominio].vercel.app/api/health
```

**Respuesta esperada:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-04T21:44:00.000Z",
  "indexFile": "ok",
  "documentsCount": 30,
  "chunksCount": 11562
}
```

**⚠️ Si `indexFile` es "missing"**: El build no generó los índices correctamente. Revisar logs del build en Vercel.

### 2. Consulta RAG

```bash
curl -X POST https://[tu-dominio].vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -d '{
    "query": "¿Qué es la acción de tutela?",
    "locale": "es"
  }'
```

**Respuesta esperada:**
```json
{
  "answer": "La acción de tutela es un mecanismo constitucional...",
  "citations": [
    {
      "title": "Constitución Política de Colombia",
      "article": "Art. 86",
      "content": "..."
    }
  ],
  "metadata": {
    "legalArea": "constitucional",
    "complexity": "media"
  }
}
```

**⚠️ Si devuelve error 500**: Revisar logs en Vercel para identificar el problema.

### 3. Verificación en Vercel Dashboard

1. Ir a **Vercel → Deployments**
2. Abrir el deployment más reciente
3. Ver **Build Logs** para confirmar:
   ```
   Running "npm run ingest"
   ✓ Indexed 30 documents (11,562 chunks)
   ✓ Generated data/index.json (262 MB)
   ✓ Generated data/bm25-index.json (14 MB)
   
   Running "npm run build"
   ✓ Compiled successfully
   ```

## 🔧 Troubleshooting

### Error: "Build failed - npm run ingest exited with 1"

**Causa**: Falta `HUGGINGFACE_API_KEY` o la API key es inválida.

**Solución**:
1. Verificar que `HUGGINGFACE_API_KEY` está configurada en Vercel
2. Verificar que la key es válida: https://huggingface.co/settings/tokens
3. Redesplegar

### Error: "Build timeout after 10 minutes"

**Causa**: El proceso de ingest tarda más de lo permitido.

**Solución**:
1. Aumentar timeout en Vercel (si tienes plan Pro+)
2. O reducir temporalmente la cantidad de documentos
3. O usar pre-build local

### Error: "JavaScript heap out of memory"

**Causa**: Node se queda sin memoria durante el ingest.

**Solución**:
1. Agregar `NODE_OPTIONS=--max-old-space-size=4096` en Vercel Environment Variables
2. Redesplegar

### Warning: "indexFile: missing" en /api/health

**Causa**: Los índices no se generaron durante el build.

**Solución**:
1. Revisar Build Logs en Vercel
2. Confirmar que `npm run ingest` se ejecutó correctamente
3. Confirmar que `HUGGINGFACE_API_KEY` está configurada
4. Redesplegar

## 📊 Estadísticas del Build

Con la configuración actual (30 documentos):

| Métrica | Valor |
|---------|-------|
| Tiempo de ingest | ~8-12 minutos |
| Memoria utilizada | ~2-3 GB |
| Tamaño de index.json | ~262 MB |
| Tamaño de bm25-index.json | ~14 MB |
| Chunks generados | 11,562 |
| Documentos procesados | 30 |

## 🔄 Actualizar Documentos

Para agregar o actualizar documentos legales:

1. Agregar archivos `.txt` en `data/documents/`
2. Commit y push:
   ```bash
   git add data/documents/
   git commit -m "Add: [nombre del documento]"
   git push origin main
   ```
3. Vercel automáticamente:
   - Re-ejecuta `npm run ingest` con los nuevos documentos
   - Regenera los índices
   - Despliega la versión actualizada

## 📝 Notas Importantes

1. **Los índices NO están en Git**: `data/index.json` y `data/bm25-index.json` están en `.gitignore` por su tamaño.

2. **Los documentos SÍ están en Git**: Los archivos `data/documents/*.txt` (~14 MB) sí se versionan porque son más pequeños.

3. **El ingest se ejecuta en cada build**: Cada vez que hay un deploy, se regeneran los índices desde cero.

4. **Caching**: Vercel puede cachear algunas cosas, pero los índices se regeneran siempre para garantizar que estén actualizados.

5. **Build cost**: Cada build consume minutos de build en Vercel. Con plan gratuito tienes 6,000 min/mes. Un build típico consume ~10-15 minutos.

## 🎯 Checklist de Despliegue

Antes de hacer push a producción:

- [ ] `HUGGINGFACE_API_KEY` configurada en Vercel
- [ ] Opcional: `NODE_OPTIONS=--max-old-space-size=4096` si necesitas más memoria
- [ ] `vercel.json` tiene `"buildCommand": "npm run ingest && npm run build"`
- [ ] Documentos actualizados en `data/documents/`
- [ ] Pruebas locales exitosas: `npm run ingest && npm run dev`

Después del despliegue:

- [ ] `/api/health` devuelve `"status": "healthy"` y `"indexFile": "ok"`
- [ ] `/api/rag` responde correctamente a consultas
- [ ] Build logs muestran ingest exitoso
- [ ] Sin errores en Runtime Logs de Vercel

## 🆘 Soporte

Si encuentras problemas:

1. **Revisar Build Logs** en Vercel Dashboard
2. **Revisar Runtime Logs** en Vercel Dashboard → Functions
3. **Verificar variables de entorno** en Project Settings
4. **Consultar documentación**: 
   - Next.js: https://nextjs.org/docs
   - Vercel: https://vercel.com/docs
   - HuggingFace: https://huggingface.co/docs

---

**Última actualización**: 2026-02-04  
**Versión del sistema**: ColLawRAG v0.1.0
