# Diagnóstico: benchmark de accuracy (evaluate-accuracy.mjs)
**Fecha:** 2026-02-20  
**Contexto:** Ejecución del benchmark que ClawdBot/OpenClaw corría antes del error de API.

---

## 1. Qué se ejecutó

- **Script:** `node scripts/evaluate-accuracy.mjs --prod --limit 5`
- **API RAG:** https://col-law-rag.vercel.app (producción)
- **Dataset:** `data/benchmarks/qa-abogados.json` (180 casos; se limitó a 5)
- **Modelo juez:** `qwen2.5:7b-instruct` vía `JUDGE_ENDPOINT` (default: `http://localhost:11434/v1/chat/completions` = Ollama)

---

## 2. Resultado de la ejecución

| Paso | Estado | Detalle |
|------|--------|---------|
| Conexión RAG | OK | `Verificando conexión con RAG... ✓ (status: 200)` |
| Consulta RAG [1/5] | OK | LAB-001 respondido en 29.6s |
| Juez IA | Bloqueado | Se queda en "Evaluando con juez IA..." sin terminar |

**Conclusión:** El **RAG en producción responde**. El **juez (Ollama en localhost:11434)** no responde o no está disponible, por lo que el benchmark se bloquea después de obtener la respuesta del RAG.

**Actualización 2026-02-03:** En una máquina con ~5.1 GiB RAM, Ollama responde pero el modelo por defecto devuelve `500 model requires more system memory (5.1 GiB) than is available`. Alternativas: (1) `ollama pull qwen2.5:3b-instruct` y `JUDGE_MODEL=qwen2.5:3b-instruct`, o (2) juez externo con `JUDGE_ENDPOINT` + `HUGGINGFACE_API_KEY`. Ver BUG-001 variante "memoria insuficiente".

---

## 3. Causa del bloqueo / error de API

- El script usa por defecto **Ollama** como juez (`JUDGE_ENDPOINT=http://localhost:11434`, `JUDGE_MODEL=qwen2.5:7b-instruct`).
- Si Ollama no está instalado o no está corriendo, la llamada al juez hace timeout o se cuelga.
- Alternativa: usar **HuggingFace** como juez configurando `HUGGINGFACE_API_KEY` y un endpoint/modelo compatible (el script usa la misma key que el proyecto si está en `.env.local`; el flujo del juez está en `callJudge()` y puede requerir otro endpoint si no es Ollama).

---

## 4. Tareas derivadas (para payloads)

1. **Asegurar juez disponible:** Tener Ollama corriendo con `qwen2.5:7b-instruct` en localhost:11434, **o** configurar `HUGGINGFACE_API_KEY` (y si hace falta `JUDGE_ENDPOINT`/`JUDGE_MODEL` para HF) antes de correr el benchmark.
2. **OC-A1 — Benchmark baseline:** Ejecutar `node scripts/evaluate-accuracy.mjs --prod` (con juez disponible) y guardar resultado en `data/benchmarks/results-YYYY-MM-DD.json` o `baseline-YYYY-MM-DD.log`. Notificar % accuracy por área.
3. **OC-A2 — Re-ingesta:** Tras mejoras en ingest/documentos: `npm run ingest` y `npm run build-bm25` en ColLawRAG.
4. **OC-A3 — Benchmark post-fix:** Tras OC-A2, volver a ejecutar `evaluate-accuracy.mjs --prod` y comparar con baseline.
5. **Documentar:** Anotar resultados en diagnóstico o en `plan-colaw/bugs-resueltos/` si el “fix” fue configurar el juez o corregir el script.

---

## 5. Cómo usar un juez distinto de Ollama

El script espera un API **compatible con OpenAI** (body: `messages`, respuesta: `choices[0].message.content`). Si no usas Ollama, configura antes de ejecutar:

```bash
export JUDGE_ENDPOINT="https://tu-endpoint-openai-compatible/v1/chat/completions"
export JUDGE_MODEL="nombre-del-modelo"
export HUGGINGFACE_API_KEY="tu-key"   # o la variable que use tu endpoint como Bearer
node scripts/evaluate-accuracy.mjs --prod --limit 5
```

Si el endpoint es localhost, no pide key; si no es localhost, usa `HUGGINGFACE_API_KEY` como Bearer (ver `evaluate-accuracy.mjs` líneas 226-233).

## 6. Comandos de referencia

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG

# Con juez Ollama disponible:
ollama run qwen2.5:7b-instruct   # en otra terminal o en background
node scripts/evaluate-accuracy.mjs --prod --limit 10
node scripts/evaluate-accuracy.mjs --prod

# Con juez externo (OpenAI-compatible):
export JUDGE_ENDPOINT="..." JUDGE_MODEL="..." HUGGINGFACE_API_KEY="..."
node scripts/evaluate-accuracy.mjs --prod
```

Bug documentado: plan-colaw/bugs-resueltos/CURSOR/BUG-001-benchmark-bloqueado-juez-ollama.md

---

## 7. Archivos relevantes

- Script: `ColLawRAG/scripts/evaluate-accuracy.mjs`
- Dataset: `ColLawRAG/data/benchmarks/qa-abogados.json`
- Tareas OpenClaw: `ColLawRAG/TAREAS_OPENCLAW.md` (OC-A1, OC-A2, OC-A3)
- Bugs resueltos: `plan-colaw/bugs-resueltos/INDEX.md` → BUG-001 (juez)

---

## 8. Próximos pasos

1. ✅ **OC-A0 completado:** Juez disponible cuando se cumple **una** de:
   - **Ollama local:** `ollama run qwen2.5:7b-instruct` y servicio en `http://localhost:11434` (sin API key).
   - **Endpoint externo:** `JUDGE_ENDPOINT` (OpenAI-compatible) + `JUDGE_MODEL` + `HUGGINGFACE_API_KEY` como Bearer.
   Documentado en BUG-001 (plan-colaw/bugs-resueltos/CURSOR/).
2. **OC-A1 — Benchmark baseline:** Ejecutar `node scripts/evaluate-accuracy.mjs --prod` (con juez disponible: Ollama 3B/7B o endpoint externo). Resultados en `data/benchmarks/results-YYYY-MM-DD.json`; anotar aquí el % por área. *Pendiente en este entorno hasta tener juez con suficiente RAM o HUGGINGFACE_API_KEY.*
3. **OC-A2 — Re-ingesta:** `npm run ingest` y `npm run build-bm25` tras mejoras en ingest.
4. **OC-A3 — Benchmark post-fix:** Tras OC-A2, volver a ejecutar evaluate-accuracy y comparar con baseline.
5. No modificar el script para “arreglar” el bloqueo del juez; es configuración de entorno (BUG-001).
