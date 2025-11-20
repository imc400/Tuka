# Sistema de Envíos Multi-Tienda

## Objetivo
Calcular costos de envío reales de cada tienda Shopify y permitir al usuario seleccionar el método de envío por tienda, para que las órdenes lleguen a Shopify exactamente como si se hubieran hecho en su propia tienda.

## Estrategia: Shopify Shipping API

### Por qué esta opción
- ✅ Usa la configuración existente de cada tienda
- ✅ Las tiendas controlan tarifas desde su panel Shopify
- ✅ Múltiples opciones de envío (Express, Normal, etc.)
- ✅ Respeta zonas de envío configuradas por la tienda
- ✅ Cálculo basado en peso/dimensiones de productos
- ✅ La orden llega a Shopify tal cual como si fuera directa

## Flujo Completo

### 1. Usuario completa dirección de envío
```
- Región (RM, V, VIII, etc.)
- Comuna
- Calle
- Código postal
```

### 2. App consulta opciones de envío
**Edge Function:** `calculate-shipping`

```typescript
POST /functions/v1/calculate-shipping
Body: {
  stores: ["spot-essence.myshopify.com", "braintoys-chile.myshopify.com"],
  destination: {
    region: "RM",
    city: "Santiago",
    zip: "8320000",
    country_code: "CL"
  },
  items: [
    {
      storeId: "spot-essence.myshopify.com",
      variant_id: "46501197218031",
      quantity: 1,
      weight: 500 // gramos
    }
  ]
}

Response: {
  "spot-essence.myshopify.com": {
    options: [
      {
        id: "shopify-Express%20Shipping-5.00",
        name: "Chilexpress Express",
        price: 5000,
        delivery_estimate: "1-2 días hábiles",
        code: "express"
      },
      {
        id: "shopify-Standard%20Shipping-2.50",
        name: "Envío Normal",
        price: 2500,
        delivery_estimate: "3-5 días hábiles",
        code: "standard"
      }
    ]
  },
  "braintoys-chile.myshopify.com": {
    options: [...]
  }
}
```

### 3. Usuario selecciona método por tienda
```
UI muestra:
┌─────────────────────────────────┐
│ SpotEssence                     │
│ ○ Express (1-2 días) - $5.000  │
│ ● Normal (3-5 días) - $2.500   │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Braintoys                       │
│ ● Express (24-48hrs) - $4.500  │
│ ○ Retiro en tienda - Gratis    │
└─────────────────────────────────┘

Total productos: $20.480
Total envío: $7.000
─────────────────────
TOTAL: $27.480
```

### 4. Se guarda selección en transacción
```sql
-- Actualizar schema
ALTER TABLE transactions ADD COLUMN shipping_selection JSONB;

-- Ejemplo de datos:
{
  "spot-essence.myshopify.com": {
    "method_id": "shopify-Standard%20Shipping-2.50",
    "method_name": "Envío Normal",
    "cost": 2500,
    "delivery_estimate": "3-5 días hábiles"
  },
  "braintoys-chile.myshopify.com": {
    "method_id": "shopify-Express%20Shipping-4.50",
    "method_name": "Chilexpress Express",
    "cost": 4500,
    "delivery_estimate": "24-48 horas"
  }
}
```

### 5. MercadoPago incluye envío en el total
```typescript
const totalProducts = cartItems.reduce(...);
const totalShipping = Object.values(shippingSelection).reduce(
  (sum, s) => sum + s.cost, 0
);

preference.items = [
  ...cartItems.map(...),
  {
    id: 'shipping',
    title: 'Envío',
    quantity: 1,
    unit_price: totalShipping,
    currency_id: 'CLP',
    category_id: 'shipping'
  }
];
```

### 6. Webhook crea orden con shipping_line
```typescript
// En mp-webhook/index.ts - función createShopifyOrders
const shippingInfo = transaction.shipping_selection[store.domain];

const draftOrder = {
  draft_order: {
    line_items: [...],
    shipping_line: {
      title: shippingInfo.method_name, // "Chilexpress Express"
      price: shippingInfo.cost.toString(), // "4500"
      code: shippingInfo.method_id // ID del método
    },
    shipping_address: {...}
  }
};
```

## Implementación Técnica

### Edge Function: calculate-shipping/index.ts
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { stores, destination, items } = await req.json();

  const supabase = createClient(...);
  const { data: storeConfigs } = await supabase
    .from('stores')
    .select('domain, admin_api_token')
    .in('domain', stores);

  const shippingOptions = {};

  for (const store of storeConfigs) {
    const storeItems = items.filter(i => i.storeId === store.domain);

    // 1. Obtener shipping zones de la tienda
    const zonesResponse = await fetch(
      `https://${store.domain}/admin/api/2024-01/shipping_zones.json`,
      {
        headers: {
          'X-Shopify-Access-Token': store.admin_api_token
        }
      }
    );
    const { shipping_zones } = await zonesResponse.json();

    // 2. Encontrar zone que aplique para la región destino
    const matchingZone = shipping_zones.find(zone => {
      return zone.countries?.some(country =>
        country.code === 'CL' &&
        (country.provinces?.some(p => p.code === destination.region) ||
         country.provinces?.length === 0) // Aplica a todo Chile
      );
    });

    if (!matchingZone) {
      shippingOptions[store.domain] = {
        options: [],
        error: 'No hay métodos de envío disponibles para esta región'
      };
      continue;
    }

    // 3. Obtener weight-based rates o price-based rates
    const rates = matchingZone.weight_based_shipping_rates ||
                  matchingZone.price_based_shipping_rates ||
                  [];

    // 4. Calcular peso/precio total de items de esta tienda
    const totalWeight = storeItems.reduce(
      (sum, item) => sum + (item.weight || 0) * item.quantity, 0
    );
    const totalPrice = storeItems.reduce(
      (sum, item) => sum + item.price * item.quantity, 0
    );

    // 5. Filtrar rates aplicables
    const applicableRates = rates.filter(rate => {
      if (rate.weight_low !== null && rate.weight_high !== null) {
        return totalWeight >= rate.weight_low && totalWeight <= rate.weight_high;
      }
      if (rate.price_low !== null && rate.price_high !== null) {
        return totalPrice >= rate.price_low && totalPrice <= rate.price_high;
      }
      return true; // Sin restricciones
    });

    // 6. Formatear opciones
    shippingOptions[store.domain] = {
      options: applicableRates.map(rate => ({
        id: `shopify-${rate.name}-${rate.price}`,
        name: rate.name,
        price: parseFloat(rate.price) * 1, // Convertir a número
        delivery_estimate: rate.min_delivery_date && rate.max_delivery_date
          ? `${rate.min_delivery_date}-${rate.max_delivery_date} días`
          : null,
        code: rate.id
      }))
    };
  }

  return new Response(JSON.stringify(shippingOptions), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### Cambios en la App (React Native)

#### 1. Nuevo estado en App.tsx
```typescript
const [shippingOptions, setShippingOptions] = useState<Record<string, any>>({});
const [selectedShipping, setSelectedShipping] = useState<Record<string, any>>({});
const [loadingShipping, setLoadingShipping] = useState(false);
```

#### 2. Fetch shipping cuando se completa dirección
```typescript
useEffect(() => {
  if (region && city && street) {
    fetchShippingOptions();
  }
}, [region, city, street]);

async function fetchShippingOptions() {
  setLoadingShipping(true);

  // Agrupar items por tienda
  const stores = [...new Set(cart.map(item => item.storeId))];

  const response = await fetch(`${supabaseUrl}/functions/v1/calculate-shipping`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`
    },
    body: JSON.stringify({
      stores,
      destination: { region, city, zip_code: zipCode, country_code: 'CL' },
      items: cart.map(item => ({
        storeId: item.storeId,
        variant_id: item.selectedVariant?.id,
        quantity: item.quantity,
        weight: item.weight || 500, // Default 500g
        price: item.price
      }))
    })
  });

  const options = await response.json();
  setShippingOptions(options);

  // Auto-seleccionar opción más barata por defecto
  const defaultSelection = {};
  Object.keys(options).forEach(store => {
    if (options[store].options?.length > 0) {
      const cheapest = options[store].options.sort((a, b) => a.price - b.price)[0];
      defaultSelection[store] = cheapest;
    }
  });
  setSelectedShipping(defaultSelection);

  setLoadingShipping(false);
}
```

#### 3. UI para seleccionar envío
```typescript
{Object.keys(shippingOptions).map(storeDomain => {
  const store = shippingOptions[storeDomain];
  const storeName = cart.find(i => i.storeId === storeDomain)?.storeName;

  return (
    <View key={storeDomain} className="mb-4">
      <Text className="font-semibold mb-2">{storeName}</Text>

      {store.options?.map(option => (
        <TouchableOpacity
          key={option.id}
          onPress={() => setSelectedShipping({
            ...selectedShipping,
            [storeDomain]: option
          })}
          className={`border p-3 rounded-lg mb-2 ${
            selectedShipping[storeDomain]?.id === option.id
              ? 'border-indigo-600 bg-indigo-50'
              : 'border-gray-200'
          }`}
        >
          <View className="flex-row justify-between">
            <View>
              <Text className="font-medium">{option.name}</Text>
              {option.delivery_estimate && (
                <Text className="text-sm text-gray-600">
                  {option.delivery_estimate}
                </Text>
              )}
            </View>
            <Text className="font-semibold">
              ${option.price.toLocaleString('es-CL')}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
})}
```

#### 4. Incluir envío en total
```typescript
const totalShipping = Object.values(selectedShipping).reduce(
  (sum: number, s: any) => sum + (s?.price || 0), 0
);

const grandTotal = totalAmount + totalShipping;
```

## Consideraciones Importantes

### Peso de Productos
- Shopify tiene el campo `weight` y `weight_unit` en cada variant
- Necesitamos obtener estos datos al cargar productos
- Si no está configurado, usar peso default (500g)

### Zonas de Envío
- Las tiendas DEBEN tener configuradas sus shipping zones en Shopify
- Si una tienda no tiene configurado envío a una región, mostrar error claro

### Envío Gratis
- Si una tienda ofrece envío gratis (price = 0), debe aparecer como opción
- Puede ser condicional por monto mínimo

### Múltiples Carriers
- Una tienda puede tener Chilexpress, Starken, Blue Express, etc.
- Todas las opciones deben mostrarse al usuario

## Migración de Base de Datos

```sql
-- Agregar campo para guardar selección de envío
ALTER TABLE transactions ADD COLUMN shipping_selection JSONB;
ALTER TABLE transactions ADD COLUMN total_shipping DECIMAL(10,2);

-- Actualizar transactions existentes
UPDATE transactions SET shipping_selection = '{}', total_shipping = 0;

-- Índice para queries
CREATE INDEX idx_transactions_shipping ON transactions USING GIN (shipping_selection);
```

## Testing

### Casos a probar:
1. ✅ Tienda con múltiples opciones de envío
2. ✅ Tienda con envío gratis por monto mínimo
3. ✅ Tienda sin configuración de envío a región específica
4. ✅ Cálculo correcto de peso total
5. ✅ Múltiples tiendas con diferentes carriers
6. ✅ Orden llega a Shopify con shipping_line correcto

## Prioridad: ALTA
Este feature es crítico para que las tiendas reciban órdenes completas y puedan procesarlas correctamente.

## Estimación: 2-3 días de desarrollo
- Día 1: Edge Function + Schema DB
- Día 2: UI en la app + integración
- Día 3: Testing y ajustes
