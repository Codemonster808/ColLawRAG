# URLs de Producción - RAG Derecho Colombiano

## 🌐 URLs Principales

### Producción (Alias Principal)
**URL**: https://col-law-rag.vercel.app

Este es el alias principal del servicio. Usa esta URL para acceso público.

### URL de Deployment Específico
**URL**: https://col-law-o3ih1otqq-codemonster808s-projects.vercel.app

Esta es la URL específica del último deployment. Se actualiza con cada nuevo deploy.

---

## 📍 Endpoints Disponibles

### 1. Health Check
**Endpoint**: `GET /api/health`

**URLs**:
- https://col-law-rag.vercel.app/api/health
- https://col-law-o3ih1otqq-codemonster808s-projects.vercel.app/api/health

**Respuesta esperada**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T...",
  "checks": {
    "indexFile": { "status": "ok" },
    "huggingFace": { "status": "ok" }
  },
  "version": "0.1.0"
}
```

### 2. API RAG (Consulta Legal)
**Endpoint**: `POST /api/rag`

**URLs**:
- https://col-law-rag.vercel.app/api/rag
- https://col-law-o3ih1otqq-codemonster808s-projects.vercel.app/api/rag

**Ejemplo de uso**:
```bash
curl -X POST https://col-law-rag.vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -d '{
    "query": "¿Qué es la acción de tutela?",
    "locale": "es"
  }'
```

### 3. Frontend (Interfaz Web)
**URL**: https://col-law-rag.vercel.app

Interfaz web para hacer consultas directamente desde el navegador.

---

## 🔍 Verificación de Estado

### Health Check Rápido
```bash
curl https://col-law-rag.vercel.app/api/health
```

### Test de API RAG
```bash
curl -X POST https://col-law-rag.vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "locale": "es"}'
```

---

## 📊 Información del Deployment

- **Proyecto**: col-law-rag
- **Plataforma**: Vercel
- **Región**: Washington, D.C., USA (East) – iad1
- **Framework**: Next.js 14.2.35
- **Último Deploy**: $(date +%Y-%m-%d)

---

## 🔗 Enlaces Útiles

- **Vercel Dashboard**: https://vercel.com/codemonster808s-projects/col-law-rag
- **Inspect Deployment**: https://vercel.com/codemonster808s-projects/col-law-rag/v3LASK3p7Svhc6ngcELaSFmCrDDB
- **Logs**: Usa `vercel logs` o el dashboard de Vercel

---

## ⚙️ Configuración

### Variables de Entorno Configuradas

Las siguientes variables deben estar configuradas en Vercel Dashboard:

- `HUGGINGFACE_API_KEY` - API key de Hugging Face (requerida)
- `HF_EMBEDDING_MODEL` - Modelo de embeddings (opcional)
- `HF_GENERATION_MODEL` - Modelo de generación (opcional, default: Qwen/Qwen2.5-7B-Instruct)
- `EMB_PROVIDER` - Proveedor de embeddings (opcional, default: hf)
- `GEN_PROVIDER` - Proveedor de generación (opcional, default: hf)

Ver [docs/VERCEL_ENV_SETUP.md](docs/VERCEL_ENV_SETUP.md) para más detalles.

---

## 🚀 Próximos Pasos

1. ✅ Deploy completado
2. ⏳ Verificar health check
3. ⏳ Ejecutar tests end-to-end
4. ⏳ Configurar monitoreo
5. ⏳ Documentar acceso público

---

**Última actualización**: 2024-01-15
