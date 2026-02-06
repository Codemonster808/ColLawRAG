# Guía de Deploy: Mejoras para Consultas Complejas

**Fecha**: 2025-01-27

---

## ✅ Cambios Implementados

Las siguientes mejoras han sido implementadas y están listas para deploy:

1. **Detección de complejidad mejorada** - Sistema más sofisticado para detectar consultas complejas
2. **Top-K adaptativo** - Recupera más chunks para consultas complejas (16 vs 8)
3. **Max tokens adaptativo** - Genera más tokens para consultas complejas (3000+ vs 2000)
4. **Contexto adaptativo** - Más citations y contexto para consultas complejas
5. **Prompts mejorados** - Instrucciones específicas para consultas complejas
6. **Validaciones mejoradas** - Habilitadas por defecto para premium

---

## 📋 Pasos para Deploy

### 1. Verificar Cambios Locales

```bash
cd ColLawRAG
git status
```

### 2. Hacer Commit (si no se hizo)

```bash
git add app/api/rag/route.ts lib/generation.ts lib/prompt-templates.ts lib/rag.ts docs/
git commit -m "feat: Mejoras para consultas complejas"
```

### 3. Push a GitHub

```bash
git push origin main
```

### 4. Deploy Automático en Vercel

Si tienes integración automática con GitHub, Vercel detectará el push y desplegará automáticamente.

**O manualmente**:
1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto `ColLawRAG`
3. Click en "Deployments" → "Redeploy" (último deployment)
4. O espera a que se despliegue automáticamente

---

## 🔧 Variables de Entorno (Opcionales)

Las siguientes variables de entorno son **opcionales** pero recomendadas:

### Para Habilitar Validaciones (Opcional)

```bash
ENABLE_FACTUAL_VALIDATION=true      # Validación factual (opcional, default: solo premium)
ENABLE_CITATION_VALIDATION=true     # Validación de citas (opcional, default: solo premium)
```

### Para Ajustar Tokens (Opcional)

```bash
HF_MAX_TOKENS=2000                  # Base max tokens (default: 2000)
                                     # Se ajusta automáticamente según complejidad:
                                     # - Alta: 3000+
                                     # - Media: 2400
                                     # - Baja: 2000
```

**Nota**: Estas variables son opcionales. El sistema funciona con los defaults, pero puedes ajustarlas si necesitas más control.

---

## ✅ Verificación Post-Deploy

### 1. Health Check

```bash
curl https://tu-dominio.vercel.app/api/health
```

Debería responder con `{"status":"ok"}`

### 2. Probar Consulta Simple

```bash
curl -X POST https://tu-dominio.vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -d '{"query": "¿Qué son las cesantías?"}'
```

### 3. Probar Consulta Compleja

```bash
curl -X POST https://tu-dominio.vercel.app/api/rag \
  -H "Content-Type: application/json" \
  -d '{"query": "Compara los requisitos y plazos para interponer una acción de tutela versus una acción de cumplimiento cuando una entidad pública no cumple con una sentencia de la Corte Constitucional."}'
```

**Verificar**:
- ✅ La consulta compleja debería recuperar más chunks (12-16 vs 8)
- ✅ La respuesta debería ser más completa y estructurada
- ✅ Debería incluir instrucciones específicas para consultas comparativas

---

## 📊 Monitoreo

Después del deploy, monitorea:

1. **Tiempo de respuesta**: Las consultas complejas pueden tardar más (normal)
2. **Uso de tokens**: Verifica que no excedas límites de Hugging Face
3. **Calidad de respuestas**: Compara respuestas antes/después de las mejoras

---

## 🔄 Rollback (si es necesario)

Si necesitas hacer rollback:

```bash
git revert HEAD
git push origin main
```

O desde Vercel Dashboard:
1. Ve a "Deployments"
2. Encuentra el deployment anterior
3. Click en "..." → "Promote to Production"

---

## 📝 Notas

- Las mejoras son **backward compatible**: consultas simples siguen funcionando igual
- Las mejoras se activan automáticamente según la complejidad detectada
- No se requieren cambios en el frontend
- Las validaciones están habilitadas por defecto para usuarios premium

---

## 🎯 Próximos Pasos

Después del deploy exitoso:

1. Monitorear métricas de uso
2. Recopilar feedback de usuarios
3. Ajustar parámetros según resultados reales
4. Considerar implementar RAG recursivo para consultas muy complejas
