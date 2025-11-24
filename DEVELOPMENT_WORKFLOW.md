# 🚀 Flujo de Desarrollo - ShopUnite

**Última actualización:** 2025-11-24

---

## 📱 Stack de Desarrollo

- **Framework:** React Native + Expo (SDK 54)
- **Development Build:** expo-dev-client
- **iOS:** Xcode + CocoaPods
- **Android:** Android Studio (opcional, podés usar solo EAS)
- **Backend:** Supabase
- **Auth:** Email/Password + Google OAuth
- **Payments:** Mercado Pago

---

## 🔄 Flujos de Trabajo

### 1️⃣ Desarrollo Diario (Local)

**Para iOS:**
```bash
npx expo run:ios
```

**Para Android:**
```bash
npx expo run:android
```

**Características:**
- ✅ Hot reload activo
- ✅ Módulos nativos funcionando (Google Sign In, etc.)
- ✅ Debugging con React DevTools
- ✅ Simulador/Emulador local
- ✅ Rápido (solo compila cambios)

**¿Cuándo usar?**
- Durante desarrollo de features
- Testing rápido de cambios
- Debugging de errores

---

### 2️⃣ Builds para Testing (EAS Cloud)

**Development Build:**
```bash
# iOS
eas build --profile development --platform ios

# Android
eas build --profile development --platform android
```

**¿Cuándo usar?**
- Compartir con clientes/testers
- Testing en dispositivos físicos sin cable
- QA antes de producción

---

### 3️⃣ Builds de Producción (Para las Tiendas)

**Production Build:**
```bash
# iOS (App Store)
eas build --profile production --platform ios

# Android (Play Store)
eas build --profile production --platform android
```

**¿Cuándo usar?**
- Release a usuarios finales
- Subir a App Store Connect
- Subir a Google Play Console

---

## 🛠️ Comandos Útiles

### Limpiar y Reiniciar

```bash
# Limpiar cache de Expo
npx expo start -c

# Limpiar pods de iOS (si hay errores)
cd ios && pod deintegrate && pod install && cd ..

# Limpiar build de iOS
rm -rf ios/build

# Limpiar build de Android
cd android && ./gradlew clean && cd ..
```

### Ver Logs en Tiempo Real

```bash
# iOS Simulator
xcrun simctl spawn booted log stream --predicate 'process == "shopunite"'

# Android Emulator
adb logcat *:S ReactNative:V ReactNativeJS:V
```

### Actualizar Dependencias

```bash
# Actualizar todas las dependencias de Expo
npx expo install --check

# Actualizar CocoaPods (iOS)
cd ios && pod repo update && pod update && cd ..
```

---

## 📦 Estructura del Proyecto

```
shopunite-marketplace/
├── ios/                    # Proyecto nativo iOS (generado)
├── android/                # Proyecto nativo Android (generado)
├── src/
│   ├── components/         # Componentes reutilizables
│   ├── screens/            # Pantallas
│   ├── services/           # Lógica de negocio (authService, etc.)
│   ├── contexts/           # Context API (AuthContext)
│   ├── types/              # TypeScript types
│   └── utils/              # Utilidades
├── supabase/
│   ├── functions/          # Edge Functions
│   └── migrations/         # Migraciones de DB
├── App.tsx                 # Entry point
├── app.json                # Configuración de Expo
├── eas.json                # Configuración de EAS Build
└── .env.local              # Variables de entorno
```

---

## 🔑 Variables de Entorno

### `.env.local` (Development)

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://kscgibfmxnyfjxpcwoac.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Google OAuth
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=411618353526-e2u2btfioqf9q82ru503msieuefepuqi.apps.googleusercontent.com

# Mercado Pago
EXPO_PUBLIC_MP_PUBLIC_KEY=your-mp-public-key

# Gemini AI (para descripciones de productos)
GEMINI_API_KEY=your-gemini-key
```

---

## 🎯 Checklist Antes de Cada Release

### Pre-Release (Development)

- [ ] Correr tests localmente: `npm test`
- [ ] Verificar que no hay errores en consola
- [ ] Probar flujo completo de compra
- [ ] Verificar Google OAuth funciona
- [ ] Verificar notificaciones push
- [ ] Probar en iOS Simulator
- [ ] Probar en Android Emulator

### Release a Testers

- [ ] Crear build de desarrollo: `eas build --profile development`
- [ ] Compartir link de instalación
- [ ] Recolectar feedback

### Release a Producción

- [ ] Incrementar versión en `app.json`
- [ ] Actualizar changelog
- [ ] Crear build de producción: `eas build --profile production`
- [ ] Subir a App Store Connect / Play Console
- [ ] Verificar metadata (screenshots, descripción)
- [ ] Submit para review

---

## 🐛 Troubleshooting Común

### Error: "Module not found: RNGoogleSignin"

**Causa:** Estás usando Expo Go (no soporta módulos nativos)

**Solución:**
```bash
npx expo run:ios  # o run:android
```

---

### Error: "CocoaPods could not find compatible versions"

**Solución:**
```bash
cd ios
rm -rf Pods Podfile.lock
pod repo update
pod install
cd ..
npx expo run:ios
```

---

### Error: "Command PhaseScriptExecution failed"

**Solución:**
```bash
# Limpiar DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData

# Reinstalar pods
cd ios && pod deintegrate && pod install && cd ..

# Rebuild
npx expo run:ios
```

---

### Build muy lento

**iOS:**
```bash
# Limpiar build cache
rm -rf ios/build
npx expo run:ios
```

**Android:**
```bash
cd android
./gradlew clean
cd ..
npx expo run:android
```

---

## 📊 Performance Tips

### 1. Optimizar Builds de iOS

En `ios/Podfile`, agregar:
```ruby
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings["EXCLUDED_ARCHS[sdk=iphonesimulator*]"] = "arm64"
    end
  end
end
```

### 2. Habilitar Hermes (JavaScript Engine)

En `app.json`:
```json
{
  "expo": {
    "android": {
      "jsEngine": "hermes"
    },
    "ios": {
      "jsEngine": "hermes"
    }
  }
}
```

---

## 🔐 Security Checklist

### Antes de Cada Release

- [ ] No hay API keys hardcoded en el código
- [ ] Todas las secrets están en `.env.local` (no commiteado)
- [ ] Row Level Security (RLS) habilitado en todas las tablas de Supabase
- [ ] Validación de inputs en backend (Edge Functions)
- [ ] HTTPS obligatorio para todas las requests
- [ ] Tokens de auth tienen expiración
- [ ] Logs no exponen información sensible

---

## 📱 Testing en Dispositivos

### iOS

**Opción 1: Simulator (gratis)**
```bash
npx expo run:ios
```

**Opción 2: Dispositivo físico**
1. Conectar iPhone con cable
2. En Xcode: Product → Destination → Tu iPhone
3. `npx expo run:ios --device`

**Opción 3: TestFlight**
```bash
eas build --profile development --platform ios
# Subir a TestFlight via App Store Connect
```

### Android

**Opción 1: Emulador (gratis)**
```bash
npx expo run:android
```

**Opción 2: Dispositivo físico**
1. Habilitar USB Debugging en el teléfono
2. Conectar con cable
3. `adb devices` para verificar
4. `npx expo run:android --device`

**Opción 3: Direct APK Install**
```bash
eas build --profile development --platform android
# Descargar APK e instalar directamente
```

---

## 🎓 Recursos

### Documentación Oficial
- [Expo Docs](https://docs.expo.dev/)
- [React Native Docs](https://reactnavigation.org/)
- [Supabase Docs](https://supabase.com/docs)
- [EAS Build Docs](https://docs.expo.dev/build/introduction/)

### Tu Proyecto
- `GOOGLE_OAUTH_SETUP.md` - Setup de Google OAuth
- `GOOGLE_OAUTH_CREDENTIALS.md` - Credenciales guardadas
- `AUTH_IMPROVEMENT_PLAN.md` - Plan de autenticación
- `SHIPPING_IMPLEMENTATION_GUIDE.md` - Sistema de envíos

---

## 🚀 Next Steps

Una vez que tengas el development build corriendo:

1. **Probar Google OAuth** en el simulador/dispositivo
2. **Implementar Apple Sign In** (siguiente fase del plan)
3. **Configurar EAS Build** para builds en la nube
4. **Setup CI/CD** con GitHub Actions (opcional)

---

**¿Dudas?** Revisar los otros docs en este proyecto o consultar la documentación oficial de Expo.
