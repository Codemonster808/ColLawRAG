# Groq — Modelo y límites de uso (plan Developer)

**Proyecto:** ColLawRAG  
**Sprint:** 1 (SPRINT_1_FUNDAMENTOS)  
**Uso:** Generación de respuestas RAG cuando `GEN_PROVIDER=groq`.

---

## Modelo definido en los sprints

| Variable | Valor | Descripción |
|----------|--------|-------------|
| **Modelo** | `llama-3.3-70b-versatile` | Llama 3.3 70B Versatile (Meta), 128K contexto, multilingüe |
| **Config** | `GEN_PROVIDER=groq` + `GROQ_API_KEY=gsk_...` + `HF_GENERATION_MODEL=llama-3.3-70b-versatile` | Ver `.env.example` |

Referencia en código: `lib/generation.ts` (bloque `provider === 'groq'`).  
Documentación Groq: https://console.groq.com/docs/model/llama-3.3-70b-versatile

---

## Límites del plan Developer (Groq Cloud)

Para **definir un tope de uso** en la consola de Groq o en tu aplicación, usa estos valores de referencia del **plan Developer**:

| Límite | Valor | Nota |
|--------|--------|------|
| **RPM** (requests/minuto) | 30 | Máx. 30 llamadas por minuto |
| **RPD** (requests/día) | 1.000 | Máx. 1.000 llamadas por día |
| **TPM** (tokens/minuto) | 6.000 | Máx. 6.000 tokens/minuto |
| **TPD** (tokens/día) | 100.000 | Máx. 100.000 tokens/día |

Fuente: https://console.groq.com/docs/rate-limits

### Estimación para ColLawRAG

- **Benchmark S1.9:** 30 casos → 30 requests (1 día si RPD=1000; cabe en 1 minuto si solo 30 req).
- **Uso típico por consulta:** ~500–2000 tokens (prompt + respuesta). Con TPD 100.000 → ~50–200 consultas/día como tope teórico.
- Para no quedarte sin cuota: puedes limitar en tu app (p. ej. rate limit por usuario) o vigilar uso en https://console.groq.com/settings/billing/plans.

---

## Resumen para configurar el límite de uso

1. **Modelo a usar (Groq):** `llama-3.3-70b-versatile`.
2. **Límites del plan Developer:** RPM 30, RPD 1.000, TPM 6.000, TPD 100.000.
3. Definir tope en Groq: en **Console → Settings → Billing / Rate limits** (si la cuenta lo permite).
4. Opcional: en ColLawRAG, `RATE_LIMIT_REQUESTS` en `.env.local` limita requests por IP; no sustituye el límite de Groq pero evita picos de uso.
