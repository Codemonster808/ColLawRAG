# BUG-010: Benchmark evaluate-accuracy se bloquea en "Evaluando con juez IA"

**Resuelto por:** Cursor  
**Fecha:** 2026-02-20  
**Archivo(s) afectado(s):** `scripts/evaluate-accuracy.mjs` (configuración, no código)

---

## Síntoma / error

Al ejecutar `node scripts/evaluate-accuracy.mjs --prod`, el RAG responde correctamente pero el script se queda colgado en "Evaluando con juez IA..." sin avanzar ni mostrar error.

---

## Causa

El script usa Ollama como juez por defecto (`JUDGE_ENDPOINT=http://localhost:11434/v1/chat/completions`, `JUDGE_MODEL=qwen2.5:7b-instruct`). Si Ollama no está instalado o no está corriendo, la llamada hace timeout sin fallar explícitamente.

---

## Solución aplicada

No se modificó código. La solución es asegurar que el juez esté disponible:

**Opción A — Ollama local:**
```bash
ollama run qwen2.5:7b-instruct
# Dejar corriendo, luego en otra terminal:
node scripts/evaluate-accuracy.mjs --prod
```

**Opción B — Endpoint externo OpenAI-compatible:**
```bash
export JUDGE_ENDPOINT="https://api.together.xyz/v1/chat/completions"
export JUDGE_MODEL="Qwen/Qwen2.5-72B-Instruct-Turbo"
export HUGGINGFACE_API_KEY="tu-key"
node scripts/evaluate-accuracy.mjs --prod
```

---

## Cómo comprobar que está resuelto

```bash
cd ColLawRAG && node scripts/evaluate-accuracy.mjs --prod --limit 2
```

Éxito: muestra "Score: X/10" para cada caso y genera `data/benchmarks/results-YYYY-MM-DD.json`.

---

## Variante: error 500 "model requires more system memory"

Si Ollama responde pero devuelve `500 model requires more system memory (5.1 GiB)`:
```bash
export JUDGE_MODEL=qwen2.5:3b-instruct
# O usar Opción B con endpoint externo
```

---

## Notas

- Referencia cruzada: `plan-colaw/bugs-resueltos/CURSOR/BUG-001-benchmark-bloqueado-juez-ollama.md`
- No repetir: intentar cambiar timeouts del script — el problema es la disponibilidad del servicio, no un bug de código
- El script no tiene validación upfront de que el juez está disponible antes de empezar la evaluación
