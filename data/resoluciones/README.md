# Resoluciones y Circulares

**Contenido:** Resoluciones de superintendencias y circulares de entes reguladores colombianos  
**Formato:** Archivos `.txt` con formato `resolucion-{entidad}-{numero}-{año}.txt`  
**Período:** 2020-2025  
**Total:** 30 documentos

---

## 📁 Estructura

```
data/resoluciones/
├── resolucion-sfc-001-2020.txt     # Superintendencia Financiera
├── resolucion-st-1000-2020.txt     # Superintendencia de Transporte
├── resolucion-sic-10000-2020.txt   # Superintendencia de Industria y Comercio
├── ...
└── metadata.json                    # Metadata de todas las resoluciones
```

---

## 🏢 Entidades Incluidas

### 1. **Superintendencia Financiera (SFC)**
- **Acrónimo:** `sfc`
- **URL:** https://www.superfinanciera.gov.co
- **Tipos:** Circulares Externas, Circulares Básicas, Resoluciones
- **Temas:** Instrucciones Contables, Normativa Financiera
- **Total:** 12 documentos (2 por año, 2020-2025)

### 2. **Superintendencia de Transporte (ST)**
- **Acrónimo:** `st`
- **URL:** https://www.supertransporte.gov.co
- **Tipos:** Resoluciones, Circulares
- **Temas:** Tarifas de Transporte, Requisitos Operativos
- **Total:** 12 documentos (2 por año, 2020-2025)

### 3. **Superintendencia de Industria y Comercio (SIC)**
- **Acrónimo:** `sic`
- **URL:** https://www.sic.gov.co
- **Tipos:** Resoluciones, Circulares
- **Temas:** Protección al Consumidor, Defensa de la Competencia
- **Total:** 6 documentos (1-2 por año, 2020-2022)

---

## 📋 Metadata

El archivo `metadata.json` contiene información estructurada de cada resolución:

```json
{
  "resolucion-sfc-001-2020.txt": {
    "entidad": "Superintendencia Financiera",
    "entidadAcronimo": "sfc",
    "numero": "001",
    "año": 2020,
    "tipo": "circular",
    "tema": "Instrucciones Contables",
    "fecha": "2020-01-15",
    "archivo": "resolucion-sfc-001-2020.txt"
  }
}
```

### Campos

- **entidad**: Nombre completo de la entidad emisora
- **entidadAcronimo**: Código corto (sfc, st, sic)
- **numero**: Número de la resolución/circular
- **año**: Año de emisión
- **tipo**: `circular` o `resolucion`
- **tema**: Tema principal del documento
- **fecha**: Fecha de emisión (YYYY-MM-DD)
- **archivo**: Nombre del archivo

---

## 🔄 Actualización

Para actualizar o agregar más resoluciones:

```bash
# Scrapear todas las entidades (años 2020-2025)
node scripts/scrape-resoluciones.mjs

# Scrapear solo una entidad
node scripts/scrape-resoluciones.mjs --entidad=sfc

# Scrapear desde un año específico
node scripts/scrape-resoluciones.mjs --desde=2023

# Dry run (solo mostrar qué se haría)
node scripts/scrape-resoluciones.mjs --dry-run
```

---

## 📊 Estadísticas

- **Total documentos:** 30
- **Por entidad:**
  - Superfinanciera: 12
  - Supertransporte: 12
  - Superindustria: 6
- **Período:** 2020-2025
- **Tamaño promedio:** ~1 KB por documento
- **Tipos:** Circulares (50%), Resoluciones (50%)

---

## ⚠️ Nota Importante

Los archivos actualmente contienen **contenido de ejemplo** generado automáticamente para propósitos de entrenamiento del sistema RAG.

Para obtener el contenido real de las resoluciones, el scraper debe ser actualizado con:

1. **Análisis detallado de cada sitio web** para identificar patrones de URLs y estructura HTML
2. **Parsers específicos** para extraer texto limpio de cada formato
3. **Manejo de PDFs** (muchas resoluciones están en formato PDF)
4. **Autenticación** si algunos documentos requieren login

### Próximos Pasos para Producción

1. Analizar estructura HTML de cada sitio web
2. Identificar URLs de listados de resoluciones
3. Implementar parsers específicos por entidad
4. Agregar soporte para descarga y extracción de PDFs
5. Implementar caché para evitar re-descargar documentos
6. Agregar más entidades reguladoras:
   - Superintendencia de Servicios Públicos
   - Superintendencia de Salud
   - Superintendencia de Economía Solidaria
   - Banco de la República
   - Comisión de Regulación de Comunicaciones

---

## 🔗 URLs de Referencia

### Superintendencia Financiera
- Normativa general: https://www.superfinanciera.gov.co/inicio/normativa/normativa-general/
- Circulares externas: https://www.superfinanciera.gov.co/inicio/normativa/normativa-general/circulares-externas/

### Superintendencia de Transporte
- Resoluciones: https://www.supertransporte.gov.co/index.php/resoluciones/
- Circulares: https://www.supertransporte.gov.co/index.php/circulares/

### Superintendencia de Industria y Comercio
- Normatividad: https://www.sic.gov.co/normatividad
- Circulares: https://www.sic.gov.co/normatividad/circulares
- Resoluciones: https://www.sic.gov.co/normatividad/resoluciones

---

## 📝 Formato de los Documentos

Cada archivo `.txt` sigue este formato:

```
[NOMBRE ENTIDAD EN MAYÚSCULAS]

[TIPO] No. [NÚMERO] DE [AÑO]

Fecha: YYYY-MM-DD
Tema: [Tema del documento]

CONSIDERANDO:
[Considerandos...]

RESUELVE:
[Artículos...]

PUBLÍQUESE Y CÚMPLASE
[Firma]
```

---

**Última actualización:** 2026-02-10  
**Scrapeado con:** `scripts/scrape-resoluciones.mjs`
