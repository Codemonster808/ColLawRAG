# FASE 4: Generación y Prompts — De modelos pequeños con prompts extensos a generación precisa

**Prioridad:** Media-Alta — La generación es donde se materializa la accuracy final  
**Impacto estimado:** +10-15% accuracy (especialmente en interpretación, completitud y alucinaciones)  
**Esfuerzo:** Medio (3-4 días)  
**Dependencias:** FASE 0 completada. Se beneficia enormemente de FASES 1-3 (mejor contexto = mejor generación).

---

## Diagnóstico

### Cuello de botella 9: Contexto limitado y modelos insuficientes para tareas legales

**Archivos afectados:** `lib/generation.ts` (líneas 40-44), `lib/prompt-templates.ts`

**Problemas concretos:**

#### 9a. Ventana de contexto desperdiciada

```typescript
// lib/generation.ts
const MAX_CONTEXT_CHARS_BASE = 4000       // ~1000 tokens — MUY poco
const MAX_CONTEXT_CHARS_COMPLEX = 8000    // ~2000 tokens — insuficiente para consultas complejas
```

- Qwen2.5-7B tiene ventana de 32k tokens pero solo se usan ~2000 tokens de contexto legal
- El system prompt consume ~1500-2000 tokens adicionales (es muy largo y repetitivo)
- Quedan solo ~500-1000 tokens para la respuesta
- Resultado: respuestas truncadas, falta de completitud, artículos clave omitidos

#### 9b. System prompt con instrucciones duplicadas y contradictorias

En `lib/prompt-templates.ts`, el system prompt generado tiene:
- Numeración duplicada: hay dos secciones "2." y dos secciones "3." (errores de formato)
- Sección "INSTRUCCIONES CRÍTICAS - ESTRUCTURA OBLIGATORIA HNAC" repite instrucciones que ya están en la descripción del área legal
- La regla anti-alucinación dice "SOLO puedes mencionar artículos que aparezcan TEXTUALMENTE en las fuentes" pero también dice "cita [1], [2]" — ¿son artículos de ley o citas de fuentes?
- Total del system prompt: ~2500-3000 caracteres (~700 tokens) — demasiado denso, el modelo pierde instrucciones del medio (efecto "lost in the middle")

#### 9c. Regeneración HNAC desperdicia tokens y latencia

```typescript
// lib/generation.ts líneas 411-496
// Si la respuesta no cumple HNAC, se regenera hasta 2 veces
```

Cada regeneración = otra llamada completa al LLM (latencia + costo). En el peor caso: 3 llamadas al LLM por query. Con modelos de 7B que no siguen instrucciones complejas consistentemente, esto es frecuente.

#### 9d. Modelos de 7B y 3B para razonamiento legal

- **Qwen2.5-7B-Instruct**: Buen modelo pero con limitaciones en razonamiento multi-paso y seguimiento de instrucciones complejas en español legal
- **Llama-3.2-3B-Instruct (fallback)**: Demasiado pequeño para tareas legales — alta tasa de alucinaciones
- Ambos modelos son **gratuitos** via HF Inference, lo que explica la elección, pero el costo en accuracy es significativo

---

## Tareas

### Tarea 4.1: Expandir ventana de contexto utilizada

**Qué hacer:**

1. Aumentar límites de contexto:
   ```typescript
   const MAX_CONTEXT_CHARS_BASE = 12000     // ~3000 tokens (de 4000)
   const MAX_CONTEXT_CHARS_COMPLEX = 24000  // ~6000 tokens (de 8000)
   const MAX_CITATIONS_BASE = 12            // de 8
   const MAX_CITATIONS_COMPLEX = 20         // de 16
   ```

2. Verificar que el modelo soporta la ventana:
   - Qwen2.5-7B: 32k tokens → sobra espacio
   - Llama-3.2-3B: 8k tokens → puede ser justo, pero aún soporta 6k de contexto

3. Ajustar `HF_MAX_TOKENS` para la respuesta:
   - Base: 2500 tokens (de 2000)
   - Compleja: 4000 tokens (de 3000)

4. Total estimado por request: ~1000 (system) + ~6000 (contexto) + ~4000 (respuesta) = ~11k tokens — dentro del rango de cualquier modelo 7B+

**Validación:**
- Queries complejas deben recibir más chunks de contexto
- Las respuestas no deben truncarse (verificar que terminan con conclusión/recomendación)
- Medir "completitud" en evaluate-accuracy: debe mejorar

### Tarea 4.2: Simplificar y optimizar system prompt

**Qué hacer:**

El prompt actual tiene ~700 tokens. Reducirlo a ~300 tokens sin perder instrucciones esenciales.

1. **Eliminar duplicaciones**:
   - La descripción del área legal ya dice "Responde estructurando: HECHOS RELEVANTES, NORMAS APLICABLES..." — no repetir en INSTRUCCIONES CRÍTICAS
   - Unificar las numeraciones (arreglar los "2." y "3." duplicados)

2. **Comprimir instrucciones HNAC**:
   Reemplazar el bloque extenso con:
   ```
   FORMATO OBLIGATORIO:
   **HECHOS RELEVANTES:** [situación específica, mín. 20 chars]
   **NORMAS APLICABLES:** [normas con citas [1]-[N], mín. 20 chars]
   **ANÁLISIS JURÍDICO:** [aplicación al caso, mín. 30 chars]
   **CONCLUSIÓN:** [respuesta fundamentada, mín. 20 chars]
   **RECOMENDACIÓN:** [pasos concretos, opcional]
   ```

3. **Comprimir regla anti-alucinación**:
   Reemplazar el bloque extenso con:
   ```
   ANTI-ALUCINACIÓN: SOLO cita artículos/normas que aparezcan en las fuentes [1]-[N]. Si no está en las fuentes, di "la información disponible no cubre este aspecto".
   ```

4. **Mover advertencias legales al user prompt** (no al system prompt):
   - Las advertencias por área legal (plazos, prescripción) son contexto del usuario, no instrucciones del sistema
   - Esto libera tokens del system prompt

5. **Resultado esperado**: System prompt de ~250-300 tokens, más claro y menos propenso al "lost in the middle"

**Validación:**
- El modelo debe seguir generando respuestas HNAC (misma tasa o mejor)
- La tasa de regeneraciones HNAC debe bajar (menos intentos para cumplir formato)
- Medir tokens usados por request antes y después

### Tarea 4.3: Mejorar selección de modelo de generación

**Qué hacer:**

Evaluar modelos más capaces que mantengan el acceso gratuito o bajo costo:

**Opción A — Modelos HF gratuitos más capaces:**
1. `Qwen/Qwen2.5-72B-Instruct` — disponible via HF Inference (gratuito, pero con rate limits más estrictos)
2. `mistralai/Mistral-Small-24B-Instruct-2501` — 24B, mejor razonamiento que 7B
3. `microsoft/phi-4` — 14B, excelente seguimiento de instrucciones

**Opción B — APIs de pago con mejor relación costo/calidad:**
1. DeepSeek V3 via Novita (ya integrado como `GEN_PROVIDER=novita`)
2. Groq API (Llama 3.3 70B) — muy rápido y económico
3. Together.ai (modelos variados) — créditos gratuitos iniciales

**Opción C — Modelo local via Ollama (para desarrollo):**
1. `qwen2.5:14b-instruct` — mejor que 7B para razonamiento
2. `llama3.3:70b` — si hay GPU disponible

**Recomendación**: Usar Qwen2.5-72B como primario (gratis en HF) y DeepSeek V3 via Novita como fallback (pagado pero alta calidad). Eliminar Llama-3.2-3B como fallback — es demasiado pequeño y produce más daño que beneficio.

**Validación:**
- Ejecutar `evaluate-accuracy.mjs` con cada modelo candidato (al menos 30 queries)
- Comparar scores de "interpretacion_valida" y "ausencia_alucinaciones"
- El modelo seleccionado debe tener score promedio ≥ 7/10

### Tarea 4.4: Reducir regeneraciones con prompt engineering

**Qué hacer:**

En lugar de regenerar hasta 3 veces para cumplir HNAC, hacer que el modelo cumpla a la primera:

1. **Few-shot en system prompt**: Incluir un ejemplo corto de respuesta correcta:
   ```
   EJEMPLO DE RESPUESTA CORRECTA:
   **HECHOS RELEVANTES:** El consultante fue despedido sin justa causa tras 3 años de servicio.
   **NORMAS APLICABLES:** Según el Art. 64 del CST [1], la terminación sin justa causa genera...
   **ANÁLISIS JURÍDICO:** Aplicando la norma al caso concreto...
   **CONCLUSIÓN:** El empleador debe pagar indemnización equivalente a...
   **RECOMENDACIÓN:** 1. Solicitar carta de terminación. 2. Calcular liquidación...
   ```

2. **Instruction following mejorado**: Usar delimitadores XML en lugar de markdown para que el modelo separe claramente las secciones:
   ```
   Estructura tu respuesta así:
   <hechos>...</hechos>
   <normas>...</normas>
   <analisis>...</analisis>
   <conclusion>...</conclusion>
   <recomendacion>...</recomendacion>
   ```
   Luego en post-proceso convertir a markdown.

3. **Validación light antes de regenerar**: Si la respuesta tiene ≥3 de 5 secciones HNAC, NO regenerar — solo agregar las secciones faltantes con un prompt de "completar" más corto

4. **Máximo 1 regeneración** (en lugar de 2): Si falla 2 veces, el prompt tiene el problema, no el modelo

**Validación:**
- Tasa de regeneraciones HNAC < 10% (actualmente probablemente >30%)
- Latencia promedio del pipeline debe bajar (menos llamadas al LLM)
- Calidad de respuestas no debe degradarse

### Tarea 4.5: Contexto enriquecido para el LLM

**Qué hacer:**

El contexto enviado al LLM actualmente es:
```
Fuente [1] (Título del doc — Artículo X):
{contenido del chunk}
```

Enriquecer con metadata útil:

1. Agregar vigencia:
   ```
   Fuente [1] (Ley 100 de 1993 — Artículo 33) [VIGENTE]:
   {contenido}
   ```
   o
   ```
   Fuente [3] (Decreto 2591 de 1991 — Artículo 10) [DEROGADO POR Ley 2213 de 2022]:
   {contenido}
   ```

2. Agregar jerarquía legal:
   ```
   Fuente [2] (Constitución Política > Título II > Art. 86) [CONSTITUCIONAL - VIGENTE]:
   ```

3. Agregar score de relevancia (para que el LLM sepa en qué fuentes confiar más):
   ```
   Fuente [1] (relevancia: 0.92) ...
   Fuente [5] (relevancia: 0.41) ...
   ```

4. Ordenar fuentes por relevancia descendente (ya se hace, pero hacerlo explícito en el prompt)

**Validación:**
- El LLM debe citar fuentes con mayor score más frecuentemente
- El LLM debe advertir cuando cita una fuente derogada
- "precision_normativa" en evaluate-accuracy debe mejorar

---

## Archivos a modificar

| Archivo | Acción |
|---------|--------|
| `lib/generation.ts` | MODIFICAR — expandir contexto, reducir regeneraciones, enriquecer contexto |
| `lib/prompt-templates.ts` | MODIFICAR — simplificar prompts, agregar few-shot, comprimir instrucciones |
| `.env.example` | MODIFICAR — agregar modelos recomendados como opciones documentadas |

---

## Criterio de éxito

- [ ] System prompt reducido a < 350 tokens
- [ ] Contexto legal expandido a ≥ 12000 chars (base) y ≥ 24000 chars (complejo)
- [ ] Tasa de regeneración HNAC < 10%
- [ ] Modelo primario con score promedio ≥ 7/10 en evaluate-accuracy
- [ ] Respuestas no truncadas (siempre incluyen conclusión)
- [ ] Fuentes enriquecidas con vigencia y jerarquía en el contexto del LLM
- [ ] Latencia de generación < 15 segundos (menos regeneraciones)
