# Known Issues - ColLawRAG

## 🐛 Bug #1: Ollama Judge Timeouts (2026-02-27)

**Síntoma:**
- Juez Ollama (`qwen2.5:7b-instruct` y `qwen2.5:14b-instruct`) da timeout constante (>150s) al evaluar respuestas
- 80-90% de evaluaciones fallan con "The operation was aborted due to timeout"
- Bloquea completamente los benchmarks

**Causa raíz:**
- Ollama local tiene latencia extremadamente alta e inconsistente
- qwen2.5:14b requiere 9.8 GiB RAM (solo hay 6-7 GiB disponibles)
- qwen2.5:7b es más lento de lo esperado para evaluaciones cortas

**Impacto:**
- Sprint 1 bloqueado (S1.7, S1.9, S1.10)
- Benchmarks tardan 2-3 horas en vez de 10-15 minutos
- Datos incompletos (solo 1-2 casos de 30 evaluados correctamente)

**Solución temporal:**
- Usar Groq como juez (llama-3.1-8b-instant: 560 tps, $0.05/$0.08)
- Configurar timeout más largo (300s) solo si es absolutamente necesario

**Solución permanente:**
- Migrar juez a API externa confiable (Groq, OpenRouter, o HuggingFace Inference)
- Nunca usar Ollama local para benchmarks críticos
- Documentar modelos compatibles con RAM disponible

**Workaround para benchmarks:**
```bash
# Usar Groq como juez (rápido y confiable)
JUDGE_PROVIDER=groq JUDGE_MODEL=llama-3.1-8b-instant node scripts/evaluate-accuracy.mjs --limit 30
```

**Historia:**
- 2026-02-27 08:00: Primer timeout detectado con qwen2.5:14b (RAM insuficiente)
- 2026-02-27 17:00: Segundo timeout con qwen2.5:7b (latencia alta)
- 2026-02-27 22:00: Bug documentado y solución implementada

---

## 🐛 Bug #2: Producción 404 Error con Embeddings HF API (2026-03-01)

**Síntoma:**
```json
{
  "error": "Error interno",
  "message": "CRITICAL: Hugging Face embeddings failed in production. HF API error: 404 - Not Found"
}
```

**Causa raíz:**
- Modelo `Xenova/paraphrase-multilingual-MiniLM-L12-v2` es para uso local (transformers.js)
- NO funciona con HF API endpoint (`router.huggingface.co`)
- Código asumía `EMB_PROVIDER=hf` por defecto, incluso para modelos Xenova

**Impacto:**
- Producción Vercel completamente rota después de deploy Sprint 3
- Todas las queries RAG fallan con 500 error
- Sistema inutilizable hasta fix

**Solución:**
Auto-detectar provider basándose en nombre del modelo:
```typescript
// lib/embeddings.ts
const EMB_PROVIDER = process.env.EMB_PROVIDER || 
  (EMBEDDING_MODEL.startsWith('Xenova/') ? 'xenova' : 'hf')
```

**Fix aplicado:**
- Commit `1eec05d` - "Auto-detect Xenova provider to fix production 404 error"
- Deployado a producción: 2026-03-01 13:33
- Status: ✅ **RESUELTO**

**Workaround manual:**
```bash
# En Vercel, configurar variable de entorno:
EMB_PROVIDER=xenova
```

**Historia:**
- 2026-03-01 13:25: Deploy Sprint 3 a producción
- 2026-03-01 13:30: Primera detección error 404 en health check
- 2026-03-01 13:32: Fix implementado (auto-detect)
- 2026-03-01 13:33: Fix deployado y verificado

---

## 🐛 Bug #3: Benchmark Local Bloqueado por RAM Insuficiente (2026-03-01)

**Síntoma:**
- Ollama runner: 5GB RAM consumidos, 384% CPU (thrashing)
- RAG queries locales: 8+ minutos por timeout/swap
- Sistema completamente no responsivo durante benchmarks

**Causa raíz:**
- JUDGE_MODEL `qwen2.5:14b-instruct` requiere 9.8GB RAM
- Sistema solo tiene 15GB total, 6-7GB disponibles
- Ollama carga modelo en RAM completo antes de responder

**Impacto:**
- Benchmarks locales imposibles de ejecutar
- Validación de Sprint 3 bloqueada
- Desarrollo local severamente limitado

**Solución temporal:**
1. Cambiar JUDGE_MODEL de 14b a 7b en `.env.local`:
   ```bash
   JUDGE_MODEL=qwen2.5:7b-instruct
   ```
2. Ejecutar benchmarks contra **producción Vercel** en lugar de local
3. Usar Groq para evaluaciones críticas (ver Bug #1)

**Solución permanente (pendiente):**
- Migrar juez a API externa (Groq, OpenRouter)
- O: Actualizar RAM del sistema a 32GB+
- O: Usar Docker con límites de memoria para Ollama

**Status:** ⚠️ **WORKAROUND ACTIVO** (pendiente solución permanente)

**Historia:**
- 2026-03-01 11:00: Primera detección (benchmark LAB-001 timeout >8 min)
- 2026-03-01 11:54: Cambio a qwen2.5:7b
- 2026-03-01 12:30: Decisión de usar producción para benchmarks

---

## 🔧 Fixes Aplicados

### Fix #1: Migrar juez a Groq (2026-02-27)
- Modificar `scripts/evaluate-accuracy.mjs` para soportar `JUDGE_PROVIDER=groq`
- Actualizar `.env.example` con configuración recomendada
- Documentar en README.md

### Fix #2: Auto-detect Xenova Provider (2026-03-01)
- Detectar automáticamente `EMB_PROVIDER=xenova` cuando modelo empieza con `Xenova/`
- Previene errores 404 en producción
- Backward compatible con configuración explícita

### Fix #3: JUDGE_MODEL 14b → 7b (2026-03-01)
- Reducir consumo RAM del juez de 9.8GB → ~4GB
- Permite benchmarks locales (aunque lentos)
- Trade-off: ligeramente menos preciso pero funcional

