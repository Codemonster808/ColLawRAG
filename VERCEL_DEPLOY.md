# Guía de Despliegue en Vercel

## Prerequisitos

1. Cuenta en Vercel (gratis): https://vercel.com
2. CLI de Vercel instalado: `npm i -g vercel`
3. Repositorio en GitHub (opcional, pero recomendado)

## Pasos de Despliegue

### Opción 1: Deploy desde CLI (Recomendado)

```bash
# 1. Login en Vercel
vercel login

# 2. Desde el directorio del proyecto
cd /home/lesaint/Documentos/Cursor/ColLawRAG

# 3. Deploy (primera vez)
vercel

# 4. Deploy a producción
vercel --prod
```

### Opción 2: Deploy desde GitHub (Automático)

1. Sube el código a GitHub:
```bash
git init
git add .
git commit -m "Initial commit: RAG Derecho Colombiano"
git remote add origin https://github.com/TU_USUARIO/ColLawRAG.git
git push -u origin main
```

2. En Vercel Dashboard:
   - Ve a https://vercel.com/new
   - Conecta tu repositorio de GitHub
   - Vercel detectará automáticamente Next.js

### Configurar Variables de Entorno en Vercel

1. En el Dashboard de Vercel, ve a tu proyecto
2. Settings → Environment Variables
3. Agrega las siguientes variables:

```
HUGGINGFACE_API_KEY=TU_HUGGINGFACE_API_KEY
HF_EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-mpnet-base-v2
HF_GENERATION_MODEL=mistralai/Mistral-7B-Instruct-v0.3
EMB_PROVIDER=hf
GEN_PROVIDER=hf
```

4. Aplica a: Production, Preview, Development

### Notas Importantes

- El archivo `data/index.json` debe estar en el repositorio (ya no está en .gitignore)
- Si el build falla, verifica que `data/index.json` exista localmente antes de hacer commit
- Vercel tiene límites de tamaño de función (50MB). Si `index.json` crece mucho, considera migrar a Pinecone
- El tiempo de build puede ser 2-5 minutos la primera vez

### Verificar Despliegue

Después del deploy, visita:
- URL de producción: `https://TU_PROYECTO.vercel.app`
- Prueba una consulta: "Ley laboral colombiana sobre horas extras"

### Troubleshooting

**Error: "data/index.json not found"**
- Ejecuta `npm run ingest` localmente
- Asegúrate de que `data/index.json` esté en el commit
- Verifica que no esté en .gitignore

**Error: "HUGGINGFACE_API_KEY not set"**
- Verifica las variables de entorno en Vercel Dashboard
- Asegúrate de aplicarlas a todos los ambientes (Production, Preview, Development)

**Build timeout**
- Vercel tiene límite de 45 minutos para builds
- Si es muy lento, considera optimizar el proceso de ingestion

