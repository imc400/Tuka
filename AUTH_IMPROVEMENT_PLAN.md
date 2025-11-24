# 🔐 Plan de Mejora: Sistema de Autenticación

**Fecha:** 2025-11-24
**Objetivo:** Mejorar el flujo de autenticación para nuevos usuarios

---

## 🎯 Requerimientos

### 1. Primera Pantalla para Nuevos Usuarios
- Usuarios nuevos deben ver pantalla de bienvenida/auth PRIMERO
- Usuarios con sesión activa van directo al marketplace
- Sesión persistente (ya implementado con Supabase ✅)

### 2. Social Login
- Google Sign In
- Apple Sign In
- Facebook Login (opcional)

### 3. UX Mejorada
- Pantalla de bienvenida atractiva
- Opción de "Explorar sin cuenta" (browse-only mode)
- Onboarding smooth

---

## 📊 Estado Actual

### ✅ Lo que YA funciona:
- Auth básico con email/contraseña
- Persistencia de sesión (Supabase)
- Context API para estado global
- Perfiles de usuario en BD
- Login y SignUp screens

### ❌ Lo que falta:
- Auth screen no es primera pantalla
- No hay social login
- No hay pantalla de bienvenida para nuevos usuarios

---

## 🚀 Implementación

### Fase 1: Auth como Primera Pantalla ⭐ (CRÍTICO)

**Objetivo:** Usuarios nuevos ven auth ANTES del marketplace.

#### 1.1 Modificar App.tsx

**Lógica actual:**
```tsx
// Siempre muestra el marketplace
<View className="flex-1">
  {view === ViewState.HOME && renderHome()}
  {view === ViewState.LOGIN && <LoginScreen />}
  ...
</View>
```

**Nueva lógica:**
```tsx
function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  // Loading
  if (isLoading) {
    return <SplashScreen />;
  }

  // NO autenticado → mostrar Welcome/Auth
  if (!isAuthenticated) {
    return <WelcomeFlow />;
  }

  // Autenticado → mostrar Marketplace
  return <MarketplaceApp />;
}
```

#### 1.2 Crear WelcomeFlow Component

**Archivo:** `src/components/WelcomeFlow.tsx`

```tsx
import React, { useState } from 'react';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';

type WelcomeView = 'welcome' | 'login' | 'signup';

export function WelcomeFlow() {
  const [view, setView] = useState<WelcomeView>('welcome');

  if (view === 'welcome') {
    return <WelcomeScreen
      onLogin={() => setView('login')}
      onSignUp={() => setView('signup')}
    />;
  }

  if (view === 'login') {
    return <LoginScreen
      onNavigate={(v) => {
        if (v === 'signup') setView('signup');
        else if (v === 'welcome') setView('welcome');
      }}
    />;
  }

  if (view === 'signup') {
    return <SignUpScreen
      onNavigate={(v) => {
        if (v === 'login') setView('login');
        else if (v === 'welcome') setView('welcome');
      }}
    />;
  }

  return null;
}
```

#### 1.3 Crear WelcomeScreen

**Archivo:** `src/screens/WelcomeScreen.tsx`

```tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity, SafeAreaView } from 'react-native';
import { ShoppingBag, Store, Heart } from 'lucide-react-native';

interface WelcomeScreenProps {
  onLogin: () => void;
  onSignUp: () => void;
  onBrowse?: () => void; // Opcional: explorar sin cuenta
}

export default function WelcomeScreen({ onLogin, onSignUp, onBrowse }: WelcomeScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-indigo-600 to-indigo-800">
      <View className="flex-1 justify-between p-6">

        {/* Logo y Título */}
        <View className="items-center mt-16">
          <View className="bg-white p-6 rounded-3xl shadow-xl mb-6">
            <ShoppingBag size={64} color="#4F46E5" strokeWidth={2} />
          </View>

          <Text className="text-4xl font-bold text-white text-center mb-3">
            ShopUnite
          </Text>

          <Text className="text-lg text-indigo-200 text-center px-8">
            Un solo lugar para comprar en todas tus tiendas favoritas
          </Text>
        </View>

        {/* Features */}
        <View className="space-y-4 my-8">
          <FeatureItem
            icon={<Store size={24} color="white" />}
            text="Todas tus tiendas en un solo carrito"
          />
          <FeatureItem
            icon={<ShoppingBag size={24} color="white" />}
            text="Pago único para múltiples tiendas"
          />
          <FeatureItem
            icon={<Heart size={24} color="white" />}
            text="Seguimiento de pedidos en tiempo real"
          />
        </View>

        {/* Botones */}
        <View className="space-y-3">
          <TouchableOpacity
            onPress={onSignUp}
            className="bg-white py-4 rounded-2xl shadow-lg"
          >
            <Text className="text-indigo-600 font-bold text-center text-lg">
              Crear cuenta
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onLogin}
            className="bg-indigo-700 py-4 rounded-2xl border-2 border-white"
          >
            <Text className="text-white font-bold text-center text-lg">
              Iniciar sesión
            </Text>
          </TouchableOpacity>

          {onBrowse && (
            <TouchableOpacity
              onPress={onBrowse}
              className="py-3"
            >
              <Text className="text-indigo-200 text-center">
                Explorar sin cuenta
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Footer */}
        <Text className="text-indigo-300 text-xs text-center mt-4">
          Al continuar, aceptas nuestros Términos y Política de Privacidad
        </Text>
      </View>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View className="flex-row items-center space-x-3 bg-white/10 p-4 rounded-xl">
      {icon}
      <Text className="text-white text-base flex-1">{text}</Text>
    </View>
  );
}
```

---

### Fase 2: Social Login ⭐⭐ (IMPORTANTE)

Supabase soporta OAuth nativo. Solo necesitamos configuración.

#### 2.1 Configurar en Supabase Dashboard

**Pasos:**
1. Ir a Supabase Dashboard → Authentication → Providers
2. Habilitar Google, Apple, Facebook
3. Configurar OAuth credentials

#### 2.2 Google Sign In

**Instalar dependencias:**
```bash
npx expo install @react-native-google-signin/google-signin
npx expo install expo-auth-session expo-crypto
```

**Configurar Google Cloud Console:**
1. Crear OAuth 2.0 credentials
2. Obtener Client ID
3. Configurar redirect URIs

**Implementar en authService.ts:**

```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configurar Google Sign In
GoogleSignin.configure({
  webClientId: 'TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
});

export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();

    const { idToken } = userInfo;

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken!,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Crear/actualizar perfil
    if (data.user) {
      await ensureUserProfile(data.user);
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error con Google Sign In',
    };
  }
}
```

#### 2.3 Apple Sign In

**Instalar:**
```bash
npx expo install expo-apple-authentication
```

**Implementar:**

```typescript
import * as AppleAuthentication from 'expo-apple-authentication';

export async function signInWithApple(): Promise<AuthResult> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const { identityToken } = credential;

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken!,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Crear/actualizar perfil
    if (data.user) {
      await ensureUserProfile(data.user, {
        full_name: credential.fullName?.givenName
          ? `${credential.fullName.givenName} ${credential.fullName.familyName}`.trim()
          : undefined,
      });
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error con Apple Sign In',
    };
  }
}

async function ensureUserProfile(user: User, additionalData?: Partial<UserProfile>) {
  // Verificar si ya existe perfil
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!existing) {
    // Crear perfil nuevo
    await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        full_name: additionalData?.full_name || user.user_metadata?.full_name || '',
        avatar_url: user.user_metadata?.avatar_url,
        created_at: new Date().toISOString(),
      });
  }
}
```

#### 2.4 Actualizar LoginScreen con botones sociales

```tsx
import { signInWithGoogle, signInWithApple } from '../services/authService';

// En LoginScreen.tsx

{/* Social Login Buttons */}
<View className="space-y-3 mt-6">
  <TouchableOpacity
    onPress={async () => {
      const result = await signInWithGoogle();
      if (result.success) {
        // Ya autenticado, AuthContext actualiza automáticamente
      } else {
        Alert.alert('Error', result.error);
      }
    }}
    className="flex-row items-center justify-center bg-white border border-gray-300 py-3 rounded-xl"
  >
    <Image source={require('../assets/google-icon.png')} className="w-5 h-5 mr-2" />
    <Text className="font-semibold text-gray-700">Continuar con Google</Text>
  </TouchableOpacity>

  {Platform.OS === 'ios' && (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={12}
      style={{ width: '100%', height: 48 }}
      onPress={async () => {
        const result = await signInWithApple();
        if (!result.success) {
          Alert.alert('Error', result.error);
        }
      }}
    />
  )}
</View>

{/* Divider */}
<View className="flex-row items-center my-6">
  <View className="flex-1 h-px bg-gray-300" />
  <Text className="mx-4 text-gray-500">o continúa con email</Text>
  <View className="flex-1 h-px bg-gray-300" />
</View>

{/* Email/Password form */}
```

---

### Fase 3: Modo "Explorar sin cuenta" (Opcional)

**Feature:** Permitir browsing sin autenticación, pero requerir cuenta para:
- Agregar al carrito
- Hacer checkout
- Ver pedidos

**Implementación:**

```tsx
// En AppContent()
const [guestMode, setGuestMode] = useState(false);

if (!isAuthenticated && !guestMode) {
  return <WelcomeFlow onBrowse={() => setGuestMode(true)} />;
}

// Si está en guest mode, mostrar banner
{guestMode && (
  <View className="bg-yellow-50 px-4 py-3 border-b border-yellow-200">
    <Text className="text-yellow-800 text-sm text-center">
      Explorando como invitado ·
      <TouchableOpacity onPress={() => {
        setGuestMode(false);
        setView(ViewState.LOGIN);
      }}>
        <Text className="text-yellow-900 font-bold"> Crear cuenta</Text>
      </TouchableOpacity>
    </Text>
  </View>
)}

// Al intentar agregar al carrito en guest mode
if (guestMode) {
  Alert.alert(
    'Crear cuenta',
    'Necesitas una cuenta para agregar productos al carrito',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Crear cuenta', onPress: () => {
        setGuestMode(false);
        setView(ViewState.SIGNUP);
      }}
    ]
  );
  return;
}
```

---

## 📋 Checklist de Implementación

### Fase 1: Auth Primera Pantalla (2-3 horas)
- [ ] Crear `WelcomeFlow` component
- [ ] Crear `WelcomeScreen` con diseño atractivo
- [ ] Modificar `App.tsx` para mostrar WelcomeFlow primero
- [ ] Agregar SplashScreen para loading
- [ ] Testing: nueva instalación debe mostrar welcome

### Fase 2: Google OAuth (2-3 horas)
- [ ] Crear proyecto en Google Cloud Console
- [ ] Configurar OAuth en Supabase
- [ ] Instalar dependencias (`@react-native-google-signin`)
- [ ] Implementar `signInWithGoogle()` en authService
- [ ] Agregar botón Google en LoginScreen y SignUpScreen
- [ ] Testing: sign in con Google debe crear perfil

### Fase 3: Apple Sign In (1-2 horas)
- [ ] Configurar Apple Developer Account
- [ ] Configurar OAuth en Supabase
- [ ] Instalar `expo-apple-authentication`
- [ ] Implementar `signInWithApple()`
- [ ] Agregar botón Apple (solo iOS)
- [ ] Testing: sign in con Apple debe funcionar

### Fase 4: Polish (1 hora)
- [ ] Agregar animaciones smooth
- [ ] Mejorar mensajes de error
- [ ] Agregar "¿Olvidaste tu contraseña?"
- [ ] Términos y Política de Privacidad
- [ ] Testing E2E completo

---

## 🎯 Prioridades

### MVP (Mínimo Viable):
1. ✅ **Welcome Screen first** (crítico)
2. ✅ **Google OAuth** (muy importante - mayoría de usuarios)
3. ⚠️ **Apple Sign In** (importante para iOS)

### Nice to Have:
4. Facebook Login
5. Modo guest/explorar sin cuenta
6. Email verification
7. Two-factor authentication

---

## 🚀 Próximos Pasos Inmediatos

### Opción A: Rápido (Solo Fase 1) - 2-3 horas
Implementar solo Welcome Screen como primera pantalla.
- UX mucho mejor
- Usuarios nuevos ven auth primero
- Sesión ya persiste ✅

### Opción B: Completo (Fases 1-3) - 6-8 horas
Implementar Welcome + Social Login.
- UX premium
- Fricción mínima (1-click signup)
- Tasa de conversión más alta

**Recomendación:** Empezar con Opción A (Welcome Screen) y agregar social login después.

---

## 📝 Notas Técnicas

### Supabase Auth
- ✅ Ya configurado
- ✅ Persistencia automática
- ✅ Context API funcionando
- ✅ Refresh tokens automático

### OAuth Providers
Supabase soporta nativamente:
- Google
- Apple
- Facebook
- GitHub
- Twitter
- Discord
- Etc.

Solo requiere:
1. Habilitar en dashboard
2. Configurar credentials
3. Llamar `supabase.auth.signInWithIdToken()`

### Session Management
```typescript
// Ya implementado ✅
supabase.auth.onAuthStateChange((event, session) => {
  // Actualiza estado automáticamente
  // Persiste en AsyncStorage
  // Refresca tokens
});
```

---

**¿Quieres que implemente primero la Fase 1 (Welcome Screen como primera pantalla)?**

Es lo más crítico y mejorará inmediatamente la UX para nuevos usuarios.
