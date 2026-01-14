# 🔒 Plan de Acción: Resolver Exposición de Token

Este documento guía el proceso completo para resolver la exposición del token de Hugging Face de manera segura y definitiva.

## ⚠️ Estado Actual

- ❌ Token de Hugging Face expuesto en commits anteriores
- ❌ Token visible en archivos de documentación (ya removido)
- ✅ Token removido de archivos actuales
- ⏳ Pendiente: Limpiar historial de Git y rotar token

---

## 📋 Plan de Acción (Paso a Paso)

### Paso 1: Revocar el Token Expuesto ⏱️ 2 minutos

1. Ve a https://huggingface.co/settings/tokens
2. Busca el token que empieza con `hf_XXXXXXXXXXXX`
3. Haz clic en **Delete** o **Revoke**
4. ✅ **Confirmación:** El token ya no aparece en la lista

**⚠️ IMPORTANTE:** No continúes hasta haber revocado el token.

---

### Paso 2: Crear un Nuevo Token ⏱️ 2 minutos

1. En https://huggingface.co/settings/tokens
2. Haz clic en **New token**
3. Configuración:
   - **Name:** `ColLawRAG-Production-2026` (usa un nombre único con fecha)
   - **Type:** **Read** (suficiente para la API)
   - **Expiration:** Opcional (recomendado: 1 año)
4. Haz clic en **Generate token**
5. **Copia el token inmediatamente** (solo se muestra una vez)
6. ✅ **Guardar en lugar seguro temporalmente** (no en el código)

---

### Paso 3: Actualizar Variables de Entorno en Vercel ⏱️ 3 minutos

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto `col-law-rag`
3. Ve a **Settings** → **Environment Variables**
4. Busca `HUGGINGFACE_API_KEY`
5. Haz clic en los tres puntos (...) → **Edit**
6. Reemplaza el valor con el **nuevo token**
7. Verifica que esté configurado para:
   - ✅ **Production**
   - ✅ **Preview**
   - ❌ **Development** (NO debe estar)
8. Haz clic en **Save**
9. ✅ **Verificación:** El valor muestra `••••••••` (oculto)

**💡 Tip:** Si tienes múltiples variables, actualiza todas de una vez.

---

### Paso 4: Actualizar Variables Locales ⏱️ 1 minuto

1. Abre tu archivo `.env.local` (si existe)
2. Actualiza `HUGGINGFACE_API_KEY` con el nuevo token
3. ✅ **Verificación:** `cat .env.local | grep HUGGINGFACE_API_KEY` (debe mostrar el nuevo token)

---

### Paso 5: Limpiar el Historial de Git ⏱️ 10-15 minutos

**Opción A: Usar git-filter-repo (Recomendado)**

```bash
# 1. Instalar git-filter-repo
pip install git-filter-repo

# 2. Ir al directorio del proyecto
cd /home/lesaint/Documentos/Cursor/ColLawRAG

# 3. Crear backup (opcional pero recomendado)
git clone . ../ColLawRAG-backup

# 4. Ejecutar el script de limpieza
./scripts/cleanup-secrets.sh

# O manualmente:
git filter-repo --replace-text <(echo "hf_XXXXXXXXXXXX==>TU_HUGGINGFACE_API_KEY") --force
```

**Opción B: Usar BFG Repo-Cleaner**

```bash
# 1. Descargar BFG: https://rtyley.github.io/bfg-repo-cleaner/
# 2. Crear archivo de reemplazo
echo "hf_XXXXXXXXXXXX==>TU_HUGGINGFACE_API_KEY" > tokens.txt

# 3. Ejecutar BFG
java -jar bfg.jar --replace-text tokens.txt

# 4. Limpiar referencias
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

**Opción C: Permitir el Secret en GitHub (Solo si es token de prueba)**

Si el token ya fue revocado y es solo para pruebas:

1. Ve al enlace proporcionado por GitHub:
   ```
   https://github.com/Codemonster808/ColLawRAG/security/secret-scanning/unblock-secret/37w9u6PR16CMvtwo4ZjRtE6fiAR
   ```
2. Haz clic en **Allow this secret**
3. ⚠️ **Solo haz esto si el token ya fue revocado**

---

### Paso 6: Verificar la Limpieza ⏱️ 2 minutos

```bash
# Verificar que el token no esté en el código actual
grep -r "hf_XXXXXXXXXXXX" --exclude-dir=node_modules --exclude-dir=.next

# Debe retornar: (nada)

# Verificar el historial (últimos commits)
git log --all --full-history --oneline | head -10

# Verificar archivos modificados
git status
```

✅ **Resultado esperado:** No debe aparecer el token antiguo en ningún lugar.

---

### Paso 7: Hacer Commit y Push ⏱️ 2 minutos

```bash
# Agregar cambios
git add SECURITY.md FIX_SECRET_EXPOSURE.md scripts/cleanup-secrets.sh
git add PASOS_DEPLOY.md VERCEL_DEPLOY.md

# Commit
git commit -m "security: Remove exposed API key and add security documentation"

# Si limpiaste el historial, necesitarás force push
# ⚠️ ADVERTENCIA: Solo si limpiaste el historial
git push origin --force --all

# Si NO limpiaste el historial, push normal
git push
```

---

### Paso 8: Verificar que Todo Funciona ⏱️ 5 minutos

1. **Verificar en Vercel:**
   - Ve a tu proyecto en Vercel
   - Haz un nuevo deploy (si es necesario)
   - Verifica que el deploy sea exitoso

2. **Probar la aplicación:**
   - Visita la URL de producción
   - Haz una consulta de prueba
   - Verifica que devuelva resultados correctamente

3. **Verificar logs:**
   - En Vercel Dashboard → Deployments → [último deploy] → Functions
   - Verifica que no haya errores relacionados con el API key

✅ **Resultado esperado:** La aplicación funciona correctamente con el nuevo token.

---

## ✅ Checklist Final

- [ ] Token antiguo revocado en Hugging Face
- [ ] Nuevo token creado y guardado de forma segura
- [ ] Variables de entorno actualizadas en Vercel
- [ ] Variables locales actualizadas (si aplica)
- [ ] Historial de Git limpiado (o secret permitido en GitHub)
- [ ] Cambios commiteados y pusheados
- [ ] Aplicación funcionando correctamente en producción
- [ ] Documentación de seguridad actualizada

---

## 🚨 Si Algo Sale Mal

### Error: "Token inválido" en producción
- Verifica que el nuevo token esté correctamente configurado en Vercel
- Asegúrate de que el token tenga permisos **Read**
- Verifica que no haya espacios extra en la variable de entorno

### Error: "Force push rejected"
- Verifica que tengas permisos de administrador en el repositorio
- Si trabajas en equipo, coordina el force push
- Considera crear una nueva rama y hacer merge

### Error: "Secret still detected"
- El token puede estar en otros archivos o commits
- Ejecuta: `git log --all --full-history -S "hf_XXXXXXXXXXXX" --source --all`
- Si aparece, necesitas limpiar esos commits también

---

## 📚 Recursos Adicionales

- [SECURITY.md](./SECURITY.md) - Guía completa de seguridad
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [Git Filter Repo](https://github.com/newren/git-filter-repo)
- [BFG Repo Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

---

## 🎯 Resumen

**Tiempo total estimado:** ~25-30 minutos

**Resultado:** 
- ✅ Token expuesto revocado
- ✅ Nuevo token en uso
- ✅ Historial limpio (o secret permitido)
- ✅ Aplicación funcionando
- ✅ Buenas prácticas implementadas

**Próximos pasos:**
- Revisar [SECURITY.md](./SECURITY.md) regularmente
- Implementar rotación periódica de tokens (cada 6-12 meses)
- Configurar alertas para detección temprana de secretos

