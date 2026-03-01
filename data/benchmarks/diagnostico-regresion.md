# Diagnóstico regresión accuracy 32.7% → 29.6% (Sprint 1 S1.5)

**Fecha:** 2026-02-25  
**Payload:** SPRINT_1_FUNDAMENTOS.toon — tarea S1.5 (Cursor)

---

## 1. Comparación de benchmarks históricos

| Métrica | results-2026-02-16 | results-2026-02-24 |
|--------|---------------------|---------------------|
| **Accuracy** | 42.7% | 29.6% |
| **Modelo juez** | `deepseek/deepseek-v3.2` (HF/cloud) | `qwen2.5:7b-instruct` (Ollama local) |
| **API** | https://col-law-rag.vercel.app | http://localhost:3000 |
| **Casos** | 5 total, 3 evaluados, 2 errores | 5 evaluados, 0 errores |
| **Score promedio** | 4.27 | 2.96 |

**Conclusión:** La comparación **no es equiparable**: el juez cambió de DeepSeek V3.2 (modelo grande en cloud) a Qwen2.5 7B (modelo pequeño en Ollama local). Un juez 7B suele ser más inconsistente y puede puntuar más bajo que un juez 14B+.

---

## 2. Verificación del juez (Ollama)

- **Script** `evaluate-accuracy.mjs`: `JUDGE_MODEL` por defecto = `qwen2.5:14b-instruct` (línea 99).
- **results-2026-02-24** indica `modelo_juez: "qwen2.5:7b-instruct"` → en esa ejecución se usó 7B (variable de entorno o único modelo disponible en Ollama).
- **Recomendación:** Usar juez **≥14B** para evaluación estable. Comprobar que Ollama tiene `qwen2.5:14b-instruct` o superior y que no se sobrescribe con `JUDGE_MODEL=qwen2.5:7b-instruct`.

```bash
# Ver modelo por defecto del script
grep JUDGE_MODEL scripts/evaluate-accuracy.mjs
# Asegurar juez 14B al ejecutar
JUDGE_MODEL=qwen2.5:14b-instruct node scripts/evaluate-accuracy.mjs --limit 25
```

---

## 3. Modelo de generación usado

- El RAG usa `HF_GENERATION_MODEL` o default `Qwen/Qwen2.5-7B-Instruct` (lib/generation.ts).
- En 2026-02-16 (prod) y 2026-02-24 (local) puede haber diferencias de modelo de generación además del juez; revisar `.env.local` y logs para confirmar qué modelo respondió en cada benchmark.

---

## 4. Reducción de chunks (33k → 16k)

- **Estado actual:** ~16 430 chunks (data/index.json / HNSW) según payload.
- Una reducción de 33k a 16k puede haber eliminado contenido útil si el filtrado o el re-chunking fueron agresivos. Para validar: ejecutar benchmarks con **20+ casos** y comparar áreas (laboral, civil, etc.) y revisar si los peores casos comparten falta de normas clave en el índice.

---

## 5. Acciones recomendadas

1. **Juez estable:** Ejecutar benchmarks con `JUDGE_MODEL=qwen2.5:14b-instruct` (o 72B si está disponible) y sin sobrescribir con 7B.
2. **Muestra suficiente:** Usar `--limit 25` o `--limit 50` para reducir ruido (los dos históricos usaron solo 5 casos).
3. **Mismo juez en comparaciones:** Para A/B de modelos de generación (7B, DeepSeek, Groq), mantener el **mismo** modelo juez y mismo dataset en todas las corridas.
4. **Revisar peores casos:** Si tras usar juez 14B la accuracy sigue baja, inspeccionar `peores_casos` y comprobar si las normas esperadas están en el índice (búsqueda por artículo/norma en data/documents o en el índice vectorial).

---

## 6. Comando de validación (benchmark 20+ casos)

```bash
cd ColLawRAG
JUDGE_MODEL=qwen2.5:14b-instruct node scripts/evaluate-accuracy.mjs --limit 25 --output data/benchmarks/diagnostico-s1.5-$(date +%Y-%m-%d).json
```

Tras ejecutar, comparar `accuracy_porcentaje` y `score_promedio` con results-2026-02-24; si el juez es 14B y la muestra ≥20, la diferencia indicará si la regresión es por el juez (7B vs 14B) o por el RAG/corpus.

---

## 7. Comprobación en esta máquina (2026-02-25)

- Al ejecutar con `JUDGE_MODEL=qwen2.5:14b-instruct`, Ollama devuelve **404: model not found, try pulling it first**.
- Por tanto, en este entorno solo está disponible el juez 7B (usado en results-2026-02-24). Para usar juez 14B: `ollama pull qwen2.5:14b-instruct`.
- El RAG (localhost:3000) responde correctamente; los fallos de evaluación son solo por el juez no disponible.
