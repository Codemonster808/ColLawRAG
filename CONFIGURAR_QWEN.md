# Configurar Qwen 2.5 7B - Guía Rápida

## ✅ Configuración Completada

Ya se configuró `HF_GENERATION_MODEL=Qwen/Qwen2.5-7B-Instruct` en tu `.env.local`.

## 🔄 Pasos para Aplicar el Cambio

### 1. Verificar que HUGGINGFACE_API_KEY está configurada

```bash
cd /home/lesaint/Documentos/Cursor/ColLawRAG
cat .env.local | grep HUGGINGFACE_API_KEY
```

Si no está configurada, agrega:
```bash
echo "HUGGINGFACE_API_KEY=tu_api_key_aqui" >> .env.local
```

### 2. Reiniciar el Servidor

**IMPORTANTE**: El servidor necesita reiniciarse para cargar la nueva configuración.

```bash
# Detén el servidor actual (Ctrl+C en la terminal donde corre)
# Luego reinicia:
npm run dev
```

### 3. Verificar que Funciona

Una vez reiniciado, prueba una consulta:

```bash
curl -X POST http://localhost:3000/api/rag \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"query": "¿Qué es la acción de tutela?", "locale": "es"}' \
  -w "\n⏱️  Tiempo: %{time_total}s\n"
```

O desde el navegador en `http://localhost:3000`

## 📊 Características de Qwen 2.5 7B

- ✅ **Excelente en español** - Entrenado con datos multilingües
- ✅ **Rápido** - 5-12 segundos por consulta típicamente
- ✅ **Buena calidad** - Especialmente bueno para tareas legales
- ✅ **Disponible** - En router.huggingface.co

## 🔍 Verificar Configuración Actual

```bash
# Ver qué modelo está configurado
cat .env.local | grep HF_GENERATION_MODEL

# Debería mostrar:
# HF_GENERATION_MODEL=Qwen/Qwen2.5-7B-Instruct
```

## ⚠️ Si el Servidor No Responde

1. **Verifica que el servidor se reinició** después de cambiar `.env.local`
2. **Verifica los logs** del servidor para ver qué modelo está usando
3. **Verifica que HUGGINGFACE_API_KEY es válida**

## 📝 Para Producción (Vercel)

Si vas a desplegar en Vercel, también configura la variable allí:

1. Ve a Vercel Dashboard → Tu Proyecto
2. Settings → Environment Variables
3. Agrega o modifica:
   - **Name**: `HF_GENERATION_MODEL`
   - **Value**: `Qwen/Qwen2.5-7B-Instruct`
   - **Environment**: Production, Preview
4. Haz un nuevo deploy

---

**Última actualización**: 2024-01-15
