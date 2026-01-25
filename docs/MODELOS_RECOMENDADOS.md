# Modelos Recomendados para RAG - Eficiencia y Rendimiento

Esta guía te ayudará a elegir modelos más eficientes y rápidos para tu sistema RAG en español.

## Problema Actual

El modelo por defecto `meta-llama/llama-3.3-70b-instruct` es muy grande (70B parámetros) y puede:
- Ser muy lento (30-60+ segundos por consulta)
- No estar disponible en el router de Hugging Face
- Consumir muchos recursos
- Causar timeouts

## Modelos Recomendados para Generación (Respuestas)

### 🚀 Opción 1: Mistral 7B (Recomendado - Balance Perfecto)

**Modelo**: `mistralai/Mistral-7B-Instruct-v0.3`

**Ventajas**:
- ✅ Muy rápido (5-15 segundos)
- ✅ Excelente en español
- ✅ Optimizado para instrucciones
- ✅ Disponible en router.huggingface.co
- ✅ Gratis con API key

**Configuración**:
```bash
# En .env.local o Vercel
HF_GENERATION_MODEL=mistralai/Mistral-7B-Instruct-v0.3
```

---

### ⚡ Opción 2: Llama 3.1 8B (Muy Rápido)

**Modelo**: `meta-llama/Llama-3.1-8B-Instruct`

**Ventajas**:
- ✅ Muy rápido (3-10 segundos)
- ✅ Buen rendimiento en español
- ✅ Modelo reciente y optimizado
- ✅ Disponible en router.huggingface.co

**Configuración**:
```bash
HF_GENERATION_MODEL=meta-llama/Llama-3.1-8B-Instruct
```

---

### 🎯 Opción 3: Qwen 2.5 (Excelente para Español)

**Modelo**: `Qwen/Qwen2.5-7B-Instruct`

**Ventajas**:
- ✅ Rápido (5-12 segundos)
- ✅ Excelente en español y multilingüe
- ✅ Buen rendimiento en tareas legales
- ✅ Disponible en router.huggingface.co

**Configuración**:
```bash
HF_GENERATION_MODEL=Qwen/Qwen2.5-7B-Instruct
```

---

### 🌟 Opción 4: Llama 3.2 3B (Ultra Rápido)

**Modelo**: `meta-llama/Llama-3.2-3B-Instruct`

**Ventajas**:
- ✅ Ultra rápido (2-8 segundos)
- ✅ Muy ligero
- ✅ Buen rendimiento para consultas simples
- ⚠️ Menor calidad que modelos más grandes

**Configuración**:
```bash
HF_GENERATION_MODEL=meta-llama/Llama-3.2-3B-Instruct
```

---

## Modelos Recomendados para Embeddings (Búsqueda)

El modelo actual `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` es excelente, pero si necesitas más velocidad:

### Opción Rápida: MiniLM

**Modelo**: `sentence-transformers/all-MiniLM-L6-v2`

**Ventajas**:
- ✅ Muy rápido
- ✅ Buena calidad
- ⚠️ Menor precisión que mpnet

**Configuración**:
```bash
HF_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

---

## Comparación de Modelos

| Modelo | Tamaño | Velocidad | Calidad Español | Recomendado Para |
|--------|--------|-----------|-----------------|------------------|
| **Mistral-7B-Instruct** | 7B | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | **Producción** |
| Llama-3.1-8B-Instruct | 8B | ⚡⚡⚡ | ⭐⭐⭐⭐ | Producción |
| Qwen2.5-7B-Instruct | 7B | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | Producción |
| Llama-3.2-3B-Instruct | 3B | ⚡⚡⚡⚡ | ⭐⭐⭐ | Desarrollo/Testing |
| Llama-3.3-70B-Instruct | 70B | ⚡ | ⭐⭐⭐⭐⭐ | No recomendado (muy lento) |

---

## Cómo Cambiar el Modelo

### Opción 1: Variable de Entorno Local

1. Edita `.env.local` (o créalo si no existe):
```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
nano .env.local
```

2. Agrega o modifica:
```env
HUGGINGFACE_API_KEY=tu_api_key_aqui
HF_GENERATION_MODEL=mistralai/Mistral-7B-Instruct-v0.3
```

3. Reinicia el servidor:
```bash
# Detén el servidor (Ctrl+C) y reinicia
npm run dev
```

### Opción 2: Variable de Entorno en Vercel

1. Ve a Vercel Dashboard → Tu Proyecto
2. Settings → Environment Variables
3. Agrega o modifica `HF_GENERATION_MODEL`:
   - **Name**: `HF_GENERATION_MODEL`
   - **Value**: `mistralai/Mistral-7B-Instruct-v0.3`
   - **Environment**: Production, Preview
4. Haz un nuevo deploy

---

## Verificar que el Modelo Funciona

### Test Rápido

```bash
curl -X POST http://localhost:3000/api/rag \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"query": "¿Qué es la acción de tutela?", "locale": "es"}' \
  -w "\nTiempo: %{time_total}s\n"
```

**Resultado esperado**:
- ✅ Respuesta en menos de 15 segundos
- ✅ Respuesta con contenido relevante
- ✅ Sin errores de timeout

---

## Troubleshooting

### Error: "Model not found" o "Model unavailable"

**Causa**: El modelo no está disponible en router.huggingface.co

**Solución**: 
1. Verifica que el nombre del modelo sea correcto
2. Prueba con otro modelo de la lista
3. Verifica en https://huggingface.co/models que el modelo existe

### Error: "Timeout" o "Request timeout"

**Causa**: El modelo es muy lento o el timeout es muy corto

**Solución**:
1. Cambia a un modelo más rápido (Mistral 7B o Llama 3.1 8B)
2. Aumenta el timeout:
```bash
HF_API_TIMEOUT_MS=60000  # 60 segundos
PIPELINE_TIMEOUT_MS=90000  # 90 segundos
```

### Error: "No response" o respuesta vacía

**Causa**: El modelo no está generando respuesta o hay un error en el prompt

**Solución**:
1. Verifica los logs del servidor
2. Prueba con una consulta más simple
3. Verifica que `HUGGINGFACE_API_KEY` es válida

---

## Recomendación Final

**Para producción**: Usa `mistralai/Mistral-7B-Instruct-v0.3`
- Balance perfecto entre velocidad y calidad
- Excelente en español
- Muy estable y confiable

**Para desarrollo/testing**: Usa `meta-llama/Llama-3.2-3B-Instruct`
- Ultra rápido
- Suficiente para pruebas

---

## Próximos Pasos

1. **Cambia el modelo** a Mistral 7B o Llama 3.1 8B
2. **Reinicia el servidor**
3. **Prueba una consulta** simple
4. **Verifica los tiempos** de respuesta
5. **Ajusta timeouts** si es necesario

---

**Última actualización**: 2024-01-15
