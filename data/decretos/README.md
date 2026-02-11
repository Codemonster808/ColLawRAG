# Decretos Reglamentarios - Colombia

**Fuente**: Presidencia de la República y Ministerios de Colombia  
**Período**: 2020-2025  
**Total de decretos**: 60

## 📁 Estructura

```
data/decretos/
├── decreto-{numero}-{año}.txt   # 60 archivos
├── metadata.json                 # Metadata completo (7.5 KB)
└── README.md                     # Este archivo
```

## 📄 Formato de Archivos

**Nombre**: `decreto-{numero}-{año}.txt`

**Ejemplo**: `decreto-0015-2021.txt`

**Estructura**:
```
DECRETO 0015 DE 2021

Ministerio/Entidad: Ministerio de Agricultura y Desarrollo Rural
Fecha: 2021-04-10
Tema: Descentralización territorial
URL: https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=100015

========================================

[Contenido del decreto con estructura legal estándar]
```

## 📊 Distribución

### Por Año
| Año  | Cantidad |
|------|----------|
| 2020 | 12       |
| 2021 | 8        |
| 2022 | 10       |
| 2023 | 10       |
| 2024 | 11       |
| 2025 | 9        |

### Por Ministerio/Entidad
| Ministerio                                    | Cantidad |
|-----------------------------------------------|----------|
| Ministerio de Comercio, Industria y Turismo  | 8        |
| Ministerio de Salud y Protección Social       | 8        |
| Ministerio de Ambiente y Desarrollo Sostenible| 7        |
| Ministerio del Trabajo                        | 7        |
| Ministerio de Educación Nacional              | 7        |
| Presidencia de la República                   | 6        |
| Ministerio de Agricultura y Desarrollo Rural  | 6        |
| Ministerio de Hacienda y Crédito Público      | 4        |
| Ministerio de Transporte                      | 4        |
| Ministerio del Interior                       | 3        |

## 📋 Metadata (metadata.json)

Cada decreto tiene la siguiente metadata:

```json
{
  "decreto-0015-2021": {
    "numero": "0015",
    "año": "2021",
    "fecha": "2021-04-10",
    "ministerio": "Ministerio de Agricultura y Desarrollo Rural",
    "tema": "Descentralización territorial",
    "url": "https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=100015",
    "tamaño": 2031
  }
}
```

## 📚 Temas Cubiertos

Los decretos abarcan 15 áreas temáticas principales:

1. **Organización administrativa**
2. **Reglamentación tributaria**
3. **Sistema de salud**
4. **Educación superior**
5. **Seguridad social**
6. **Medio ambiente**
7. **Comercio exterior**
8. **Transporte público**
9. **Función pública**
10. **Presupuesto nacional**
11. **Contratación estatal**
12. **Régimen laboral**
13. **Licencias y permisos**
14. **Control fiscal**
15. **Descentralización territorial**

## 🚧 Limitación Técnica

**IMPORTANTE**: Estos datos fueron generados como **datos de muestra realistas** debido a que los sitios web oficiales (funcionpublica.gov.co, secretariasenado.gov.co) bloquean scraping automatizado con errores 403 (Forbidden).

### Opciones para Obtener Datos Reales:

1. **Scraping Manual**: Descargar PDFs/HTMLs manualmente desde los sitios oficiales
2. **Browser Automation**: Usar Playwright/Puppeteer para evadir bloqueo
3. **API Oficial**: Si existe una API pública disponible
4. **Fuentes Alternativas**: Consultar bases de datos académicas o jurídicas

El scraper está preparado para procesar datos reales cuando estén disponibles. El formato y estructura son idénticos a lo que se extraería de las fuentes oficiales.

## 📦 Uso

### Scraper

```bash
# Generar datos de muestra
node scripts/scrape-decretos.mjs --sample --limit=60

# Filtrar por ministerio
node scripts/scrape-decretos.mjs --sample --ministerio=hacienda --limit=20

# Filtrar por año
node scripts/scrape-decretos.mjs --sample --desde=2023 --limit=30

# Ver opciones
node scripts/scrape-decretos.mjs --help
```

### Opciones disponibles

- `--sample`: Genera datos de muestra (fallback para sitios bloqueados)
- `--dry-run`: Modo prueba (no guarda archivos)
- `--ministerio=X`: Solo decretos de ministerio X
- `--desde=YYYY`: Solo decretos desde año YYYY
- `--limit=N`: Limitar a N decretos

## 📈 Estadísticas

**Total**: 60 decretos  
**Período**: 2020-2025  
**Ministerios**: 10 entidades  
**Temas**: 15 áreas  
**Tamaño promedio**: ~2 KB por archivo  
**Tamaño total**: ~120 KB

## 🔗 Referencias

- **Función Pública**: https://www.funcionpublica.gov.co/eva/gestornormativo/
- **Secretaría del Senado**: http://www.secretariasenado.gov.co/
- **Presidencia**: https://www.presidencia.gov.co/normativa/

---

**Última actualización**: 2026-02-10  
**Scraper**: scripts/scrape-decretos.mjs  
**Tarea**: Tarea 13 - Scraper de Decretos Reglamentarios
