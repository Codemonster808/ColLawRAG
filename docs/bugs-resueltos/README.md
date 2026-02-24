# Registro de Bugs Resueltos — ColLawRAG

**Propósito:** Documentar cada bug que Cursor resuelve para NO volver a trabajar en problemas ya solucionados.

---

## Estructura

```
docs/bugs-resueltos/
├── README.md              ← Este archivo (índice + formato)
└── CURSOR/
    ├── BUG-001-*.md       ← Un archivo por bug resuelto por Cursor
    ├── BUG-002-*.md
    └── ...
```

Cada bug va en un archivo individual: `BUG-NNN-descripcion-corta.md`

---

## Formato estándar para cada bug

```markdown
# BUG-NNN: Descripción corta del problema

**Resuelto por:** Cursor  
**Fecha:** YYYY-MM-DD  
**Archivo(s) afectado(s):** `ruta/al/archivo.ts`

---

## Síntoma / error

Qué se observa. Mensaje de error exacto si lo hay (en bloque de código).

---

## Causa

Por qué ocurre. Explicar la causa raíz, no solo el síntoma.

---

## Solución aplicada

Qué se cambió y en qué archivo(s). Incluir fragmentos de código antes/después si aplica.

---

## Cómo comprobar que está resuelto

Comando o pasos para verificar. Qué se espera ver como resultado exitoso.

---

## Notas

- Lecciones aprendidas
- "No repetir: ..." (qué NO intentar si el bug reaparece)
- Referencias a otros bugs o docs relacionados
```

---

## Índice de bugs resueltos

### Migrados de BUGS_RESUELTOS.md (bugs históricos pre-2026-02-23)

| ID | Descripción | Archivo(s) | Fecha |
|----|-------------|------------|-------|
| BUG-001 | Import LRU Cache como default en lugar de named | `app/api/rag/route.ts` | pre-2026-02 |
| BUG-002 | Node.js version incompatible (<18.17.0) | Configuración del sistema | pre-2026-02 |
| BUG-003 | Variables de entorno no cargadas en scripts standalone | `scripts/ingest.mjs` | pre-2026-02 |
| BUG-004 | ReferenceError: funciones llamadas antes de definirse | `scripts/scrape-colombia-legal.mjs` | pre-2026-02 |
| BUG-005 | .gitignore excluyendo test-production.mjs | `.gitignore` | pre-2026-02 |
| BUG-006 | Errores TypeScript en Vercel build (const, require, types) | Varios (`route.ts`, `tiers.ts`, `vigencia-normas.ts`) | pre-2026-02 |
| BUG-007 | Funciones serverless exceden 250 MB en Vercel | `next.config.mjs`, `lib/retrieval.ts` | pre-2026-02 |
| BUG-008 | Índices RAG no disponibles en runtime de Vercel | `lib/retrieval.ts`, `.vercelignore` | pre-2026-02 |
| BUG-009 | Comillas sin escapar en JSX bloquean build | `app/terminos/page.tsx` | 2026-02-09 |

### Documentados de plan-colaw (referencia cruzada)

| ID | Descripción | Archivo(s) | Fecha |
|----|-------------|------------|-------|
| BUG-010 | Benchmark bloqueado en "Evaluando con juez IA" (Ollama no disponible) | `scripts/evaluate-accuracy.mjs` (config) | 2026-02-20 |

### Nuevos (post diagnóstico 2026-02-23)

| ID | Descripción | Archivo(s) | Fecha |
|----|-------------|------------|-------|
| — | (Agregar aquí conforme Cursor resuelva bugs) | — | — |

---

## Reglas para sesiones de Cursor

1. **Antes de arreglar un bug:** Leer este README y buscar en `docs/bugs-resueltos/CURSOR/` si ya fue resuelto.
2. **Después de arreglar un bug:** Crear `BUG-NNN-descripcion.md` siguiendo el formato estándar.
3. **Numeración:** Continuar desde el último BUG-NNN existente.
4. **No duplicar:** Si el bug es una variante de uno existente, agregar una sección "Variante" al archivo del bug original.
5. **Bugs de diagnóstico (FASE 0-5):** Cuando se resuelva un cuello de botella del plan de mejoras, documentar como bug si hubo comportamiento inesperado durante la implementación.
