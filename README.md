# RAG Derecho Colombiano (Next.js 14)

Consulta normativa colombiana (leyes, jurisprudencia, reglamentos) con RAG en español y citas.

## Requisitos
- Node.js >= 18.18
- Cuenta de Hugging Face y token de acceso (`HUGGINGFACE_API_KEY`)
- (Opcional) Cuenta de Pinecone si deseas ANN con index vectorial gestionado

## Instalación
```bash
npm install
cp .env.local.example .env.local
# Edita .env.local con tus claves
```

## Datos de ejemplo
En `data/documents/` se incluyen 3 documentos de ejemplo (mock). Puedes añadir más `.txt` en español.

## Ingesta de documentos
El script procesa, trocea y sube embeddings:
```bash
npm run ingest
```
- Si `PINECONE_API_KEY` y `PINECONE_INDEX` están configurados: se upserta en Pinecone (crea un índice con dimensiones propias del modelo seleccionado, p. ej., 768 para `paraphrase-multilingual-mpnet-base-v2`).
- Si no: se guarda un índice local en `data/index.json` y la API usará búsqueda local por similitud (coseno).

## Ejecutar en local
```bash
npm run dev
```
Abre `http://localhost:3000` y consulta: `Ley laboral colombiana sobre horas extras`.

## API
`POST /api/rag`
```json
{
  "query": "¿Qué dice la ley colombiana sobre horas extras?",
  "filters": { "type": "estatuto" },
  "locale": "es"
}
```
Respuesta:
```json
{
  "answer": "…",
  "citations": [{ "id": "…", "title": "…", "type": "estatuto", "url": "…", "article": "…", "score": 0.87 }],
  "retrieved": 3,
  "requestId": "uuid"
}
```

## Seguridad y compliance
- Variables de entorno para claves.
- Filtro básico de PII (correos, teléfonos, cédula, NIT) en las respuestas.
- (Opcional) `RAG_API_KEY` para proteger el endpoint con header `x-api-key`.

**🔒 Seguridad:**
- Ver [SECURITY.md](./SECURITY.md) para buenas prácticas de seguridad
- Si expusiste un token, sigue [FIX_SECRET_EXPOSURE.md](./FIX_SECRET_EXPOSURE.md)
- **NUNCA** commitees archivos `.env` o tokens en el código

## Modelos por defecto
- Embeddings: `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` (multilingüe con buen desempeño en ES).
- Generación: `mistralai/Mistral-7B-Instruct-v0.3` (accesible sin gate, optimizado para español).

## Pruebas locales
- Consultas sugeridas:
  - "Ley laboral colombiana sobre horas extras"
  - "¿Qué es la acción de tutela?"
  - "Requisitos de la acción de cumplimiento"
- Verifica que aparezcan citas [1], [2], etc. y que los enlaces funcionen si hay URL.

## Escalamiento
- Migrar a Pinecone (HNSW/IVF-ANN) para latencia baja y escala.
- Aumentar corpus y ajustar chunking (p.ej., por artículos y títulos).
- Añadir almacenamiento de feedback y re-ranking supervisado.
- Cachear resultados frecuentes (Redis) y habilitar streaming de respuestas.

## Estructura del proyecto
- `app/`: App Router y rutas API
- `components/`: UI reutilizable (`SearchBar`, `Filters`, `ResultsDisplay`)
- `lib/`: lógica RAG (`embeddings`, `retrieval`, `generation`, `rag`, `pii`)
- `scripts/ingest.ts`: ingesta y vectorización
- `data/`: documentos y `index.json` local
- `styles/`: Tailwind

## Despliegue en Vercel

✅ **Servicio en Producción**: https://col-law-rag.vercel.app

Ver [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md) para instrucciones detalladas.

**Resumen rápido:**
```bash
npm i -g vercel
vercel login
vercel --prod
```

Configura las variables de entorno en Vercel Dashboard:
- `HUGGINGFACE_API_KEY`
- `HF_EMBEDDING_MODEL`
- `HF_GENERATION_MODEL`
- `EMB_PROVIDER=hf`
- `GEN_PROVIDER=hf`

**URLs de Producción:**
- 🌐 **Frontend**: https://col-law-rag.vercel.app
- 🔍 **Health Check**: https://col-law-rag.vercel.app/api/health
- 📊 **Status Dashboard**: https://col-law-rag.vercel.app/status
- 📡 **API RAG**: https://col-law-rag.vercel.app/api/rag

Ver [PRODUCTION_URLS.md](PRODUCTION_URLS.md) para más detalles.

## Monitoreo y Estado

### Health Check

Verifica el estado del servicio:
```bash
curl https://col-law-rag.vercel.app/api/health
```

### Dashboard de Estado

Visita `/status` para ver el dashboard de estado del servicio con:
- Estado general del servicio
- Verificaciones de salud (índice, API keys)
- Información de versión
- Enlaces rápidos

### Documentación

- **[PUBLIC_ACCESS.md](./PUBLIC_ACCESS.md)**: Guía de acceso público y uso de la API
- **[docs/MONITORING.md](./docs/MONITORING.md)**: Guía completa de monitoreo y métricas
- **[docs/DEPLOYMENT_CHECKLIST.md](./docs/DEPLOYMENT_CHECKLIST.md)**: Checklist de deployment

### Optimizaciones Implementadas

- ✅ **Lazy Loading**: Módulos pesados se cargan solo cuando se necesitan (cold start < 5s)
- ✅ **Structured Logging**: Logs estructurados con Request ID y métricas
- ✅ **Caching**: Cache con TTL de 60s para queries frecuentes
- ✅ **Rate Limiting**: 10 requests/minuto por IP
- ✅ **Performance Monitoring**: Métricas de tiempo de respuesta y errores

## Datos Actuales

- **10 documentos legales** indexados (Constitución, Código Laboral, Ley 100, etc.)
- **Índice vectorial**: 1.3MB (embeddings reales)
- **Fuentes**: Funcion Pública, SUIN-Juriscol, documentos manuales

## Notas legales
Este proyecto es educativo y no sustituye asesoría legal. Verifica en fuentes oficiales (Diario Oficial, Corte Constitucional, MinTrabajo). 