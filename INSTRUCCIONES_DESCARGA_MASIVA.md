# Instrucciones: Descarga Masiva de Sentencias

**Total sentencias**: 515  
**Pendientes**: 515  
**Archivos preparados**: ✅

---

## 🚀 OPCIÓN 1: Script Automatizado (RECOMENDADO)

### Descargar sentencias de alta prioridad (69 sentencias - MÁXIMA PRIORIDAD)

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
bash scripts/download-sentencias-batch.sh --priority 10 --limit 69
```

**Tiempo estimado**: ~10 minutos (8s entre descargas)

### Descargar más sentencias (201 sentencias - PRIORIDAD 9-10)

```bash
bash scripts/download-sentencias-batch.sh --priority 9 --limit 201
```

**Tiempo estimado**: ~27 minutos

### Descargar TODAS las sentencias de alta prioridad (361 sentencias - PRIORIDAD 8-10)

```bash
bash scripts/download-sentencias-batch.sh --priority 8
```

**Tiempo estimado**: ~48 minutos

### Descargar TODAS las 515 sentencias

```bash
bash scripts/download-sentencias-batch.sh
```

**Tiempo estimado**: ~1.5 horas

---

## 📥 OPCIÓN 2: wget Manual (si el script falla)

### Preparación

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
mkdir -p data/jurisprudencia/cc/downloads
```

### Descargar con wget (69 más importantes)

```bash
cat data/jurisprudencia/cc/urls-prioridad-10.txt | while read url; do
  filename=$(echo $url | grep -oP '[A-Z]+-\d+-\d+')
  echo "Descargando: $filename"
  wget --timeout=30 \
       --tries=3 \
       --user-agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" \
       --referer="https://www.google.com/" \
       -O "data/jurisprudencia/cc/downloads/${filename}.html" \
       "$url"
  sleep 8
done
```

### Descargar 201 (prioridad 9-10)

```bash
cat data/jurisprudencia/cc/urls-prioridad-9.txt | while read url; do
  filename=$(echo $url | grep -oP '[A-Z]+-\d+-\d+')
  echo "Descargando: $filename"
  wget --timeout=30 \
       --tries=3 \
       --user-agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" \
       -O "data/jurisprudencia/cc/downloads/${filename}.html" \
       "$url"
  sleep 8
done
```

### Descargar TODAS (515 sentencias)

```bash
cat data/jurisprudencia/cc/urls-todas.txt | while read url; do
  filename=$(echo $url | grep -oP '[A-Z]+-\d+-\d+')
  echo "Descargando: $filename"
  wget --timeout=30 \
       -O "data/jurisprudencia/cc/downloads/${filename}.html" \
       "$url" 2>/dev/null || echo "Error: $filename"
  sleep 8
done
```

---

## 🌐 OPCIÓN 3: Navegador (para pocas sentencias)

### Ver URLs prioritarias

```bash
# Ver las 20 más importantes
head -20 data/jurisprudencia/cc/urls-prioridad-10.txt
```

### Proceso manual

1. Abrir cada URL en el navegador
2. Guardar página (Ctrl+S)
3. Nombre: `{TIPO}-{NUMERO}-{AÑO}.html` (ej: `T-010-2024.html`)
4. Guardar en: `data/jurisprudencia/cc/downloads/`

---

## ⚙️ DESPUÉS DE LA DESCARGA

Una vez descargados los archivos HTML, procesarlos automáticamente:

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG

# Procesar todos los HTMLs descargados
node scripts/process-downloaded-files.mjs

# Ver estadísticas
ls -lh data/jurisprudencia/cc/downloads/ | wc -l
```

El script:
- Extrae texto de cada HTML
- Extrae metadata (magistrado, fecha)
- Guarda en formato estándar: `sentencia-{tipo}-{numero}-{año}.txt`
- Actualiza `metadata.json`

---

## 📊 Distribución de Sentencias

| Prioridad | Cantidad | Descripción |
|-----------|----------|-------------|
| 10 (máxima) | 69 | Sentencias de unificación 2024-2025 |
| 9 | 132 | Tutelas recientes 2024-2025 |
| 8 | 160 | Constitucionalidad 2024-2025 |
| 7 | 120 | Sentencias 2022-2023 |
| 6 | 34 | Sentencias 2020-2021 |
| **TOTAL** | **515** | Todas las sentencias |

---

## 🔍 Monitoreo de Descarga

### Ver progreso

```bash
# Contar archivos descargados
ls data/jurisprudencia/cc/downloads/*.html 2>/dev/null | wc -l

# Ver últimos descargados
ls -lht data/jurisprudencia/cc/downloads/ | head -10

# Ver tamaño total
du -sh data/jurisprudencia/cc/downloads/
```

### Si hay errores

```bash
# Ver archivos muy pequeños (posibles errores)
find data/jurisprudencia/cc/downloads/ -name "*.html" -size -1k

# Eliminar archivos erróneos
find data/jurisprudencia/cc/downloads/ -name "*.html" -size -1k -delete
```

---

## ⚡ Comandos Rápidos

```bash
# Descargar 50 más importantes (recomendado para empezar)
bash scripts/download-sentencias-batch.sh --priority 10 --limit 50

# Procesar lo descargado
node scripts/process-downloaded-files.mjs

# Categorizar
node scripts/categorize-jurisprudencia.mjs

# Ver estadísticas
jq 'keys | length' data/jurisprudencia/cc/metadata.json
find data/jurisprudencia/cc -name "sentencia-*.txt" | wc -l
```

---

## 📁 Estructura de Archivos

```
data/jurisprudencia/cc/
├── downloads/              # ← HTMLs descargados (temporal)
│   ├── T-010-2024.html
│   ├── C-123-2023.html
│   └── ...
│
├── 2020/                   # ← Sentencias procesadas
│   ├── sentencia-tutela-010-2020.txt
│   └── ...
├── 2021/
├── 2022/
├── 2023/
├── 2024/
├── 2025/
│
├── metadata.json           # ← Metadata enriquecido
├── download-list.json      # ← Lista de URLs con prioridades
├── urls-prioridad-10.txt   # ← 69 URLs más importantes
├── urls-prioridad-9.txt    # ← 201 URLs (prioridad 9-10)
├── urls-prioridad-8.txt    # ← 361 URLs (prioridad 8-10)
└── urls-todas.txt          # ← 515 URLs (todas)
```

---

## 🎯 Recomendación

**Para empezar HOY**:
```bash
# 1. Descargar las 69 más importantes (~10 min)
bash scripts/download-sentencias-batch.sh --priority 10

# 2. Procesar lo descargado
node scripts/process-downloaded-files.mjs

# 3. Categorizar
node scripts/categorize-jurisprudencia.mjs
```

**Luego, si funciona**:
```bash
# 4. Descargar más sentencias de alta prioridad
bash scripts/download-sentencias-batch.sh --priority 9

# 5. Procesarlas
node scripts/process-downloaded-files.mjs
```

**Finalmente**:
```bash
# 6. Descargar todas (1.5 horas)
bash scripts/download-sentencias-batch.sh

# 7. Procesar y categorizar
node scripts/process-downloaded-files.mjs
node scripts/categorize-jurisprudencia.mjs
```

---

## ⚠️ Notas Importantes

- **Delay**: 8 segundos entre descargas para evitar bloqueos
- **Timeout**: 30 segundos por descarga
- **Reintentos**: 3 intentos por sentencia
- **Skip automático**: Si el archivo ya existe, se salta
- **Validación**: Archivos menores a 1KB se consideran erróneos

Si el sitio bloquea:
- Aumentar delay a 15-20 segundos
- Descargar en tandas pequeñas (50 cada vez)
- Esperar 1-2 horas entre tandas
- Usar VPN si es necesario

---

**Archivos preparados**:
- ✅ `scripts/download-sentencias-batch.sh` - Script automatizado
- ✅ `scripts/process-downloaded-files.mjs` - Procesador
- ✅ `data/jurisprudencia/cc/urls-prioridad-10.txt` - 69 URLs
- ✅ `data/jurisprudencia/cc/urls-prioridad-9.txt` - 201 URLs  
- ✅ `data/jurisprudencia/cc/urls-todas.txt` - 515 URLs

**Último paso**: ¡Ejecutar el script y dejar que descargue!
