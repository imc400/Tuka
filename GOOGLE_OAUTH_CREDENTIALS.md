# 🔐 Google OAuth - Credenciales Guardadas

**Fecha:** 2025-11-24

---

## ✅ Credenciales Configuradas

### Supabase Project
- **Project ID:** `kscgibfmxnyfjxpcwoac`
- **Supabase URL:** `https://kscgibfmxnyfjxpcwoac.supabase.co`
- **Callback URL:** `https://kscgibfmxnyfjxpcwoac.supabase.co/auth/v1/callback`

### Google Cloud Console

#### ShopUnite Web (OAuth Client ID)
- **Client ID:** `411618353526-e2u2btfioqf9q82ru503msieuefepuqi.apps.googleusercontent.com`
- **Application Type:** Web
- **Authorized Redirect URI:** `https://kscgibfmxnyfjxpcwoac.supabase.co/auth/v1/callback`

---

## 📁 Archivos Configurados

### ✅ `.env.local`
```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=411618353526-e2u2btfioqf9q82ru503msieuefepuqi.apps.googleusercontent.com
```

### ✅ `App.tsx`
- Import de `configureGoogleSignIn` agregado (línea 70)
- useEffect configurando Google Sign In al inicio (líneas 195-202)

### ✅ `src/services/authService.ts`
- Función `configureGoogleSignIn()` implementada
- Función `signInWithGoogle()` implementada
- Función `signOutGoogle()` implementada
- Helper `ensureUserProfile()` para crear perfiles OAuth

### ✅ `src/screens/LoginScreen.tsx`
- Botón "Continuar con Google" agregado
- Handler `handleGoogleSignIn()` implementado

### ✅ `src/screens/SignUpScreen.tsx`
- Botón "Registrarse con Google" agregado
- Handler `handleGoogleSignIn()` implementado

---

## 🚀 Próximos Pasos

### 1. Configurar Google Cloud Console (si no está hecho)

Ve a [Google Cloud Console](https://console.cloud.google.com/) y:

1. **Verificar Authorized Redirect URI:**
   - Ir a OAuth 2.0 Client ID: `411618353526-e2u2btfioqf9q82ru503msieuefepuqi`
   - Verificar que esta URI esté agregada:
     ```
     https://kscgibfmxnyfjxpcwoac.supabase.co/auth/v1/callback
     ```

2. **Copiar Client Secret:**
   - En el mismo OAuth Client ID, copiar el **Client Secret**
   - Lo necesitarás para el siguiente paso

### 2. Configurar Supabase Dashboard

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac)
2. **Authentication** → **Providers** → **Google**
3. Click **Enable**
4. Pegar credenciales:
   - **Client ID:** `411618353526-e2u2btfioqf9q82ru503msieuefepuqi.apps.googleusercontent.com`
   - **Client Secret:** [Copiar desde Google Cloud Console]
5. **Save**

### 3. Reiniciar App y Probar

```bash
# Detener Expo (Ctrl+C)
# Limpiar cache y reiniciar
npx expo start -c
```

Luego:
1. Abrir app
2. Tap "Crear cuenta gratis" o "Ya tengo cuenta"
3. Tap "Continuar con Google" / "Registrarse con Google"
4. ✅ Debería abrir Google Sign In

---

## 📝 Notas Importantes

### ⚠️ Expo Go Limitation

Google Sign In **NO funciona en Expo Go** debido a limitaciones de firma de certificados.

**Soluciones:**

#### Opción A: Expo Development Build (Recomendado)
```bash
npx expo install expo-dev-client
eas build --profile development --platform ios
```

#### Opción B: Probar en Web
```bash
npx expo start --web
```
Google OAuth funciona perfectamente en web sin configuración adicional.

### ✅ Production Build

Para builds de producción (iOS/Android):
1. Google Sign In funcionará automáticamente
2. Solo necesitas los Client IDs de iOS/Android en Google Cloud Console
3. La app usará el Web Client ID internamente

---

## 🔍 Verificación

Una vez configurado Supabase y probado, deberías ver:

### En Logs de Expo:
```
✅ [App] Google Sign In configurado
✅ [AuthService] Google Sign In configurado
```

### Al hacer tap en el botón de Google:
```
🔐 [AuthService] Iniciando Google Sign In...
✅ [AuthService] Google Sign In exitoso: usuario@gmail.com
✅ [AuthService] Usuario autenticado con Supabase: abc-123-xyz
👤 [AuthService] Verificando perfil para: abc-123-xyz
📝 [AuthService] Creando nuevo perfil para usuario OAuth
✅ [AuthService] Perfil creado exitosamente
```

### En Supabase Dashboard → Authentication → Users:
- ✅ Nuevo usuario con provider: `google`
- ✅ Email del usuario de Google
- ✅ Avatar de Google

### En Supabase Dashboard → Table Editor → user_profiles:
- ✅ Perfil creado con `full_name` y `avatar_url` de Google

---

## 📚 Documentación Adicional

- Ver `GOOGLE_OAUTH_SETUP.md` para guía completa paso a paso
- Ver `AUTH_IMPROVEMENT_PLAN.md` para contexto del proyecto
- Ver `src/services/authService.ts` líneas 505-721 para implementación

---

**Estado:** ✅ Código implementado, esperando configuración final en Google Cloud Console y Supabase Dashboard.
