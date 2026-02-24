# BUG-003: Variables de entorno no cargadas en scripts standalone

**Resuelto por:** Cursor  
**Fecha:** pre-2026-02  
**Archivo(s) afectado(s):** `scripts/ingest.mjs`

---

## Síntoma / error

```
❌ Error: EMB_PROVIDER=hf requiere HUGGINGFACE_API_KEY
```

---

## Causa

Los scripts ejecutados con `node scripts/xxx.mjs` no cargan `.env.local` automáticamente. Solo los procesos Next.js (dev, build, start) lo hacen.

---

## Solución aplicada

Agregar carga manual de `.env.local` al inicio de cada script:

```javascript
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

---

## Cómo comprobar que está resuelto

```bash
cd ColLawRAG && node scripts/ingest.mjs --dry-run
```

No debe mostrar error de API key si `.env.local` tiene `HUGGINGFACE_API_KEY`.

---

## Notas

- Afecta a TODOS los scripts standalone (`ingest.mjs`, `build-bm25.ts`, `evaluate-accuracy.mjs`, etc.)
- No repetir: intentar pasar `--env-file .env.local` no funciona en todas las versiones de Node
- Alternativa: usar `dotenv` como dependencia, pero el proyecto prefiere no agregar deps innecesarias
