# 🔑 Configuración de Admin API Token para Shipping Real

**Fecha:** 2025-11-24
**Estado:** ✅ Edge Function lista | ⏳ Tokens pendientes de configurar

---

## ❗ Por qué necesitamos Admin API

### El Problema
- **Storefront API** (`access_token`) solo muestra tarifas de envío **nativas de Shopify**
- **NO puede acceder** a tarifas de **apps de terceros** como:
  - Chilexpress
  - 99minutos
  - Blue Express
  - Starken
  - Otras apps de shipping

### La Solución
- **Admin API** (`admin_api_token`) con **Draft Orders**
- ✅ Accede a tarifas de **apps de terceros**
- ✅ Calcula shipping **real y actualizado**
- ✅ Incluye todas las opciones disponibles en la tienda

---

## 🚀 Paso 1: Crear Admin API Token en cada tienda Shopify

Para **CADA tienda** conectada a tu marketplace, debes:

### 1.1 Ir a Shopify Admin
```
https://[tu-tienda].myshopify.com/admin
```

### 1.2 Ir a Settings → Apps and sales channels
```
Settings > Apps and sales channels > Develop apps
```

### 1.3 Crear una Custom App (si no existe)
- Click **"Create an app"**
- Nombre: `ShopUnite Marketplace`
- Descripción: `Marketplace integration for product sync and shipping calculation`

### 1.4 Configurar API Scopes

Click en **"Configure Admin API scopes"** y habilitar:

#### ✅ Scopes Requeridos (Mínimo):
```
✓ read_products
✓ read_product_listings
✓ read_draft_orders
✓ write_draft_orders
✓ read_shipping
```

#### ✅ Scopes Recomendados (Para funcionalidad completa):
```
✓ read_orders
✓ write_orders
✓ read_customers
✓ read_inventory
```

### 1.5 Instalar la App
- Click **"Install app"**
- Confirmar los permisos

### 1.6 Obtener el Admin API Access Token
- Después de instalar, verás: **"Admin API access token"**
- Click **"Reveal token once"**
- **¡IMPORTANTE!** Copia el token inmediatamente (solo lo verás una vez)
- Formato: `shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## 📝 Paso 2: Agregar Token a Supabase

### Opción A: Supabase Dashboard (Recomendado)

1. Ir a: https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac/editor

2. Ejecutar SQL para cada tienda:

```sql
-- Ejemplo para dentobal.myshopify.com
UPDATE stores
SET admin_api_token = 'shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
WHERE domain = 'dentobal.myshopify.com';

-- Ejemplo para braintoys-chile.myshopify.com
UPDATE stores
SET admin_api_token = 'shpat_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy'
WHERE domain = 'braintoys-chile.myshopify.com';

-- Verificar
SELECT domain,
       CASE WHEN admin_api_token IS NOT NULL THEN '✅ Configurado' ELSE '❌ Falta' END as admin_api,
       CASE WHEN access_token IS NOT NULL THEN '✅ Configurado' ELSE '❌ Falta' END as storefront_api
FROM stores;
```

### Opción B: Desde el Dashboard Web

Si tienes una UI de administración en tu dashboard web, agregar el campo para configurar `admin_api_token`.

---

## 🧪 Paso 3: Probar el Shipping

Después de configurar los tokens, ejecuta:

```bash
node test-shipping-real.js
```

**Resultado esperado:**
```
✅ SUCCESS! Shipping rates calculated:

  🏪 dentobal.myshopify.com:
     ✓ Chilexpress - Envío Prioritario: $5.990 (CHXPRIORITY)
     ✓ Chilexpress - Envío Día Siguiente: $8.990 (CHXNEXTDAY)

  🏪 braintoys-chile.myshopify.com:
     ✓ Envío a domicilio: $3.500 (STANDARD)
     ✓ Retiro en tienda: $0 (PICKUP)
```

---

## 📊 Cómo Funciona (Técnico)

### Flujo Actual:

```
1. Usuario agrega productos al carrito
2. Usuario completa dirección de envío
3. App llama a Edge Function: calculate-shipping

4. Edge Function por cada tienda:
   ┌─────────────────────────────────────┐
   │ ¿Tiene admin_api_token?             │
   └─────┬───────────────────────────┬───┘
         │ SÍ                        │ NO
         ▼                           ▼
   ┌─────────────────┐         ┌──────────────────┐
   │ Admin API       │         │ Storefront API   │
   │ Draft Orders    │         │ (limitado)       │
   │ ✅ Apps terceros │         │ ❌ Solo nativo    │
   └─────────────────┘         └──────────────────┘
         │                           │
         ▼                           ▼
   ┌─────────────────────────────────────┐
   │  Retorna tarifas de shipping        │
   │  con precio, título, código         │
   └─────────────────────────────────────┘
         │
         ▼
   5. App muestra opciones al usuario
   6. Usuario selecciona método de envío
   7. Al pagar, se crea orden con shipping correcto
```

### Mejoras Implementadas:

1. ✅ **API Version 2024-10** (la más reciente estable)
2. ✅ **Admin API + Draft Orders** (soporta apps de terceros)
3. ✅ **Delay de 500ms** después de crear draft order (para que Shopify calcule)
4. ✅ **Cleanup automático** (borra draft orders de prueba)
5. ✅ **Fallback inteligente** (usa Storefront API si no hay Admin token)
6. ✅ **Logging mejorado** (debugging fácil)

---

## 🔒 Seguridad

### Tokens guardados en Supabase:
- ✅ `access_token` (Storefront API) - Permisos de **SOLO LECTURA** de productos
- ✅ `admin_api_token` (Admin API) - Permisos para Draft Orders (**NO puede modificar órdenes reales**)

### Buenas prácticas:
- 🔐 Tokens encriptados en tránsito (HTTPS)
- 🔐 Acceso mediante Row Level Security (RLS)
- 🔐 Service Role Key para Edge Functions
- 🔐 Nunca exponer tokens en frontend

---

## 🛠️ Troubleshooting

### Error: "Admin API token required"
**Causa:** La tienda no tiene `admin_api_token` configurado
**Solución:** Seguir Paso 1 y Paso 2 arriba

### Error: "Failed to create draft order"
**Causa:** Token inválido o sin permisos
**Solución:** Verificar que el token tiene scopes `write_draft_orders` y `read_shipping`

### Error: "No shipping methods available"
**Causa:** La dirección está fuera de las zonas de envío de la tienda
**Solución:** Verificar en Shopify Admin → Settings → Shipping and delivery → Shipping zones

### Aparecen tarifas pero son $0
**Causa:** La app de shipping (ej: Chilexpress) no está configurada correctamente
**Solución:** Verificar configuración de la app en Shopify Admin → Apps

---

## 📋 Checklist de Configuración

Para cada tienda en el marketplace:

- [ ] Crear Custom App en Shopify Admin
- [ ] Configurar scopes: `read_draft_orders`, `write_draft_orders`, `read_shipping`
- [ ] Instalar app y obtener Admin API token
- [ ] Actualizar `admin_api_token` en tabla `stores` de Supabase
- [ ] Verificar que la tienda tiene zonas de envío configuradas
- [ ] Probar con `node test-shipping-real.js`
- [ ] Verificar que aparecen tarifas correctas (incluyendo apps de terceros)

---

## 🎯 Próximos Pasos

1. ✅ **Aplicar migración SQL** (005_add_admin_api_token.sql) en Supabase
2. ⏳ **Configurar Admin API tokens** para todas las tiendas
3. ⏳ **Integrar UI de shipping** en el checkout de la app
4. ⏳ **Testing end-to-end** con compras reales
5. ⏳ **Documentar para owners de tiendas** cómo configurar sus tokens

---

**Última actualización:** 2025-11-24
**Autor:** Claude Code
**Status:** ✅ Implementación completa - Pendiente configuración de tokens
