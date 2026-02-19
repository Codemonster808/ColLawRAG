# Configurar NextAuth (Google + email) — .env y Vercel

Variables necesarias para el login con **NextAuth.js** (Google OAuth + email/contraseña).

---

## 1. Variables en `.env.local` (desarrollo)

Abre `ColLawRAG/.env.local` y completa estas cuatro variables:

| Variable | Qué es | Cómo obtenerla |
|----------|--------|------------------|
| **NEXTAUTH_SECRET** | Clave secreta para firmar cookies y tokens JWT de NextAuth | Generar: `openssl rand -base64 32` |
| **NEXTAUTH_URL** | URL base de tu app | Local: `http://localhost:3000` |
| **GOOGLE_CLIENT_ID** | ID del cliente OAuth de Google | Google Cloud Console (ver abajo) |
| **GOOGLE_CLIENT_SECRET** | Secreto del cliente OAuth de Google | Google Cloud Console (ver abajo) |

### Ejemplo en `.env.local`

```env
# NextAuth
NEXTAUTH_SECRET=tu_clave_generada_con_openssl_rand_base64_32
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 2. Obtener GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET

1. Entra a **Google Cloud Console**: https://console.cloud.google.com  
2. Crea o selecciona un **proyecto**.  
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.  
4. Si te pide configurar la pantalla de consentimiento:
   - **OAuth consent screen** → External (o Internal si es solo tu org) → Completa nombre de app, email de soporte, etc.  
5. En **Application type** elige **Web application**.  
6. **Authorized JavaScript origins** (opcional en dev, obligatorio en prod):
   - Local: `http://localhost:3000`
   - Producción: `https://col-law-rag.vercel.app` (o tu dominio)  
7. **Authorized redirect URIs** (obligatorio):
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Producción: `https://col-law-rag.vercel.app/api/auth/callback/google`  
8. Crea el cliente. Copia **Client ID** → `GOOGLE_CLIENT_ID` y **Client secret** → `GOOGLE_CLIENT_SECRET`.

---

## 3. Generar NEXTAUTH_SECRET

En la terminal:

```bash
openssl rand -base64 32
```

Copia el resultado (una línea de caracteres) y pégalo en `NEXTAUTH_SECRET` en `.env.local`.

---

## 4. Configurar en Vercel (producción)

1. **Vercel Dashboard** → tu proyecto **ColLawRAG** → **Settings** → **Environment Variables**.  
2. Añade las **mismas cuatro variables** con valores de **producción**:

| Name | Value | Environment |
|------|--------|-------------|
| `NEXTAUTH_SECRET` | (otro valor generado con `openssl rand -base64 32`, o el mismo si quieres) | Production, Preview |
| `NEXTAUTH_URL` | `https://col-law-rag.vercel.app` | Production, Preview |
| `GOOGLE_CLIENT_ID` | El mismo Client ID de Google | Production, Preview |
| `GOOGLE_CLIENT_SECRET` | El mismo Client Secret de Google | Production, Preview |

3. En Google Cloud Console, en el OAuth client, asegúrate de tener en **Authorized redirect URIs**:
   - `https://col-law-rag.vercel.app/api/auth/callback/google`  
4. **Redeploy** el proyecto en Vercel para que tome las variables.

---

## 5. Resumen rápido

- **Local:** `.env.local` con `NEXTAUTH_URL=http://localhost:3000` y las 4 variables.  
- **Vercel:** Mismas 4 variables en **Environment Variables**, con `NEXTAUTH_URL=https://col-law-rag.vercel.app` y el redirect de Google apuntando a esa URL.  
- **NEXTAUTH_SECRET:** Siempre generado con `openssl rand -base64 32`; no lo compartas ni lo subas al repo.

Cuando las cuatro variables estén definidas, el login con Google y con email/contraseña (según tu `auth-config`) funcionará en local y en Vercel.
