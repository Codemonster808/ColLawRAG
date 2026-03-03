# Sprint 4 — Resultados (Producto: Abstención + Confianza + Feedback)

**Fecha:** 2026-03-03  
**Objetivo:** Mantener accuracy, añadir abstención inteligente, badge de confianza y feedback thumbs.

---

## Resumen ejecutivo

| Métrica | Antes | Después | Objetivo |
|---------|-------|---------|----------|
| Abstención | 0% | Funcional (topScore < 0.25) | 5–15% en queries ambiguas |
| Badge confianza | No | Sí (alta/media/baja/insuficiente) | Visible |
| Feedback thumbs | Sí (API distinta) | Sí (requestId + vote) | Funcional |
| Accuracy | 72.6% | Por validar | ≥ 74% |

---

## Tareas completadas

### S4.1 — calculateRetrievalConfidence
- **Archivo:** `lib/rag.ts`
- **Umbrales:** topScore < 0.25 → insuficiente; < 0.45 → baja; < 0.65 → media; else → alta
- **Export:** `RetrievalConfidence`, `RetrievalConfidenceLevel`

### S4.2 — Abstención si confianza insuficiente
- **Archivo:** `lib/rag.ts`
- **Comportamiento:** Si `confidence.level === 'insuficiente'` retorna mensaje de abstención sin generar respuesta.
- **Mensaje:** "No tengo información suficiente para responder esta consulta con la debida precisión legal..."

### S4.3 — Advertencia si confianza baja
- **Archivo:** `lib/rag.ts`
- **Comportamiento:** Si `confidence.level === 'baja'` se antepone "Advertencia: La información disponible puede ser incompleta."

### S4.4 — Tipo confidence en RagResponse
- **Archivo:** `lib/types.ts`
- **Campo:** `confidence?: { level: ConfidenceLevel; score: number }`

### S4.5 — Exponer confidence en API
- **Archivo:** `app/api/rag/route.ts`
- **Comportamiento:** El resultado de `runRagPipeline` incluye `confidence`; se devuelve en JSON sin cambios.

### S4.6 — Badge confianza en UI
- **Archivo:** `components/ResultsDisplay.tsx`
- **Estilos:** verde (alta), amarillo (media), naranja (baja), rojo (insuficiente)

### S4.7 — Botones thumbs up/down
- **Archivo:** `components/ResultsDisplay.tsx`
- **Estado:** Ya existían; envían `{ requestId, vote }` a `/api/feedback`.

### S4.8 — Endpoint /api/feedback con requestId + vote
- **Archivo:** `app/api/feedback/route.ts`
- **Formato:** `POST { requestId, vote: 'up'|'down' }`
- **Almacenamiento:** Feedback negativo → `data/eval/negative-feedback.jsonl`

### S4.9 — Documentación
- **Archivo:** `docs/sprints/SPRINT_4_RESULTADOS.md` (este documento)

---

## Distribución de confianza (objetivo)

| Nivel      | Umbral topScore | Color badge |
|------------|-----------------|-------------|
| Alta       | ≥ 0.65          | Verde       |
| Media      | 0.45–0.65       | Amarillo    |
| Baja       | 0.25–0.45       | Naranja     |
| Insuficiente | < 0.25        | Rojo (abstención) |

---

## Próximos pasos

1. Benchmark post-Sprint 4 para verificar que accuracy se mantiene.
2. Monitorear tasa de abstención en producción (objetivo 5–15% en queries ambiguas).
3. Revisar `data/eval/negative-feedback.jsonl` para priorizar mejora de casos negativos.
