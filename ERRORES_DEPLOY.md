# 📋 Log de Errores de Deploy - Vercel

Este documento registra todos los errores de deploy en Vercel para facilitar el debugging y seguimiento de problemas.

---

## 📊 Resumen de Deploys

| Fecha | Commit | Estado | Error | Resuelto |
|-------|--------|--------|-------|----------|
| 2026-02-09 17:52 | `26a5001` | ❌ Error | Comillas sin escapar en JSX | ✅ Sí |

---

## 🔴 Errores de Deploy

### Deploy #1 - 2026-02-09 17:52 (Commit: `26a5001`)

**Estado**: ❌ Error  
**Tiempo de build**: ~1 minuto  
**Causa del fallo**: Error de linting en `app/terminos/page.tsx`

#### Error Completo
```
Failed to compile.

./app/terminos/page.tsx
83:44  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
83:53  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
83:57  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
83:78  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities

Error: Command "npm run download-indices && npm run build" exited with 1
```

#### Contexto del Deploy
- **Build machine**: Washington, D.C., USA (East) – iad1
- **Configuración**: 2 cores, 8 GB
- **Node.js**: 20.x (forzado por `package.json`)
- **Next.js**: 14.2.35
- **Tiempo de descarga de índices**: ~1 segundo
- **Compilación**: ✅ Exitosa
- **Linting**: ❌ Falló

#### Log Completo del Build
```
17:52:46.490 Running build in Washington, D.C., USA (East) – iad1
17:52:46.491 Build machine configuration: 2 cores, 8 GB
17:52:46.605 Cloning github.com/Codemonster808/ColLawRAG (Branch: main, Commit: 26a5001)
17:52:47.805 Cloning completed: 1.200s
17:52:47.854 Found .vercelignore
17:52:47.899 Removed 35 ignored files defined in .vercelignore
17:52:48.127 Restored build cache from previous deployment (gfUYJ7tqu1deHafeVM4YEm4hxonC)
17:52:48.440 Warning: Due to "engines": { "node": "20.x" } in your `package.json` file, the Node.js Version defined in your Project Settings ("24.x") will not apply, Node.js Version "20.x" will be used instead.
17:52:49.745 Running "install" command: `npm install`...
17:52:59.058 up to date, audited 770 packages in 9s
17:52:59.172 Detected Next.js version: 14.2.35
17:52:59.172 Running "npm run download-indices && npm run build"
17:52:59.330 > col-law-rag@0.1.0 download-indices
17:52:59.330 > node scripts/download-indices.mjs
17:53:00.218 ✅ Descargado en 0.7s
17:53:00.466 ✅ Descargado en 0.2s
17:53:00.466 ✅ ¡Índices descargados exitosamente! (modo Vercel - solo .gz)
17:53:30.437 > col-law-rag@0.1.0 build
17:53:30.438 > next build
17:53:31.141 ▲ Next.js 14.2.35
17:53:39.490 ✓ Compiled successfully
17:53:39.491 Linting and checking validity of types ...
17:53:46.438 Failed to compile.
17:53:46.439 ./app/terminos/page.tsx
17:53:46.447 83:44  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
17:53:46.447 83:53  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
17:53:46.447 83:57  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
17:53:46.447 83:78  Error: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
17:53:46.482 Error: Command "npm run download-indices && npm run build" exited with 1
```

#### Solución Aplicada
- **Archivo**: `app/terminos/page.tsx`
- **Línea**: 83
- **Fix**: Reemplazar comillas dobles literales (`"`) con entidades HTML (`&quot;`)
- **Commit de fix**: (pendiente de push)
- **Referencia**: Ver [Bug #9 en BUGS_RESUELTOS.md](./BUGS_RESUELTOS.md#9-comillas-sin-escapar-en-jsx-causan-error-de-build)

#### Observaciones
- El build compiló exitosamente, pero falló en la fase de linting
- Solo apareció en producción (Vercel), no en desarrollo local
- El error bloquea completamente el deploy
- Hay múltiples warnings de TypeScript (`@typescript-eslint/no-explicit-any`) que no bloquean el build

---

## 📝 Notas Generales

### Proceso de Debugging
1. Revisar logs completos en Vercel Dashboard
2. Identificar la fase del build que falla (install, compile, lint, type-check)
3. Reproducir localmente si es posible
4. Aplicar fix y documentar en `BUGS_RESUELTOS.md`
5. Verificar que el nuevo deploy sea exitoso

### Errores Comunes
- **Linting errors**: Bloquean el build en producción
- **Type errors**: Bloquean el build en producción
- **Warnings**: No bloquean el build, pero deberían corregirse

### Mejores Prácticas
- Ejecutar `npm run build` localmente antes de hacer push
- Configurar pre-commit hooks para linting
- Revisar warnings de TypeScript regularmente
- Documentar todos los errores de deploy para referencia futura

---

**Última actualización**: 2026-02-09  
**Total de deploys con error**: 1  
**Deploys exitosos**: (verificar en Vercel Dashboard)
