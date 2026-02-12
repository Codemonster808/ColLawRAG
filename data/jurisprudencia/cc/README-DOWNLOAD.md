# Instrucciones de Descarga Manual - Jurisprudencia CC

**Generado**: 2026-02-11  
**Total de sentencias**: 644  
**Pendientes de descarga**: 644  
**Ya existentes**: 0

## 📋 Lista de Descarga

La lista completa de URLs está en: `download-list.json`

**Formato**:
```json
{
  "id": "T-010-2024",
  "tipo": "tutela",
  "numero": "010",
  "año": "2024",
  "url": "https://www.corteconstitucional.gov.co/relatoria/2024/T-010-2024.htm",
  "estado": "pendiente",
  "prioridad": 8,
  "notas": "Pendiente de descarga"
}
```

## 🔧 Proceso de Descarga Manual

### Opción 1: Descarga Individual (Browser)

1. Abrir las URLs en el navegador
2. Guardar HTML completo (Ctrl+S / Cmd+S)
3. Guardar en: `data/jurisprudencia/cc/downloads/`
4. Nombrar archivos: `{id}.html` (ej: `T-010-2024.html`)

### Opción 2: Descarga con wget/curl (Terminal)

```bash
# Crear directorio
mkdir -p data/jurisprudencia/cc/downloads

# Descargar sentencias (ejemplo con primeras 10)
jq -r '.[] | select(.estado == "pendiente") | .url' data/jurisprudencia/cc/download-list.json | head -10 | while read url; do
  filename=$(echo $url | grep -oP '[A-Z]+-\d+-\d+')
  curl -A "Mozilla/5.0" "$url" > "data/jurisprudencia/cc/downloads/$filename.html"
  sleep 5 # Delay para evitar bloqueo
done
```

### Opción 3: Extensión de Navegador

1. Instalar extensión: **DownThemAll** o **Tab Save**
2. Abrir todas las URLs en tabs
3. Usar extensión para guardar todos los HTMLs

## ⚙️ Procesar Archivos Descargados

Una vez descargados los HTMLs, procesarlos con:

```bash
node scripts/process-downloaded-files.mjs
```

Este script:
- Lee archivos HTML de `downloads/`
- Extrae y limpia el texto
- Guarda en formato estándar: `sentencia-{tipo}-{numero}-{año}.txt`
- Actualiza `metadata.json`

## 📊 Priorización de Descargas

**Alta prioridad** (prioridad 8-10):
- Sentencias 2024-2025
- Sentencias de unificación (SU)
- Tutelas recientes

**Media prioridad** (prioridad 5-7):
- Sentencias 2022-2023
- Constitucionalidad

**Baja prioridad** (prioridad 1-4):
- Sentencias 2020-2021
- Ya existen en disco

## 🔍 Verificar Estado

```bash
# Ver sentencias pendientes
jq '.[] | select(.estado == "pendiente") | .id' data/jurisprudencia/cc/download-list.json

# Ver estadísticas
jq 'group_by(.estado) | map({estado: .[0].estado, count: length})' data/jurisprudencia/cc/download-list.json
```

## 📝 Notas Importantes

- **Delays**: Esperar 5-10 segundos entre descargas para evitar bloqueo
- **User-Agent**: Usar User-Agent de navegador real
- **Referer**: Agregar header `Referer: https://www.google.com/`
- **VPN/Proxy**: Considerar usar VPN si hay bloqueos persistentes

## 🔗 URLs Importantes

- **Relatoria CC**: https://www.corteconstitucional.gov.co/relatoria/
- **Consulta sentencias**: https://www.corteconstitucional.gov.co/secretaria/
- **Contacto**: secretaria@corteconstitucional.gov.co

---

**Generado automáticamente por**: `scripts/generate-download-list.mjs`
