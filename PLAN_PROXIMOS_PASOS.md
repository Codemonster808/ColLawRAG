# 📋 Plan de Próximos Pasos - ColLawRAG

Este documento describe los pasos siguientes para mejorar y completar el proyecto ColLawRAG.

---

## 🎯 Objetivos Principales

1. **Optimizar rendimiento y confiabilidad**
2. **Mejorar calidad de respuestas RAG**
3. **Aumentar cobertura de documentos legales**
4. **Mejorar experiencia de usuario**
5. **Preparar para escalamiento**

---

## 📅 Fase 1: Estabilización y Optimización (Prioridad Alta)

### 1.1. Resolver problema de persistencia de índices en Vercel

**Problema actual**: Los índices se descargan en runtime (fallback), agregando 10-15 segundos al primer request.

**Tareas**:
- [ ] Investigar por qué los archivos `.gz` no persisten del build al runtime
- [ ] Verificar si `outputFileTracingIncludes` funciona correctamente
- [ ] Considerar usar Vercel Blob Storage para almacenar índices
- [ ] Alternativa: Usar CDN (Cloudflare R2, AWS S3) para servir índices
- [ ] Documentar solución final

**Estimación**: 2-3 días

---

### 1.2. Optimizar cold start de funciones serverless

**Problema actual**: El primer request tarda 10-15 segundos (descarga + descompresión).

**Tareas**:
- [ ] Implementar warm-up de funciones (cron job que llama a `/api/health`)
- [ ] Optimizar descompresión (usar streams en lugar de cargar todo en memoria)
- [ ] Considerar usar Edge Functions para endpoints que no necesitan índices
- [ ] Implementar cache compartido (Redis) para índices entre invocaciones
- [ ] Medir y documentar mejoras

**Estimación**: 3-4 días

---

### 1.3. Mejorar manejo de errores y logging

**Tareas**:
- [ ] Implementar structured logging con niveles (error, warn, info, debug)
- [ ] Agregar correlation IDs para rastrear requests end-to-end
- [ ] Integrar con servicio de logging (Vercel Logs, Datadog, Sentry)
- [ ] Crear dashboard de monitoreo de errores
- [ ] Documentar códigos de error y cómo resolverlos

**Estimación**: 2-3 días

---

## 📅 Fase 2: Mejoras de Calidad RAG (Prioridad Media-Alta)

### 2.1. Mejorar chunking de documentos legales

**Problema actual**: Los chunks pueden perder contexto (artículos divididos, referencias cruzadas perdidas).

**Tareas**:
- [ ] Implementar chunking semántico (usar modelos de embeddings para detectar límites semánticos)
- [ ] Mejorar preservación de contexto (agregar contexto de artículo/capítulo a cada chunk)
- [ ] Implementar chunking jerárquico (artículo → párrafo → oración)
- [ ] Agregar metadata de relaciones (artículo X referencia artículo Y)
- [ ] Evaluar calidad de chunks con métricas (coherencia, completitud)

**Estimación**: 5-7 días

---

### 2.2. Mejorar re-ranking y scoring

**Tareas**:
- [ ] Implementar cross-encoder real (en lugar de heurísticas)
- [ ] Ajustar pesos de hybrid search (BM25 + embeddings)
- [ ] Agregar boost por recencia de documentos
- [ ] Implementar re-ranking basado en jerarquía legal
- [ ] Evaluar con queries de prueba y ajustar parámetros

**Estimación**: 4-5 días

---

### 2.3. Mejorar prompts para generación

**Tareas**:
- [ ] Crear prompts especializados por tipo de consulta (comparativa, procedimental, factual)
- [ ] Implementar few-shot examples en prompts
- [ ] Agregar validación de citas en el prompt
- [ ] Mejorar manejo de consultas ambiguas
- [ ] A/B testing de diferentes prompts

**Estimación**: 3-4 días

---

## 📅 Fase 3: Expansión de Datos (Prioridad Media)

### 3.1. Aumentar cobertura de documentos legales

**Tareas**:
- [ ] Scrapear más códigos (Código de Procedimiento Administrativo, Código de Policía, etc.)
- [ ] Agregar jurisprudencia de más cortes (Consejo de Estado, Corte Suprema)
- [ ] Incluir decretos reglamentarios recientes
- [ ] Agregar resoluciones de entidades (Superintendencia de Industria y Comercio, etc.)
- [ ] Implementar scraper para actualizaciones automáticas

**Estimación**: 7-10 días

---

### 3.2. Mejorar metadata de documentos

**Tareas**:
- [ ] Extraer fechas de vigencia automáticamente
- [ ] Detectar modificaciones y derogaciones
- [ ] Agregar relaciones entre documentos (X modifica Y)
- [ ] Implementar sistema de versionado de documentos
- [ ] Crear índice de vigencia actualizado

**Estimación**: 5-7 días

---

## 📅 Fase 4: Mejoras de UX (Prioridad Media)

### 4.1. Mejorar interfaz de usuario

**Tareas**:
- [ ] Agregar modo oscuro
- [ ] Implementar búsqueda avanzada (filtros por tipo, fecha, área legal)
- [ ] Agregar historial de búsquedas
- [ ] Implementar favoritos/guardados
- [ ] Mejorar visualización de citas (tooltips, enlaces directos)

**Estimación**: 5-7 días

---

### 4.2. Agregar funcionalidades adicionales

**Tareas**:
- [ ] Implementar exportación de respuestas (PDF, DOCX)
- [ ] Agregar comparación de documentos
- [ ] Implementar alertas de cambios en documentos seguidos
- [ ] Agregar calculadora legal mejorada (más tipos de cálculos)
- [ ] Crear API pública documentada

**Estimación**: 7-10 días

---

## 📅 Fase 5: Escalamiento y Producción (Prioridad Baja)

### 5.1. Optimizar para alto tráfico

**Tareas**:
- [ ] Implementar rate limiting más sofisticado (por usuario, por IP)
- [ ] Agregar cache de respuestas (Redis)
- [ ] Implementar CDN para assets estáticos
- [ ] Optimizar queries de embeddings (batch processing)
- [ ] Considerar usar Pinecone/Weaviate para índices grandes

**Estimación**: 5-7 días

---

### 5.2. Mejorar seguridad

**Tareas**:
- [ ] Implementar autenticación de usuarios
- [ ] Agregar autorización por roles
- [ ] Implementar API keys para acceso programático
- [ ] Agregar rate limiting por usuario/tier
- [ ] Implementar auditoría de acceso

**Estimación**: 7-10 días

---

### 5.3. Monitoreo y observabilidad

**Tareas**:
- [ ] Implementar métricas de negocio (queries por día, documentos más consultados)
- [ ] Agregar alertas proactivas (errores, latencia alta)
- [ ] Crear dashboard de analytics
- [ ] Implementar tracing distribuido
- [ ] Documentar runbooks para operaciones

**Estimación**: 5-7 días

---

## 🔧 Tareas Técnicas Específicas

### Mejoras Inmediatas (Esta Semana)

1. **Actualizar endpoint `/api/debug`**:
   - [ ] Agregar verificación de archivos en `/tmp`
   - [ ] Mostrar información de descarga en runtime
   - [ ] Agregar métricas de rendimiento (tiempo de carga, tamaño de índices)

2. **Documentar proceso de deployment**:
   - [ ] Crear guía paso a paso para nuevos deployments
   - [ ] Documentar troubleshooting común
   - [ ] Crear checklist pre-deployment

3. **Mejorar tests**:
   - [ ] Agregar tests de integración para API RAG
   - [ ] Tests de carga para verificar límites
   - [ ] Tests de regresión para bugs conocidos

---

## 📊 Métricas de Éxito

### Rendimiento
- [ ] Cold start < 5 segundos
- [ ] Warm requests < 2 segundos
- [ ] Uptime > 99.9%

### Calidad
- [ ] Precisión de citas > 95%
- [ ] Relevancia de respuestas > 90% (evaluación manual)
- [ ] Cobertura de documentos > 80% de leyes principales

### Escalabilidad
- [ ] Soporte para 1000+ queries/día
- [ ] Índices de 50,000+ chunks sin degradación
- [ ] Costo por query < $0.01

---

## 🚀 Próximos Pasos Inmediatos (Esta Semana)

1. **Día 1-2**: Investigar y resolver persistencia de índices en Vercel
2. **Día 3**: Implementar warm-up de funciones serverless
3. **Día 4**: Mejorar logging y monitoreo
4. **Día 5**: Actualizar documentación y crear guías

---

## 📝 Notas

- **Prioridades**: Las fases están ordenadas por prioridad, pero algunas tareas pueden hacerse en paralelo
- **Estimaciones**: Son aproximadas y pueden variar según complejidad y dependencias
- **Iteración**: Este plan debe actualizarse regularmente según progreso y feedback

---

**Última actualización**: 2026-02-09  
**Próxima revisión**: 2026-02-16
