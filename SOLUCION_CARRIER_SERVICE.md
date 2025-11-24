# 🚚 Solución Final: Carrier Service Apps

## 🔍 Problema Identificado

Las tiendas (spot-essence, braintoys-chile) SÍ tienen envíos configurados:

**Configuración en Shopify:**
```
✅ Zona: Regiones • Chile (14 de 16 regiones)
   - Envío a $990 (pedidos $59.990+)
   - Envío Gratis (pedidos $69.990+)
   - ❗ eDarkstore Shipping Rates (CarrierService)
   - ❗ Tarificador (CarrierService)

✅ Zona: Santiago • Chile
   - Envío a $990 (pedidos $49.990+)
   - Envío Gratis (pedidos $59.990+)
   - ❗ eDarkstore Shipping Rates (CarrierService)
   - ❗ Tarificador (CarrierService)
```

## ❌ Por qué NO funciona con Storefront API:

**CarrierService apps** (eDarkstore, Tarificador) son servicios de cálculo dinámico que:
- Requieren llamadas en tiempo real al backend de la app
- **NO están expuestos via Storefront API**
- Solo funcionan en el checkout oficial de Shopify
- Solo son accesibles via **Shopify Checkout Extensions** o **Admin API con contexto específico**

**Storefront API solo ve:**
- ✅ Tarifas fijas configuradas directamente
- ❌ NO ve tarifas de CarrierService

---

## 🎯 Soluciones Posibles

### Opción 1: Usar tarifas fijas (RÁPIDO)

**Implementación:**
Las tiendas ya tienen tarifas fijas configuradas ($990, Gratis). Podemos:
1. Mostrar esas tarifas al usuario
2. Aplicar las condiciones (monto mínimo)
3. Funciona inmediatamente

**Limitación:**
- No son tarifas "reales" de Chilexpress/99minutos
- Son aproximaciones fijas

**Código:**
```typescript
// En el checkout, calcular based en subtotal
const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

if (subtotal >= 69990) {
  shippingCost = 0; // Gratis
} else if (subtotal >= 59990) {
  shippingCost = 990;
} else {
  shippingCost = 990; // Default
}
```

---

### Opción 2: Implementar Carrier Service propio (CORRECTO pero COMPLEJO)

**Qué es:**
Un servidor que Shopify llama para obtener tarifas dinámicas.

**Requisitos:**
1. Crear un endpoint público (ej: `https://tu-app.com/shipping-rates`)
2. Registrar el CarrierService en Shopify Admin API
3. El endpoint recibe datos de la orden y retorna tarifas
4. Integrar con APIs de Chilexpress, 99minutos, etc.

**Pasos:**

#### 1. Crear Carrier Service Endpoint

```typescript
// supabase/functions/carrier-service/index.ts
serve(async (req) => {
  const { rate } = await req.json();

  // rate contiene:
  // - origin (dirección de la tienda)
  // - destination (dirección del cliente)
  // - items (productos con peso/dimensiones)
  // - currency

  // Llamar API de Chilexpress/99minutos
  const rates = await getShippingRatesFromChilexpress({
    origin: rate.origin,
    destination: rate.destination,
    weight: calculateTotalWeight(rate.items),
  });

  // Retornar formato Shopify
  return new Response(JSON.stringify({
    rates: rates.map(r => ({
      service_name: r.name,
      service_code: r.code,
      total_price: r.price * 100, // en centavos
      currency: 'CLP',
      min_delivery_date: r.estimatedDays,
      max_delivery_date: r.estimatedDays + 2,
    }))
  }));
});
```

#### 2. Registrar en Shopify

```bash
curl -X POST "https://spot-essence.myshopify.com/admin/api/2024-10/carrier_services.json" \
  -H "X-Shopify-Access-Token: $ADMIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "carrier_service": {
      "name": "ShopUnite Shipping",
      "callback_url": "https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/carrier-service",
      "service_discovery": true
    }
  }'
```

#### 3. Shopify llamará tu endpoint automáticamente

Cuando alguien hace checkout, Shopify llama tu endpoint y muestra las tarifas retornadas.

**Pros:**
- ✅ Tarifas reales de Chilexpress/otros
- ✅ Dinámico y actualizado
- ✅ Funciona en checkout de Shopify

**Contras:**
- ❌ Complejo de implementar
- ❌ Requiere integración con APIs de transportistas
- ❌ Solo funciona en checkout de Shopify (no en tu app custom)

---

### Opción 3: Híbrido - Tarifas estimadas + Ajuste post-pago (RECOMENDADO)

**Flujo:**
1. En tu app: Mostrar tarifas fijas ($990, Gratis según monto)
2. Usuario paga el total estimado
3. Después del pago: Crear orden en Shopify → Shopify calcula tarifa real con CarrierService
4. Si hay diferencia:
   - Si es menor: Todo bien
   - Si es mayor: Contactar cliente o absorber diferencia

**Implementación:**
```typescript
// Checkout en app
const estimatedShipping = subtotal >= 69990 ? 0 : 990;
const total = subtotal + estimatedShipping;

// Después de pago aprobado (webhook)
// Crear orden en Shopify con shipping_line
const order = await createShopifyOrder({
  line_items: [...],
  shipping_address: {...},
  shipping_line: {
    title: "Envío estimado",
    price: estimatedShipping,
    code: "ESTIMATED"
  }
});

// Shopify calcula tarifa real usando CarrierService
// Si hay diferencia, manejarla
```

**Pros:**
- ✅ Simple de implementar
- ✅ Usuario ve precio rápidamente
- ✅ Tarifas reales se calculan al final
- ✅ Funciona HOY

**Contras:**
- ⚠️ Puede haber pequeñas diferencias
- ⚠️ Necesitas política clara de ajustes

---

## 📋 Recomendación Final

**Para lanzar YA:**
→ **Opción 3 (Híbrido)**

1. Mostrar tarifas fijas en el checkout de la app
2. Dejar que Shopify calcule la tarifa real al crear la orden
3. Manejar diferencias si existen (usualmente son mínimas)

**Para largo plazo:**
→ **Opción 2 (Carrier Service propio)**

Solo si necesitas tarifas 100% exactas ANTES del pago y tienes tiempo para:
- Integrar con APIs de Chilexpress/99minutos
- Implementar cálculo de peso/dimensiones
- Mantener el servicio funcionando 24/7

---

## 🚀 Implementación Inmediata (Opción 3)

Actualizo el código para usar tarifas fijas basadas en configuración de las tiendas:

```typescript
// shippingService.ts
export function calculateFixedShipping(
  cartItems: CartItem[],
  storeDomain: string
): ShippingRate[] {
  const subtotal = cartItems
    .filter(item => item.storeId.includes(storeDomain))
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  const rates: ShippingRate[] = [];

  // Configuración por tienda
  const config = {
    'spot-essence.myshopify.com': {
      freeThreshold: 69990,
      paidThreshold: 59990,
      paidPrice: 990,
    },
    'braintoys-chile.myshopify.com': {
      freeThreshold: 69990,
      paidThreshold: 59990,
      paidPrice: 990,
    },
  };

  const storeConfig = config[storeDomain];

  if (subtotal >= storeConfig.freeThreshold) {
    rates.push({
      id: 'free',
      title: 'Envío Gratis',
      price: 0,
      code: 'FREE',
      source: 'fixed',
    });
  }

  if (subtotal >= storeConfig.paidThreshold) {
    rates.push({
      id: 'standard',
      title: `Envío a $${storeConfig.paidPrice.toLocaleString('es-CL')}`,
      price: storeConfig.paidPrice,
      code: 'STANDARD',
      source: 'fixed',
    });
  } else {
    rates.push({
      id: 'standard',
      title: `Envío a $${storeConfig.paidPrice.toLocaleString('es-CL')}`,
      price: storeConfig.paidPrice,
      code: 'STANDARD',
      source: 'fixed',
    });
  }

  return rates;
}
```

**¿Quieres que implemente la Opción 3 (tarifas fijas) para que funcione HOY?**

---

**Última actualización:** 2025-11-24
