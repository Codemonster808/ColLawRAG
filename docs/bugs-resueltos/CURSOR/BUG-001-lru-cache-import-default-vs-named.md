# BUG-001: Import LRU Cache como default en lugar de named

**Resuelto por:** Cursor  
**Fecha:** pre-2026-02  
**Archivo(s) afectado(s):** `app/api/rag/route.ts`

---

## Síntoma / error

```
TypeError: lru_cache__WEBPACK_IMPORTED_MODULE_2__.default is not a constructor
```

---

## Causa

El paquete `lru-cache` en la versión instalada exporta como named export, no como default.

---

## Solución aplicada

```typescript
// Antes (incorrecto)
import LRUCache from 'lru-cache'

// Después (correcto)
import { LRUCache } from 'lru-cache'
```

---

## Cómo comprobar que está resuelto

```bash
cd ColLawRAG && npm run build
```

El build no debe mostrar error de `lru-cache`.

---

## Notas

- No repetir: intentar `require('lru-cache')` tampoco funciona en módulos ESM
- En Node.js moderno, muchos paquetes migraron a named exports
