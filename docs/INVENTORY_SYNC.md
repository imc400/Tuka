# Sistema de Sincronización de Inventario

## Estrategia: Híbrida (Cache + Verificación Pre-Pago)

### Por qué esta opción
- ✅ **Rápido**: Productos se cargan desde cache local
- ✅ **Seguro**: Verificación real antes de pagar
- ✅ **Escalable**: No sobrecarga API de Shopify
- ✅ **Balance perfecto**: Velocidad en navegación + exactitud en checkout
- ✅ **Previene sobreventa**: Validación final con Shopify

## Flujo Completo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. NAVEGACIÓN (desde cache - ultra rápido)                 │
│    Usuario ve productos → DB local (actualizada cada 15min) │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. AGREGAR AL CARRITO (validación ligera)                  │
│    Valida contra cache: "10 disponibles"                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. CHECKOUT - ANTES DE PAGAR (validación real)             │
│    ✓ Consulta stock REAL en Shopify API                    │
│    ✓ Si OK: Continúa al pago                               │
│    ✗ Si agotado: "Lo sentimos, producto sin stock"         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. PAGO APROBADO (descuenta automático)                    │
│    Shopify descuenta stock al crear la orden               │
└─────────────────────────────────────────────────────────────┘
```

## Implementación Técnica

### 1. Schema de Base de Datos

```sql
-- Tabla para cache de inventario
CREATE TABLE product_inventory (
  id SERIAL PRIMARY KEY,
  store_domain TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  variant_title TEXT,
  quantity_available INTEGER NOT NULL,
  inventory_policy TEXT, -- 'deny' o 'continue' (permite venta sin stock)
  tracked BOOLEAN DEFAULT true, -- Si la variante trackea inventario
  last_synced TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(store_domain, variant_id)
);

-- Índices para queries rápidas
CREATE INDEX idx_inventory_store_variant ON product_inventory(store_domain, variant_id);
CREATE INDEX idx_inventory_synced ON product_inventory(last_synced);
CREATE INDEX idx_inventory_available ON product_inventory(quantity_available) WHERE tracked = true;

-- Función para limpiar cache viejo (> 24 horas)
CREATE OR REPLACE FUNCTION cleanup_old_inventory()
RETURNS void AS $$
BEGIN
  DELETE FROM product_inventory
  WHERE last_synced < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
```

### 2. Edge Function: sync-inventory

**Propósito**: Job que corre cada 15 minutos sincronizando inventario de todas las tiendas activas.

```typescript
// supabase/functions/sync-inventory/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Obtener todas las tiendas activas
    const { data: stores } = await supabase
      .from('stores')
      .select('domain, admin_api_token')
      .eq('is_active', true);

    console.log(`Syncing inventory for ${stores?.length} stores...`);

    for (const store of stores || []) {
      await syncStoreInventory(store, supabase);
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced_stores: stores?.length,
        timestamp: new Date().toISOString()
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function syncStoreInventory(store: any, supabase: any) {
  const maxPages = 10; // Límite de seguridad
  let hasNextPage = true;
  let cursor = null;

  for (let page = 0; page < maxPages && hasNextPage; page++) {
    // GraphQL query para obtener inventario
    const query = `
      query GetInventory($cursor: String) {
        products(first: 50, after: $cursor) {
          edges {
            node {
              id
              title
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    inventoryQuantity
                    inventoryPolicy
                    inventoryItem {
                      tracked
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const response = await fetch(
      `https://${store.domain}/admin/api/2024-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': store.admin_api_token,
        },
        body: JSON.stringify({
          query,
          variables: { cursor },
        }),
      }
    );

    const { data } = await response.json();
    const products = data?.products?.edges || [];

    // Procesar cada producto
    for (const productEdge of products) {
      const product = productEdge.node;

      for (const variantEdge of product.variants.edges) {
        const variant = variantEdge.node;

        // Extraer ID numérico del GraphQL ID
        const variantId = variant.id.split('/').pop();
        const productId = product.id.split('/').pop();

        // Upsert en la DB
        await supabase
          .from('product_inventory')
          .upsert({
            store_domain: store.domain,
            product_id: productId,
            variant_id: variantId,
            variant_title: variant.title,
            quantity_available: variant.inventoryQuantity || 0,
            inventory_policy: variant.inventoryPolicy,
            tracked: variant.inventoryItem?.tracked ?? true,
            last_synced: new Date().toISOString(),
          }, {
            onConflict: 'store_domain,variant_id'
          });
      }
    }

    // Preparar siguiente página
    const pageInfo = data?.products?.pageInfo;
    hasNextPage = pageInfo?.hasNextPage || false;
    cursor = pageInfo?.endCursor;

    console.log(`Store ${store.domain}: Page ${page + 1} synced`);
  }

  console.log(`✓ Store ${store.domain} inventory synced`);
}
```

### 3. Configurar Cron Job en Supabase

**Opción A: pg_cron (Supabase nativo)**
```sql
-- Ejecutar cada 15 minutos
SELECT cron.schedule(
  'sync-inventory-job',
  '*/15 * * * *', -- Cada 15 minutos
  $$
  SELECT net.http_post(
    url := 'https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/sync-inventory',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  );
  $$
);
```

**Opción B: External cron (GitHub Actions, cron-job.org)**
```yaml
# .github/workflows/sync-inventory.yml
name: Sync Inventory
on:
  schedule:
    - cron: '*/15 * * * *' # Cada 15 minutos
  workflow_dispatch: # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger sync
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/sync-inventory
```

### 4. Edge Function: verify-stock-before-payment

**Propósito**: Verificar stock real en Shopify justo antes de crear la transacción.

```typescript
// supabase/functions/verify-stock/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { cartItems } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Agrupar items por tienda
    const itemsByStore: Record<string, any[]> = {};
    cartItems.forEach((item: any) => {
      const domain = item.storeId.replace(/^real-/, '');
      if (!itemsByStore[domain]) itemsByStore[domain] = [];
      itemsByStore[domain].push(item);
    });

    // Obtener configuración de tiendas
    const storeDomains = Object.keys(itemsByStore);
    const { data: stores } = await supabase
      .from('stores')
      .select('domain, admin_api_token')
      .in('domain', storeDomains);

    const stockIssues: any[] = [];

    // Verificar stock en cada tienda
    for (const store of stores || []) {
      const storeItems = itemsByStore[store.domain];

      for (const item of storeItems) {
        // Extraer variant ID numérico
        const variantId = item.selectedVariant?.id?.split('/').pop();

        // Consultar stock actual en Shopify
        const response = await fetch(
          `https://${store.domain}/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${variantId}`,
          {
            headers: {
              'X-Shopify-Access-Token': store.admin_api_token,
            },
          }
        );

        const { inventory_levels } = await response.json();
        const currentStock = inventory_levels?.[0]?.available || 0;

        // Verificar si hay suficiente stock
        if (currentStock < item.quantity) {
          stockIssues.push({
            productName: item.name,
            storeName: item.storeName,
            requested: item.quantity,
            available: currentStock,
          });
        }
      }
    }

    if (stockIssues.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          stockIssues,
          message: 'Algunos productos no tienen stock suficiente',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Stock verificado correctamente' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Stock verification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
```

### 5. Cambios en la App (React Native)

#### Mostrar stock desde cache
```typescript
// Al cargar productos, incluir stock
const { data: products } = await supabase
  .from('products')
  .select(`
    *,
    inventory:product_inventory!inner(quantity_available, tracked)
  `)
  .eq('product_inventory.store_domain', storeDomain);

// Mostrar en UI
<Text className="text-sm text-gray-600">
  {product.inventory.tracked
    ? `${product.inventory.quantity_available} disponibles`
    : 'Stock disponible'
  }
</Text>

// Deshabilitar "Agregar" si no hay stock
<TouchableOpacity
  disabled={product.inventory.quantity_available === 0}
  className={product.inventory.quantity_available === 0 ? 'opacity-50' : ''}
>
  <Text>
    {product.inventory.quantity_available === 0
      ? 'Sin stock'
      : 'Agregar al carrito'
    }
  </Text>
</TouchableOpacity>
```

#### Verificar stock antes de pagar
```typescript
async function handlePay() {
  setLoading(true);

  try {
    // 1. VERIFICAR STOCK REAL EN SHOPIFY
    const verifyResponse = await fetch(
      `${supabaseUrl}/functions/v1/verify-stock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ cartItems: cart }),
      }
    );

    const verifyResult = await verifyResponse.json();

    if (!verifyResult.success) {
      // Mostrar alerta con productos sin stock
      const issues = verifyResult.stockIssues
        .map((i: any) => `${i.productName}: Solo quedan ${i.available} unidades`)
        .join('\n');

      Alert.alert(
        'Productos sin stock suficiente',
        issues,
        [
          { text: 'OK', onPress: () => {
            // Opcional: Eliminar productos sin stock del carrito
            removeOutOfStockItems(verifyResult.stockIssues);
          }}
        ]
      );
      return;
    }

    // 2. STOCK OK - CONTINUAR CON PAGO
    // Crear transacción
    const { data: transaction } = await supabase
      .from('transactions')
      .insert({ ... })
      .select()
      .single();

    // Crear preferencia MercadoPago
    const mpResult = await createMercadoPagoPreference(...);

    // Abrir checkout
    await openMercadoPagoCheckout(mpResult.initPoint);

  } catch (error) {
    Alert.alert('Error', error.message);
  } finally {
    setLoading(false);
  }
}
```

### 6. Actualización Automática de Cache Post-Venta

Cuando el webhook crea una orden en Shopify, Shopify automáticamente descuenta el stock. Para mantener nuestro cache sincronizado:

```typescript
// En mp-webhook/index.ts, después de crear orden exitosa
async function updateInventoryAfterSale(storeItems: any[], store: any, supabase: any) {
  for (const item of storeItems) {
    const variantId = item.selectedVariant?.id?.split('/').pop();

    // Decrementar en cache local
    await supabase.rpc('decrement_inventory', {
      p_store_domain: store.domain,
      p_variant_id: variantId,
      p_quantity: item.quantity
    });
  }
}

// Función SQL helper
CREATE OR REPLACE FUNCTION decrement_inventory(
  p_store_domain TEXT,
  p_variant_id TEXT,
  p_quantity INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE product_inventory
  SET
    quantity_available = GREATEST(quantity_available - p_quantity, 0),
    last_synced = NOW()
  WHERE store_domain = p_store_domain
    AND variant_id = p_variant_id;
END;
$$ LANGUAGE plpgsql;
```

## UI/UX Considerations

### Indicadores de Stock
```typescript
// Colores según disponibilidad
const getStockColor = (qty: number) => {
  if (qty === 0) return 'text-red-600';
  if (qty <= 5) return 'text-orange-600';
  return 'text-green-600';
};

// Badges
{stock.tracked && (
  <View className={`px-2 py-1 rounded ${getStockBadge(stock.quantity)}`}>
    <Text className="text-xs">
      {stock.quantity === 0 && 'Agotado'}
      {stock.quantity > 0 && stock.quantity <= 5 && `¡Solo ${stock.quantity}!`}
      {stock.quantity > 5 && 'Disponible'}
    </Text>
  </View>
)}
```

### Mensajes al Usuario
```typescript
// Al agregar al carrito
"✓ Agregado al carrito (15 disponibles)"

// Al verificar stock antes de pagar
"⏳ Verificando disponibilidad..."

// Si hay problema
"⚠️ Lo sentimos, algunos productos se agotaron:
   • Producto A: Solo quedan 2 unidades (tenías 5)
   • Producto B: Sin stock"

// Botones
"Actualizar cantidades" | "Eliminar productos agotados"
```

## Monitoreo y Logs

```typescript
// Logs importantes
console.log('[INVENTORY] Sync started:', new Date());
console.log('[INVENTORY] Store synced:', store.domain, 'products:', count);
console.log('[INVENTORY] Stock verified before payment:', transaction.id);
console.log('[INVENTORY] Stock issue detected:', productName, available, requested);
```

## Testing

### Casos críticos:
1. ✅ Producto con stock suficiente → Pago exitoso
2. ✅ Producto sin stock → Bloqueado antes de pagar
3. ✅ Stock cambia mientras usuario está en checkout → Detectado en verificación
4. ✅ Múltiples usuarios compran el último item → Solo uno logra pagar
5. ✅ Cache desactualizado → Verificación real previene sobreventa
6. ✅ Producto sin tracking de inventario → Siempre permite venta

## Prioridad: ALTA
El control de inventario es crítico para evitar sobreventa y problemas con clientes.

## Estimación: 3-4 días de desarrollo
- Día 1: Schema DB + Edge Function sync-inventory
- Día 2: Cron job + Edge Function verify-stock
- Día 3: Integración en app + UI
- Día 4: Testing exhaustivo de casos edge

## Notas Adicionales

### Performance
- Cache reduce latencia de 500-1000ms a <50ms
- Sync cada 15 min = 96 syncs/día por tienda
- Con 10 tiendas = 960 API calls/día (muy por debajo del límite de Shopify)

### Shopify API Limits
- REST Admin API: 2 calls/segundo
- GraphQL: 50 puntos/segundo
- Nuestro sync usa GraphQL = Muy eficiente

### Fallback
Si sync falla por cualquier razón, siempre tenemos la verificación pre-pago como red de seguridad.
