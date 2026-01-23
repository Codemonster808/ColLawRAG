# Comandos para Deploy

## Opción 1: Push a GitHub primero (Recomendado si Vercel está conectado a GitHub)

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG

# 1. Agregar todos los cambios
git add .

# 2. Hacer commit
git commit -m "feat: Implementación completa de features, tests y deployment

- Agregado sistema de autenticación y tiers
- Mejorada extracción de parámetros para cálculos
- Integrados procedimientos en respuestas
- Agregados tests (pipeline, API, features)
- Scripts de verificación de deployment
- Documentación completa de producción
- Middleware de rate limiting
- Health check endpoint"

# 3. Push a GitHub
git push origin main

# 4. Vercel desplegará automáticamente desde GitHub
# O puedes hacer redeploy manual desde Vercel Dashboard
```

## Opción 2: Deploy directo con Vercel CLI (sin push)

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG

# Deploy directo (usa código local, no de GitHub)
vercel --prod
```

## ⚠️ Importante

- **Si Vercel está conectado a GitHub**: Usa Opción 1 (push primero)
- **Si usas solo Vercel CLI**: Puedes usar Opción 2, pero es mejor Opción 1 para mantener sincronizado

## Verificación después del deploy

```bash
# Verificar variables de entorno
npm run verify-env

# Verificar deployment (reemplaza URL con tu dominio)
DEPLOY_URL=https://tu-proyecto.vercel.app npm run deploy-check
```
