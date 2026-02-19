# Diagnóstico: problema raíz en documentos — ColLawRAG
**Fecha:** 2026-02-18  
**Conclusión:** El accuracy bajo y los filtros por área fallan porque **los documentos son el problema raíz**: formato inconsistente, metadata no extraída y contenido sintético/mock en parte del corpus.

---

## 1. Hallazgo principal: los documentos

Tras investigar, se confirmó que:

- **Parte del corpus** tiene documentos de prueba o sintéticos (ej. `decreto-0001-2020.txt`: "Generado automáticamente como datos de muestra", placeholders `[Definición 1]`, `[CARTERA]`).
- **Formatos de cabecera distintos** entre archivos:
  - Unos usan frontmatter YAML entre `---` (ej. `norma_vigencia_*.txt`) con `area:`, `tipo:`.
  - Otros usan líneas `Ministerio/Entidad:`, `Tema:`, `URL:` y separador `========================================` (decretos).
  - Otros usan `Tipo: tutela`, `TEMA:`, `Fecha:` y el mismo separador `======` (jurisprudencia).
- El **ingest** solo parseaba frontmatter `--- ... ---`. Las cabeceras con `Tema:`/`Tipo:`/`======` no se usaban → la mayoría de chunks quedaban con `area`/`type` por defecto o por detección por contenido (imprecisa).
- **Consecuencia:** Retrieval filtrado por área no funciona bien y el accuracy se resiente.

---

## 2. Estado actual del índice (referencia)

| Métrica | Valor |
|--------|--------|
| Documentos en `data/documents/` | ~744 .txt |
| Chunks (index.json) | ~12k+ (archivo muy grande para cargar en memoria) |
| Chunks con área específica (antes del fix) | ~6% (resto general/unknown) |
| Formatos de documento | 3 (YAML ---, cabecera ========, mixtos) |

---

## 3. Qué hacer mientras se resuelve el problema de documentos

Acciones que **no dependen** de tener ya todos los documentos definitivos:

1. **Ingest más robusto**  
   - Parsear también la cabecera tipo `Tema:` / `Tipo:` / `Ministerio/Entidad:` antes de `========================================` (o `---`).  
   - Unificar en un solo flujo: frontmatter YAML + cabecera alternativa → `metadata.area` y `metadata.type`.  
   - Así, en la próxima re-ingesta los documentos actuales (decretos, jurisprudencia con ese formato) aportarán mejor metadata.

2. **Strip de cabecera con `======`**  
   - En `stripHeaderAndNav`, reconocer el separador `========================================` y eliminar todo lo anterior (incl. la línea de iguales).  
   - El cuerpo del documento empieza después; se evita que la cabecera se fragmente en chunks.

3. **Re-ingesta tras mejoras**  
   - Tras cambiar ingest y strip: `npm run ingest` y `npm run build-bm25`.  
   - Volver a medir: % de chunks con `area` específica y, si existe, benchmark de accuracy.

4. **Calidad del corpus (en paralelo)**  
   - Sustituir o marcar documentos mock/sintéticos.  
   - Usar el plan para Claude en Chrome (o descarga manual) para obtener textos reales de Función Pública / Corte Constitucional / Senado y guardarlos en el formato acordado (cabecera con Tema/URL/etc. + `======` + cuerpo).

5. **Benchmark y métricas**  
   - Mantener y ejecutar `scripts/evaluate-accuracy.mjs` contra `/api/rag` cuando el corpus esté estable.  
   - Documentar en este diagnóstico el accuracy antes/después de cambios de documentos e ingest.

6. **Payload / plan de trabajo**  
   - Actualizar el payload (ClawdBot/OpenClaw o el que use Cursor) para que:
     - Tenga como **problema raíz** los documentos (formato + calidad).
     - Priorice: (a) mejoras de ingest y strip, (b) re-ingesta, (c) sustitución de mocks y descarga de documentos reales en paralelo.

---

## 4. Mejoras ya aplicadas en este ciclo

- **Diagnóstico:** Este documento (problema raíz = documentos).  
- **Ingest:** Se añade parsing de cabecera alternativa (`Tema:`, `Tipo:`, etc.) y uso de separador `======` para strip.  
- **Payload:** Se actualiza con referencia a este diagnóstico y prioridades (documentos + mejoras en paralelo).

---

## 5. Próximos pasos recomendados

1. Completar cambios en `scripts/ingest.mjs` (parsear cabecera alternativa + strip por `======`).  
2. Ejecutar re-ingesta y build BM25.  
3. Sustituir/ampliar documentos mock con textos reales (plan Claude Chrome o proceso híbrido).  
4. Volver a ejecutar benchmark de accuracy y actualizar este diagnóstico con resultados.
