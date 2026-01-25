# Guía de Testing en Producción

## Script de Testing Post-Deploy

El script `scripts/test-production.mjs` ejecuta una suite completa de tests para validar que el servicio funciona correctamente en producción.

## Uso

### Opción 1: Testing en Producción

```bash
DEPLOY_URL=https://col-law-rag.vercel.app npm run test-production
```

### Opción 2: Testing en Preview

```bash
DEPLOY_URL=https://col-law-rag-xxxxx.vercel.app npm run test-production
```

### Opción 3: Testing Local

```bash
# Terminal 1: Iniciar servidor local
npm run dev

# Terminal 2: Ejecutar tests
DEPLOY_URL=http://localhost:3000 npm run test-production
```

## Tests Incluidos

### 1. Tests de Health Check
- ✅ Health check retorna 200
- ✅ Status es "healthy"
- ✅ indexFile check es "ok"
- ✅ huggingFace check es "ok"

### 2. Tests de API RAG
Para cada una de estas queries:
- "¿Qué es la acción de tutela?"
- "Ley laboral colombiana sobre horas extras"
- "Requisitos de la acción de cumplimiento"

Se valida:
- ✅ Request retorna 200
- ✅ Respuesta contiene `answer` (string no vacío)
- ✅ Respuesta contiene `citations` (array con al menos 1 elemento)
- ✅ Cada cita tiene `title`, `type`, `score`
- ✅ Tiempo de respuesta < 30 segundos

### 3. Tests de Validación de Contenido
- ✅ Respuestas están en español
- ✅ Citas referencian documentos legales colombianos
- ✅ No hay PII en las respuestas (emails, teléfonos, etc.)

### 4. Tests de Rate Limiting
- ✅ 10 requests/min permitidas
- ✅ Request 11 retorna 429 (o headers de rate limit presentes)
- ✅ Headers `X-RateLimit-*` están presentes

## Salida del Script

El script muestra:
- ✅ Tests que pasan (en verde)
- ❌ Tests que fallan (en rojo)
- 📊 Reporte final con:
  - Total de tests
  - Tests pasados
  - Tests fallidos
  - Tasa de éxito
  - Lista de fallos (si hay)

## Exit Codes

- `0`: Todos los tests pasaron
- `1`: Al menos un test falló

## Ejemplo de Salida

```
🚀 Iniciando Tests de Producción
URL: https://col-law-rag.vercel.app

📋 Tests de Health Check
✅ Health check retorna 200
✅ Status es "healthy"
✅ indexFile check es "ok"
✅ huggingFace check es "ok"

📋 Tests de API RAG
✅ Request retorna 200 para: "¿Qué es la acción de tutela?"
✅ Respuesta contiene "answer" para: "¿Qué es la acción de tutela?"
...

📊 Reporte de Tests
Total de tests: 25
✅ Pasados: 25
❌ Fallidos: 0
Tasa de éxito: 100.0%

✅ Todos los tests pasaron!
```

## Troubleshooting

### Error: "fetch failed" o "ECONNREFUSED"
- Verifica que la URL es correcta
- Verifica que el servicio está desplegado y accesible
- Si es local, verifica que `npm run dev` está corriendo

### Error: "Health check unhealthy"
- Verifica variables de entorno en Vercel
- Verifica que `data/index.json` está en el build
- Revisa logs en Vercel Dashboard

### Error: "Rate limiting no funciona"
- Puede ser normal si el rate limit se resetea entre requests
- Verifica que los headers `X-RateLimit-*` están presentes

### Tests de contenido fallan
- Verifica que el índice tiene documentos reales
- Verifica que las queries son relevantes para el contenido indexado

## Integración con CI/CD

Puedes integrar este script en tu pipeline de CI/CD:

```yaml
# Ejemplo para GitHub Actions
- name: Test Production
  run: |
    DEPLOY_URL=${{ secrets.PRODUCTION_URL }} npm run test-production
```

## Notas

- Los tests pueden tardar varios minutos (especialmente los de API RAG)
- El rate limiting puede afectar los tests si se ejecutan muy rápido
- Algunos tests pueden ser flaky en el primer deploy (cold starts)
