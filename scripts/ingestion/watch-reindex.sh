#!/usr/bin/env bash
# Sigue en vivo el log del re-index (ingest.mjs) en otra ventana.
# Uso: ./scripts/watch-reindex.sh   (o bash scripts/watch-reindex.sh)

TERMINALS_DIR="${CURSOR_TERMINALS_DIR:-$HOME/.cursor/projects/home-lesaint-Documentos-Cursor/terminals}"
if [[ ! -d "$TERMINALS_DIR" ]]; then
  echo "No se encontró carpeta de terminales. Variable CURSOR_TERMINALS_DIR=$CURSOR_TERMINALS_DIR"
  exit 1
fi

LOG=""
for f in "$TERMINALS_DIR"/*.txt; do
  [[ -f "$f" ]] || continue
  if grep -q "ingest.mjs\|Generando embeddings" "$f" 2>/dev/null; then
    LOG="$f"
    break
  fi
done

if [[ -z "$LOG" ]]; then
  echo "No se encontró ningún proceso de re-index en curso."
  echo "Para iniciar uno: cd ColLawRAG && node scripts/ingest.mjs"
  exit 1
fi

echo "=== Siguiendo re-index (Ctrl+C para salir) ==="
echo "Log: $LOG"
echo ""
tail -f "$LOG"
