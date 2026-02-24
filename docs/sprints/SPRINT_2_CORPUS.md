# SPRINT 2: Corpus Viable — Expandir la base de conocimiento

**Duración:** Semana 3-4  
**Accuracy entrada:** ~55-65% (post Sprint 1)  
**Accuracy objetivo:** 70-75%  
**Concepto:** No puedes responder bien lo que no tienes. Expandir corpus de 749 a 1,500+ documentos y medir retrieval.

---

## Contexto para el LLM

ColLawRAG tiene 749 documentos legales colombianos. Esto cubre < 2% de las leyes vigentes. Este sprint expande el corpus con las normas más consultadas y crea métricas para medir si el retrieval encuentra los documentos correctos.

**Archivos clave que debes leer antes de empezar:**
- `scripts/ingest.mjs` — Pipeline de ingesta de documentos
- `scripts/scrape-leyes-co.mjs` — Scraper de leyes
- `scripts/scrape-jurisprudencia-cc.mjs` — Scraper de jurisprudencia
- `data/documents/` — Directorio de documentos fuente (.txt)
- `data/normas-vigencia/` — JSONs de estado de vigencia
- `data/benchmarks/qa-abogados.json` — Dataset de evaluación (180 casos)

---

## TAREA 2.1: Ingestar leyes laborales faltantes

**Problema:** El área laboral tiene 42 preguntas en el benchmark (la más evaluada) pero faltan leyes clave.

**Qué hacer:**

1. Buscar y descargar textos de estas leyes (usar scraper existente o fuentes como `www.secretariasenado.gov.co`):
   - Ley 1562 de 2012 (Sistema General de Riesgos Laborales)
   - Ley 776 de 2002 (Prestaciones por accidentes de trabajo)
   - Ley 1010 de 2006 (Acoso laboral)
   - Decreto 1072 de 2015 (Decreto Único Reglamentario del Sector Trabajo) — al menos Títulos principales
   - Ley 1822 de 2017 (Licencia de maternidad)
   - Ley 2114 de 2021 (Licencia de paternidad)

2. Para cada ley, crear un archivo `.txt` en `data/documents/` con el formato:
   ```
   ---
   titulo: Ley 1562 de 2012
   tipo: estatuto
   tema: riesgos laborales
   area: laboral
   fecha: 2012-07-11
   url: https://www.secretariasenado.gov.co/...
   ---
   ========
   ARTÍCULO 1. ...
   ```

3. El frontmatter YAML debe incluir: `titulo`, `tipo`, `tema`, `area`, `fecha`, `url`.

4. Verificar que cada archivo se parsea correctamente:
   ```bash
   node -e "
   const fs = require('fs');
   const text = fs.readFileSync('data/documents/ley-1562-2012.txt','utf-8');
   console.log('Largo:', text.length, 'chars');
   console.log('Artículos:', (text.match(/ART[ÍI]CULO\s+\d+/gi) || []).length);
   "
   ```

**Validación:**
- Al menos 6 nuevos archivos `.txt` en `data/documents/`
- Cada archivo tiene frontmatter YAML válido
- Cada archivo tiene al menos 5 artículos identificables

---

## TAREA 2.2: Ingestar leyes civiles y comerciales faltantes

**Qué hacer:**

Misma metodología que Tarea 2.1 para:

**Civil:**
- Ley 1996 de 2019 (Capacidad legal personas con discapacidad)
- Ley 640 de 2001 (Conciliación)
- Ley 1774 de 2016 (Protección animal)
- Ley 1098 de 2006 (Código de Infancia — ya podría estar, verificar)

**Comercial:**
- Ley 1116 de 2006 (Insolvencia empresarial)
- Ley 222 de 1995 (Régimen de sociedades — verificar si está)
- Ley 1480 de 2011 (Estatuto del Consumidor — verificar si está)

**Administrativo:**
- Ley 80 de 1993 (Contratación estatal)
- Ley 1150 de 2007 (Reforma contratación)
- Decreto 1082 de 2015 (Reglamentación contratación)

**Tributario:**
- Ley 2277 de 2022 (Reforma tributaria)
- Ley 2010 de 2019 (Reforma tributaria anterior)

**Penal:**
- Ley 1826 de 2017 (Procedimiento penal abreviado)
- Ley 1709 de 2014 (Reforma penitenciaria)

**Validación:**
- Al menos 12 nuevos archivos `.txt` adicionales
- Total de documentos en `data/documents/` ≥ 770

---

## TAREA 2.3: Ingestar sentencias hito (Corte Constitucional)

**Problema:** Solo hay jurisprudencia de 2024-2025. Faltan sentencias históricas que definen la interpretación de la ley.

**Qué hacer:**

1. Crear lista de las 50 sentencias más importantes de la Corte Constitucional:
   - T-025/2004 (desplazamiento forzado)
   - C-355/2006 (aborto)
   - SU-214/2016 (matrimonio igualitario)
   - T-760/2008 (derecho a la salud)
   - C-577/2011 (parejas del mismo sexo)
   - T-406/1992 (Estado Social de Derecho)
   - C-141/2010 (reelección presidencial)
   - SU-039/1997 (consulta previa)
   - T-881/2002 (dignidad humana)
   - C-239/1997 (eutanasia)
   - (y 40 más por área: laboral, penal, tributario, administrativo)

2. Para cada sentencia, usar el scraper existente o descargar manualmente:
   ```bash
   node scripts/scrape-jurisprudencia-cc.mjs --sentencia T-025-2004
   ```
   O si el scraper no soporta sentencias individuales, descargar desde `www.corteconstitucional.gov.co`.

3. Convertir a formato `.txt` con frontmatter:
   ```
   ---
   titulo: Sentencia T-025 de 2004 - Corte Constitucional
   tipo: jurisprudencia
   tema: desplazamiento forzado
   area: constitucional
   fecha: 2004-01-22
   corte: Corte Constitucional
   magistrado: Manuel José Cepeda
   url: https://www.corteconstitucional.gov.co/...
   ---
   ========
   [Texto de la sentencia]
   ```

4. Guardar en `data/documents/` con nombre: `jurisprudencia_cc_T-025-2004.txt`

**Validación:**
- Al menos 30 sentencias hito ingestadas (de las 50 listadas)
- Cada archivo tiene frontmatter con `tipo: jurisprudencia` y `corte`
- Los archivos se parsean sin errores durante ingest

---

## TAREA 2.4: Mapear vigencia de normas ingestadas

**Problema:** Solo 19 de 749 documentos tienen estado de vigencia mapeado en `data/normas-vigencia/`. Sin esto, el sistema puede citar normas derogadas sin advertir.

**Qué hacer:**

1. Listar todos los documentos de tipo `estatuto` y `ley` en `data/documents/`.

2. Para cada uno, crear o actualizar un JSON en `data/normas-vigencia/`:
   ```json
   {
     "normaId": "ley-1562-2012",
     "titulo": "Ley 1562 de 2012",
     "tipo": "ley",
     "estado": "vigente",
     "vigente": true,
     "fechaExpedicion": "2012-07-11",
     "articulos": [
       {
         "numero": "1",
         "estado": "vigente"
       },
       {
         "numero": "11",
         "estado": "modificado",
         "modificadoPor": "Ley 1955 de 2019, Art. 193"
       }
     ]
   }
   ```

3. Fuentes para verificar vigencia:
   - `www.secretariasenado.gov.co` — Indica "Vigente" o "Derogada" en cada ley
   - `www.suin-juriscol.gov.co` — Sistema Único de Información Normativa

4. Priorizar las normas que más aparecen en el benchmark: CST, Constitución, Código Civil, Código Penal, Estatuto Tributario.

**Validación:**
- Al menos 50 normas con vigencia mapeada (de 19 actuales)
- Cada JSON tiene `estado` (vigente/derogada/parcialmente_derogada)
- Normas derogadas deben tener campo `derogadaPor` con la norma derogatoria

---

## TAREA 2.5: Re-indexar con corpus expandido

**Qué hacer:**

1. Después de completar Tareas 2.1-2.4:
   ```bash
   node scripts/ingest.mjs
   ```

2. Verificar que el nuevo conteo de chunks es significativamente mayor:
   ```bash
   node -e "const d=JSON.parse(require('fs').readFileSync('data/index.json','utf-8')); console.log('Chunks:', d.length)"
   ```
   Debe ser > 40,000 (vs ~33,000 actual).

3. Reconstruir BM25:
   ```bash
   npx tsx scripts/build-bm25.ts
   ```

4. Si los índices se usan comprimidos en producción, recomprimir:
   ```bash
   gzip -k data/index.json
   gzip -k data/bm25-index.json
   ```

**Validación:**
- `data/index.json` existe y tiene > 40,000 chunks
- `data/bm25-index.json` existe
- Una query de prueba sobre ley nueva retorna resultados relevantes

---

## TAREA 2.6: Implementar métricas de retrieval (Recall@K)

**Problema:** No hay forma de saber si el retrieval encuentra los chunks correctos. Solo se mide la respuesta final.

**Qué hacer:**

1. Enriquecer `data/benchmarks/qa-abogados.json`: para al menos 30 casos, agregar campo `chunks_esperados`:
   ```json
   {
     "id": "LAB-001",
     "pregunta": "¿Cuántos días de vacaciones...",
     "chunks_esperados": [
       {"buscar_en_titulo": "Código Sustantivo del Trabajo", "buscar_articulo": "Artículo 186"},
       {"buscar_en_titulo": "Código Sustantivo del Trabajo", "buscar_articulo": "Artículo 187"}
     ]
   }
   ```

2. Crear `scripts/evaluate-retrieval.mjs`:
   ```javascript
   // Para cada caso:
   //   1. Ejecutar solo retrieval (no generación)
   //   2. Ver si los chunks esperados están en top-K
   //   3. Calcular Recall@5, Recall@10, MRR

   // Pseudocódigo:
   // const retrieved = await retrieveRelevantChunks(caso.pregunta, {}, 10)
   // const foundInTop5 = chunks_esperados.filter(ce =>
   //   retrieved.slice(0,5).some(r =>
   //     r.chunk.metadata.title.includes(ce.buscar_en_titulo) &&
   //     r.chunk.content.includes(ce.buscar_articulo)
   //   )
   // )
   // recall_at_5 = foundInTop5.length / chunks_esperados.length
   ```

3. El script debe reportar:
   ```
   === RETRIEVAL METRICS ===
   Recall@5:    0.XX
   Recall@10:   0.XX
   MRR:         0.XX
   
   Por área:
     laboral:        Recall@5=X.XX
     constitucional: Recall@5=X.XX
   ```

**Validación:**
- El script ejecuta sin errores sobre al menos 30 casos anotados
- Reporta Recall@5 y Recall@10
- Recall@10 ≥ Recall@5 (sanity check)

---

## TAREA 2.7: Benchmark post-corpus (medir impacto Sprint 2)

**Qué hacer:**

1. Ejecutar benchmark completo con corpus expandido:
   ```bash
   node scripts/evaluate-accuracy.mjs --output data/benchmarks/sprint2-completo-$(date +%Y-%m-%d).json --copy-to-history
   ```

2. Ejecutar evaluación de retrieval:
   ```bash
   node scripts/evaluate-retrieval.mjs --output data/benchmarks/sprint2-retrieval-$(date +%Y-%m-%d).json
   ```

3. Comparar con Sprint 1:
   ```bash
   node scripts/compare-benchmark-results.mjs data/benchmarks/sprint1-completo-*.json data/benchmarks/sprint2-completo-*.json
   ```

4. Documentar en `docs/sprints/SPRINT_2_RESULTADOS.md`

**Validación:**
- Accuracy ≥ 65% (objetivo: 70-75%)
- Recall@10 ≥ 0.70
- Mejora visible en áreas donde se agregaron normas (laboral, civil)

---

## Orden de ejecución

```
2.1 Leyes laborales ──────┐
2.2 Leyes otras áreas ────┤── (pueden hacerse en paralelo)
2.3 Sentencias hito ──────┘
         │
         ▼
2.4 Mapear vigencia ──────── (después de ingestar nuevas normas)
         │
         ▼
2.5 Re-indexar corpus ────── (OBLIGATORIO después de agregar docs)
         │
    ┌────┴────┐
    ▼         ▼
2.6 Métricas   2.7 Benchmark
retrieval      post-corpus
```

---

## Checklist del sprint

- [ ] 2.1 — ≥ 6 leyes laborales nuevas ingestadas
- [ ] 2.2 — ≥ 12 leyes de otras áreas ingestadas
- [ ] 2.3 — ≥ 30 sentencias hito ingestadas
- [ ] 2.4 — ≥ 50 normas con vigencia mapeada
- [ ] 2.5 — Corpus re-indexado (> 40,000 chunks)
- [ ] 2.6 — Script evaluate-retrieval.mjs funcional con Recall@K
- [ ] 2.7 — Benchmark completo ejecutado y documentado
- [ ] Total documentos ≥ 800
- [ ] Accuracy post-sprint ≥ 65%
