# 📦 Guía de Implementación: Sistema de Envíos

**Fecha:** 2025-11-24
**Estado:** Backend completado ✅ | Frontend pendiente ⏳

---

## ✅ Lo que ya está listo (Backend)

### 1. Edge Function: `calculate-shipping`
- **Archivo:** `supabase/functions/calculate-shipping/index.ts`
- **Función:** Calcula tarifas de envío reales desde Shopify usando Draft Orders
- **Input:** Cart items + dirección de envío
- **Output:** Tarifas disponibles por cada tienda

### 2. Migración SQL
- **Archivo:** `supabase/migrations/003_add_shipping_costs.sql`
- **Cambio:** Agrega columna `shipping_costs` (JSONB) a tabla `transactions`

### 3. Servicios Actualizados
- ✅ `src/services/shippingService.ts` (nuevo)
- ✅ `src/services/orderService.ts` (actualizado con `ShippingCost` interface)
- ✅ `supabase/functions/mp-webhook/index.ts` (incluye `shipping_line`)

---

## 🚀 Pasos para Deployment

### Paso 1: Aplicar Migración SQL

**Opción A: Supabase Dashboard (Recomendado)**
```
1. Ir a: https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac/editor
2. Click "SQL Editor" → "New query"
3. Copiar contenido de: supabase/migrations/003_add_shipping_costs.sql
4. Click "Run"
5. Verificar:
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'transactions' AND column_name = 'shipping_costs';
```

**Opción B: CLI (si tienes access token)**
```bash
# Configurar access token
export SUPABASE_ACCESS_TOKEN="tu_access_token_aqui"

# Ejecutar migración
psql "postgresql://postgres.[PROJECT_REF]@aws-0-us-west-1.pooler.supabase.com:5432/postgres" \
  -f supabase/migrations/003_add_shipping_costs.sql
```

### Paso 2: Desplegar Edge Function

```bash
# Asegurarte que tienes access token configurado
export SUPABASE_ACCESS_TOKEN="sbp_xxxxxxxxxxxxx"

# Desplegar la función
supabase functions deploy calculate-shipping \
  --project-ref kscgibfmxnyfjxpcwoac \
  --no-verify-jwt

# Verificar deployment
curl https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/calculate-shipping \
  -H "Authorization: Bearer $EXPO_PUBLIC_SUPABASE_ANON_KEY"
```

### Paso 3: Re-desplegar mp-webhook (actualizado)

```bash
supabase functions deploy mp-webhook \
  --project-ref kscgibfmxnyfjxpcwoac
```

---

## 📱 Implementación Frontend (Checkout)

### Arquitectura de Componentes

```
CheckoutScreen.tsx (o similar)
  ├─ [Sección existente: Resumen del Carrito]
  ├─ [Sección existente: Información de Envío (form)]
  │
  ├─ [NUEVA SECCIÓN: Métodos de Envío]
  │   │
  │   ├─ useEffect: Auto-calcula cuando dirección completa
  │   │
  │   ├─ Por cada tienda en el carrito:
  │   │   ├─ Título: "Envío para {storeName}"
  │   │   ├─ Loading state mientras calcula
  │   │   └─ Radio buttons con opciones:
  │   │       ├─ ○ Express Shipping - $15.000
  │   │       ├─ ● Standard Shipping - $5.000 (selected)
  │   │       └─ ○ Otro método - $X.XXX
  │   │
  │   └─ Total de envíos: $XX.XXX
  │
  ├─ [Sección existente: Resumen Final]
  │   └─ Actualizar para incluir shipping
  │
  └─ [Botón: Proceder al Pago]
```

### Pseudo-código del Flujo

```typescript
// State management
const [shippingAddress, setShippingAddress] = useState({...});
const [shippingRates, setShippingRates] = useState<ShippingRatesByStore>({});
const [selectedRates, setSelectedRates] = useState<SelectedShippingRates>({});
const [calculatingShipping, setCalculatingShipping] = useState(false);

// Auto-calcular cuando dirección está completa
useEffect(() => {
  if (isAddressComplete(shippingAddress)) {
    calculateShipping();
  }
}, [shippingAddress]);

async function calculateShipping() {
  setCalculatingShipping(true);

  const formattedAddress = formatAddressForShopify(shippingAddress);
  const result = await calculateShippingRates(cartItems, formattedAddress);

  if (result.success) {
    setShippingRates(result.shippingRates);

    // Auto-seleccionar la opción más barata por tienda
    const autoSelected: SelectedShippingRates = {};
    Object.entries(result.shippingRates).forEach(([domain, rates]) => {
      const cheapest = rates.reduce((min, rate) =>
        rate.price < min.price ? rate : min
      );
      autoSelected[domain] = {
        rate_id: cheapest.id,
        title: cheapest.title,
        price: cheapest.price,
        code: cheapest.code,
      };
    });
    setSelectedRates(autoSelected);
  }

  setCalculatingShipping(false);
}

// Calcular totales
const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
const shippingTotal = calculateTotalShipping(selectedRates);
const total = subtotal + shippingTotal;

// Al procesar pago
async function handleCheckout() {
  // Validar que se hayan seleccionado envíos
  const validation = validateShippingSelection(cartItems, selectedRates);
  if (!validation.valid) {
    alert(`Falta seleccionar envío para: ${validation.missingStores.join(', ')}`);
    return;
  }

  // Crear transacción con shipping costs
  const transactionData: TransactionData = {
    cartItems,
    shippingInfo,
    totalAmount: total, // Incluye shipping
    storeSplits: calculateStoreSplits(cartItems),
    shippingCosts: selectedRates, // ⭐ NUEVO
    userId: user?.id,
  };

  const result = await createPendingTransaction(transactionData);

  if (result) {
    // Proceder con MercadoPago...
  }
}
```

### Componente de Ejemplo

```typescript
// ShippingMethodSelector.tsx
import { ShippingRate, SelectedShippingRate } from '../services/shippingService';

interface Props {
  storeDomain: string;
  storeName: string;
  rates: ShippingRate[];
  selectedRate?: SelectedShippingRate;
  onSelect: (rate: SelectedShippingRate) => void;
}

export function ShippingMethodSelector({
  storeDomain,
  storeName,
  rates,
  selectedRate,
  onSelect
}: Props) {
  return (
    <View className="mb-4 p-4 bg-white rounded-lg">
      <Text className="font-bold mb-2">Envío para {storeName}</Text>

      {rates.map((rate) => (
        <Pressable
          key={rate.id}
          onPress={() => onSelect({
            rate_id: rate.id,
            title: rate.title,
            price: rate.price,
            code: rate.code,
          })}
          className="flex-row items-center py-2"
        >
          <View className="w-5 h-5 rounded-full border-2 mr-3">
            {selectedRate?.rate_id === rate.id && (
              <View className="flex-1 m-1 rounded-full bg-blue-500" />
            )}
          </View>
          <Text className="flex-1">{rate.title}</Text>
          <Text className="font-bold">${rate.price.toLocaleString('es-CL')}</Text>
        </Pressable>
      ))}
    </View>
  );
}
```

---

## 🧪 Testing del Sistema Completo

### Test Case 1: Cálculo de Envíos

```bash
# Llamar a la Edge Function directamente
curl -X POST \
  https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/calculate-shipping \
  -H "Authorization: Bearer $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "cartItems": [
      {
        "id": "gid://shopify/Product/123",
        "quantity": 2,
        "price": 15000,
        "storeId": "imanix.myshopify.com",
        "selectedVariant": {
          "id": "gid://shopify/ProductVariant/456"
        }
      }
    ],
    "shippingAddress": {
      "address1": "Av. Providencia 1234",
      "city": "Santiago",
      "province": "Región Metropolitana",
      "zip": "7500000",
      "country_code": "CL"
    }
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "shippingRates": {
    "imanix.myshopify.com": [
      {
        "id": "shopify-Standard-5.00",
        "title": "Envío Estándar",
        "price": 5000,
        "code": "STANDARD",
        "source": "shopify"
      },
      {
        "id": "shopify-Express-10.00",
        "title": "Envío Express",
        "price": 10000,
        "code": "EXPRESS",
        "source": "shopify"
      }
    ]
  }
}
```

### Test Case 2: Orden Completa con Envío

1. **En la app:**
   - Agregar productos de 2 tiendas (ej: Imanix + SpotEssence)
   - Completar dirección de envío
   - Seleccionar métodos de envío
   - Ver total actualizado (productos + envíos)
   - Proceder a pagar con MercadoPago

2. **Verificar en Supabase:**
```sql
-- Ver la transacción creada
SELECT
  id,
  total_amount,
  status,
  shipping_costs
FROM transactions
ORDER BY created_at DESC
LIMIT 1;

-- Debería mostrar shipping_costs como:
-- {
--   "imanix.myshopify.com": {
--     "rate_id": "shopify-Standard-5.00",
--     "title": "Envío Estándar",
--     "price": 5000,
--     "code": "STANDARD"
--   },
--   "spot-essence.myshopify.com": {...}
-- }
```

3. **Pagar en MercadoPago** (puedes usar modo test)

4. **Verificar en Shopify:**
   - Ir a cada tienda → Orders
   - Abrir la orden recién creada
   - Verificar que muestra:
     ```
     Subtotal: $XX.XXX
     Shipping (Envío Estándar): $5.000
     Total: $XX.XXX
     ```

---

## 🐛 Troubleshooting

### Error: "Admin API token not configured"

**Causa:** La tienda no tiene `admin_api_token` en la tabla `stores`.

**Solución:**
```sql
-- Verificar tokens
SELECT domain,
       CASE WHEN admin_api_token IS NOT NULL THEN 'Configurado' ELSE 'Falta' END
FROM stores;

-- Si falta, agregarlo desde el dashboard web
```

### Error: "No shipping rates configured"

**Causa:** La tienda no tiene zonas de envío configuradas en Shopify.

**Solución:**
1. Ir a Shopify Admin → Settings → Shipping and delivery
2. Crear zona de envío (ej: "Chile")
3. Agregar tarifas (ej: "Estándar $5.000")

### La función devuelve error 500

**Debugging:**
```bash
# Ver logs de la Edge Function
supabase functions logs calculate-shipping --project-ref kscgibfmxnyfjxpcwoac --follow
```

---

## 📊 Siguiente Pasos

1. ✅ **Backend completado**
2. ⏳ **Desplegar infraestructura** (migración + Edge Function)
3. ⏳ **Implementar UI de shipping en checkout**
4. ⏳ **Testing end-to-end**
5. ⏳ **Configurar zonas de envío en todas las tiendas**

---

## 📝 Notas Técnicas

### Formato de shipping_costs en transactions

```typescript
{
  "imanix.myshopify.com": {
    "rate_id": "shopify-Standard-5.00",  // ID del método de envío
    "title": "Envío Estándar",           // Nombre para mostrar
    "price": 5000,                        // Precio en CLP (sin decimales)
    "code": "STANDARD"                    // Código interno
  },
  "spot-essence.myshopify.com": {
    "rate_id": "shopify-Express-10.00",
    "title": "Envío Express",
    "price": 10000,
    "code": "EXPRESS"
  }
}
```

### Formato de shipping_line en Shopify Draft Order

```javascript
{
  draft_order: {
    // ... line_items, shipping_address ...
    shipping_line: {
      title: "Envío Estándar",   // Aparece en la orden
      price: "5000",              // String, sin decimales
      code: "STANDARD"            // Código de tracking interno
    }
  }
}
```

---

**Última actualización:** 2025-11-24
**Autor:** Claude Code
**Status:** Ready for deployment ✅
