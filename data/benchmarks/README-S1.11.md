# S1.11 — Crear ab-test-summary.md (OpenClaw)

Cuando tengas los tres archivos de benchmark:

- `ab-qwen7b-*.json` (baseline, ya existe)
- `ab-deepseek-v3-*.json` (S1.7)
- `ab-groq-70b-*.json` (S1.9)

ejecuta **un solo comando** desde la raíz del proyecto:

```bash
node scripts/compare-ab-test.mjs \
  data/benchmarks/ab-qwen7b-*.json \
  data/benchmarks/ab-deepseek-*.json \
  data/benchmarks/ab-groq-*.json \
  --output data/benchmarks/ab-test-summary.md
```

(Si los nombres tienen fecha, usa el glob o pon los paths exactos.)

El script escribe en `ab-test-summary.md` la tabla comparativa y el **modelo ganador**. Con ese archivo, Cursor ejecuta la post-fase con un solo comando:

```bash
node scripts/apply-winner-and-benchmark.mjs
```

Ese script comprueba que exista `ab-test-summary.md`, muestra el modelo ganador y las variables para `.env.local`, y lanza `evaluate-accuracy.mjs --limit 50` guardando en `data/benchmarks/sprint1-final-YYYY-MM-DD.json`. Opción `--dry-run` para solo ver los pasos sin ejecutar el benchmark.

**Opcional (mientras OpenClaw corre):** Si tienes el servidor RAG libre (p. ej. otra instancia o tras el benchmark), Cursor puede adelantar S2.13: `node scripts/annotate-retrieval-ground-truth.mjs --limit 35` para ampliar ground truth en `qa-abogados.json` (requiere servidor arriba y rate limit suficiente).
