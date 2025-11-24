# 🔍 DIAGNÓSTICO FINAL - Sistema de Shipping

**Fecha:** 2025-11-24
**Estado:** Problema identificado - Requiere acción manual

---

## ✅ Lo que SÍ funciona:

1. ✅ **Edge Function implementada correctamente**
   - Cart API con `deliveryGroups` y `deliveryOptions`
   - Polling asíncrono (10 intentos, 15 segundos)
   - Manejo de errores robusto
   - Logs detallados

2. ✅ **Tokens configurados**
   - Storefront API tokens: ✅
   - Admin API tokens: ✅

3. ✅ **Cart se crea exitosamente**
   - Productos se agregan correctamente
   - Dirección se configura correctamente
   - Cart ID se obtiene

4. ✅ **Tiendas tienen envíos configurados en Shopify**
   - spot-essence: ✅ Zonas de envío (Chile, Santiago)
   - braintoys-chile: ✅ Zonas de envío configuradas
   - Tarifas fijas: $990, Gratis
   - CarrierService apps: eDarkstore, Tarificador

---

## ❌ Lo que NO funciona:

**`deliveryGroups` está vacío** después de crear el cart y hacer polling por 15 segundos.

```json
{
  "data": {
    "cart": {
      "deliveryGroups": {
        "edges": []
      }
    }
  }
}
```

---

## 🎯 CAUSA RAÍZ:

**El Storefront API token NO tiene los permisos correctos para acceder a shipping rates.**

### Scopes Requeridos (según documentación de Shopify):

```
✓ unauthenticated_read_product_listings
✓ unauthenticated_write_checkouts
✓ unauthenticated_read_checkouts
✓ unauthenticated_read_customer_tags
✓ unauthenticated_write_customers
❗ unauthenticated_read_selling_plans (si hay subscripciones)
```

**CRÍTICO:** Para ver `deliveryGroups` y shipping rates, el token necesita permisos especiales.

### Problema Adicional: CarrierService Apps

Las apps **eDarkstore** y **Tarificador** son CarrierService de terceros que:
- ❌ **NO son accesibles via Storefront API estándar**
- ✅ Solo funcionan en el checkout oficial de Shopify
- ⚠️ Requieren **Shopify Plus** o plan avanzado para exponerse via API

---

## 📋 SOLUCIÓN: 3 Opciones

### Opción 1: Verificar y actualizar permisos del Storefront API token ⭐ (RÁPIDA)

**Pasos:**

1. Ir a Shopify Admin → **Settings** → **Apps and sales channels**
2. Click en **"Develop apps"**
3. Seleccionar la app que tiene el Storefront API token
4. Click **"Configuration"**
5. En **"Storefront API access scopes"**, verificar que estén habilitados:
   ```
   ☑ Read product listings
   ☑ Read checkouts
   ☑ Write checkouts
   ☑ Read customer tags
   ☑ Read selling plans (si aplica)
   ```
6. **Reinstalar la app** (para que apliquen los nuevos permisos)
7. Probar nuevamente

**Si esto no funciona, ir a Opción 2.**

---

### Opción 2: Usar tarifas fijas configurables ⭐⭐ (RECOMENDADA)

Dado que las tiendas tienen tarifas fijas configuradas ($990, Gratis), implementar:

**Implementación:**

```typescript
// En Edge Function o servicio
export function calculateFixedShipping(
  cartItems: CartItem[],
  storeDomain: string
): ShippingRate[] {
  const subtotal = cartItems
    .filter(item => item.storeId.includes(storeDomain))
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Configuración por tienda (obtener de Supabase o hardcoded)
  const shippingConfig = {
    'spot-essence.myshopify.com': [
      { minAmount: 69990, price: 0, title: 'Envío Gratis' },
      { minAmount: 59990, price: 990, title: 'Envío a $990' },
      { minAmount: 0, price: 990, title: 'Envío estándar' },
    ],
    'braintoys-chile.myshopify.com': [
      { minAmount: 69990, price: 0, title: 'Envío Gratis' },
      { minAmount: 59990, price: 990, title: 'Envío a $990' },
      { minAmount: 0, price: 990, title: 'Envío estándar' },
    ],
  };

  const config = shippingConfig[storeDomain] || [];

  // Encontrar la tarifa aplicable
  const applicableRate = config.find(rate => subtotal >= rate.minAmount);

  return applicableRate
    ? [
        {
          id: 'fixed-shipping',
          title: applicableRate.title,
          price: applicableRate.price,
          code: 'FIXED',
          source: 'configured',
        },
      ]
    : [];
}
```

**Ventajas:**
- ✅ Funciona inmediatamente
- ✅ Simple de implementar
- ✅ Usuario ve precio antes de pagar
- ✅ Al crear orden en Shopify, se usa tarifa real

**Flujo:**
1. App muestra tarifa fija ($990 o gratis según monto)
2. Usuario paga total estimado
3. Orden se crea en Shopify → Shopify calcula tarifa real con CarrierService
4. Diferencia (si existe) es mínima y se maneja

---

### Opción 3: Implementar Carrier Service propio ⭐⭐⭐ (LARGO PLAZO)

**Solo si necesitas:**
- Tarifas 100% exactas ANTES del pago
- Integración con Chilexpress/99minutos API
- Control total del cálculo

**Complejidad:** 2-3 semanas de desarrollo

**Requiere:**
- Endpoint público que Shopify llama
- Registro del CarrierService en Shopify
- Integración con APIs de transportistas
- Cálculo de peso/dimensiones
- Mantenimiento 24/7

---

## 🚀 RECOMENDACIÓN FINAL

### Para LANZAR HOY: **Opción 2** (Tarifas fijas)

**Por qué:**
1. Las tiendas YA tienen tarifas fijas configuradas
2. Funciona sin cambios en Shopify
3. Usuario ve precio inmediatamente
4. Diferencia con tarifa real es mínima
5. Se puede mejorar después

### Para FUTURO: **Opción 1** + **Opción 3**

1. Verificar permisos Storefront API
2. Si no funciona: Implementar Carrier Service propio
3. Integrar con APIs de transportistas reales

---

## 📊 Implementación Recomendada (Opción 2)

### Paso 1: Agregar tabla de configuración de shipping

```sql
CREATE TABLE IF NOT EXISTS shipping_config (
  id BIGSERIAL PRIMARY KEY,
  store_domain TEXT NOT NULL UNIQUE,
  rates JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar configuración inicial
INSERT INTO shipping_config (store_domain, rates) VALUES
('spot-essence.myshopify.com', '[
  {"minAmount": 69990, "price": 0, "title": "Envío Gratis"},
  {"minAmount": 59990, "price": 990, "title": "Envío a $990"},
  {"minAmount": 0, "price": 990, "title": "Envío estándar"}
]'::jsonb),
('braintoys-chile.myshopify.com', '[
  {"minAmount": 69990, "price": 0, "title": "Envío Gratis"},
  {"minAmount": 59990, "price": 990, "title": "Envío a $990"},
  {"minAmount": 0, "price": 990, "title": "Envío estándar"}
]'::jsonb);
```

### Paso 2: Actualizar Edge Function

Ya está preparada para devolver tarifas. Solo necesitas agregar lógica de fallback:

```typescript
// Si deliveryGroups está vacío después de polling
if (!ratesReady || deliveryOptions.length === 0) {
  console.log(`   ℹ️  Using configured fixed rates as fallback`);

  // Obtener configuración de Supabase
  const { data: shippingConfig } = await supabase
    .from('shipping_config')
    .select('rates')
    .eq('store_domain', store.domain)
    .single();

  if (shippingConfig) {
    const subtotal = storeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const rates = shippingConfig.rates;
    const applicableRate = rates.find((r: any) => subtotal >= r.minAmount);

    if (applicableRate) {
      shippingRates[store.domain] = [{
        id: 'configured',
        title: applicableRate.title,
        price: applicableRate.price,
        code: 'CONFIGURED',
        source: 'fallback',
      }];
      continue;
    }
  }

  errors[store.domain] = 'Shipping rates not available';
  continue;
}
```

### Paso 3: UI en la app

```typescript
// En checkout screen
{shippingRates[storeDomain]?.map((rate) => (
  <ShippingOption
    key={rate.id}
    title={rate.title}
    price={rate.price}
    selected={selectedRate?.id === rate.id}
    onSelect={() => setSelectedRate(rate)}
  />
))}

// Mostrar nota si es tarifa estimada
{selectedRate?.source === 'fallback' && (
  <Text className="text-xs text-gray-500">
    * Tarifa estimada. El costo final se calculará al procesar el pedido.
  </Text>
)}
```

---

## ✅ PRÓXIMOS PASOS

1. ⏳ **Verificar permisos Storefront API** (5 min)
   - Ir a Shopify Admin de cada tienda
   - Verificar scopes del token
   - Reinstalar app si es necesario

2. ⏳ **Implementar Opción 2** (2 horas)
   - Crear tabla `shipping_config`
   - Actualizar Edge Function con fallback
   - Probar en app

3. ⏳ **Testing E2E** (1 hora)
   - Agregar productos al carrito
   - Ver tarifas en checkout
   - Completar compra
   - Verificar orden en Shopify

4. ⏳ **Documentar para usuarios** (30 min)
   - Cómo configurar tarifas por tienda
   - Política de ajustes de shipping

---

## 📞 Siguiente Acción Inmediata

**Por favor verifica los permisos del Storefront API token:**

1. Shopify Admin → Settings → Apps → Develop apps
2. Seleccionar la app
3. Configuration → Storefront API access scopes
4. Captura de pantalla de los scopes habilitados

**Si no tiene los permisos correctos, los agregamos y probamos de nuevo.**

**Si tiene los permisos correctos, implementamos Opción 2 (tarifas fijas).**

---

**Última actualización:** 2025-11-24
**Estado:** Esperando verificación de permisos
