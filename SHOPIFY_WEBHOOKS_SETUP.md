# 🔗 Guía Completa: Configuración de Webhooks de Shopify

**Objetivo:** Sincronizar productos en tiempo real entre Shopify → Supabase → App

**Tiempo estimado:** 30-45 minutos por tienda

---

## 📋 ¿Qué son los Webhooks?

Los webhooks son notificaciones automáticas que Shopify envía a tu servidor cuando ocurre un evento:

```
Evento en Shopify (ej: producto sin stock)
    ↓ (< 1 segundo)
Shopify envía HTTP POST a tu servidor
    ↓ (< 1 segundo)
Tu servidor actualiza Supabase
    ↓ (inmediato)
App muestra producto como "No disponible"
```

**Sin webhooks:**
- Delay de 6-24 horas (depende de tu cron job)
- Riesgo de vender productos sin stock
- Precios desactualizados

**Con webhooks:**
- Sincronización en < 1 segundo
- 0 riesgo de vender sin stock
- Precios siempre correctos

---

## 🎯 Webhooks Necesarios

Configuraremos 4 webhooks para cada tienda:

| Webhook | Cuándo se dispara | Para qué sirve |
|---------|-------------------|----------------|
| `products/create` | Tienda crea nuevo producto | Agregar producto a app inmediatamente |
| `products/update` | Cambio de precio/título/descripción | Actualizar info del producto |
| `products/delete` | Producto eliminado/archivado | Remover de app |
| `inventory_levels/update` | Stock cambia (venta/restock) | **MUY IMPORTANTE:** Actualizar disponibilidad |

---

## 🚀 Paso a Paso: Implementación

### **Paso 1: Desplegar Edge Function en Supabase**

#### 1.1 Verificar que tienes Supabase CLI instalado

```bash
supabase --version
```

Si no está instalado:
```bash
npm install -g supabase
```

#### 1.2 Inicializar Supabase (si no está inicializado)

```bash
supabase init
```

#### 1.3 Link a tu proyecto

```bash
supabase link --project-ref kscgibfmxnyfjxpcwoac
```

Te pedirá tu database password (la tienes en Supabase dashboard).

#### 1.4 Desplegar la función

```bash
supabase functions deploy shopify-webhook
```

Esto desplegará la función en:
```
https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/shopify-webhook
```

#### 1.5 Verificar que está funcionando

```bash
curl -X POST https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/shopify-webhook \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: test" \
  -H "X-Shopify-Shop-Domain: test.myshopify.com" \
  -d '{"test": true}'
```

Deberías ver: `{"success":true,"topic":"test"}`

---

### **Paso 2: Configurar Webhooks en Shopify (POR CADA TIENDA)**

Repite estos pasos para cada tienda que agregues al marketplace.

#### 2.1 Acceder a Shopify Admin

1. Ir a: `https://[TIENDA].myshopify.com/admin`
2. Login como administrador

#### 2.2 Navegar a Webhooks

1. Click en **Settings** (abajo izquierda)
2. Click en **Notifications**
3. Scroll down hasta **Webhooks**

#### 2.3 Crear Webhook #1: products/create

1. Click **Create webhook**
2. Configurar:
   - **Event:** Products → Product creation
   - **Format:** JSON
   - **URL:** `https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/shopify-webhook`
   - **Webhook API version:** 2024-01 (o la más reciente)
3. Click **Save webhook**

#### 2.4 Crear Webhook #2: products/update

1. Click **Create webhook**
2. Configurar:
   - **Event:** Products → Product update
   - **Format:** JSON
   - **URL:** `https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/shopify-webhook`
3. Click **Save webhook**

#### 2.5 Crear Webhook #3: products/delete

1. Click **Create webhook**
2. Configurar:
   - **Event:** Products → Product deletion
   - **Format:** JSON
   - **URL:** `https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/shopify-webhook`
3. Click **Save webhook**

#### 2.6 Crear Webhook #4: inventory_levels/update ⭐ CRÍTICO

1. Click **Create webhook**
2. Configurar:
   - **Event:** Inventory → Inventory levels update
   - **Format:** JSON
   - **URL:** `https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/shopify-webhook`
3. Click **Save webhook**

---

### **Paso 3: Verificar que Funcionan**

#### 3.1 Probar en Shopify Admin

Después de crear los webhooks, verás una lista. Para cada webhook:

1. Click en el webhook
2. Scroll hasta **Recent deliveries**
3. Click **Send test notification**
4. Verifica que el **Status** sea `200 OK`

#### 3.2 Probar con un cambio real

**Opción A: Cambiar precio de producto**
1. Ir a Products en Shopify
2. Editar cualquier producto
3. Cambiar el precio (ej: $100 → $101)
4. Guardar
5. **Verificar en Supabase:**
   ```bash
   node -e "
   const { createClient } = require('@supabase/supabase-js');
   require('dotenv').config();
   const supabase = createClient(
     process.env.EXPO_PUBLIC_SUPABASE_URL,
     process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
   );
   (async () => {
     const { data } = await supabase
       .from('products')
       .select('title, price, synced_at')
       .eq('store_domain', 'dentobal.myshopify.com')
       .order('synced_at', { ascending: false })
       .limit(5);
     console.log('Últimos productos actualizados:', data);
   })();
   "
   ```
6. El `synced_at` debe ser de hace unos segundos ✅

**Opción B: Cambiar stock (MÁS IMPORTANTE)**
1. Ir a Products en Shopify
2. Editar cualquier producto
3. Cambiar el **Inventory** (ej: 10 → 0)
4. Guardar
5. **Verificar en Supabase que `available` cambió a `false`**

---

### **Paso 4: Monitorear Webhooks (Opcional pero Recomendado)**

#### 4.1 Ver logs en Supabase

```bash
supabase functions logs shopify-webhook --tail
```

Verás algo como:
```
📥 Webhook received: products/update from dentobal.myshopify.com
🔄 Updating product: Anestesia Lidocaína
✅ Product updated: Anestesia Lidocaína
```

#### 4.2 Ver logs en Shopify Admin

1. Ir a Settings → Notifications → Webhooks
2. Click en cualquier webhook
3. Ver **Recent deliveries**
4. Si alguno falló, verás el error y podrás **Retry**

---

## 🔐 Seguridad: Verificar Firma HMAC (IMPORTANTE para Producción)

Actualmente el webhook acepta cualquier request. Para producción, debes verificar que viene de Shopify:

### Paso 1: Obtener Webhook Secret de Shopify

1. Ir a Settings → Notifications → Webhooks
2. Click en cualquier webhook
3. Copiar el **Webhook signing secret** (aparece arriba)

### Paso 2: Agregar a Supabase Secrets

```bash
supabase secrets set SHOPIFY_WEBHOOK_SECRET="tu_secret_aqui"
```

### Paso 3: Descomentar verificación HMAC

En `supabase/functions/shopify-webhook/index.ts`, descomenta:

```typescript
// TODO: Verify HMAC signature for security
const isValid = await verifyShopifyHmac(req, hmac)
if (!isValid) {
  return new Response('Invalid signature', { status: 401 })
}
```

Y agrega la función de verificación:

```typescript
async function verifyShopifyHmac(req: Request, hmac: string): Promise<boolean> {
  const body = await req.text()
  const secret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET')!

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body)
  )

  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
  return base64Signature === hmac
}
```

---

## 📊 Testing Completo

### Checklist de Pruebas

- [ ] **Crear producto nuevo en Shopify**
  - ¿Aparece en Supabase en < 5 segundos?
  - ¿Aparece en app al recargar?

- [ ] **Cambiar precio de producto**
  - ¿Se actualiza en Supabase?
  - ¿Se actualiza en app al recargar?

- [ ] **Cambiar stock de 10 → 0**
  - ¿`available` cambia a `false` en Supabase?
  - ¿Producto desaparece de app?

- [ ] **Cambiar stock de 0 → 5**
  - ¿`available` cambia a `true` en Supabase?
  - ¿Producto REAPARECE en app?

- [ ] **Eliminar producto en Shopify**
  - ¿Se elimina de Supabase?
  - ¿Desaparece de app?

---

## 🔄 Flujo Completo: Onboarding de Nueva Tienda

Cuando agregas una tienda nueva al marketplace:

### 1. Datos que necesitas recolectar:

```javascript
{
  store_domain: "nueva-tienda.myshopify.com",
  store_name: "Nueva Tienda",

  // API Tokens (como ahora)
  admin_api_token: "shpat_xxxxx",        // Para Admin API (si lo usas)
  storefront_access_token: "xxxxxx",      // Para Storefront API (sync)

  // NO necesitas guardar webhook secret (es automático)

  // Opcional
  logo_url: "https://...",
  theme_color: "#FF5733"
}
```

### 2. Pasos de configuración:

**Paso A: Insertar tienda en Supabase**
```bash
# Insertar en tabla 'stores' o 'shopify_configs'
```

**Paso B: Ejecutar sync inicial**
```bash
npm run sync
# Esto descarga todos los productos actuales
```

**Paso C: Configurar 4 webhooks en Shopify** (seguir Paso 2 arriba)
- products/create
- products/update
- products/delete
- inventory_levels/update

**Paso D: Probar con un cambio de stock**
- Cambiar stock de cualquier producto
- Verificar que se actualiza en < 5 segundos

**LISTO!** ✅ La tienda está sincronizada en tiempo real.

---

## 🆚 Comparación: Antes vs Después

### ANTES (Solo Cron Job)

```
10:00 AM - Último sync
10:30 AM - Cliente compra en Shopify → Stock = 0
11:00 AM - Cliente ve app → Stock = 1 ❌ (desactualizado)
16:00 AM - Siguiente sync
16:00 AM - App actualiza → Stock = 0 ✅
```

**Delay:** 6 horas
**Riesgo:** Alto (ventas duplicadas)

### DESPUÉS (Con Webhooks)

```
10:30:00 - Cliente compra en Shopify → Stock = 0
10:30:01 - Webhook notifica (< 1 seg)
10:30:01 - Supabase actualiza → available = false
10:30:02 - Usuario abre app → Producto NO DISPONIBLE ✅
```

**Delay:** < 2 segundos
**Riesgo:** Cero

---

## 🎯 Resumen Ejecutivo

### ✅ Ventajas de Webhooks:

1. **Sincronización en tiempo real** (< 1 segundo)
2. **Cero riesgo de vender sin stock**
3. **Precios siempre correctos**
4. **Mejor experiencia de usuario**
5. **Menos carga en servidor** (solo procesa cambios reales)

### 📝 Esfuerzo de Implementación:

- **Setup inicial:** 30 mins (desplegar función)
- **Por tienda nueva:** 15 mins (configurar 4 webhooks)
- **Mantenimiento:** 0 mins (automático)

### 💰 Costo:

- **Supabase Edge Functions:** Gratis hasta 500k invocaciones/mes
- **Shopify Webhooks:** Gratis ilimitados
- **Total:** $0 (dentro de free tier)

### 🚨 Crítico para E-commerce:

**SÍ**, los webhooks son ESENCIALES para un marketplace serio. Sin ellos, arriesgas:
- Vender productos sin stock
- Mostrar precios incorrectos
- Perder credibilidad con clientes
- Problemas con dueños de tiendas

---

## 🆘 Troubleshooting

### Webhook falla con 401 Unauthorized

**Causa:** Edge Function requiere autenticación
**Solución:** Los webhooks de Shopify son públicos por diseño. Verificar que la función NO requiera auth.

### Webhook falla con 500 Internal Error

**Causa:** Error en el código de la función
**Solución:** Ver logs:
```bash
supabase functions logs shopify-webhook --tail
```

### Cambios en Shopify NO se reflejan en app

**Checklist:**
1. ¿Webhook tiene status 200 OK en Shopify Admin?
2. ¿Logs de Supabase muestran el evento?
3. ¿Tabla `products` tiene `synced_at` reciente?
4. ¿Usuario recargó la app después del cambio?

---

## 📚 Recursos Adicionales

- [Shopify Webhooks Documentation](https://shopify.dev/docs/api/admin-rest/2024-01/resources/webhook)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Verifying Webhook HMAC](https://shopify.dev/docs/apps/webhooks/configuration/https#step-5-verify-the-webhook)

---

**Última actualización:** 2025-11-21
**Autor:** Senior Dev
