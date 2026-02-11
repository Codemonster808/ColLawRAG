#!/bin/bash
#
# Descarga Masiva de Sentencias - Corte Constitucional
#
# Usa wget para descargar todas las sentencias pendientes con delays
# para evitar bloqueos.
#
# Uso:
#   bash scripts/download-sentencias-batch.sh [--limit N] [--priority N]
#

set -e

# Configuración
DOWNLOAD_DIR="data/jurisprudencia/cc/downloads"
LIST_FILE="data/jurisprudencia/cc/download-list.json"
DELAY=8  # segundos entre descargas
TIMEOUT=30  # timeout por descarga
USER_AGENT="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse argumentos
LIMIT=999999
MIN_PRIORITY=1

while [[ $# -gt 0 ]]; do
  case $1 in
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    --priority)
      MIN_PRIORITY="$2"
      shift 2
      ;;
    --help)
      echo "Uso: bash scripts/download-sentencias-batch.sh [opciones]"
      echo ""
      echo "Opciones:"
      echo "  --limit N       Descargar máximo N sentencias"
      echo "  --priority N    Solo sentencias con prioridad >= N (1-10)"
      echo "  --help          Mostrar esta ayuda"
      echo ""
      echo "Ejemplos:"
      echo "  # Descargar 50 sentencias de alta prioridad"
      echo "  bash scripts/download-sentencias-batch.sh --limit 50 --priority 8"
      echo ""
      echo "  # Descargar todas las de prioridad máxima"
      echo "  bash scripts/download-sentencias-batch.sh --priority 10"
      echo ""
      echo "  # Descargar las primeras 20"
      echo "  bash scripts/download-sentencias-batch.sh --limit 20"
      exit 0
      ;;
    *)
      echo "Opción desconocida: $1"
      exit 1
      ;;
  esac
done

# Crear directorio de descargas
mkdir -p "$DOWNLOAD_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}DESCARGA MASIVA DE SENTENCIAS${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Directorio: ${YELLOW}$DOWNLOAD_DIR${NC}"
echo -e "Delay entre descargas: ${YELLOW}${DELAY}s${NC}"
echo -e "Límite: ${YELLOW}$LIMIT${NC}"
echo -e "Prioridad mínima: ${YELLOW}$MIN_PRIORITY${NC}"
echo ""

# Verificar que existe jq
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq no está instalado${NC}"
    echo "Instalar con: sudo apt-get install jq"
    exit 1
fi

# Verificar que existe wget
if ! command -v wget &> /dev/null; then
    echo -e "${RED}Error: wget no está instalado${NC}"
    echo "Instalar con: sudo apt-get install wget"
    exit 1
fi

# Contar sentencias a descargar
TOTAL=$(jq -r "[.[] | select(.estado == \"pendiente\" and .prioridad >= $MIN_PRIORITY)] | length" "$LIST_FILE")
if [ "$TOTAL" -lt "$LIMIT" ]; then
  TO_DOWNLOAD=$TOTAL
else
  TO_DOWNLOAD=$LIMIT
fi

echo -e "${GREEN}Total de sentencias pendientes: $TOTAL${NC}"
echo -e "${GREEN}Sentencias a descargar: $TO_DOWNLOAD${NC}"
echo ""

# Confirmar
read -p "¿Continuar con la descarga? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelado."
    exit 0
fi

echo ""
echo -e "${BLUE}Iniciando descarga...${NC}"
echo ""

# Estadísticas
SUCCESS=0
FAILED=0
SKIPPED=0
COUNT=0

# Extraer URLs y descargar
jq -r ".[] | select(.estado == \"pendiente\" and .prioridad >= $MIN_PRIORITY) | .id + \"|\" + .url" "$LIST_FILE" | head -n "$LIMIT" | while IFS='|' read -r ID URL; do
  COUNT=$((COUNT + 1))
  
  # Nombre del archivo
  FILENAME="${ID}.html"
  FILEPATH="$DOWNLOAD_DIR/$FILENAME"
  
  # Si ya existe, skip
  if [ -f "$FILEPATH" ]; then
    echo -e "${YELLOW}[$COUNT/$TO_DOWNLOAD] SKIP: $ID (ya existe)${NC}"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi
  
  echo -e "${BLUE}[$COUNT/$TO_DOWNLOAD] Descargando: $ID${NC}"
  echo -e "  URL: $URL"
  
  # Descargar con wget
  if wget --quiet \
         --timeout=$TIMEOUT \
         --tries=3 \
         --user-agent="$USER_AGENT" \
         --referer="https://www.google.com/" \
         --header="Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
         --header="Accept-Language: es-CO,es;q=0.9,en;q=0.8" \
         -O "$FILEPATH" \
         "$URL"; then
    
    # Verificar que el archivo tiene contenido
    SIZE=$(stat -c%s "$FILEPATH")
    if [ "$SIZE" -gt 1000 ]; then
      echo -e "${GREEN}  ✓ Descargado: $SIZE bytes${NC}"
      SUCCESS=$((SUCCESS + 1))
    else
      echo -e "${RED}  ✗ Archivo muy pequeño (posible error): $SIZE bytes${NC}"
      rm -f "$FILEPATH"
      FAILED=$((FAILED + 1))
    fi
  else
    echo -e "${RED}  ✗ Error en descarga${NC}"
    rm -f "$FILEPATH"
    FAILED=$((FAILED + 1))
  fi
  
  # Delay antes de siguiente descarga (excepto en la última)
  if [ $COUNT -lt $TO_DOWNLOAD ]; then
    echo -e "  ${YELLOW}Esperando ${DELAY}s...${NC}"
    sleep $DELAY
  fi
  
  echo ""
done

# Reporte final
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}REPORTE FINAL${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Total descargadas: ${GREEN}$SUCCESS${NC}"
echo -e "Saltadas (ya existían): ${YELLOW}$SKIPPED${NC}"
echo -e "Fallidas: ${RED}$FAILED${NC}"
echo ""

if [ $SUCCESS -gt 0 ]; then
  echo -e "${GREEN}Archivos guardados en: $DOWNLOAD_DIR${NC}"
  echo ""
  echo -e "${YELLOW}Siguiente paso:${NC}"
  echo -e "  node scripts/process-downloaded-files.mjs"
  echo ""
fi
