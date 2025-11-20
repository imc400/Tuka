# 🚀 Quick Start - Probar el Sistema Ahora

Esta guía te permite probar el sistema de checkout **inmediatamente** sin desplegar nada.

---

## ✅ PASO 1: Ejecutar Schema de Órdenes (2 minutos)

1. Ve a tu proyecto de Supabase: https://app.supabase.com
2. Click en **SQL Editor** (icono de código)
3. Click en **New Query**
4. Copia y pega todo el contenido de `supabase_orders_schema.sql`
5. Click **Run** (▶️)

Deberías ver:
```
✅ SCHEMA DE ÓRDENES CREADO CORRECTAMENTE
```

---

## ✅ PASO 2: Probar Pago de Prueba (sin MercadoPago)

### 2.1 Ejecutar la app

```bash
# Instalar dependencias (solo primera vez)
npm install

# Iniciar app
npm start
```

### 2.2 Flujo de prueba

1. **Agregar productos al carrito**
   - Navega por las tiendas
   - Agrega productos de DIFERENTES tiendas (prueba multi-store)
   - Ejemplo: 2 productos de Tienda A, 1 de Tienda B

2. **Ir al carrito**
   - Click en el icono del carrito (arriba derecha)
   - Verifica que los productos estén correctos

3. **Checkout**
   - Click en **"Finalizar Compra"**
   - Llenar el formulario:
     ```
     Nombre: Juan Pérez
     Email: juan@test.com
     Dirección: Av. Providencia 123, Depto 45
     Ciudad: Santiago
     Región: Metropolitana
     Código Postal: 7500000
     Teléfono: +56912345678
     ```

4. **Pago de Prueba**
   - Click en el botón **NARANJA** que dice "Pago de Prueba (Testing)"
   - Espera 2 segundos
   - Deberías ver: **"✅ Prueba Exitosa - Transacción #1 creada"**

### 2.3 Verificar en Supabase

Ve a **Table Editor** en Supabase:

**1. Tabla `transactions`**
```sql
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 1;
```

Deberías ver:
- `status`: "approved"
- `total_amount`: suma de tus productos
- `buyer_email`: "juan@test.com"
- `cart_items`: JSON con tus productos
- `is_test`: true

**2. Tabla `shopify_orders`**
```sql
SELECT * FROM shopify_orders ORDER BY created_at DESC;
```

Deberías ver:
- **Una orden por cada tienda** (si compraste de 2 tiendas, verás 2 órdenes)
- `status`: "created"
- `order_amount`: monto de cada tienda
- `shopify_order_id`: comienza con "test_"
- `shopify_order_number`: "#TEST-1234"

---

## ✅ PASO 3: Generar Admin API Tokens de Shopify (5 minutos)

Necesitas hacer esto **una vez por tienda**.

### Para cada tienda Shopify:

1. **Ir a la configuración de apps**
   ```
   https://[tu-tienda].myshopify.com/admin/settings/apps/development
   ```

2. **Crear Custom App**
   - Click **"Create an app"**
   - App name: "ShopUnite Marketplace"
   - App developer: tu email
   - Click **"Create app"**

3. **Configurar permisos**
   - Click en **"Configuration"**
   - En **"Admin API integration"**, click **"Configure"**
   - Busca y selecciona estos scopes:

   ```
   ✅ read_orders
   ✅ write_orders
   ✅ read_draft_orders
   ✅ write_draft_orders
   ✅ read_products (ya debería estar)
   ✅ read_customers
   ✅ write_customers
   ```

   - Click **"Save"**

4. **Instalar la app**
   - Click **"Install app"** (botón arriba)
   - Confirmar

5. **Obtener Access Token**
   - En la página de la app, busca **"Admin API access token"**
   - Click **"Reveal token once"**
   - **COPIAR EL TOKEN** (empieza con `shpat_...`)
   - ⚠️ **IMPORTANTE**: Solo se muestra UNA VEZ. Guárdalo en un lugar seguro.

6. **Actualizar en Supabase**
   - Ve a Supabase → SQL Editor
   - Ejecuta:
   ```sql
   UPDATE stores
   SET access_token = 'shpat_TU_TOKEN_AQUI'
   WHERE domain = 'tu-tienda.myshopify.com';
   ```

7. **Verificar**
   ```sql
   SELECT domain, store_name,
          CASE
            WHEN access_token IS NOT NULL THEN '✅ Configurado'
            ELSE '❌ Falta token'
          END as status
   FROM stores;
   ```

---

## ✅ PASO 4: Desplegar Edge Functions (10 minutos)

### 4.1 Instalar Supabase CLI

**macOS**:
```bash
brew install supabase/tap/supabase
```

**Windows**:
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Linux/otros**:
```bash
npm install -g supabase
```

### 4.2 Login y Link

```bash
# Login
npx supabase login

# Link al proyecto (reemplaza TU_PROJECT_REF)
npx supabase link --project-ref TU_PROJECT_REF
```

Tu `PROJECT_REF` está en la URL de Supabase:
```
https://app.supabase.com/project/ESTE_ES_TU_PROJECT_REF/...
```

### 4.3 Configurar MercadoPago Access Token

Obtén tu Access Token:
1. Ve a: https://www.mercadopago.cl/developers/panel
2. Click **"Tus aplicaciones"**
3. Crear aplicación si no tienes
4. Copiar **Access Token de Prueba** (empieza con `TEST-`)

Configurarlo:
```bash
npx supabase secrets set MERCADOPAGO_ACCESS_TOKEN=TEST-tu-token-aqui
```

### 4.4 Desplegar funciones

```bash
# Desplegar todas las funciones
npx supabase functions deploy create-mp-preference
npx supabase functions deploy check-payment-status
npx supabase functions deploy mp-webhook

# Verificar
npx supabase functions list
```

Deberías ver:
```
✓ create-mp-preference
✓ check-payment-status
✓ mp-webhook
```

---

## ✅ PASO 5: Configurar Webhook de MercadoPago (3 minutos)

### 5.1 Obtener URL del webhook

Tu URL es:
```
https://TU_PROJECT_REF.supabase.co/functions/v1/mp-webhook
```

Reemplaza `TU_PROJECT_REF` con tu project ref.

### 5.2 Configurar en MercadoPago

1. Ve a: https://www.mercadopago.cl/developers/panel/notifications/webhooks
2. Click **"Crear webhook"**
3. **URL de prueba**: pega tu URL del paso anterior
4. **Eventos**:
   - ✅ Marcar solo "Pagos" (payment)
5. Click **"Guardar"**

### 5.3 Probar webhook (opcional)

En el panel de MercadoPago puedes **"Enviar prueba"** para verificar que funciona.

---

## ✅ PASO 6: Probar Pago Real con MercadoPago (5 minutos)

### 6.1 Reiniciar la app

```bash
# Ctrl+C para detener
# Volver a iniciar
npm start
```

### 6.2 Flujo completo

1. Agregar productos al carrito
2. Ir a checkout
3. Llenar formulario con datos reales (tu email para recibir confirmación)
4. Click en el botón **AZUL** "Pagar $XXX"
5. Se abrirá el navegador con el checkout de MercadoPago
6. Usar tarjeta de prueba:

**Tarjeta que APRUEBA**:
```
Número: 5031 7557 3453 0604
Vencimiento: 11/25
CVV: 123
Nombre: APRO
Email: test_user_12345@testuser.com
```

**Tarjeta que RECHAZA**:
```
Número: 5031 7557 3453 0604
Vencimiento: 11/25
CVV: 123
Nombre: CONT
```

7. Completar el pago
8. Deberías ser redirigido a la app
9. Ver mensaje: **"✅ Pago Exitoso"**

### 6.3 Verificar órdenes en Shopify

1. Ve a cada tienda Shopify:
   ```
   https://tu-tienda.myshopify.com/admin/orders
   ```

2. Busca la orden con:
   - Tag: "shopunite"
   - Estado: **Pagado**
   - Productos correctos
   - Dirección de envío correcta

---

## 🎉 ¡Felicidades!

Tu sistema está funcionando:

✅ **Checkout unificado** con formulario único
✅ **Pago con MercadoPago** (tarjetas de prueba)
✅ **Órdenes automáticas en Shopify** (múltiples tiendas)
✅ **Tracking completo** en Supabase

---

## 🐛 Solución de Problemas Comunes

### Error: "No se pudo crear la transacción"

**Solución**:
1. Verificar que ejecutaste `supabase_orders_schema.sql`
2. Verificar RLS policies:
```sql
-- Ejecutar en SQL Editor
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN ('transactions', 'shopify_orders');
```

### Error: "MercadoPago Access Token not configured"

**Solución**:
```bash
npx supabase secrets set MERCADOPAGO_ACCESS_TOKEN=tu-token
```

### El webhook no recibe notificaciones

**Solución**:
1. Verificar URL en panel de MercadoPago
2. Verificar función desplegada: `npx supabase functions list`
3. Ver logs: `npx supabase functions logs mp-webhook`

### Órdenes no se crean en Shopify

**Causas posibles**:
1. **Access Token inválido o sin permisos**
   - Verificar scopes en la Custom App
   - Regenerar token si es necesario

2. **variant_id inválido**
   - Verificar que los productos se sincronizaron: `npm run sync`
   - Los variant_ids deben ser de Shopify

3. **Ver logs**:
```bash
npx supabase functions logs mp-webhook --follow
```

### La app se cierra al abrir MercadoPago

**Solución**: Esto es normal. MercadoPago abre el navegador y la app queda en background. Al completar el pago, deberías volver a la app automáticamente.

---

## 📊 Queries Útiles para Debugging

### Ver última transacción
```sql
SELECT
  id,
  status,
  total_amount,
  buyer_email,
  created_at,
  is_test
FROM transactions
ORDER BY created_at DESC
LIMIT 1;
```

### Ver órdenes de una transacción
```sql
SELECT
  store_domain,
  order_amount,
  status,
  shopify_order_number,
  error_message
FROM shopify_orders
WHERE transaction_id = 1; -- Reemplaza con tu transaction_id
```

### Ver todas las tiendas y sus tokens
```sql
SELECT
  domain,
  store_name,
  CASE
    WHEN access_token IS NOT NULL THEN '✅ Configurado'
    ELSE '❌ Sin configurar'
  END as token_status
FROM stores;
```

---

## 📚 Siguiente Lectura

- **DEPLOYMENT_GUIDE.md**: Guía completa para producción
- **README.md**: Documentación general del proyecto

---

## 💡 Tips

1. **Siempre probar primero con "Pago de Prueba"** antes de usar MercadoPago
2. **Usar tokens de PRUEBA** de MercadoPago hasta que todo funcione
3. **Ver los logs** de Edge Functions si algo falla
4. **Verificar en Supabase** que las transacciones y órdenes se crearon
5. **Revisar Shopify** para confirmar que las órdenes llegaron

---

¡Ahora sí, a probar! 🚀
