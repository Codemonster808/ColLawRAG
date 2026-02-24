# Plan para Producto Comercial — De 32% a 90%+ accuracy

**Fecha:** 2026-02-23  
**Estado actual real:** 32.7% accuracy (179 casos evaluados, benchmark 2026-02-19)  
**Objetivo comercial:** ≥ 90% accuracy en respuestas sobre ley colombiana  
**Brecha:** ~58 puntos porcentuales

---

## Diagnóstico brutal: por qué 32% no es casualidad

Los benchmarks disponibles cuentan la historia:

| Benchmark | Score | Casos | Observación |
|-----------|-------|-------|-------------|
| `local-benchmark-2026-02-19-fase1` | **32.7%** | 179 | Evaluación más amplia |
| `local-benchmark-2026-02-19-xenova` | **32.7%** | 55 | Con embeddings Xenova local |
| `local-benchmark-2026-02-18-cst-clean` | **36.2%** | 50 | Solo CST (laboral) |
| `local-benchmark-2026-02-18` | **35.9%** | 47 | General |
| `results-2026-02-16` | **42.7%** | 3 | Muestra mínima |
| `baseline-prod-2026-02-16` | **59.0%** | 2 | Solo 2 casos — no representativo |

**32% accuracy significa:** de cada 3 respuestas legales, 2 están mal. Esto es inaceptable para cualquier producto y peligroso en el dominio legal.

Las FASES 0-5 atacan el pipeline técnico. Pero para ir de 32% a 90%+ se necesitan mejoras en **3 dimensiones adicionales** que el pipeline solo no resuelve:

1. **Corpus** — No puedes responder bien lo que no tienes en la base de datos
2. **Modelo de generación** — Un modelo de 7B no razona a nivel de abogado
3. **Producto** — Features que un usuario pagante necesita y un prototipo no tiene

---

## DIMENSIÓN 1: Corpus — El dato es el producto

### Estado actual

| Tipo | Cantidad | Cobertura estimada vs universo colombiano |
|------|----------|------------------------------------------|
| Códigos | 9 | ~90% (faltan: Código Disciplinario, Código de Minas, Código Electoral) |
| Constitución | 1 | 100% |
| Leyes | ~20 | **< 2%** — Colombia tiene ~2,500 leyes vigentes relevantes |
| Decretos | ~60 | **< 1%** — Hay miles de decretos reglamentarios vigentes |
| Jurisprudencia | ~608 | **< 0.5%** — Solo Corte Constitucional, y solo 2024-2025. Faltan Corte Suprema, Consejo de Estado, Cortes de apelación |
| Resoluciones | ~30 | **< 0.1%** — Miles de resoluciones de superintendencias, ministerios |
| Normas vigencia mapeadas | 19 | **< 1%** — Solo 19 de miles de normas tienen estado de vigencia |

### Lo que falta (prioritario para comercialización)

#### Prioridad 1: Leyes fundamentales (impacto inmediato en accuracy)

Leyes que los abogados colombianos consultan todos los días y que NO están en el corpus:

**Laboral (42 preguntas en el benchmark — área más evaluada):**
- Ley 50 de 1990 (ya está) — pero faltan sus decretos reglamentarios
- Ley 2101 de 2021 (ya está) — reducción jornada
- **Falta:** Ley 1562 de 2012 (riesgos laborales)
- **Falta:** Ley 776 de 2002 (prestaciones accidentes de trabajo)
- **Falta:** Ley 1010 de 2006 (acoso laboral) — hay norma vigencia pero no el texto
- **Falta:** Decretos reglamentarios de liquidación de prestaciones

**Civil (28 preguntas):**
- **Falta:** Ley 1564 de 2012 (CGP) — artículos de familia y sucesiones
- **Falta:** Ley 1996 de 2019 (capacidad legal personas con discapacidad)
- **Falta:** Ley 640 de 2001 (conciliación)
- **Falta:** Ley 1774 de 2016 (protección animal — tema frecuente)

**Constitucional (36 preguntas):**
- **Falta:** Sentencias hito: T-025/2004, C-355/2006, SU-214/2016, T-760/2008
- **Falta:** Corte Suprema de Justicia — sentencias de casación
- **Falta:** Consejo de Estado — contencioso administrativo

**Tributario (28 preguntas):**
- Estatuto Tributario (ya está) — pero ley 2277 de 2022 (reforma tributaria) lo modificó sustancialmente
- **Falta:** Ley 2277 de 2022 (última reforma tributaria grande)
- **Falta:** Resoluciones DIAN anuales (calendario tributario, formatos)
- **Falta:** Concepto unificados DIAN

**Penal (18 preguntas):**
- Código Penal y Procedimiento Penal (ya están)
- **Falta:** Ley 1826 de 2017 (procedimiento penal abreviado)
- **Falta:** Jurisprudencia penal reciente

**Administrativo (28 preguntas):**
- CPACA Ley 1437 (ya está)
- **Falta:** Ley 80 de 1993 (contratación estatal)
- **Falta:** Ley 1150 de 2007 (contratación estatal reforma)
- **Falta:** Decreto 1082 de 2015 (reglamentación contratación)

#### Prioridad 2: Jurisprudencia masiva

La jurisprudencia es lo que diferencia una respuesta genérica de una respuesta útil. Un abogado necesita saber no solo qué dice la ley, sino cómo la interpreta la Corte.

- **Corte Constitucional**: Hay ~236 sentencias de 2024-2025. Faltan las de 2000-2023 (~15,000 sentencias)
- **Corte Suprema de Justicia**: 0 sentencias. Necesarias para laboral, civil, penal
- **Consejo de Estado**: 0 sentencias. Necesarias para administrativo, tributario
- **Mínimo viable**: Las ~500 sentencias "hito" más citadas de cada corte

#### Prioridad 3: Actualización continua

Las leyes colombianas cambian constantemente. En 2025 se expidieron ~80 leyes y ~500 decretos. Sin pipeline de actualización, el sistema se vuelve obsoleto en meses.

### Tareas de corpus

| ID | Tarea | Impacto | Esfuerzo |
|----|-------|---------|----------|
| C-1 | Ingestar las ~50 leyes más consultadas en cada área (ver lista arriba) | CRÍTICO | 1 semana |
| C-2 | Ingestar ~500 sentencias hito (Corte Constitucional, Suprema, Consejo de Estado) | ALTO | 2 semanas |
| C-3 | Completar Códigos faltantes (Disciplinario, Minas, Electoral) | MEDIO | 2 días |
| C-4 | Mapear vigencia de todas las normas ingestadas (actualmente solo 19 de 749) | ALTO | 1 semana |
| C-5 | Pipeline de actualización automática: scraping periódico + re-ingest | CRÍTICO (largo plazo) | 2-3 semanas |
| C-6 | Ingestar decretos reglamentarios de las leyes principales | ALTO | 1 semana |
| C-7 | Ingestar conceptos DIAN y opiniones jurídicas de superintendencias | MEDIO | 1 semana |

---

## DIMENSIÓN 2: Modelo de generación — El cerebro

### Estado actual

- **Modelo primario:** Qwen2.5-7B-Instruct (gratis via HF Inference)
- **Modelo fallback:** Llama-3.2-3B-Instruct (gratis, pero muy pequeño)
- **Alternativa pagada:** DeepSeek V3 via Novita (no se ha benchmarkeado)

### Por qué 7B no es suficiente para derecho comercial

Un modelo de 7B parámetros:

1. **No sigue instrucciones complejas consistentemente** — Las regeneraciones HNAC lo demuestran. El modelo no puede mantener una estructura de 5 secciones con citas precisas de forma confiable.

2. **Razonamiento legal débil** — Aplicar una norma a un caso concreto requiere razonamiento multi-paso: identificar hechos → identificar norma aplicable → interpretar la norma → aplicar al caso → considerar excepciones. Modelos < 30B no hacen esto bien.

3. **Alucinaciones frecuentes** — Con contexto de 4000 chars y un modelo de 7B, el modelo "rellena" con información de su entrenamiento que puede ser incorrecta (artículos inventados, fechas erróneas, interpretaciones equivocadas).

4. **Context following débil** — Modelos pequeños tienden a ignorar partes del contexto proporcionado, especialmente cuando hay muchos chunks. Si el chunk relevante está en posición 6/8, es probable que lo ignore ("lost in the middle").

### Ruta de mejora del modelo

| Nivel | Modelo | Costo | Accuracy estimado | Para qué sirve |
|-------|--------|-------|-------------------|----------------|
| Actual | Qwen2.5-7B (HF gratis) | $0 | ~32% | Prototipo, demo |
| Nivel 2 | Qwen2.5-72B (HF gratis con rate limits) | $0 | ~55-65% | Testing, desarrollo |
| Nivel 3 | DeepSeek V3 (Novita) / Claude Haiku / GPT-4o-mini | $0.05-0.15/query | ~70-80% | Producto beta |
| Nivel 4 | Claude Sonnet / GPT-4o / DeepSeek R1 | $0.10-0.30/query | ~85-92% | Producto comercial |
| Nivel 5 | Modelo fine-tuneado en derecho colombiano | $500-2000 (una vez) + hosting | ~88-95% | Competitivo, diferenciación |

**Recomendación para comercialización:** Nivel 3-4. El costo de $0.10-0.30 por query es viable si el usuario paga una suscripción. Con 100 queries/usuario/mes a $0.20/query = $20/mes de costo de LLM por usuario. Precio de suscripción de $50-100K COP/mes cubre esto con margen.

### Tareas de modelo

| ID | Tarea | Impacto | Esfuerzo |
|----|-------|---------|----------|
| M-1 | Benchmarkear DeepSeek V3 (ya integrado como `novita`) sobre los 180 casos | CRÍTICO | 1 día |
| M-2 | Integrar API de Groq (Llama 3.3 70B — rápido y económico) como opción | ALTO | 1 día |
| M-3 | Integrar Claude Haiku / GPT-4o-mini como opción de generación | ALTO | 1-2 días |
| M-4 | A/B test: 7B vs 70B vs API comercial sobre mismos 180 casos | CRÍTICO | 2 días |
| M-5 | Evaluar fine-tuning de embeddings en corpus legal colombiano | ALTO (largo plazo) | 2-3 semanas |
| M-6 | Implementar modelo de confianza: si el score de retrieval es bajo, decir "no tengo información suficiente" en lugar de alucinar | CRÍTICO | 2-3 días |

---

## DIMENSIÓN 3: Producto — Lo que un usuario pagante necesita

### Features que un prototipo no tiene pero un producto sí

#### 3.1 Abstención inteligente (anti-alucinación comercial)

El feature más importante para un producto legal. Si el sistema no tiene la respuesta, **debe decirlo claramente** en lugar de inventar.

- Si Recall del retrieval es bajo (score del top-1 chunk < 0.4): "No tengo información suficiente para responder esta consulta con precisión. Te recomiendo consultar con un abogado especializado en [área]."
- Si la norma citada está derogada: advertir explícitamente ANTES de la respuesta, no como footnote
- Nivel de confianza visible: "Alta confianza" / "Media confianza" / "Baja confianza — verificar con abogado"

#### 3.2 Citación verificable

Cada afirmación legal debe tener una cita clickeable que lleve al texto exacto de la norma. Actualmente las citas son `[1]`, `[2]` pero no enlazan a nada.

- Cada cita debe enlazar a la fuente (URL de la norma en el repositorio o en sitios oficiales)
- Mostrar el texto exacto del artículo citado en un popup/expandible
- Permitir al usuario verificar que la cita es real (no alucinada)

#### 3.3 Actualización y vigencia visible

- Mostrar fecha de última actualización del corpus por área legal
- Warning claro si la norma consultada fue modificada recientemente
- Badge de "verificado al [fecha]" en cada respuesta

#### 3.4 Multi-turn y seguimiento

Una consulta legal real raramente se resuelve en un solo turno. El usuario necesita:

- Preguntas de seguimiento: "¿y si el contrato era a término fijo?"
- Contexto persistente: la segunda pregunta debe considerar los hechos de la primera
- Historial de consultas (ya existe parcialmente con `/api/historial`)

#### 3.5 Feedback loop

- Thumbs up/down en cada respuesta
- Cuando un abogado marca "incorrecta", guardar el caso para review
- Los casos "incorrectos" alimentan el dataset de evaluación
- Esto crea un ciclo de mejora continua

#### 3.6 Exportación profesional

- Exportar respuesta como PDF con formato de concepto jurídico
- Incluir citas completas, normas consultadas, advertencias
- Ya hay `/api/export-pdf` — asegurar que funciona bien

### Tareas de producto

| ID | Tarea | Impacto en valor comercial | Esfuerzo |
|----|-------|---------------------------|----------|
| P-1 | Implementar abstención inteligente (umbral de confianza) | CRÍTICO — evita daño reputacional | 2-3 días |
| P-2 | Citas clickeables con texto fuente verificable | ALTO — diferenciador competitivo | 3-5 días |
| P-3 | Indicador de confianza visible (alta/media/baja) | ALTO — genera confianza del usuario | 1-2 días |
| P-4 | Multi-turn con contexto persistente | MEDIO — mejora UX significativamente | 3-5 días |
| P-5 | Feedback loop (thumbs up/down → dataset) | ALTO — mejora continua automática | 2-3 días |
| P-6 | Dashboard de vigencia por área legal | MEDIO — transparencia | 2 días |
| P-7 | Verificar y mejorar export PDF | BAJO (ya existe) | 1 día |

---

## Roadmap integrado: de 32% a 90%

### Sprint 1 (semana 1-2): "De roto a funcional" → Objetivo: 55-65%

| Prioridad | Tarea | Fase |
|-----------|-------|------|
| 1 | FASE 0: Unificar embeddings + eliminar doble retrieval | Pipeline |
| 2 | M-1: Benchmarkear DeepSeek V3 sobre 180 casos | Modelo |
| 3 | M-4: A/B test 7B vs modelo API comercial | Modelo |
| 4 | FASE 0: Re-indexar con embeddings correctos | Pipeline |

**Por qué este sprint primero:** El mismatch de embeddings es la causa #1 del 32%. Arreglarlo + mejor modelo debería duplicar el accuracy sin tocar nada más.

### Sprint 2 (semana 3-4): "Corpus viable" → Objetivo: 70-75%

| Prioridad | Tarea | Fase |
|-----------|-------|------|
| 1 | C-1: Ingestar 50 leyes más consultadas por área | Corpus |
| 2 | C-2: Ingestar 500 sentencias hito | Corpus |
| 3 | C-4: Mapear vigencia de todas las normas ingestadas | Corpus |
| 4 | FASE 5: Implementar métricas de retrieval (Recall@K) | Evaluación |

**Por qué este sprint segundo:** Sin las normas en la base de datos, el retrieval no puede encontrar lo que no existe. Expandir corpus + medir retrieval independientemente.

### Sprint 3 (semana 5-6): "Pipeline de calidad" → Objetivo: 80-85%

| Prioridad | Tarea | Fase |
|-----------|-------|------|
| 1 | FASE 2: Chunking semántico (artículos completos + prefijos) | Pipeline |
| 2 | FASE 1: Índice HNSW + BM25 sobre corpus completo + RRF | Pipeline |
| 3 | FASE 3: Cross-encoder real para reranking | Pipeline |
| 4 | FASE 4: Expandir contexto + optimizar prompts | Pipeline |

**Por qué este sprint tercero:** Con corpus expandido y modelo mejor, ahora optimizar el pipeline tiene efecto real. Cada mejora de pipeline se mide con las métricas de FASE 5.

### Sprint 4 (semana 7-8): "Producto comercial" → Objetivo: 85-90%

| Prioridad | Tarea | Fase |
|-----------|-------|------|
| 1 | P-1: Abstención inteligente (umbral de confianza) | Producto |
| 2 | P-2: Citas verificables clickeables | Producto |
| 3 | P-3: Indicador de confianza | Producto |
| 4 | P-5: Feedback loop | Producto |
| 5 | M-6: Modelo de confianza (no responder si no sabe) | Modelo |

**Por qué este sprint último:** Las features de producto no mejoran accuracy directamente, pero hacen que el producto sea USABLE y CONFIABLE. La abstención inteligente sube el accuracy percibido dramáticamente (porque deja de dar respuestas malas).

### Sprint 5+ (ongoing): "Excelencia" → Objetivo: 90-95%

| Tarea | Tipo |
|-------|------|
| C-5: Pipeline de actualización automática del corpus | Corpus |
| M-5: Fine-tuning de embeddings en corpus legal colombiano | Modelo |
| P-4: Multi-turn con contexto persistente | Producto |
| Expansion a regulaciones sectoriales (salud, financiero, ambiental) | Corpus |
| Análisis de feedback de usuarios para mejora continua | Producto |

---

## Estimación de costos para producto comercial

| Concepto | Costo mensual estimado |
|----------|----------------------|
| LLM API (Nivel 3-4, ~1000 queries/día) | $300-900 USD |
| Vercel Pro (hosting) | $20 USD |
| Pinecone (si se migra a vector DB managed) | $70 USD (starter) |
| Dominio + SSL | ~$5 USD |
| **Total infraestructura** | **~$400-1000 USD/mes** |

**Precio sugerido por usuario:**
- Plan Básico: $50,000 COP/mes (~$12 USD) — 50 queries/día, modelo Nivel 3
- Plan Profesional: $150,000 COP/mes (~$35 USD) — ilimitado, modelo Nivel 4, export PDF
- Plan Firma: $500,000 COP/mes (~$120 USD) — multi-usuario, API, soporte

Con 50 usuarios pagantes en Plan Profesional = ~$1,750 USD/mes → cubre infraestructura con margen.

---

## Resumen ejecutivo

| Dimensión | Estado actual | Necesario para comercializar |
|-----------|---------------|------------------------------|
| **Accuracy** | 32.7% (179 casos) | ≥ 85% |
| **Corpus** | 749 docs, < 2% de leyes vigentes | 2,000+ docs, 80%+ de leyes consultadas |
| **Modelo** | 7B gratis (alucina frecuentemente) | 70B+ o API comercial ($0.10-0.30/query) |
| **Vigencia** | 19 normas mapeadas | Todas las normas ingestadas |
| **Evaluación** | LLM-as-judge básico | Métricas por capa + feedback de usuarios |
| **Abstención** | No existe (siempre responde, a veces mal) | Umbral de confianza + "no sé" explícito |
| **Citación** | `[1]`, `[2]` sin enlace | Clickeable, verificable, con texto fuente |
| **Actualización** | Manual, sin pipeline | Automático periódico |

**La brecha más grande no es el pipeline — es el corpus y el modelo.** Las FASES 0-5 son necesarias pero no suficientes. Sin expandir el corpus a ≥2,000 documentos y sin usar un modelo ≥70B, el techo de accuracy está en ~60-65% incluso con pipeline perfecto.
