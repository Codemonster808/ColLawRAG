# 🔒 Guía de Seguridad

## ⚠️ Tokens y Secretos Expuestos

Si accidentalmente has expuesto un token o secreto en el repositorio:

### 1. Revocar el Token Inmediatamente

**Hugging Face:**
1. Ve a https://huggingface.co/settings/tokens
2. Encuentra el token expuesto
3. Haz clic en **Delete** o **Revoke**
4. Crea un nuevo token con un nombre diferente

**Otros servicios:**
- Revoca cualquier token/API key que haya sido expuesto
- Crea nuevos tokens con nombres únicos para este proyecto

### 2. Actualizar Variables de Entorno

**En Vercel:**
1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. **Settings** → **Environment Variables**
4. Actualiza `HUGGINGFACE_API_KEY` con el nuevo token
5. Asegúrate de que esté configurado para **Production** y **Preview**

**Localmente:**
1. Actualiza tu archivo `.env.local` con el nuevo token
2. **NUNCA** hagas commit de `.env.local` o archivos con tokens

### 3. Limpiar el Historial de Git

Si el token está en commits anteriores, debes limpiar el historial:

```bash
# Opción A: Usar git filter-repo (recomendado)
# Instalar: pip install git-filter-repo
git filter-repo --path PASOS_DEPLOY.md --path VERCEL_DEPLOY.md --invert-paths --force

# Opción B: Usar BFG Repo-Cleaner
# Descargar: https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --replace-text tokens.txt
# Donde tokens.txt contiene: hf_XXXXXXXXXXXX==>TU_HUGGINGFACE_API_KEY

# Después de limpiar, hacer force push (⚠️ solo si es necesario)
git push origin --force --all
```

**⚠️ ADVERTENCIA:** Force push reescribe el historial. Asegúrate de que todos los colaboradores estén al tanto.

### 4. Verificar que No Queden Secretos

```bash
# Buscar posibles tokens en el código
grep -r "hf_[A-Za-z0-9]\{30,\}" --exclude-dir=node_modules --exclude-dir=.next
grep -r "sk-[A-Za-z0-9]\{30,\}" --exclude-dir=node_modules --exclude-dir=.next
```

## 📋 Buenas Prácticas

### ✅ HACER

- ✅ Usar variables de entorno para todos los secretos
- ✅ Agregar archivos sensibles a `.gitignore`
- ✅ Usar `.env.example` como plantilla (sin valores reales)
- ✅ Revisar commits antes de hacer push
- ✅ Usar GitHub Secret Scanning (activado por defecto)
- ✅ Rotar tokens periódicamente
- ✅ Usar tokens con permisos mínimos necesarios

### ❌ NO HACER

- ❌ Committear archivos `.env` o `.env.local`
- ❌ Incluir tokens en documentación o comentarios
- ❌ Subir screenshots que contengan tokens
- ❌ Compartir tokens por email, chat o mensajes
- ❌ Usar el mismo token en múltiples proyectos
- ❌ Ignorar alertas de GitHub Secret Scanning

## 🔐 Archivos Protegidos

Los siguientes archivos/patrones están en `.gitignore` y **NUNCA** deben ser commiteados:

- `.env*` - Todos los archivos de entorno
- `*_api_key.txt` - Archivos con API keys
- `.vercel` - Configuración de Vercel (puede contener secrets)
- `huggin_face_api_key.txt` - Archivo específico con token

## 🚨 Si Detectas un Secreto Expuesto

1. **Inmediatamente:** Revoca el token/secreto
2. **Limpia el historial:** Usa git filter-repo o BFG
3. **Actualiza variables:** En todos los servicios (Vercel, local, etc.)
4. **Notifica al equipo:** Si trabajas en equipo
5. **Revisa logs:** Verifica si el token fue usado por terceros

## 📚 Recursos

- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [Git Filter Repo](https://github.com/newren/git-filter-repo)
- [BFG Repo Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

