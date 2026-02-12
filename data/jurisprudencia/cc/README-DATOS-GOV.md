# Dataset Oficial - Datos.gov.co

## 📊 Fuente de Datos

**Dataset:** Sentencias proferidas por la Corte Constitucional  
**Fuente:** [datos.gov.co](https://www.datos.gov.co)  
**URL:** https://www.datos.gov.co/Justicia-y-Derecho/Sentencias-proferidas-por-la-Corte-Constitucion/hqvf-q7x2  
**Actualizado:** 03/02/2026  
**Cobertura:** 1992 - Enero 2026  
**Total de sentencias:** 29,211

---

## 📁 Archivos Disponibles

### CSV Original
- **Archivo:** `downloads/Sentencias_proferidas_por_la_Corte_Constitucional_20260211.csv`
- **Tamaño:** 3.6 MB
- **Filas:** 29,210
- **Columnas:** 10

### Metadata Procesada
- **Archivo:** `metadata-oficial.json`
- **Generado con:** `scripts/process-datos-gov-csv.mjs`
- **Filtro aplicado:** Años 2020-2026
- **Total de sentencias:** 3,084

### Estadísticas
- **Archivo:** `stats-oficial.json`
- **Incluye:** 
  - Distribución por año
  - Distribución por tipo de sentencia
  - Top 10 magistrados ponentes
  - Top 10 salas
  - Sentencias con votos salvamento/aclaración

---

## 📋 Estructura del CSV

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| Proceso | Tipo de proceso | "Tutela" |
| Expediente Tipo | Código del tipo | "T", "C", "SU" |
| Expediente Número | Número del expediente | "7473841" |
| Magistrado(a) ponente | Nombre completo | "Jorge Enrique Ibáñez Najar" |
| Sala | Sala que profirió la sentencia | "Salas de Revisión" |
| Sentencia Tipo | Código de sentencia | "T", "C", "SU" |
| Sentencia | ID completo | "T-001/20" |
| Fecha Sentencia | Fecha de la sentencia | "2020 Jan 14 12:00:00 AM" |
| SV-SPV | Salvamento de voto | "Sí", "No", "s.d." |
| AV-APV | Aclaración de voto | "Sí", "No", "s.d." |

---

## 🔧 Procesamiento de Datos

### Script: `process-datos-gov-csv.mjs`

**Uso básico:**
```bash
node scripts/process-datos-gov-csv.mjs
```

**Filtrar por año:**
```bash
node scripts/process-datos-gov-csv.mjs --year-from=2020
node scripts/process-datos-gov-csv.mjs --year-from=2020 --year-to=2025
```

**Filtrar por tipo:**
```bash
node scripts/process-datos-gov-csv.mjs --tipo=T     # Solo tutelas
node scripts/process-datos-gov-csv.mjs --tipo=C     # Solo constitucionalidad
node scripts/process-datos-gov-csv.mjs --tipo=SU    # Solo unificación
```

**Combinar filtros:**
```bash
node scripts/process-datos-gov-csv.mjs --year-from=2023 --tipo=T
```

---

## 📊 Estadísticas (2020-2026)

### Por Tipo de Sentencia
- **Tutelas (T):** 2,222
- **Demandas (D):** 640
- **Revisión Eventual (RE):** 155
- **Otros:** 67

### Top 10 Magistrados Ponentes
1. Jorge Enrique Ibáñez Najar: 330
2. Cristina Pardo Schlesinger: 297
3. Diana Constanza Fajardo Rivera: 294
4. Antonio José Lizarazo Ocampo: 292
5. José Fernando Reyes Cuartas: 285
6. Paola Andrea Meneses Mosquera: 278
7. Alejandro Linares Cantillo: 252
8. Natalia Ángel Cabo: 229
9. Juan Carlos Cortés González: 177
10. Gloria Stella Ortiz Delgado: 128

### Por Año
- 2026: 9 (enero)
- 2025: 520
- 2024: 530
- 2023: 585
- 2022: 474
- 2021: 443
- 2020: 523

### Votos
- Con salvamento/aclaración: 3,020 (97.9%)
- Sin votos: 64 (2.1%)

---

## 🚀 Integración con RAG

### 1. Generar Metadata Enriquecida
```bash
node scripts/process-datos-gov-csv.mjs --year-from=2020
```

Esto genera `metadata-oficial.json` con estructura:
```json
{
  "T-001/20": {
    "id": "T-001/20",
    "tipo": "tutela",
    "tipoCode": "T",
    "numero": "7475326",
    "año": "2020",
    "fecha": "2020-01-14",
    "magistrado": "José Fernando Reyes Cuartas",
    "sala": "Salas de Revisión",
    "proceso": "Tutela",
    "url": "https://www.corteconstitucional.gov.co/relatoria/2020/T-001-20.htm",
    "prioridad": 2020,
    "votos": {
      "salvamento": "No",
      "aclaracion": "Sí"
    },
    "fuente": "datos.gov.co",
    "actualizado": "2026-02-03"
  }
}
```

### 2. Descargar Textos Completos (Opcional)
Las URLs están generadas en `metadata-oficial.json`.

**Opciones:**
- **Manual:** Navegar a las URLs y guardar HTMLs
- **Híbrido:** Usar `generate-download-list.mjs` + descarga manual
- **Automático:** Usar `scrape-jurisprudencia-stealth.mjs` (puede ser bloqueado)

### 3. Categorizar y Enriquecer
```bash
node scripts/categorize-jurisprudencia.mjs
```

Agrega:
- `areaLegal` (derecho penal, civil, constitucional, etc.)
- `tema` (temas específicos)
- `precedente` (si es precedente vinculante)
- `normasCitadas` (normas referenciadas)
- `resumen` (resumen automático)

### 4. Ingerir al RAG
```bash
npm run ingest
```

Procesa todos los archivos `.txt` en `data/jurisprudencia/cc/` y genera embeddings.

---

## ✅ Ventajas vs Scraping

| Aspecto | Scraping | Datos.gov.co |
|---------|----------|--------------|
| **Acceso** | Bloqueado (403) | ✅ Libre |
| **Actualización** | Manual | ✅ Mensual |
| **Legalidad** | Gris | ✅ Oficial |
| **Completitud** | Parcial | ✅ 100% desde 1992 |
| **Metadata** | Limitada | ✅ Completa (magistrado, sala, votos) |
| **Mantenimiento** | Alto | ✅ Bajo |

---

## 🔗 Enlaces Útiles

- **Dataset oficial:** https://www.datos.gov.co/Justicia-y-Derecho/Sentencias-proferidas-por-la-Corte-Constitucion/hqvf-q7x2
- **Documentación:** [V2 - Documentación de las bases de datos publicadas en el portal de datos abiertos.pdf](https://www.datos.gov.co/api/views/hqvf-q7x2/files/...)
- **Fuente original:** https://www.corteconstitucional.gov.co/lacorte/estadisticas
- **Corte Constitucional:** https://www.corteconstitucional.gov.co

---

## 📝 Notas

- CSV actualizado mensualmente por la Corte Constitucional
- Última actualización: 03/02/2026
- Cobertura: Enero 1992 - Enero 2026
- Total sentencias: 29,211
- **Licencia:** Public Domain (uso libre)

---

**Última actualización de este README:** 2026-02-11
