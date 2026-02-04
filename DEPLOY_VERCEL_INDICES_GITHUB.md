# Despliegue en Vercel con Índices RAG desde GitHub Releases

Este documento explica la nueva estrategia de despliegue que utiliza **GitHub Releases** para almacenar los índices pre-generados, evitando regenerarlos en cada build.

## 🎯 Problema resuelto

- ❌ **Antes**: `npm run ingest` tardaba 12-15 minutos, causando timeout en Vercel Free (10 min)
- ✅ **Ahora**: Los índices se descargan desde GitHub Releases en ~2-3 minutos

## 📋 Estrategia

1. Los índices se generan localmente una sola vez con `npm run ingest`
2. Se comprimen y suben a GitHub Releases con `npm run upload-indices`
3. El build de Vercel los descarga con `npm run download-indices` (<3 min)
4. Solo se regeneran cuando actualizas documentos

## 🚀 Configuración inicial (una sola vez)

### 1. Instalar GitHub CLI

```bash
# Ubuntu/Debian
sudo apt install gh

# macOS
brew install gh

# O descarga desde: https://cli.github.com/
```

### 2. Autenticar GitHub CLI

```bash
gh auth login
```

Sigue las instrucciones en pantalla.

### 3. Generar índices localmente

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
npm run ingest
```

Esto genera:
- `data/index.json` (~262 MB)
- `data/bm25-index.json` (~54 MB)

### 4. Subir índices a GitHub Releases

```bash
npm run upload-indices
```

Este script:
- Comprime los índices (~108 MB total comprimido)
- Crea un GitHub Release `indices-v1`
- Sube los archivos comprimidos
- Genera `data/indices-urls.json` con las URLs de descarga

### 5. Commit y push

```bash
git add data/indices-urls.json vercel.json .vercelignore package.json
git commit -m "feat: Use GitHub Releases for RAG indices"
git push origin main
```

## ✅ Verificación en Vercel

El build ahora:

1. **Descarga índices** (~2-3 min):
   ```
   Running "npm run download-indices"
   📥 Descargando index.json.gz...
   📥 Descargando bm25-index.json.gz...
   📦 Descomprimiendo...
   ✅ Índices listos
   ```

2. **Build de Next.js** (~2 min):
   ```
   Running "npm run build"
   ✓ Compiled successfully
   ```

**Tiempo total de build**: ~5 minutos (vs. 12-15 minutos antes)

### Health check

```bash
curl https://col-law-rag.vercel.app/api/health
```

Debería responder:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-04T...",
  "checks": {
    "indexFile": { "status": "ok" },
    "huggingFace": { "status": "ok" }
  }
}
```

## 🔄 Actualizar documentos

Cuando agregues o modifiques documentos en `data/documents/`:

### 1. Regenerar índices localmente

```bash
npm run ingest
```

### 2. Subir nuevos índices

```bash
npm run upload-indices
```

Esto actualizará el release en GitHub automáticamente.

### 3. Commit y push

```bash
git add data/documents/ data/indices-urls.json
git commit -m "docs: Update legal documents"
git push origin main
```

Vercel detectará el push y:
- Descargará los nuevos índices desde GitHub
- Construirá y desplegará la nueva versión

## 📊 Estadísticas

### Tamaños de archivos

| Archivo | Sin comprimir | Comprimido (.gz) |
|---------|---------------|------------------|
| index.json | 262 MB | 89 MB |
| bm25-index.json | 54 MB | 20 MB |
| **Total** | **316 MB** | **109 MB** |

### Tiempos de build

| Etapa | Antes (ingest) | Ahora (download) |
|-------|----------------|------------------|
| Generar/Descargar índices | 12-15 min ⏰ | 2-3 min ✅ |
| Build Next.js | 2 min | 2 min |
| **Total** | **14-17 min** ❌ | **4-5 min** ✅ |

## 🔧 Configuración técnica

### vercel.json

```json
{
  "buildCommand": "npm run download-indices && npm run build"
}
```

### package.json

```json
{
  "scripts": {
    "ingest": "node scripts/ingest.mjs && npm run build-bm25",
    "upload-indices": "node scripts/upload-indices-to-github.mjs",
    "download-indices": "node scripts/download-indices.mjs"
  }
}
```

### .vercelignore

```
# Índices RAG - Se descargan desde GitHub Releases
data/index.json
data/bm25-index.json
data/*.gz

# NO ignorar indices-urls.json (necesario para el build)
!data/indices-urls.json
```

## 📝 Scripts disponibles

### `npm run ingest`
Genera los índices localmente desde los documentos.
- **Cuándo usar**: Cuando agregues/modifiques documentos
- **Tiempo**: 8-12 minutos
- **Requiere**: `HUGGINGFACE_API_KEY` configurado

### `npm run upload-indices`
Comprime y sube los índices a GitHub Releases.
- **Cuándo usar**: Después de regenerar índices localmente
- **Tiempo**: 3-5 minutos
- **Requiere**: GitHub CLI autenticado

### `npm run download-indices`
Descarga índices desde GitHub Releases.
- **Cuándo usar**: En el build de Vercel (automático)
- **Tiempo**: 2-3 minutos
- **Requiere**: `data/indices-urls.json` en el repo

## 🆘 Troubleshooting

### Error: "GitHub CLI no está instalado"

**Solución**:
```bash
# Ubuntu/Debian
sudo apt install gh

# macOS
brew install gh
```

### Error: "GitHub CLI no está autenticado"

**Solución**:
```bash
gh auth login
```

### Error: "Archivo de configuración no encontrado"

**Causa**: Falta `data/indices-urls.json`

**Solución**:
```bash
npm run upload-indices
git add data/indices-urls.json
git commit -m "Add indices URLs config"
git push
```

### Error: "HTTP 404" al descargar índices

**Causa**: El release en GitHub no existe o es privado

**Solución**:
1. Verificar que el repo es público o que Vercel tiene acceso
2. Verificar el release: https://github.com/Codemonster808/ColLawRAG/releases/tag/indices-v1
3. Re-ejecutar: `npm run upload-indices`

### Build todavía hace timeout

**Causa**: Conexión lenta a GitHub o problemas de red

**Solución temporal**:
```bash
# Opción 1: Aumentar timeout en Vercel (requiere Pro)

# Opción 2: Usar CDN más rápido (jsDelivr)
# Editar data/indices-urls.json:
{
  "indexUrl": "https://cdn.jsdelivr.net/gh/Codemonster808/ColLawRAG@indices-v1/index.json.gz",
  "bm25Url": "https://cdn.jsdelivr.net/gh/Codemonster808/ColLawRAG@indices-v1/bm25-index.json.gz"
}
```

## 🎯 Ventajas de esta solución

✅ **Build rápido**: 4-5 minutos vs. 14-17 minutos  
✅ **Sin timeout**: Funciona con Vercel Free (10 min)  
✅ **Gratuito**: GitHub Releases es gratis (hasta 2 GB por archivo)  
✅ **Versionado**: Los índices están versionados en GitHub  
✅ **Reproducible**: Siempre se descargan los mismos índices  
✅ **Eficiente**: Solo regeneras cuando cambias documentos  
✅ **Sin API externa**: No requiere servicios de terceros  

## 📚 Recursos

- GitHub CLI: https://cli.github.com/
- GitHub Releases: https://docs.github.com/en/repositories/releasing-projects-on-github
- Vercel Build Configuration: https://vercel.com/docs/build-step
- Next.js Deployment: https://nextjs.org/docs/deployment

---

**Última actualización**: 2026-02-04  
**Versión del sistema**: ColLawRAG v0.1.0 con GitHub Releases
