# 🤖 TAREAS OPENCLAW — ColLawRAG
**Generado:** 2026-02-16  
**Estas tareas las ejecuta OpenClaw de forma autónoma o cuando Le'saint lo pida**

---

## ⚡ TAREAS INMEDIATAS (ejecutar hoy)

---

### OC-A1 — Ejecutar benchmark de accuracy BASELINE

**Cuándo:** Ahora (antes de cualquier cambio de Cursor)  
**Por qué:** Necesitamos medir el accuracy actual (estimado 60–70%) para saber cuánto mejora cada fix.

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG

# Opción 1: script existente
node scripts/evaluate-accuracy.mjs 2>&1 | tee data/benchmarks/baseline-2026-02-16.log

# Opción 2: si el script no funciona, hacer manualmente con curl
# Para cada pregunta del benchmark QA (data/benchmarks/qa-abogados.json),
# llamar a la API y comparar con respuesta_referencia
```

**Output esperado:** `data/benchmarks/baseline-YYYY-MM-DD.json` con % accuracy por área.

**Notificar a Le'saint:** El % de accuracy por área (laboral, constitucional, etc.)

---

### OC-A2 — Hacer re-ingesta DESPUÉS de que Cursor complete CU-01 + CU-02

**Trigger:** Cuando Cursor confirme que terminó los cambios en `ingest.mjs`

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
npm run ingest
npm run build-bm25
```

**Verificar:** Revisar el nuevo `data/index.json` y confirmar que los chunks tienen `metadata.area` diferente a 'general' (debe bajar de 99.7% a <30%).

```bash
# Contar chunks con area != 'general'
node -e "
const idx = JSON.parse(require('fs').readFileSync('data/index.json','utf8'));
const total = idx.length;
const conArea = idx.filter(c => c.metadata?.area && c.metadata.area !== 'general' && c.metadata.area !== 'unknown').length;
console.log('Total chunks:', total);
console.log('Con area específica:', conArea, '(' + (conArea/total*100).toFixed(1) + '%)');
const areas = {};
idx.forEach(c => { const a = c.metadata?.area || 'unknown'; areas[a] = (areas[a]||0)+1; });
console.log('Distribución:', JSON.stringify(areas, null, 2));
"
```

**Notificar:** Total chunks, distribución por área, mejora vs baseline.

---

### OC-A3 — Re-ejecutar benchmark DESPUÉS de CU-01 + CU-02 + re-ingesta

**Trigger:** Después de OC-A2

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
node scripts/evaluate-accuracy.mjs 2>&1 | tee data/benchmarks/post-fix-$(date +%Y-%m-%d).log
```

**Notificar a Le'saint:** Diferencia de accuracy antes/después del fix.

---

### OC-A4 — Subir índices actualizados a GitHub Releases

**Trigger:** Después de OC-A2 (re-ingesta exitosa)

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
npm run upload-indices
```

**Luego verificar en Vercel (si ya está configurado):**
```bash
# Trigger re-deploy
npx vercel --prod
```

---

## 📅 TAREAS PERIÓDICAS (cron jobs ya configurados)

---

### OC-B1 — Monitoreo diario (automático, 9:05 AM)
**Ya configurado como cron job.**

Verifica: health check + queries de prueba + tiempo de respuesta.  
Alerta si: respuesta >8s, error en health, citas = 0.

---

### OC-B2 — Warm-up Vercel (automático, 7am/1pm/7pm)
**Ya configurado como cron job.**

Previene cold starts llamando a `/api/health` cada 8 horas.

---

### OC-B3 — Reporte semanal (automático, lunes 8 AM)
**Ya configurado como cron job.**

Revisa: calidad de respuestas, avance del roadmap, próximos pasos.

---

## 🔧 TAREAS BAJO DEMANDA (cuando Le'saint lo pida)

---

### OC-C1 — Scraping de jurisprudencia nueva

**Cuándo usar:** Para aumentar cobertura de sentencias (actualmente ~600 sentencias)

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG

# Tutellas 2025
node scripts/scrape-jurisprudencia.mjs --year=2025 --type=tutela

# Constitucionalidad 2024-2025
node scripts/scrape-jurisprudencia.mjs --year=2024 --type=constitucionalidad
node scripts/scrape-jurisprudencia.mjs --year=2025 --type=constitucionalidad

# Sentencias de Unificación
node scripts/scrape-jurisprudencia.mjs --year=2024 --type=unificacion
node scripts/scrape-jurisprudencia.mjs --year=2025 --type=unificacion
```

**Nota:** El sitio de la Corte Constitucional puede devolver HTTP 403 por anti-bot. En ese caso, reportar a Le'saint para descarga manual.

---

### OC-C2 — Generar benchmark expandido (100 casos)

**Cuándo usar:** Para tener evaluación más robusta de accuracy

**Tarea:** Crear 80 preguntas adicionales al archivo `data/benchmarks/qa-abogados.json` (que ya tiene 20 casos) basándose en los documentos del corpus.

**Distribución objetivo:**
- Laboral: 25 preguntas (cesantías, vacaciones, despido, horas extras, jornada)
- Constitucional: 20 preguntas (tutela, derechos fundamentales, jurisprudencia)
- Administrativo: 15 preguntas (derecho de petición, nulidad, contencioso)
- Civil: 15 preguntas (contratos, familia, propiedad)
- Penal: 10 preguntas (delitos, proceso penal)
- Tributario: 15 preguntas (renta, IVA, retención)

**Formato a mantener:**
```json
{
  "id": "LAB-XXX",
  "area": "laboral",
  "dificultad": "basico|intermedio|avanzado",
  "pregunta": "...",
  "respuesta_referencia": "...",
  "normas_clave": ["Art. X CST", "Ley Y"],
  "criterio_evaluacion": "..."
}
```

**Generar usando** los documentos en `data/documents/` como fuente de verdad.

---

### OC-C3 — Análisis de cobertura de corpus

**Cuándo usar:** Para saber qué normas faltan en el índice

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG

# Listar qué normas de scrape-meta ESTÁN en documents/
ls data/documents/ | sort > /tmp/docs-actual.txt
ls data/scrape-meta/ | sed 's/\.json$//' | sort > /tmp/docs-meta.txt

# Ver cuáles tienen archivo en scrape-meta pero no en documents
comm -23 /tmp/docs-meta.txt /tmp/docs-actual.txt

# Ver distribución de chunks por área en el índice actual
node -e "
const idx = JSON.parse(require('fs').readFileSync('data/index.json','utf8'));
const areas = {};
const tipos = {};
idx.forEach(c => {
  const a = c.metadata?.area || c.metadata?.areaLegal || 'unknown';
  const t = c.metadata?.type || 'unknown';
  areas[a] = (areas[a]||0)+1;
  tipos[t] = (tipos[t]||0)+1;
});
console.log('=== Por área ===');
Object.entries(areas).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => 
  console.log(k + ': ' + v + ' (' + (v/idx.length*100).toFixed(1) + '%)')
);
console.log('=== Por tipo ===');
Object.entries(tipos).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => 
  console.log(k + ': ' + v + ' (' + (v/idx.length*100).toFixed(1) + '%)')
);
"
```

**Reportar:** Lista de normas faltantes y chunks por área.

---

### OC-C4 — Verificar vigencia de normas del corpus

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
node scripts/vigencia-normas.mjs 2>&1 | head -50
```

**Reportar:** Normas posiblemente desactualizadas para actualización manual.

---

### OC-C5 — Generar documentos de compliance LPDP

**Cuándo usar:** Antes del lanzamiento comercial

**Tarea:** Generar borradores de:

1. **`docs/legal/politica-datos-personales.md`**  
   Política de Tratamiento de Datos Personales según Ley 1581/2012 y Decreto 1377/2013.
   Incluir: responsable del tratamiento, finalidades, derechos del titular, procedimientos.

2. **`docs/legal/terminos-servicio.md`**  
   Términos de servicio específicos para plataforma de asesoría legal con IA.
   Incluir: naturaleza del servicio (informativo, no vinculante), limitaciones de responsabilidad, propiedad intelectual.

3. **`docs/legal/aviso-privacidad.md`**  
   Aviso simplificado para mostrar a usuarios en el registro.

---

### OC-C6 — Analizar queries reales de producción

**Cuándo usar:** Una vez que haya usuarios reales haciendo consultas

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG

# Si hay SQLite local con datos:
node -e "
const db = require('better-sqlite3')('data/users.db');
try {
  const queries = db.prepare('SELECT query, legal_area, COUNT(*) as count FROM queries GROUP BY legal_area ORDER BY count DESC').all();
  console.log('Queries por área:');
  queries.forEach(q => console.log(q.legal_area + ': ' + q.count));
  
  const failures = db.prepare('SELECT query, response_time FROM queries WHERE success=0 ORDER BY created_at DESC LIMIT 20').all();
  console.log('\\nÚltimas queries fallidas:');
  failures.forEach(q => console.log(q.query.slice(0,80)));
} catch(e) { console.log('BD no disponible:', e.message); }
"
```

**Reportar:** Top áreas consultadas, queries sin respuesta útil, patrones de fallo.

---

### OC-C7 — Test de queries complejas

**Cuándo usar:** Después de cualquier re-ingesta o cambio de prompts

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
node scripts/test-complex-queries.mjs 2>&1
```

---

### OC-C8 — Generar reporte de calidad manual

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
node scripts/generate-quality-report.mjs 2>&1
```

---

## 📊 MÉTRICAS QUE OPENCLAW DEBE RASTREAR

Para cada reporte, incluir estas métricas:

| Métrica | Cómo medir | Objetivo |
|---|---|---|
| Accuracy benchmark | `evaluate-accuracy.mjs` | >85% (Sprint 1), >90% (Sprint 4) |
| % chunks con area específica | Script node inline | >70% |
| Total chunks | `index.json` length | >15,000 |
| Cold start time | Medir primer request | <5s |
| P95 response time | Logs de monitoreo | <6s |
| Uptime producción | Health check diario | >99% |

---

## 🚦 FLUJO DE TRABAJO CON CURSOR

```
Cursor hace CU-01 (ingest.mjs)
    ↓
Cursor hace CU-02 (chunk size)
    ↓
Cursor confirma "listo para re-ingestar"
    ↓
OpenClaw: OC-A2 (npm run ingest)
    ↓
OpenClaw: verificar distribución de metadata
    ↓
OpenClaw: OC-A3 (benchmark post-fix)
    ↓
OpenClaw: OC-A4 (upload-indices)
    ↓
OpenClaw: notificar a Le'saint con resultados

Si accuracy mejoró >10%:
    → Cursor puede proceder con CU-03 (Postgres)
Si accuracy NO mejoró:
    → Reportar a Le'saint para investigar
```

---

## 📁 ARCHIVOS DE REFERENCIA

| Archivo | Descripción |
|---|---|
| `DIAGNOSTICO_COMERCIAL_2026-02-16.md` | Diagnóstico completo con roadmap |
| `TAREAS_CURSOR.md` | Tareas de código para Cursor |
| `data/benchmarks/qa-abogados.json` | 20 casos QA para medir accuracy |
| `scripts/evaluate-accuracy.mjs` | Script de evaluación de accuracy |
| `data/benchmarks/` | Guardar aquí todos los resultados |

---

*Actualizar con ✅/❌ y fecha cuando se complete cada tarea*
