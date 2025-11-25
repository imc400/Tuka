# Claude Code Context - ShopUnite Marketplace

## Estado Actual del Proyecto (24 Nov 2024)

### Resumen
ShopUnite es una app React Native + Expo que unifica múltiples tiendas Shopify en un marketplace. El usuario puede navegar productos de diferentes tiendas, agregar al carrito y hacer checkout.

### Lo que funciona
- Login con email/contraseña (Supabase Auth)
- Navegación del marketplace con 4 tiendas Shopify (1288 productos)
- Carrito de compras
- Pedidos de prueba
- Development Build para testing rápido en iPhone físico
- TestFlight build #7 enviado a Apple

### Lo que está en progreso
- **Google Sign In**: Falta hacer un nuevo build nativo para incluir el URL scheme de Google

### Problema actual de Google Sign In
El error es:
```
Your app is missing support for the following URL schemes: com.googleusercontent.apps.356945634678-9drgid5o0fr3pvj7knbi79qa8a6csmou
```

**Solución**: Ejecutar `eas build --profile development-device --platform ios` para crear un nuevo build que incluya el plugin de Google Sign In configurado en `app.json`.

### Configuración de Google OAuth
- **Web Client ID**: `356945634678-189cs6oued0ksdtalnsh87c64qurfs0q.apps.googleusercontent.com`
- **iOS Client ID**: `356945634678-9drgid5o0fr3pvj7knbi79qa8a6csmou.apps.googleusercontent.com`
- **Supabase**: Configurado con Google provider usando estos IDs
- **Variables de entorno**: Configuradas en `.env.local` y en EAS Secrets

### Archivos clave modificados en esta sesión
1. `app.json` - Agregado plugin `@react-native-google-signin/google-signin` con `iosUrlScheme`
2. `eas.json` - Agregado perfil `development-device` y `environment: "production"` para cargar env vars
3. `App.tsx` - Agregado `iosClientId` a la configuración de Google Sign In
4. `src/services/authService.ts` - Función `configureGoogleSignIn` ahora acepta `iosClientId`
5. `src/lib/supabase.ts` - Agregados logs de debugging para verificar env vars
6. `.env.local` - Agregado `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

### EAS Secrets configurados
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

### Flujo de desarrollo configurado
1. **Development Build**: Para testing rápido con hot reload
   - Ejecutar: `npx expo start --dev-client`
   - Conectar iPhone manualmente a: `http://192.168.100.217:8081`
   - Cambios en código se reflejan en segundos

2. **TestFlight Build**: Para distribución a testers
   - Ejecutar: `eas build --profile testflight --platform ios`
   - Luego: `eas submit --platform ios --profile testflight --latest`

### Próximos pasos
1. Ejecutar `eas build --profile development-device --platform ios`
2. Instalar el nuevo build en iPhone
3. Probar Google Sign In
4. Si funciona, hacer build de TestFlight con Google Sign In

### Credenciales importantes (NO commitear)
- Apple Team ID: `Y763D7J83C`
- Bundle ID: `com.shopunite.marketplace`
- Supabase Project: `kscgibfmxnyfjxpcwoac`

### Comandos útiles
```bash
# Development
npx expo start --dev-client --clear

# Build Development para iPhone
eas build --profile development-device --platform ios

# Build TestFlight
eas build --profile testflight --platform ios

# Submit a TestFlight
eas submit --platform ios --profile testflight --latest

# Ver secretos de EAS
eas secret:list

# Registrar dispositivo
eas device:create
```
