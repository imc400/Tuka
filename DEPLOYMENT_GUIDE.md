# 🚀 Guía de Deployment - ShopUnite Marketplace

Esta guía te ayudará a configurar y deployar el sistema de checkout completo con MercadoPago y Shopify.

---

## 📋 Pre-requisitos

1. ✅ Cuenta de Supabase (gratis)
2. ✅ Cuenta de MercadoPago (Chile)
3. ✅ Acceso Admin a las tiendas Shopify
4. ✅ Node.js instalado (v18+)

---

## 🗄️ PASO 1: Configurar Base de Datos

### 1.1 Crear tablas de productos (si no lo hiciste)

Ve a SQL Editor en Supabase y ejecuta:

```bash
supabase_products_schema_final.sql
```

### 1.2 Crear tablas de órdenes y pagos

Ejecuta en SQL Editor:

```bash
supabase_orders_schema.sql
```

Esto creará:
- `transactions` (pagos de MercadoPago)
- `shopify_orders` (órdenes en cada tienda)
- `payouts` (transferencias a tiendas)
- `users` (usuarios, futuro)

---

## 🔑 PASO 2: Configurar MercadoPago

### 2.1 Obtener Access Token

1. Ir a: https://www.mercadopago.cl/developers/panel
2. Click en **"Tus aplicaciones"** → **"Crear aplicación"**
3. Nombre: "ShopUnite Marketplace"
4. Selecciona: **"Pagos online"**
5. Copiar **Access Token de Producción** (empieza con `APP_USR-...`)

### 2.2 Modo Testing

Para testing, usa el **Access Token de Prueba** (empieza con `TEST-...`)

**Tarjetas de prueba**: https://www.mercadopago.cl/developers/es/docs/checkout-api/testing

---

## ⚙️ PASO 3: Configurar Shopify Admin API

Para CADA tienda, necesitas:

### 3.1 Crear Custom App

1. Ir a: `https://[tu-tienda].myshopify.com/admin/settings/apps/development`
2. Click **"Create an app"**
3. Nombre: "ShopUnite Marketplace"
4. Developer: tu email

### 3.2 Configurar Scopes

En **"Configuration"** → **"Admin API integration"**, selecciona:

```
✅ read_orders
✅ write_orders
✅ read_draft_orders
✅ write_draft_orders
✅ read_products (ya lo tienes)
✅ read_customers
✅ write_customers
```

### 3.3 Instalar y obtener token

1. Click **"Install app"**
2. Revelar **"Admin API access token"**
3. Copiar el token (empieza con `shpat_...`)
4. **IMPORTANTE**: Solo se muestra una vez, guárdalo en lugar seguro

### 3.4 Actualizar en Supabase

Ejecuta este SQL en Supabase (reemplaza los valores):

```sql
UPDATE stores
SET access_token = 'shpat_xxxxxxxxxxxxx'
WHERE domain = 'tu-tienda.myshopify.com';
```

---

## 🌐 PASO 4: Desplegar Edge Functions

### 4.1 Instalar Supabase CLI

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### 4.2 Login en Supabase

```bash
npx supabase login
```

### 4.3 Link al proyecto

```bash
npx supabase link --project-ref TU_PROJECT_REF
```

Tu `PROJECT_REF` está en la URL de Supabase: `https://app.supabase.com/project/**TU_PROJECT_REF**/...`

### 4.4 Configurar secrets

```bash
# MercadoPago Access Token
npx supabase secrets set MERCADOPAGO_ACCESS_TOKEN=TU_ACCESS_TOKEN_DE_MERCADOPAGO

# Verificar
npx supabase secrets list
```

### 4.5 Desplegar las funciones

```bash
# Desde la raíz del proyecto
npx supabase functions deploy create-mp-preference
npx supabase functions deploy check-payment-status
npx supabase functions deploy mp-webhook
```

### 4.6 Verificar deployment

```bash
npx supabase functions list
```

Deberías ver:
```
✓ create-mp-preference
✓ check-payment-status
✓ mp-webhook
```

---

## 🔔 PASO 5: Configurar Webhook de MercadoPago

### 5.1 Obtener URL del webhook

Tu URL será:
```
https://TU_PROJECT_REF.supabase.co/functions/v1/mp-webhook
```

### 5.2 Configurar en MercadoPago

1. Ir a: https://www.mercadopago.cl/developers/panel/notifications/webhooks
2. Click **"Crear webhook"**
3. **URL de producción**: `https://TU_PROJECT_REF.supabase.co/functions/v1/mp-webhook`
4. **Eventos a escuchar**:
   - ✅ `payment` (pagos)
5. Click **"Guardar"**

### 5.3 Probar webhook

MercadoPago te permite enviar una notificación de prueba desde el panel.

---

## 📱 PASO 6: Configurar la App React Native

### 6.1 Variables de entorno

Asegúrate de que `.env` tiene:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

### 6.2 Instalar dependencias

```bash
npm install
```

### 6.3 Ejecutar la app

```bash
# iOS
npm run ios

# Android
npm run android

# Web (Admin Dashboard)
npm run dev:web
```

---

## 🧪 PASO 7: Testing

### 7.1 Probar Pago de Prueba (sin MercadoPago)

1. Agregar productos al carrito
2. Ir a checkout
3. Llenar formulario de envío
4. Click **"Pago de Prueba (Testing)"** (botón naranja)
5. Verificar que se crea la transacción en Supabase

**Verificar en Supabase**:
```sql
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 1;
SELECT * FROM shopify_orders ORDER BY created_at DESC;
```

### 7.2 Probar Pago Real con MercadoPago (Sandbox)

1. Configurar Access Token de PRUEBA en Supabase secrets
2. Agregar productos al carrito
3. Llenar formulario
4. Click **"Pagar"** (botón azul)
5. Usar tarjeta de prueba:
   - **Tarjeta**: 5031 7557 3453 0604
   - **Vencimiento**: 11/25
   - **CVV**: 123
   - **Nombre**: APRO (aprobar) / CONT (rechazar)

### 7.3 Verificar órdenes en Shopify

1. Ir a: `https://tu-tienda.myshopify.com/admin/orders`
2. Deberías ver la orden creada con tag "shopunite"
3. Estado: **Pagado**
4. Items correctos

---

## 🐛 PASO 8: Debugging

### 8.1 Ver logs de Edge Functions

```bash
npx supabase functions logs mp-webhook
npx supabase functions logs create-mp-preference
```

### 8.2 Errores comunes

**Error: "MercadoPago Access Token not configured"**
- Solución: `npx supabase secrets set MERCADOPAGO_ACCESS_TOKEN=...`

**Error: "No se pudo crear la transacción"**
- Verificar que ejecutaste `supabase_orders_schema.sql`
- Verificar RLS policies en Supabase

**Error en Shopify: "Unprocessable Entity"**
- Verificar que el Access Token tiene los scopes correctos
- Verificar que el `variant_id` es válido

**Webhook no recibe notificaciones**
- Verificar URL en MercadoPago panel
- Verificar que la función está desplegada: `npx supabase functions list`

### 8.3 Probar Edge Functions localmente

```bash
# Iniciar Supabase local
npx supabase start

# Servir función localmente
npx supabase functions serve mp-webhook --env-file .env
```

---

## 🔄 PASO 9: Sync de Productos

Antes de poder comprar, necesitas sincronizar productos:

```bash
# Ejecutar sync manual
npm run sync
```

Esto poblará la tabla `products` con los productos de tus tiendas Shopify.

---

## 📊 PASO 10: Monitoreo

### 10.1 Dashboard de transacciones (SQL)

```sql
-- Ventas del día
SELECT
  COUNT(*) as total_orders,
  SUM(total_amount) as total_sales,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_orders
FROM transactions
WHERE created_at >= CURRENT_DATE;

-- Órdenes por tienda
SELECT
  store_domain,
  COUNT(*) as orders,
  SUM(order_amount) as total_sales
FROM shopify_orders
WHERE status = 'created'
GROUP BY store_domain;
```

### 10.2 Ver balance pendiente de una tienda

```sql
SELECT get_store_pending_balance('tu-tienda.myshopify.com');
```

---

## 💰 PASO 11: Distribución de Fondos (Manual)

Por ahora, las transferencias son manuales:

### 11.1 Ver balance de cada tienda

```sql
SELECT
  store_domain,
  get_store_pending_balance(store_domain) as pending_balance
FROM stores;
```

### 11.2 Registrar payout

Cuando transfieras fondos a una tienda:

```sql
INSERT INTO payouts (
  store_domain,
  amount,
  transfer_method,
  transfer_reference,
  status,
  period_start,
  period_end
) VALUES (
  'tu-tienda.myshopify.com',
  150000.00,
  'bank_transfer',
  'TRANSFERENCIA-123456',
  'completed',
  '2025-01-01',
  '2025-01-07'
);
```

---

## 🎉 ¡Listo!

Tu marketplace está funcionando:

✅ Checkout unificado con MercadoPago
✅ Órdenes automáticas en Shopify
✅ Tracking de transacciones
✅ Sistema de testing

---

## 📞 Soporte

Si tienes problemas:

1. Revisar logs: `npx supabase functions logs [function-name]`
2. Verificar webhooks en panel de MercadoPago
3. Revisar tabla `shopify_orders` para errores
4. Verificar que Admin API tokens tienen los permisos correctos

---

## 🔜 Próximos Pasos (Opcional)

1. **Transferencias automáticas**: Implementar `MercadoPago Split Payments`
2. **Autenticación**: Agregar sistema de usuarios con Supabase Auth
3. **Notificaciones**: Push notifications para confirmar órdenes
4. **Dashboard comerciantes**: Panel para que tiendas vean sus ventas
5. **Comisiones**: Agregar % de comisión en `store_splits`

---

## 📝 Notas Importantes

- **Seguridad**: Los Access Tokens de Shopify y MercadoPago NUNCA deben estar en el código de la app
- **RLS**: En producción, debes configurar RLS policies más restrictivas
- **Webhooks**: MercadoPago puede reintentar webhooks, tu función debe ser idempotente
- **Inventario**: Shopify maneja el inventario automáticamente al crear órdenes
- **Testing**: SIEMPRE usar tokens de prueba primero antes de producción
