# 📋 Instrucciones: Configurar Webhooks de Shopify

**Tiempo estimado:** 15 minutos por tienda

---

## 🎯 URL del Webhook (MISMA para todos)

```
https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/shopify-webhook
```

**IMPORTANTE:** Esta URL es la misma para las 4 tiendas. No cambia.

---

## 📝 Paso a Paso

### 1. Acceder a Shopify Admin

Ir a: `https://[NOMBRE-TIENDA].myshopify.com/admin`

**Tiendas del marketplace:**
- https://dentobal.myshopify.com/admin
- https://braintoys-chile.myshopify.com/admin
- https://spot-essence.myshopify.com/admin
- https://ximenarogat.myshopify.com/admin ✅ (ya configurado)

### 2. Navegar a Webhooks

1. Click en **Settings** (abajo a la izquierda)
2. Click en **Notifications**
3. Scroll down hasta la sección **Webhooks**

### 3. Crear los 4 Webhooks

Crear cada webhook con el botón **"Create webhook"**

---

## 🔔 Webhook #1: Creación de Productos

### Configuración:
- **Event:** `Products` → `Product creation`
- **Format:** `JSON`
- **URL:** `https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/shopify-webhook`
- **Webhook API version:** `2024-01` (o la más reciente disponible)

### Para qué sirve:
Cuando se crea un nuevo producto en Shopify, se agrega automáticamente a la app.

---

## 🔄 Webhook #2: Actualización de Productos

### Configuración:
- **Event:** `Products` → `Product update`
- **Format:** `JSON`
- **URL:** `https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/shopify-webhook`
- **Webhook API version:** `2024-01` (o la más reciente disponible)

### Para qué sirve:
Cuando se actualiza precio, título, descripción o cualquier info del producto, se sincroniza en la app.

---

## 🗑️ Webhook #3: Eliminación de Productos

### Configuración:
- **Event:** `Products` → `Product deletion`
- **Format:** `JSON`
- **URL:** `https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/shopify-webhook`
- **Webhook API version:** `2024-01` (o la más reciente disponible)

### Para qué sirve:
Cuando se elimina o archiva un producto en Shopify, se remueve de la app automáticamente.

---

## 📦 Webhook #4: Cambios de Inventario ⭐ CRÍTICO

### Configuración:
- **Event:** `Inventory` → `Inventory levels update`
- **Format:** `JSON`
- **URL:** `https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/shopify-webhook`
- **Webhook API version:** `2024-01` (o la más reciente disponible)

### Nombre en español:
Si Shopify está en español, buscar: **"Actualización de cantidades de artículos en envíos de inventario"** (es la tercera opción en el dropdown de Inventory)

### Para qué sirve:
**EL MÁS IMPORTANTE.** Cuando el stock cambia (por venta o restock), actualiza disponibilidad en tiempo real. Sin este webhook, se pueden vender productos sin stock.

---

## ✅ Verificar que Funcionan

### Opción 1: Test Notification (En Shopify)

Después de crear cada webhook:

1. Click en el webhook recién creado
2. Scroll hasta **"Recent deliveries"** (puede tardar unos segundos en aparecer)
3. Click en **"Send test notification"**
4. Verificar que el **Status** sea `200 OK`
5. Si aparece un error, revisar la URL y configuración

### Opción 2: Cambio Real (Recomendado)

**Probar con cambio de stock:**

1. Ir a **Products** en Shopify
2. Editar cualquier producto
3. Cambiar el **Inventory** (ej: 10 → 5)
4. Click **Save**
5. Esperar 5 segundos
6. Verificar en Supabase que el producto tiene `synced_at` reciente

**Comando para verificar en terminal:**
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
    .select('title, store_domain, synced_at')
    .eq('store_domain', 'NOMBRE-TIENDA.myshopify.com')
    .order('synced_at', { ascending: false })
    .limit(5);
  console.log('Últimos productos actualizados:', data);
})();
"
```

Reemplazar `NOMBRE-TIENDA` por la tienda que estás configurando.

---

## 🎯 Checklist por Tienda

Usar este checklist para cada tienda que configures:

```
TIENDA: _______________________

□ Webhook #1: products/create configurado
  □ URL correcta
  □ Format: JSON
  □ Test notification enviada → Status 200 OK

□ Webhook #2: products/update configurado
  □ URL correcta
  □ Format: JSON
  □ Test notification enviada → Status 200 OK

□ Webhook #3: products/delete configurado
  □ URL correcta
  □ Format: JSON
  □ Test notification enviada → Status 200 OK

□ Webhook #4: inventory_levels/update configurado ⭐
  □ URL correcta
  □ Format: JSON
  □ Test notification enviada → Status 200 OK

□ Prueba real: Cambié stock de un producto
□ Verificado: synced_at actualizado en Supabase
□ Verificado: App muestra cambios

✅ TIENDA LISTA PARA SINCRONIZACIÓN EN TIEMPO REAL
```

---

## 🔗 URLs Completas de Referencia

### Shopify Webhooks:
```
dentobal:
https://admin.shopify.com/store/dentobal/settings/notifications

braintoys-chile:
https://admin.shopify.com/store/braintoys-chile/settings/notifications

spot-essence:
https://admin.shopify.com/store/spot-essence/settings/notifications

ximenarogat:
https://admin.shopify.com/store/ximenarogat/settings/notifications
```

### Supabase Edge Function:
```
Dashboard:
https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac/functions

Webhook URL (para configurar en Shopify):
https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/shopify-webhook
```

---

## 🆘 Troubleshooting

### Error: 401 Unauthorized
**Problema:** Edge Function tiene JWT verification habilitado
**Solución:**
1. Ir a Supabase Dashboard → Functions → shopify-webhook
2. Tab "Details"
3. Desmarcar "Verify JWT"
4. Save

### Error: 500 Internal Server Error
**Problema:** Error en el código de la función
**Solución:**
1. Ver logs en Supabase Dashboard → Functions → shopify-webhook → Logs
2. Identificar el error
3. Si no se resuelve, contactar soporte

### Webhook no aparece en "Recent deliveries"
**Problema:** Shopify aún no ha enviado ningún webhook
**Solución:**
- Es normal si acabas de crear el webhook
- Hacer un cambio real en un producto para disparar el webhook
- Usar "Send test notification"

### Cambios en Shopify no se reflejan en app
**Checklist:**
1. ¿Webhook tiene status 200 OK?
2. ¿Logs de Supabase muestran el evento?
3. ¿Usuario recargó la app?
4. ¿Han pasado más de 5 segundos desde el cambio?

---

## 📊 Estado de Configuración

### ✅ Ximena Rogat
- 4/4 webhooks configurados
- Estado: FUNCIONANDO
- Fecha: 2025-11-21

### ⏳ Dentobal
- 0/4 webhooks configurados
- Estado: PENDIENTE

### ⏳ BrainToys Chile
- 0/4 webhooks configurados
- Estado: PENDIENTE

### ⏳ Spot Essence
- 0/4 webhooks configurados
- Estado: PENDIENTE

---

## 🎯 Resumen Rápido

**Para cada tienda nueva:**

1. Ir a Shopify Admin → Settings → Notifications → Webhooks
2. Crear 4 webhooks (products/create, products/update, products/delete, inventory_levels/update)
3. Todos usan la misma URL: `https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/shopify-webhook`
4. Format: JSON
5. Probar con test notification o cambio real
6. ✅ Listo - sincronización en tiempo real activada

**Tiempo:** 15 minutos por tienda
**Costo:** $0 (gratis)
**Beneficio:** Sincronización en < 2 segundos vs 6-24 horas

---

**Última actualización:** 2025-11-21
**Versión:** 1.0

✅ **Guarda este documento para futuras tiendas**
