#!/bin/bash
#
# Descarga TODAS las sentencias de alta prioridad (8, 9, 10)
# Total: 361 sentencias
#

set -e

cd /home/lesaint/Documentos/Cursor/ColLawRAG

echo "========================================="
echo "DESCARGA MASIVA - TODAS LAS PRIORIDADES"
echo "========================================="
echo ""

# Función de descarga
download_priority() {
  local priority=$1
  local file=$2
  local total=$(wc -l < "$file")
  
  echo ""
  echo "📥 Descargando prioridad $priority ($total sentencias)..."
  echo ""
  
  local count=0
  local success=0
  local skip=0
  local fail=0
  
  while read url; do
    count=$((count + 1))
    filename=$(echo $url | grep -oP '[A-Z]+-\d+-\d+' || echo "unknown")
    filepath="data/jurisprudencia/cc/downloads/${filename}.html"
    
    # Skip si ya existe
    if [ -f "$filepath" ]; then
      echo "[$count/$total] Skip: $filename"
      skip=$((skip + 1))
      continue
    fi
    
    echo "[$count/$total] Descargando: $filename"
    if wget --timeout=30 \
           --tries=2 \
           --quiet \
           --user-agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" \
           --referer="https://www.google.com/" \
           -O "$filepath" \
           "$url" 2>/dev/null; then
      size=$(stat -c%s "$filepath" | numfmt --to=iec)
      echo "  ✓ OK ($size)"
      success=$((success + 1))
    else
      echo "  ✗ Error"
      rm -f "$filepath" 2>/dev/null
      fail=$((fail + 1))
    fi
    
    # Delay
    sleep 6
  done < "$file"
  
  echo ""
  echo "Prioridad $priority completada:"
  echo "  Exitosas: $success"
  echo "  Saltadas: $skip"
  echo "  Fallidas: $fail"
  echo ""
}

# Descargar por prioridad
download_priority 10 "data/jurisprudencia/cc/urls-prioridad-10.txt"
download_priority 9 "data/jurisprudencia/cc/urls-prioridad-9.txt"
download_priority 8 "data/jurisprudencia/cc/urls-prioridad-8.txt"

# Reporte final
echo "========================================="
echo "REPORTE FINAL"
echo "========================================="
echo ""
total_files=$(ls data/jurisprudencia/cc/downloads/*.html 2>/dev/null | wc -l)
total_size=$(du -sh data/jurisprudencia/cc/downloads/ 2>/dev/null | cut -f1)
echo "Total descargados: $total_files archivos"
echo "Tamaño total: $total_size"
echo ""
echo "Siguiente paso:"
echo "  node scripts/process-downloaded-files.mjs"
echo ""
