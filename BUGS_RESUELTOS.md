# 🐛 Bugs Resueltos - Historial de Correcciones

Este documento registra todos los bugs encontrados y resueltos durante el desarrollo y deployment del proyecto ColLawRAG, para evitar resolver los mismos errores múltiples veces.

---

## 📋 Índice de Bugs

1. [Error de importación LRU Cache](#1-error-de-importación-lru-cache)
2. [Versión de Node.js incompatible](#2-versión-de-nodejs-incompatible)
3. [Variables de entorno no cargadas en scripts](#3-variables-de-entorno-no-cargadas-en-scripts)
4. [ReferenceError en scraper](#4-referenceerror-en-scraper)
5. [Git ignore excluyendo test script](#5-git-ignore-excluyendo-test-script)
6. [Errores de TypeScript en Vercel build](#6-errores-de-typescript-en-vercel-build)
7. [Límite de tamaño de funciones serverless (250 MB)](#7-límite-de-tamaño-de-funciones-serverless-250-mb)
8. [Índices RAG no disponibles en runtime de Vercel](#8-índices-rag-no-disponibles-en-runtime-de-vercel)

---

## 1. Error de importación LRU Cache

### ❌ Error
```
TypeError: lru_cache__WEBPACK_IMPORTED_MODULE_2__.default is not a constructor
```

### 🔍 Causa
El paquete `lru-cache` se importaba como default import (`import LRUCache from 'lru-cache'`), pero en la versión instalada se debe usar named import.

### ✅ Solución
**Archivo**: `app/api/rag/route.ts`

**Cambio**:
```typescript
// Antes
import LRUCache from 'lru-cache'

// Después
import { LRUCache } from 'lru-cache'
```

### 📝 Notas
- Verificar siempre la documentación del paquete para el tipo de import correcto
- En Node.js moderno, muchos paquetes usan named exports en lugar de default exports

---

## 2. Versión de Node.js incompatible

### ❌ Error
```
Node.js version >= v18.17.0 is required.
```

### 🔍 Causa
El proyecto requiere Node.js 18.17.0 o superior, pero el sistema tenía una versión anterior.

### ✅ Solución
**Instrucciones proporcionadas al usuario**:
1. Actualizar Node.js usando `nvm`:
   ```bash
   nvm install 20
   nvm use 20
   ```
2. O usando `apt`:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
3. Reinstalar dependencias:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### 📝 Notas
- El `package.json` especifica `"engines": { "node": "20.x" }`
- Vercel respeta esta configuración y usa Node 20.x automáticamente

---

## 3. Variables de entorno no cargadas en scripts

### ❌ Error
```
❌ Error: EMB_PROVIDER=hf requiere HUGGINGFACE_API_KEY
```

### 🔍 Causa
El script `scripts/ingest.mjs` se ejecutaba directamente y no cargaba las variables de entorno desde `.env.local`.

### ✅ Solución
**Archivo**: `scripts/ingest.mjs`

**Cambio**: Agregar carga de `.env.local` al inicio del script:
```javascript
// Cargar variables de entorno desde .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '')
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
  }
}
```

### 📝 Notas
- Los scripts ejecutados directamente con `node` no cargan automáticamente `.env.local`
- Next.js solo carga `.env.local` para procesos de Next.js (dev, build, start)
- Para scripts independientes, siempre cargar manualmente las variables de entorno

---

## 4. ReferenceError en scraper

### ❌ Error
```
ReferenceError: scrapeCorteConstitucional is not defined
```

### 🔍 Causa
Las funciones `scrapeCorteConstitucional`, `scrapeCorteSuprema`, y `scrapeConsejoEstado` se llamaban antes de ser definidas en el script.

### ✅ Solución
**Archivo**: `scripts/scrape-colombia-legal.mjs`

**Cambio**: Mover las definiciones de funciones ANTES de su primera llamada en `main()`:
```javascript
// Definir funciones primero
async function scrapeCorteConstitucional() { ... }
async function scrapeCorteSuprema() { ... }
async function scrapeConsejoEstado() { ... }

// Luego llamarlas en main()
async function main() {
  await scrapeCorteConstitucional()
  // ...
}
```

### 📝 Notas
- En JavaScript, las funciones declaradas con `function` se elevan (hoisting), pero las funciones async/arrow functions no
- Siempre definir funciones antes de usarlas, especialmente en scripts modulares

---

## 5. Git ignore excluyendo test script

### ❌ Error
```
git add . ignored scripts/test-production.mjs
```

### 🔍 Causa
El `.gitignore` tenía una regla `**/test-*.mjs` que excluía todos los scripts que empiezan con `test-`, incluyendo `test-production.mjs` que es necesario para CI/CD.

### ✅ Solución
**Archivo**: `.gitignore`

**Cambio**: Agregar excepción después de la regla general:
```
**/test-*.mjs
# Excepción: script de testing de producción (necesario para CI/CD)
!scripts/test-production.mjs
```

### 📝 Notas
- Las reglas de negación (`!`) deben ir DESPUÉS de las reglas de exclusión
- Git procesa `.gitignore` de arriba hacia abajo, la última regla que coincida gana

---

## 6. Errores de TypeScript en Vercel build

### ❌ Errores

#### 6.1. Prefer const
```
Error: 'queryText' is never reassigned. Use 'const' instead.
```

**Archivo**: `app/api/rag/route.ts`

**Solución**:
```typescript
// Antes
let queryText = ''
// ... más tarde
queryText = query

// Después
const queryText = query // Inicializar directamente con el valor correcto
```

#### 6.2. Require vs Import
```
Error: A require() style import is forbidden.
```

**Archivo**: `lib/tiers.ts`

**Solución**:
```typescript
// Antes
const { createUser } = require('./auth')

// Después
import { createUser } from './auth'
```

#### 6.3. Type mismatches en vigencia-normas.ts

**Errores**:
1. `Type 'string' is not assignable to type '"codigo" | "ley" | ...'`
2. `Type 'string' is not assignable to type '"modificacion" | "adicion" | ...'`
3. `Argument of type 'string' is not assignable to parameter of type '"vigente" | "derogada" | ...'`

**Archivo**: `scripts/vigencia-normas.ts`

**Solución**: Agregar type assertions explícitas:
```typescript
// Para tipo de norma
crearNorma({
  tipo: tipo as NormaVigencia['tipo'],
  // ...
})

// Para tipo de modificación
registrarModificacion({
  tipo: tipo as Modificacion['tipo'],
  // ...
})

// Para estado de vigencia
filtrarPorEstado(estado as 'vigente' | 'derogada' | 'parcialmente_derogada', fecha)
```

**También**: Cambiar `tiposValidos` a `as const` para mejor type inference:
```typescript
const tiposValidos = ['codigo', 'ley', ...] as const
```

### 📝 Notas
- Vercel ejecuta TypeScript strict checks durante el build
- Los errores de tipo deben resolverse con type assertions cuando el valor viene de runtime (CLI args, user input)
- Preferir `as const` para arrays de literales para mejor type inference

---

## 7. Límite de tamaño de funciones serverless (250 MB)

### ❌ Error
```
Error: A Serverless Function has exceeded the unzipped maximum size of 250 MB.
```

### 🔍 Causa
Los archivos `data/index.json` (261 MB) y `data/bm25-index.json` (54 MB) se incluían en el bundle de las funciones serverless, excediendo el límite de 250 MB de Vercel.

### ✅ Solución

#### 7.1. Configuración de Next.js
**Archivo**: `next.config.mjs`

**Cambios**:
1. Excluir archivos grandes del tracing por defecto:
```javascript
outputFileTracingExcludes: {
  '*': [
    './data/index.json',
    './data/bm25-index.json',
    './data/old-documents-backup/**',
    './node_modules/onnxruntime-node/**',
    './node_modules/sharp/vendor/**',
  ],
}
```

2. Incluir solo los archivos comprimidos (.gz) para rutas específicas:
```javascript
outputFileTracingIncludes: {
  '/api/rag': ['./data/index.json.gz', './data/bm25-index.json.gz'],
  '/api/health': ['./data/index.json.gz'],
  '/api/debug': ['./data/index.json.gz', './data/bm25-index.json.gz'],
}
```

#### 7.2. Script de descarga
**Archivo**: `scripts/download-indices.mjs`

**Cambio**: No descomprimir en Vercel:
```javascript
if (IS_VERCEL) {
  // En Vercel: NO descomprimir. Se hará en runtime desde .gz
  console.log(`✅ ¡Índices descargados exitosamente! (modo Vercel - solo .gz)`)
  // NO llamar a decompressFile()
} else {
  // Local: descomprimir normalmente
  await decompressFile(indexGzPath, INDEX_PATH, 'index.json')
}
```

#### 7.3. Runtime decompression
**Archivo**: `lib/retrieval.ts`

**Cambio**: Descomprimir en memoria al cargar:
```typescript
function loadLocalIndex(): DocumentChunk[] {
  if (cachedLocalIndex) return cachedLocalIndex

  const indexPath = path.join(process.cwd(), 'data', 'index.json')
  const gzPath = indexPath + '.gz'

  // 1. Intentar archivo descomprimido (dev local)
  if (fs.existsSync(indexPath)) {
    cachedLocalIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
    return cachedLocalIndex
  }

  // 2. Intentar archivo .gz (Vercel serverless) - descomprimir en memoria
  if (fs.existsSync(gzPath)) {
    const compressed = fs.readFileSync(gzPath)
    const decompressed = gunzipSync(compressed)
    cachedLocalIndex = JSON.parse(decompressed.toString('utf-8'))
    return cachedLocalIndex
  }

  return []
}
```

#### 7.4. Health check
**Archivo**: `app/api/health/route.ts`

**Cambio**: Verificar ambos formatos:
```typescript
const jsonExists = fs.existsSync(indexPath)
const gzExists = fs.existsSync(gzPath)

if (!jsonExists && !gzExists) {
  return { status: 'error', message: '...' }
}

if (gzExists) {
  // Validar que el .gz es válido (intentar descomprimir)
  try {
    const compressed = fs.readFileSync(gzPath)
    const decompressed = gunzipSync(compressed)
    JSON.parse(decompressed.toString('utf-8'))
  } catch (e) {
    return { status: 'error', message: 'index.json.gz is corrupted' }
  }
}
```

#### 7.5. Postbuild script
**Archivo**: `package.json`

**Cambio**: Aceptar ambos formatos:
```json
"postbuild": "test -f data/index.json || test -f data/index.json.gz || echo '⚠️  data/index.json(.gz) no encontrado...'"
```

### 📝 Notas
- Vercel tiene límite de 250 MB **descomprimido** por función serverless
- Los archivos `.gz` reducen el tamaño de ~315 MB a ~108 MB
- La descompresión en memoria agrega ~2-3 segundos al primer request (cold start)
- Después del primer request, el índice está cacheado en memoria

---

## 8. Índices RAG no disponibles en runtime de Vercel

### ❌ Error
- `/api/debug` reporta: `indexGz: "NOT FOUND"`, `bm25Gz: "NOT FOUND"`
- `/api/rag` retorna: `retrieved: 0`, `citations: []`

### 🔍 Causa
Aunque los archivos `.gz` se descargan durante el build (`npm run download-indices`), **no están disponibles en el runtime** de las funciones serverless porque:

1. `.vercelignore` excluía `data/*.gz` del workspace de build
2. `outputFileTracingIncludes` no garantiza que los archivos persistan en runtime
3. Vercel puede limpiar archivos del workspace después del build

### ✅ Solución

#### 8.1. Actualizar .vercelignore
**Archivo**: `.vercelignore`

**Cambio**: Permitir archivos `.gz` de índices:
```
# Índices RAG - Se descargan desde GitHub Releases en el build
data/index.json
data/bm25-index.json
data/*.gz
# Excepciones: los índices comprimidos SON necesarios en producción
!data/index.json.gz
!data/bm25-index.json.gz
```

#### 8.2. Fallback de descarga en runtime
**Archivo**: `lib/retrieval.ts`

**Cambio**: Si no encuentra los archivos en `data/`, descargarlos en runtime a `/tmp`:
```typescript
async function downloadIndexIfMissing(): Promise<void> {
  const indexPath = path.join(process.cwd(), 'data', 'index.json')
  const gzPath = indexPath + '.gz'
  const tmpGzPath = path.join('/tmp', 'index.json.gz')

  // Si ya existe en data/ o /tmp, no hacer nada
  if (fs.existsSync(indexPath) || fs.existsSync(gzPath) || fs.existsSync(tmpGzPath)) {
    return
  }

  // Cargar configuración de URLs
  const configPath = path.join(process.cwd(), 'data', 'indices-urls.json')
  if (!fs.existsSync(configPath)) {
    console.warn('[retrieval] indices-urls.json no encontrado, no se puede descargar índices')
    return
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  
  // Descargar a /tmp
  console.log('[retrieval] Descargando índices a /tmp (runtime fallback)...')
  await downloadFile(config.indexUrl, tmpGzPath, 'index.json.gz')
  await downloadFile(config.bm25Url, path.join('/tmp', 'bm25-index.json.gz'), 'bm25-index.json.gz')
}

// Modificar loadLocalIndex para buscar también en /tmp
function loadLocalIndex(): DocumentChunk[] {
  // ... código existente ...
  
  // 3. Intentar /tmp (runtime fallback)
  const tmpGzPath = path.join('/tmp', 'index.json.gz')
  if (fs.existsSync(tmpGzPath)) {
    console.log('[retrieval] Cargando desde /tmp/index.json.gz...')
    const compressed = fs.readFileSync(tmpGzPath)
    const decompressed = gunzipSync(compressed)
    cachedLocalIndex = JSON.parse(decompressed.toString('utf-8'))
    return cachedLocalIndex
  }
  
  return []
}
```

### 📝 Notas
- El fallback de descarga en runtime agrega latencia al primer request (~10-15 segundos)
- Los archivos en `/tmp` persisten durante la vida de la función serverless (warm invocations)
- Después del primer request, el índice está cacheado en memoria
- Esta solución es un **workaround** mientras se investiga por qué los archivos no persisten del build

---

## 📊 Resumen de Lecciones Aprendidas

### ✅ Mejores Prácticas

1. **Siempre verificar imports**: Revisar documentación del paquete para el tipo de import correcto
2. **Cargar variables de entorno en scripts**: Scripts independientes deben cargar `.env.local` manualmente
3. **Type assertions para runtime values**: Usar `as Type` cuando los valores vienen de runtime (CLI, user input)
4. **Archivos grandes en serverless**: Usar compresión y descompresión en memoria
5. **Fallbacks para archivos críticos**: Implementar descarga en runtime si los archivos no están disponibles del build

### ⚠️ Errores Comunes a Evitar

1. **Asumir que archivos del build están en runtime**: En Vercel, el workspace de build y runtime pueden diferir
2. **Ignorar límites de tamaño**: Siempre verificar límites de la plataforma (250 MB para Vercel)
3. **No probar en producción**: Muchos errores solo aparecen en Vercel, no localmente
4. **No documentar fixes**: Este documento ayuda a evitar repetir errores

---

## 🔄 Proceso de Resolución de Bugs

1. **Reproducir el error**: Verificar que el error es consistente
2. **Identificar la causa raíz**: No solo el síntoma, sino la causa subyacente
3. **Implementar fix**: Hacer el cambio mínimo necesario
4. **Probar localmente**: Verificar que el fix funciona localmente
5. **Probar en producción**: Deploy y verificar en Vercel
6. **Documentar**: Agregar entrada a este documento

---

**Última actualización**: 2026-02-09  
**Total de bugs resueltos**: 8
