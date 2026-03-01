# Groq — Modelo y límites (plan developer)

**Proyecto:** ColLawRAG  
**Sprint:** 1 (SPRINT_1_FUNDAMENTOS)  
**Uso:** Generación de respuestas RAG cuando `GEN_PROVIDER=groq`.

---

## Modelo que usamos

| Variable | Valor | Notas |
|----------|--------|--------|
| **Modelo** | `llama-3.3-70b-versatile` | Llama 3.3 70B en Groq |
| **HF_GENERATION_MODEL** | `llama-3.3-70b-versatile` | Misma variable que para HF/Novita; con Groq se ignora el prefijo "meta-llama/" |
| **API** | `https://api.groq.com/openai/v1/chat/completions` | OpenAI-compatible |

Configuración en `.env.local`:

```bash
GEN_PROVIDER=groq
GROQ_API_KEY=gsk_...
HF_GENERATION_MODEL=llama-3.3-70b-versatile
```

---

## Límites plan Developer (Groq)

Para definir el límite de uso en [console.groq.com](https://console.groq.com) (Settings → Rate limits / Billing), usar el modelo **llama-3.3-70b-versatile**:

| Límite | Valor (Developer) | Descripción |
|--------|-------------------|-------------|
| **RPM** | 30 | Requests por minuto |
| **RPD** | 1 000 | Requests por día |
| **TPM** | 6 000 | Tokens por minuto |
| **TPD** | 100 000 | Tokens por día |

Referencia: [Groq Rate limits](https://console.groq.com/docs/rate-limits).

---

## Estimación de uso para benchmarks (Sprint 1)

- **S1.9** (benchmark Groq 30 casos): 30 requests en una corrida → cabe en 1 000 RPD.
- **S1.7 / A/B test:** Varias corridas de 30 casos → ~90–150 requests/día en días de prueba.
- **Producción:** Si se adopta Groq como modelo ganador, 1 000 RPD ≈ 1 query cada ~1,5 min en promedio; para más tráfico hace falta plan superior o cache.

---

## Resumen para definir el límite

1. En la consola Groq, identificar el modelo **llama-3.3-70b-versatile**.
2. Los límites por defecto del plan Developer son los de la tabla anterior.
3. Si pides aumento (hasta 10× en Developer Tier), tener en cuenta RPD/TPD para no pasarte del presupuesto deseado.
