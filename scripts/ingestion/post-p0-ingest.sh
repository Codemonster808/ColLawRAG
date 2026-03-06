#!/bin/bash
# Ejecutar TRAS completar node scripts/ingest.mjs (P0 Fix T5)
# Uso: ./scripts/post-p0-ingest.sh
set -e
cd "$(dirname "$0")/.."

echo "=== 1. Validar metadata.title sin codigo codigo ==="
bad=$(node -e 'const d=JSON.parse(require("fs").readFileSync("data/index.json","utf8")); const b=d.filter(c=>/codigo codigo/.test(c.metadata?.title||"")); console.log(b.length)')
if [ "$bad" != "0" ]; then
  echo "❌ Aún hay $bad chunks con codigo codigo. Verificar ingest."
  exit 1
fi
echo "✅ metadata.title OK (0 chunks con codigo codigo)"

echo ""
echo "=== 2. Build BM25 y HNSW ==="
npm run build-bm25
npm run build-hnsw

echo ""
echo "=== 3. Re-anotar ground truth (requiere npm run dev) ==="
echo "   Ejecutar en otra terminal: npm run dev"
echo "   Luego: node scripts/annotate-retrieval-ground-truth.mjs --url http://localhost:3000 --limit 50"

echo ""
echo "=== 4. Evaluar retrieval y accuracy ==="
node scripts/evaluate-retrieval.mjs --url http://localhost:3000 --limit 30
JUDGE_PROVIDER=groq node scripts/evaluate-accuracy.mjs --url http://localhost:3000 --limit 50 --output data/benchmarks/results-post-p0-$(date +%Y-%m-%d).json

echo ""
echo "✅ T5 completado. Verificar 0 alucinaciones Código Penal en LAB-004, CIV-001, ADM-001."
