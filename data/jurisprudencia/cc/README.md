# Jurisprudencia - Corte Constitucional de Colombia

**Fuente**: Corte Constitucional de Colombia  
**Período**: 2020-2025  
**Total de sentencias**: 604

## 📁 Estructura de Directorios

```
data/jurisprudencia/cc/
├── 2020/                         # 89 sentencias
├── 2021/                         # 107 sentencias
├── 2022/                         # 100 sentencias
├── 2023/                         # 118 sentencias
├── 2024/                         # 100 sentencias
├── 2025/                         # 90 sentencias
├── metadata.json                 # Metadata completo (204 KB)
└── README.md                     # Este archivo
```

## 📄 Formato de Archivos

**Nombre**: `sentencia-{tipo}-{numero}-{año}.txt`

**Ejemplo**: `sentencia-tutela-010-2024.txt`

**Estructura**:
```
SENTENCIA T-010-2024

Tipo: tutela
Número: 010
Año: 2024
Fecha: 2024-03-15
Magistrado Ponente: José Fernando Reyes Cuartas
Corte: Corte Constitucional de Colombia
URL: https://www.corteconstitucional.gov.co/relatoria/2024/T-010-2024.htm

========================================

[Contenido de la sentencia]
```

## 📊 Tipos de Sentencias

| Tipo                 | Código | Cantidad | Descripción                                    |
|----------------------|--------|----------|------------------------------------------------|
| Tutela               | T      | ~200     | Protección de derechos fundamentales           |
| Constitucionalidad   | C      | ~230     | Control abstracto de constitucionalidad        |
| Unificación          | SU     | ~174     | Unificación de jurisprudencia                  |

## 📋 Metadata (metadata.json)

Cada sentencia tiene la siguiente metadata:

```json
{
  "T-010-2024": {
    "tipo": "tutela",
    "tipoCode": "T",
    "numero": "010",
    "año": "2024",
    "fecha": "2024-03-15",
    "magistrado": "José Fernando Reyes Cuartas",
    "url": "https://www.corteconstitucional.gov.co/relatoria/2024/T-010-2024.htm",
    "tamaño": 1697,
    "areaLegal": null,          // ← Se llenará con Tarea 11
    "tema": null,               // ← Se llenará con Tarea 11
    "precedente": false,        // ← Se llenará con Tarea 11
    "normasCitadas": [],        // ← Se llenará con Tarea 11
    "resumen": null             // ← Se llenará con Tarea 11
  }
}
```

## 🔍 Campos Pendientes (Tarea 11: Categorización)

Los siguientes campos se llenarán con la **Tarea 11 - Categorización y Metadata**:

- **areaLegal**: Área del derecho (laboral, comercial, penal, constitucional, etc.)
- **tema**: Tema principal de la sentencia
- **precedente**: Si la sentencia establece precedente (true/false)
- **normasCitadas**: Array de normas citadas en la sentencia
- **resumen**: Resumen breve de la sentencia

## 🚧 Limitación Técnica

**IMPORTANTE**: Estos datos fueron generados como **datos de muestra realistas** debido a que el sitio web oficial de la Corte Constitucional (corteconstitucional.gov.co) bloquea scraping automatizado con errores 403 (Forbidden).

### Opciones para Obtener Datos Reales:

1. **Scraping Manual**: Descargar HTMLs manualmente desde el sitio web oficial
2. **Browser Automation**: Usar Playwright/Puppeteer para evadir bloqueo
3. **API Oficial**: Si existe una API pública disponible
4. **Fuentes Alternativas**: Consultar repositorios académicos o jurídicos

El scraper está preparado para procesar datos reales cuando estén disponibles. El formato y estructura son idénticos a lo que se extraería del sitio oficial.

## 📦 Uso

### Scraper

```bash
# Generar datos de muestra
node scripts/scrape-jurisprudencia-cc.mjs --year=2020-2025 --type=all --sample --limit=40

# Intentar scraping automático (puede fallar con 403)
node scripts/scrape-jurisprudencia-cc.mjs --year=2024 --type=tutela --dry-run --limit=10

# Opciones disponibles
--year YYYY         # Año específico (2020-2025)
--year YYYY-YYYY    # Rango de años (ej: 2020-2025)
--type TYPE         # Tipo: tutela, constitucionalidad, unificacion, all
--dry-run           # Modo prueba (no guarda archivos)
--limit N           # Limitar a N sentencias por año/tipo
--sample            # Genera datos de muestra (fallback para sitios bloqueados)
```

### Categorización (Tarea 11)

```bash
# Después de completar Tarea 11
node scripts/categorize-jurisprudencia.mjs
```

Esto llenará los campos pendientes en `metadata.json`:
- areaLegal
- tema
- precedente
- normasCitadas
- resumen

## 📈 Estadísticas Actuales

**Total**: 604 sentencias

**Por Año**:
- 2020: 89 sentencias
- 2021: 107 sentencias
- 2022: 100 sentencias
- 2023: 118 sentencias
- 2024: 100 sentencias
- 2025: 90 sentencias

**Por Tipo**:
- Tutela: ~200 sentencias
- Constitucionalidad: ~230 sentencias
- Unificación: ~174 sentencias

**Tamaño promedio**: ~2 KB por archivo
**Tamaño total**: ~1.2 MB

## 🔗 Referencias

- Sitio oficial: https://www.corteconstitucional.gov.co/
- Relatoria: https://www.corteconstitucional.gov.co/relatoria/
- Consulta de sentencias: https://www.corteconstitucional.gov.co/secretaria/

---

**Última actualización**: 2026-02-10  
**Scraper**: scripts/scrape-jurisprudencia-cc.mjs  
**Tarea**: Tarea 10 - Scraper de Jurisprudencia CC 2020-2025
