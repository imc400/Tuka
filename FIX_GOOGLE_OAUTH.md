# 🔧 Arreglar Google OAuth - Checklist

## ✅ Paso 1: Verificar Google Cloud Console

1. Ir a: https://console.cloud.google.com/apis/credentials
2. Verificar que tengas **3 OAuth Client IDs**:
   - ✅ Web application (para Supabase)
   - ❓ iOS (Bundle ID: com.shopunite.marketplace)
   - ❓ Android (Package: com.shopunite.marketplace)

### Crear iOS Client ID (si no existe):
1. Click "Create Credentials" → "OAuth Client ID"
2. Application type: **iOS**
3. Name: `ShopUnite iOS`
4. Bundle ID: `com.shopunite.marketplace`
5. Click "Create"
6. **Copiar el Client ID generado** (formato: xxx-yyy.apps.googleusercontent.com)

## ✅ Paso 2: Verificar Supabase

1. Ir a: https://kscgibfmxnyfjxpcwoac.supabase.co/project/kscgibfmxnyfjxpcwoac/auth/providers
2. Buscar "Google" en providers
3. Verificar:
   - ✅ Enabled: ON
   - ✅ Client ID: 411618353526-e2u2btfioqf9q82ru503msieuefepuqi.apps.googleusercontent.com
   - ✅ Client Secret: (debe estar lleno, no vacío)
   - ✅ Redirect URL: https://kscgibfmxnyfjxpcwoac.supabase.co/auth/v1/callback

Si falta Client Secret:
1. Ir a Google Cloud Console
2. Click en el Web Client ID
3. Copiar el "Client Secret"
4. Pegarlo en Supabase
5. Save

## ✅ Paso 3: Verificar .env.local

Tu archivo `.env.local` debe tener:

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=411618353526-e2u2btfioqf9q82ru503msieuefepuqi.apps.googleusercontent.com
```

✅ Ya lo tienes correcto.

## ✅ Paso 4: Probar en device REAL (no simulador)

Google Sign In NO funciona en simulador iOS por limitaciones de iOS.

**Opciones para probar:**

### Opción A: TestFlight (RECOMENDADO)
1. Hacer build para TestFlight (ver sección de updates abajo)
2. Instalar en iPhone físico
3. Probar Google Sign In

### Opción B: Development Build en iPhone físico
```bash
# Conectar iPhone por USB
npx expo run:ios --device
```

## 🐛 Si sigue sin funcionar

Revisar logs en tiempo real:
```bash
# En terminal donde corre Expo
# Buscar estos logs:
✅ [App] Google Sign In configurado
✅ [AuthService] Iniciando Google Sign In...
❌ Error: [ver mensaje específico]
```

Errores comunes:
- "SIGN_IN_CANCELLED" → Usuario canceló (normal)
- "PLAY_SERVICES_NOT_AVAILABLE" → Solo Android, ignorar en iOS
- "No se pudo obtener token de Google" → Revisar Client IDs

---

**NOTA IMPORTANTE:** Si estás probando en **simulador iOS**, Google Sign In **NO funcionará**.
Necesitas probarlo en:
1. iPhone físico (Development Build)
2. TestFlight (Producción)
3. Web (funciona perfecto)

