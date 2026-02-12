# Plan de Integración - Datos.gov.co → ColLawRAG

## ✅ Completado

### 1. Obtención de Datos Oficiales
- [x] Descargado CSV oficial de datos.gov.co (29,211 sentencias)
- [x] Creado procesador `process-datos-gov-csv.mjs`
- [x] Generado `metadata-oficial.json` (3,084 sentencias 2020-2026)
- [x] Generado `stats-oficial.json` (estadísticas detalladas)
- [x] Documentado proceso en `README-DATOS-GOV.md`

---

## 🚀 Próximos Pasos

### 2. Descarga de Textos Completos (PRIORIDAD ALTA)

**Problema:** Metadata está lista, pero necesitamos los textos completos de las sentencias.

**Opciones:**

#### **Opción A: Descarga Manual Asistida** (RECOMENDADO)
1. Generar lista priorizada de URLs
2. Usar navegador para descargar HTMLs (evita bloqueo 403)
3. Procesar HTMLs automáticamente

```bash
# Generar lista priorizada (ej: tutelas 2024-2025)
node scripts/generate-download-list-oficial.mjs --year-from=2024 --tipo=T --limit=100

# Descargar manualmente a: data/jurisprudencia/cc/downloads/html/

# Procesar automáticamente
node scripts/process-downloaded-files.mjs
```

**Estimado:** 100 sentencias/hora (manual)

#### **Opción B: Archive.org (Wayback Machine)**
```bash
node scripts/scrape-jurisprudencia-stealth.mjs --source=wayback --year=2024 --type=tutela --limit=50
```

**Ventajas:**
- No bloqueado
- Contenido completo
- Automático

**Desventajas:**
- Puede no tener sentencias recientes
- Necesita verificar disponibilidad

#### **Opción C: Solicitud Oficial API/Dataset**
Contactar a la Corte Constitucional para solicitar:
- Acceso a API (si existe)
- Dataset completo de textos
- Formato estructurado (JSON/XML)

**Email:** secretaria@corteconstitucional.gov.co

**Template de email:**
```
Asunto: Solicitud de acceso a base de datos de sentencias

Estimados señores de la Corte Constitucional,

Mi nombre es [NOMBRE] y estoy desarrollando un proyecto de investigación académica
sobre jurisprudencia constitucional colombiana utilizando técnicas de procesamiento
de lenguaje natural y recuperación de información (RAG).

He encontrado el dataset "Sentencias proferidas por la Corte Constitucional" en
datos.gov.co, el cual contiene metadatos valiosos de 29,211 sentencias. Sin embargo,
para mi investigación necesito acceso a los textos completos de las sentencias.

¿Sería posible obtener:
1. Acceso a una API para consulta programática de sentencias
2. Un dataset completo con textos de sentencias (JSON/XML/CSV)
3. Indicaciones sobre cómo acceder a los textos de manera automatizada

Cualquier orientación o recurso que puedan compartir sería muy valioso para mi
proyecto.

Agradezco de antemano su atención.

Atentamente,
[NOMBRE]
[CONTACTO]
```

---

### 3. Categorización y Enriquecimiento

Una vez tengamos textos completos:

```bash
# Categorizar sentencias (automático con Claude)
node scripts/categorize-jurisprudencia.mjs --source=oficial

# Enriquecer metadata con:
# - areaLegal
# - tema
# - precedente (si es vinculante)
# - normasCitadas
# - resumen
```

**Estimado:** 100 sentencias/hora (procesamiento automático)

---

### 4. Ingesta al RAG

```bash
# Generar embeddings y crear índice
npm run ingest

# Resultado: data/index.json (actualizado con 3,084+ sentencias)
```

**Estimado:** 30 minutos para 3,084 sentencias

---

### 5. Testing y Validación

```bash
# Probar queries
npm run dev

# Queries de prueba:
# - "¿Cuál es el precedente sobre derecho a la salud?"
# - "Sentencias de tutela sobre pensiones 2024"
# - "Jurisprudencia del magistrado Jorge Enrique Ibáñez Najar"
```

---

### 6. Deployment

```bash
# Generar release con índice actualizado
npm run upload-indices

# Deploy a Vercel
vercel --prod
```

---

## 📊 Métricas Objetivo

### Cobertura de Datos
- **Actual:** 3,084 sentencias (metadata)
- **Objetivo Corto Plazo:** 500 sentencias (textos completos) - 16.2%
- **Objetivo Medio Plazo:** 1,500 sentencias (textos completos) - 48.6%
- **Objetivo Largo Plazo:** 3,084 sentencias (textos completos) - 100%

### Accuracy del RAG
- **Actual:** 60-70%
- **Objetivo Corto Plazo:** 75-80% (con 500 sentencias reales)
- **Objetivo Medio Plazo:** 85-90% (con 1,500 sentencias reales)
- **Objetivo Largo Plazo:** 95%+ (con 3,084 sentencias reales + categorización)

### Tiempo de Respuesta
- **Actual:** ~2-3 segundos
- **Objetivo:** <2 segundos (con optimización de índice)

---

## 🎯 Priorización de Sentencias

### Criterios de Prioridad

1. **Año reciente** (2024-2025): Mayor relevancia
2. **Tipo de sentencia:**
   - SU (Sentencias de Unificación): Máxima prioridad - precedente vinculante
   - C (Constitucionalidad): Alta prioridad - interpretación de normas
   - T (Tutela): Media prioridad - casos concretos
3. **Magistrado ponente:** Magistrados con más sentencias
4. **Con votos salvamento/aclaración:** Indica controversia/importancia

### Lista Priorizada (Top 100)

```bash
# Generar lista priorizada
node scripts/generate-download-list-oficial.mjs --prioritize --limit=100

# Output: data/jurisprudencia/cc/download-list-prioritized.json
```

---

## 📋 Checklist de Tareas

### Corto Plazo (1-2 semanas)
- [ ] Crear `generate-download-list-oficial.mjs` (usa metadata-oficial.json)
- [ ] Descargar top 100 sentencias prioritarias (manual)
- [ ] Procesar HTMLs descargados
- [ ] Categorizar 100 sentencias
- [ ] Ingerir al RAG
- [ ] Testing inicial (queries de prueba)
- [ ] Deployment a Vercel

### Medio Plazo (1-2 meses)
- [ ] Descargar 500+ sentencias prioritarias
- [ ] Categorización masiva (automática)
- [ ] Optimización de índice RAG
- [ ] Testing exhaustivo (batería de queries)
- [ ] Redactar y enviar email oficial a Corte Constitucional
- [ ] Investigar Archive.org coverage

### Largo Plazo (3-6 meses)
- [ ] Completar descarga de 3,084 sentencias (2020-2026)
- [ ] Explorar dataset completo (1992-2026) si es necesario
- [ ] Implementar API propia para consulta de sentencias
- [ ] Dashboard de estadísticas jurisprudenciales
- [ ] Publicar proyecto como recurso público

---

## 💡 Ideas Futuras

### Expansión de Fuentes
- **Consejo de Estado:** Sentencias de lo contencioso administrativo
- **Corte Suprema de Justicia:** Casación penal, civil, laboral
- **Tribunales Superiores:** Jurisprudencia regional

### Features Avanzados
- **Análisis de tendencias:** Evolución de jurisprudencia por tema
- **Red de sentencias:** Grafo de citas entre sentencias
- **Comparación de magistrados:** Estilos y tendencias por ponente
- **Predicción de fallos:** ML para predecir resultado de casos

---

## 📚 Recursos

- **Dataset oficial:** https://www.datos.gov.co/Justicia-y-Derecho/Sentencias-proferidas-por-la-Corte-Constitucion/hqvf-q7x2
- **Corte Constitucional:** https://www.corteconstitucional.gov.co
- **Relatoria:** https://www.corteconstitucional.gov.co/relatoria/
- **Estadísticas:** https://www.corteconstitucional.gov.co/lacorte/estadisticas

---

**Última actualización:** 2026-02-11
