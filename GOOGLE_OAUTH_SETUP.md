# 🔐 Configuración de Google OAuth

Guía paso a paso para configurar Google Sign In en ShopUnite.

---

## 📋 Resumen

Google OAuth ya está **implementado en el código**. Solo necesitas configurar:
1. **Google Cloud Console** (obtener credenciales)
2. **Supabase Dashboard** (habilitar provider)
3. **Variables de entorno** (agregar Client ID)

Tiempo estimado: **15-20 minutos**

---

## 🚀 Paso 1: Google Cloud Console

### 1.1 Crear Proyecto

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear nuevo proyecto o seleccionar existente
3. Nombre sugerido: `ShopUnite Marketplace`

### 1.2 Configurar OAuth Consent Screen

1. Ir a **APIs & Services** → **OAuth consent screen**
2. Seleccionar **External** (para usuarios públicos)
3. Completar información:
   - **App name:** ShopUnite
   - **User support email:** tu-email@ejemplo.com
   - **Developer contact:** tu-email@ejemplo.com
4. **Scopes:** Dejar los defaults (email, profile, openid) ✅
5. **Test users (opcional):** Agregar tu email para testing
6. Guardar

### 1.3 Crear OAuth 2.0 Client IDs

Necesitas crear **3 credenciales** (Web, iOS, Android):

#### **A) Web Client ID** (Para Supabase)

1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
2. Application type: **Web application**
3. Name: `ShopUnite Web`
4. **Authorized redirect URIs:**
   ```
   https://[TU_PROYECTO].supabase.co/auth/v1/callback
   ```
   Reemplaza `[TU_PROYECTO]` con tu Supabase Project ID

   Ejemplo: `https://abc123xyz.supabase.co/auth/v1/callback`

5. **Guardar** → Copiar el **Client ID**
   - Formato: `123456789-abc123xyz.apps.googleusercontent.com`

#### **B) iOS Client ID**

1. Crear nuevo OAuth Client ID
2. Application type: **iOS**
3. Name: `ShopUnite iOS`
4. **Bundle ID:** Obtener desde tu `app.json`:
   ```json
   {
     "expo": {
       "ios": {
         "bundleIdentifier": "com.tunombre.shopunite"
       }
     }
   }
   ```
5. Guardar → Copiar el **iOS Client ID**

#### **C) Android Client ID**

1. Crear nuevo OAuth Client ID
2. Application type: **Android**
3. Name: `ShopUnite Android`
4. **Package name:** Obtener desde tu `app.json`:
   ```json
   {
     "expo": {
       "android": {
         "package": "com.tunombre.shopunite"
       }
     }
   }
   ```
5. **SHA-1 certificate fingerprint:**
   - Para desarrollo/Expo Go:
     ```bash
     # Fingerprint de Expo (desarrollo)
     # Usar: D89D4E55F5D9E47FA6E4EA3E8E0D1E3AE2B0F8A1
     ```
   - Para producción, generar con:
     ```bash
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
     ```
6. Guardar → Copiar el **Android Client ID**

### 1.4 Resumen de Credenciales

Al final tendrás **3 Client IDs**:

```
Web Client ID:     123456789-abc123xyz.apps.googleusercontent.com
iOS Client ID:     987654321-ios987xyz.apps.googleusercontent.com
Android Client ID: 555666777-android555.apps.googleusercontent.com
```

**IMPORTANTE:** Solo necesitas el **Web Client ID** para el código. Los otros dos son para Google internamente.

---

## 🗄️ Paso 2: Configurar Supabase

### 2.1 Habilitar Google Provider

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleccionar tu proyecto: `ShopUnite Marketplace`
3. Ir a **Authentication** → **Providers**
4. Buscar **Google** y hacer click en **Enable**

### 2.2 Configurar Credenciales

En el formulario de Google:

1. **Google client ID:** Pegar el **Web Client ID** de Google Cloud Console
   ```
   123456789-abc123xyz.apps.googleusercontent.com
   ```

2. **Google client secret:** Pegar el **Client Secret** (se genera junto con el Client ID)
   ```
   GOCSPX-AbC123XyZ789
   ```

3. **Redirect URL:** Ya está pre-configurado por Supabase ✅
   ```
   https://[TU_PROYECTO].supabase.co/auth/v1/callback
   ```

4. **Guardar** ✅

---

## ⚙️ Paso 3: Configurar Variables de Entorno

### 3.1 Agregar Web Client ID a `.env.local`

Abrir `.env.local` y agregar:

```bash
# Google OAuth
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-abc123xyz.apps.googleusercontent.com
```

Reemplaza con tu **Web Client ID real**.

### 3.2 Configurar Google Sign In en App.tsx

El código ya está listo, solo necesitas llamar `configureGoogleSignIn()` al inicio.

Abrir `App.tsx` y agregar al inicio del componente:

```typescript
import { configureGoogleSignIn } from './src/services/authService';

export default function App() {
  // Configurar Google Sign In al montar la app
  useEffect(() => {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (webClientId) {
      configureGoogleSignIn(webClientId);
    } else {
      console.warn('⚠️  GOOGLE_WEB_CLIENT_ID no configurado');
    }
  }, []);

  // ... resto del código
}
```

---

## 🧪 Paso 4: Testing

### 4.1 Reiniciar App

```bash
# Detener Expo
# Ctrl+C

# Limpiar cache y reiniciar
npx expo start -c
```

### 4.2 Probar Flujo

1. **Abrir app** → Ver Welcome Screen
2. **Tap "Crear cuenta gratis"** o **"Ya tengo cuenta"**
3. **Tap "Continuar con Google"** o **"Registrarse con Google"**
4. **Seleccionar cuenta Google** en popup nativo
5. **Autorizar permisos** (email, profile)
6. **✅ Login exitoso** → Ver marketplace

### 4.3 Verificar en Supabase

1. Ir a **Authentication** → **Users**
2. Ver nuevo usuario con:
   - ✅ Provider: `google`
   - ✅ Email de Google
   - ✅ Avatar de Google

3. Ir a **Table Editor** → **user_profiles**
4. Ver perfil creado automáticamente con:
   - ✅ `full_name` de Google
   - ✅ `avatar_url` de Google

---

## 🐛 Troubleshooting

### Error: "Google Sign In no configurado"

**Causa:** No se llamó `configureGoogleSignIn()` al inicio

**Solución:** Agregar en `App.tsx`:
```typescript
useEffect(() => {
  configureGoogleSignIn(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!);
}, []);
```

---

### Error: "Invalid client ID"

**Causa:** Client ID incorrecto o no agregado a `.env.local`

**Solución:**
1. Verificar que el Client ID en `.env.local` coincida con Google Cloud Console
2. Reiniciar Expo: `npx expo start -c`

---

### Error: "Redirect URI mismatch"

**Causa:** Redirect URI en Google Cloud Console no coincide con Supabase

**Solución:**
1. Copiar redirect URI de Supabase (en Authentication → Providers → Google)
2. Pegar **exactamente** en Google Cloud Console → OAuth Client → Authorized redirect URIs
3. Esperar 5 minutos para que propague

---

### Error: "Access blocked: This app's request is invalid"

**Causa:** OAuth Consent Screen no configurado correctamente

**Solución:**
1. Ir a Google Cloud Console → OAuth consent screen
2. Completar todos los campos obligatorios
3. Publicar app (o agregar test users si está en testing)

---

### Usuario creado pero sin perfil

**Causa:** Problemas con `ensureUserProfile()`

**Solución:**
1. Verificar que la función se ejecuta en `authService.ts:590`
2. Revisar logs: buscar `"Creando nuevo perfil para usuario OAuth"`
3. Verificar permisos RLS en tabla `user_profiles`

---

## 📱 Configuración para Expo Go (Desarrollo)

Si usas **Expo Go** para desarrollo, Google Sign In **no funcionará** debido a limitaciones de Expo Go.

### Opciones:

#### **Opción A: Expo Development Build (Recomendado)**

```bash
# Instalar expo-dev-client
npx expo install expo-dev-client

# Crear development build
eas build --profile development --platform android
# o
eas build --profile development --platform ios
```

#### **Opción B: Testing solo en navegador (Web)**

```bash
npx expo start --web
```

Google OAuth funciona perfectamente en web sin configuración adicional.

---

## 🎉 ¡Listo!

Google Sign In ya está completamente implementado y listo para usar.

### ✅ Lo que funciona ahora:

- ✅ Botón "Continuar con Google" en LoginScreen
- ✅ Botón "Registrarse con Google" en SignUpScreen
- ✅ Flujo OAuth completo
- ✅ Creación automática de perfil
- ✅ Avatar de Google guardado
- ✅ Sesión persistente
- ✅ Sign out limpia sesión de Google

### 📝 Próximos pasos:

1. **Apple Sign In** (siguiente fase)
2. **Facebook Login** (opcional)
3. **Email verification** (nice to have)

---

## 📚 Referencias

- [Google Cloud Console](https://console.cloud.google.com/)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [React Native Google Sign In](https://github.com/react-native-google-signin/google-signin)
- [Expo Auth Session](https://docs.expo.dev/guides/authentication/)

---

**¿Preguntas?** Revisa el código en:
- `src/services/authService.ts` (líneas 505-721)
- `src/screens/LoginScreen.tsx` (líneas 99-115)
- `src/screens/SignUpScreen.tsx` (líneas 136-152)
