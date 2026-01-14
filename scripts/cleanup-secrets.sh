#!/bin/bash
# Script para limpiar secretos del historial de Git
# ⚠️ ADVERTENCIA: Este script reescribe el historial de Git
# Solo ejecutar si estás seguro de lo que haces

set -e

echo "🔒 Limpieza de Secretos del Historial de Git"
echo "=============================================="
echo ""
echo "⚠️  ADVERTENCIA: Este script reescribirá el historial de Git"
echo "   Asegúrate de haber:"
echo "   1. Revocado el token expuesto"
echo "   2. Creado un nuevo token"
echo "   3. Actualizado las variables de entorno en Vercel"
echo "   4. Hecho backup del repositorio"
echo ""
read -p "¿Continuar? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Operación cancelada"
    exit 1
fi

# Token expuesto (reemplazar con el token real que se expuso)
# Ejemplo: OLD_TOKEN="hf_XXXXXXXXXXXX"
OLD_TOKEN="hf_XXXXXXXXXXXX"
REPLACEMENT="TU_HUGGINGFACE_API_KEY"

echo ""
echo "📝 Limpiando historial..."
echo "   Buscando: $OLD_TOKEN"
echo "   Reemplazando con: $REPLACEMENT"
echo ""

# Crear archivo temporal con el mapeo de reemplazo
TEMP_FILE=$(mktemp)
echo "$OLD_TOKEN==>$REPLACEMENT" > "$TEMP_FILE"

# Verificar si git-filter-repo está instalado
if command -v git-filter-repo &> /dev/null; then
    echo "✅ Usando git-filter-repo..."
    git filter-repo --replace-text "$TEMP_FILE" --force
elif command -v bfg &> /dev/null; then
    echo "✅ Usando BFG Repo-Cleaner..."
    bfg --replace-text "$TEMP_FILE"
    git reflog expire --expire=now --all
    git gc --prune=now --aggressive
else
    echo "❌ Error: Necesitas instalar git-filter-repo o BFG Repo-Cleaner"
    echo ""
    echo "Instalar git-filter-repo:"
    echo "  pip install git-filter-repo"
    echo ""
    echo "O descargar BFG:"
    echo "  https://rtyley.github.io/bfg-repo-cleaner/"
    rm "$TEMP_FILE"
    exit 1
fi

rm "$TEMP_FILE"

echo ""
echo "✅ Historial limpiado"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Verifica los cambios: git log"
echo "   2. Si todo está bien, haz force push:"
echo "      git push origin --force --all"
echo "   3. Notifica a tu equipo si trabajas en colaboración"
echo ""

