# ShopUnite Marketplace - Estado Funcional

**Fecha**: 25 de Noviembre 2025
**Build**: Development Build para iOS
**Versión**: TestFlight Build #7+

---

## ✅ Funcionalidades Verificadas

### Autenticación
- [x] **Google Sign In** - Funcionando correctamente con OAuth nativo
- [x] **Login con email/contraseña** - Funcionando
- [x] **Registro de usuarios** - Funcionando
- [x] **Perfil de usuario** - Muestra nombre y email correctamente

### Marketplace
- [x] **4 tiendas Shopify integradas** (1288 productos totales)
  - Dentobal (885 productos)
  - Ximena Rogat (228 productos)
  - Spot Essence (75 productos)
  - BrainToys Chile (100 productos)
- [x] **Sincronización de productos** - Funcionando con cache
- [x] **Navegación por tiendas** - Funcionando

### Carrito y Pedidos
- [x] **Agregar productos al carrito** - Funcionando
- [x] **Carrito persistente en DB** - Funcionando
- [x] **Crear pedidos de prueba** - Funcionando
- [x] **Ver historial de pedidos** - Funcionando
- [x] **Guardar dirección de envío** - Funcionando

### Suscripciones a Tiendas
- [x] **Suscribirse a tiendas** (campanita) - Funcionando
- [x] **Desuscribirse** - Funcionando
- [x] **Ver suscripciones en perfil** - Funcionando

### Push Notifications
- [x] **Registro de push tokens** - Funcionando (Expo Push)
- [x] **Envío de notificaciones** - Funcionando
- [x] **Notificaciones con app abierta** - Funcionando
- [x] **Notificaciones con app cerrada** - Funcionando
- [x] **Segmentación por tienda** - Implementado

---

## Configuración Requerida en Supabase

### Google OAuth
En **Authentication → Providers → Google**:
- **Skip nonce checks**: ✅ Activado (requerido para iOS)
- **Client IDs**: Web Client ID + iOS Client ID (separados por coma)

### RLS Policies
- **push_tokens**: RLS deshabilitado temporalmente para desarrollo
  ```sql
  ALTER TABLE push_tokens DISABLE ROW LEVEL SECURITY;
  ```

---

## Variables de Entorno

### .env.local
```
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxx.apps.googleusercontent.com
```

### EAS Secrets
Configurados en Expo EAS para builds de producción.

---

## Arquitectura Push Notifications

```
Usuario se suscribe a tienda (ej: spot-essence)
         ↓
store_subscriptions: user_id + store_domain
         ↓
Admin envía notificación a "spot-essence"
         ↓
get_store_subscribers() → lista de user_ids suscritos
         ↓
push_tokens → ExponentPushToken de cada user
         ↓
Expo Push API → FCM (Android) / APNs (iOS)
         ↓
Notificación llega al dispositivo
```

---

## Próximos Pasos Sugeridos

1. **Producción Push Tokens**: Re-habilitar RLS con políticas correctas
2. **Admin Dashboard**: Panel web para enviar notificaciones (`/notifications-admin`)
3. **Deep Links**: Al tocar notificación, abrir producto/tienda específica
4. **Analytics**: Tracking de notificaciones entregadas/abiertas

---

## Test de Push Notifications

Token de prueba: `ExponentPushToken[RvjRByAZTCtlmp35y-7m64]`

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[RvjRByAZTCtlmp35y-7m64]",
    "title": "Test",
    "body": "Mensaje de prueba",
    "sound": "default"
  }'
```

---

**Último test exitoso**: 25 Nov 2025, 03:10 AM (Chile)
