# 🏗️ Arquitectura del Sistema - ShopUnite Marketplace

Documentación técnica completa del sistema de checkout multi-tienda.

---

## 📊 Stack Tecnológico

### Frontend
- **React Native** (Expo SDK 54)
- **TypeScript**
- **NativeWind** (Tailwind CSS)
- **Expo Web Browser** (para checkout de MercadoPago)

### Backend
- **Supabase Edge Functions** (Deno runtime)
- **Supabase PostgreSQL** (base de datos)
- **Supabase Auth** (futuro)

### Integraciones
- **MercadoPago API** (procesamiento de pagos)
- **Shopify Admin API** (creación de órdenes)
- **Shopify Storefront API** (catálogo de productos)

---

## 🔄 Flujo Completo de Compra

### Diagrama de Secuencia

```
Usuario → App → Edge Functions → MercadoPago → Webhook → Shopify
```

### Detalle del Flujo

#### 1️⃣ **Agregar al Carrito** (Frontend)
```typescript
// App.tsx:199-238
addToCart(product, store, variant)
```
- Valida variantes
- Maneja cantidades
- Almacena en state local

#### 2️⃣ **Iniciar Checkout** (Frontend)
```typescript
// App.tsx:323-411
handleRealPayment()
```
1. Valida formulario de envío
2. Llama a `createPendingTransaction()`
3. Crea registro en DB con status "pending"

#### 3️⃣ **Crear Preferencia de Pago** (Edge Function)
```typescript
// supabase/functions/create-mp-preference/index.ts
POST /functions/v1/create-mp-preference
```
1. Recibe datos del carrito
2. Crea preferencia en MercadoPago API
3. Retorna `init_point` (URL de checkout)
4. Actualiza transaction con `mp_preference_id`

#### 4️⃣ **Abrir Checkout de MercadoPago** (Frontend)
```typescript
// mercadopagoService.ts:96
openMercadoPagoCheckout(initPoint)
```
- Abre `init_point` en navegador externo
- Usuario completa pago con tarjeta
- MercadoPago procesa pago

#### 5️⃣ **Webhook de Confirmación** (Edge Function)
```typescript
// supabase/functions/mp-webhook/index.ts
POST /functions/v1/mp-webhook
```
1. MercadoPago envía notificación de pago
2. Obtiene detalles del pago desde MercadoPago API
3. Actualiza transaction: `status = "approved"`
4. Trigger: `createShopifyOrders()`

#### 6️⃣ **Crear Órdenes en Shopify** (Edge Function)
```typescript
// mp-webhook/index.ts:126-293
createShopifyOrders(transactionId)
```
1. Agrupa items por tienda
2. Para cada tienda:
   - Crea Draft Order en Shopify
   - Completa Draft Order → Order
   - Guarda en `shopify_orders` table
3. Shopify reduce inventario automáticamente

#### 7️⃣ **Verificar Estado** (Frontend)
```typescript
// mercadopagoService.ts:125
checkPaymentStatus(transactionId)
```
- Consulta estado en DB
- Muestra mensaje de éxito/error al usuario

---

## 🗄️ Modelo de Datos

### Diagrama ER

```
transactions (1) ──┬──< (N) shopify_orders
                   │
                   └──< (N) payouts (futuro)

stores (1) ────< (N) shopify_orders
stores (1) ────< (N) products
```

### Tablas Principales

#### `transactions`
**Propósito**: Registro de cada compra/pago de MercadoPago

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | PK, auto-increment |
| mp_payment_id | text | ID de pago en MercadoPago |
| mp_preference_id | text | ID de preferencia creada |
| total_amount | numeric | Monto total pagado |
| status | text | pending / approved / rejected / cancelled |
| buyer_email | text | Email del comprador |
| buyer_name | text | Nombre completo |
| buyer_phone | text | Teléfono |
| shipping_address | jsonb | { street, city, region, zip_code } |
| cart_items | jsonb | Snapshot del carrito al momento de compra |
| store_splits | jsonb | { "domain": amount } - monto por tienda |
| is_test | boolean | true = pago de prueba, false = real |
| created_at | timestamptz | Timestamp de creación |
| paid_at | timestamptz | Timestamp de pago aprobado |

**Índices**:
- `idx_transactions_mp_payment` (mp_payment_id)
- `idx_transactions_status` (status)
- `idx_transactions_email` (buyer_email)

#### `shopify_orders`
**Propósito**: Órdenes creadas en cada tienda Shopify

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | PK, auto-increment |
| transaction_id | bigint | FK → transactions.id |
| store_domain | text | FK → stores.domain |
| shopify_order_id | text | ID de orden en Shopify (gid://...) |
| shopify_order_number | text | Número visible (#1001) |
| shopify_draft_order_id | text | Draft order ID temporal |
| order_amount | numeric | Monto de esta orden |
| order_items | jsonb | Productos de esta tienda |
| status | text | draft / pending / created / failed / cancelled |
| fulfillment_status | text | Estado de envío (Shopify) |
| error_message | text | Si falla la creación |
| created_at | timestamptz | Timestamp de creación |
| synced_at | timestamptz | Cuando se creó en Shopify |

**Índices**:
- `idx_shopify_orders_transaction` (transaction_id)
- `idx_shopify_orders_store` (store_domain)
- `idx_shopify_orders_shopify_id` (shopify_order_id)

#### `payouts`
**Propósito**: Transferencias de fondos a tiendas

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigint | PK, auto-increment |
| store_domain | text | FK → stores.domain |
| amount | numeric | Monto a transferir |
| transfer_method | text | manual / mercadopago / bank_transfer |
| transfer_id | text | ID de transferencia externa |
| status | text | pending / processing / completed / failed |
| period_start | date | Inicio del período |
| period_end | date | Fin del período |
| included_orders | bigint[] | Array de shopify_orders.id |
| paid_at | timestamptz | Timestamp de pago completado |

---

## 🔌 APIs Utilizadas

### MercadoPago API

#### 1. Crear Preferencia de Pago
```http
POST https://api.mercadopago.com/checkout/preferences
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{
  "items": [{
    "title": "Compra en ShopUnite",
    "quantity": 1,
    "unit_price": 50000
  }],
  "back_urls": {
    "success": "shopunite://payment/success",
    "failure": "shopunite://payment/failure"
  },
  "external_reference": "123"
}
```

**Response**:
```json
{
  "id": "1234567890-abcd-1234-efgh-123456789012",
  "init_point": "https://www.mercadopago.cl/checkout/v1/redirect?pref_id=..."
}
```

#### 2. Obtener Detalles de Pago
```http
GET https://api.mercadopago.com/v1/payments/{payment_id}
Authorization: Bearer ACCESS_TOKEN
```

**Response**:
```json
{
  "id": 12345678901,
  "status": "approved",
  "status_detail": "accredited",
  "external_reference": "123",
  "transaction_amount": 50000,
  "payment_method_id": "visa"
}
```

### Shopify Admin API

#### 1. Crear Draft Order
```http
POST https://{store}.myshopify.com/admin/api/2024-01/draft_orders.json
X-Shopify-Access-Token: shpat_xxxxx
Content-Type: application/json

{
  "draft_order": {
    "line_items": [{
      "variant_id": 44195354411298,
      "quantity": 2
    }],
    "customer": {
      "email": "juan@test.com",
      "first_name": "Juan",
      "last_name": "Pérez"
    },
    "shipping_address": {
      "address1": "Av. Providencia 123",
      "city": "Santiago",
      "province": "Metropolitana",
      "zip": "7500000",
      "country": "CL"
    },
    "note": "Orden de ShopUnite",
    "tags": "shopunite, marketplace",
    "financial_status": "paid"
  }
}
```

#### 2. Completar Draft Order
```http
PUT https://{store}.myshopify.com/admin/api/2024-01/draft_orders/{id}/complete.json
X-Shopify-Access-Token: shpat_xxxxx
Content-Type: application/json

{
  "payment_pending": false
}
```

**Response**:
```json
{
  "order": {
    "id": 5678901234567890,
    "order_number": 1001,
    "admin_graphql_api_id": "gid://shopify/Order/...",
    "financial_status": "paid",
    "fulfillment_status": null
  }
}
```

---

## 🔐 Seguridad

### Secretos y Tokens

#### En Edge Functions (Supabase Secrets)
```bash
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxx-xxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... (auto-provisto)
SUPABASE_URL=https://xxx.supabase.co (auto-provisto)
```

#### En App (.env)
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci... (público, seguro)
```

#### En Supabase (tabla stores)
```sql
-- Encriptado en la DB
stores.access_token (shpat_xxxxx)
```

### Row Level Security (RLS)

#### Desarrollo (actual)
```sql
-- Lectura pública
CREATE POLICY "transactions_select_policy" ON transactions
  FOR SELECT USING (true);

-- Escritura permitida (para Edge Functions con SERVICE_ROLE)
CREATE POLICY "transactions_insert_policy" ON transactions
  FOR INSERT WITH CHECK (true);
```

#### Producción (recomendado)
```sql
-- Solo el usuario puede ver sus propias transacciones
CREATE POLICY "transactions_select_policy" ON transactions
  FOR SELECT USING (auth.email() = buyer_email);

-- Solo Edge Functions pueden insertar
CREATE POLICY "transactions_insert_policy" ON transactions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
```

### CORS

Todas las Edge Functions incluyen:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

---

## ⚡ Performance

### Optimizaciones Implementadas

#### 1. **Cache-First Architecture**
- Productos se cachean en Supabase (`products` table)
- Sync automático nocturno
- Load time: <1 segundo vs 5-15 segundos

#### 2. **Edge Functions**
- Deno runtime (más rápido que Node.js)
- Deploy global en Cloudflare Workers
- Latencia: <100ms promedio

#### 3. **Índices de Base de Datos**
```sql
-- Búsquedas rápidas
CREATE INDEX idx_transactions_email ON transactions(buyer_email);
CREATE INDEX idx_shopify_orders_transaction ON shopify_orders(transaction_id);

-- Full-text search
CREATE INDEX idx_products_search ON products USING gin(
  to_tsvector('spanish', title || ' ' || COALESCE(description, ''))
);
```

#### 4. **Lazy Loading**
- Imágenes se cargan progresivamente
- Infinite scroll en home (futuro)

### Métricas Esperadas

| Operación | Tiempo Esperado |
|-----------|-----------------|
| Cargar home | < 1 segundo |
| Agregar al carrito | Instantáneo |
| Crear transacción | 200-500ms |
| Crear preferencia MP | 500-1000ms |
| Webhook processing | 2-5 segundos |
| Crear órdenes Shopify | 1-3 seg por tienda |

---

## 🔄 Flujo de Webhooks

### MercadoPago Webhook

#### Eventos Soportados
- `payment` (pagos)

#### Payload Recibido
```json
{
  "action": "payment.created",
  "api_version": "v1",
  "data": {
    "id": "12345678901"
  },
  "date_created": "2025-01-20T10:30:00Z",
  "id": 123456789,
  "live_mode": false,
  "type": "payment",
  "user_id": "987654321"
}
```

#### Procesamiento
1. Verificar `type === "payment"`
2. Obtener detalles del pago desde MercadoPago API
3. Extraer `external_reference` (transaction_id)
4. Actualizar `transactions` table
5. Si `status === "approved"`, crear órdenes en Shopify
6. Retornar `200 OK` a MercadoPago

#### Reintentos
- MercadoPago reintenta hasta 3 veces si falla
- Webhook debe ser **idempotente** (verificar si ya procesado)

---

## 🧪 Testing

### Niveles de Testing

#### 1. **Unit Tests** (futuro)
```typescript
// __tests__/orderService.test.ts
describe('createPendingTransaction', () => {
  it('should create transaction with correct splits', async () => {
    const cart = [
      { storeId: 'store-a', price: 10000, quantity: 2 },
      { storeId: 'store-b', price: 15000, quantity: 1 }
    ];
    const result = await createPendingTransaction({...});
    expect(result.storeSplits['store-a']).toBe(20000);
    expect(result.storeSplits['store-b']).toBe(15000);
  });
});
```

#### 2. **Integration Tests** (actual)
- Botón "Pago de Prueba"
- Crea transacciones reales en DB
- No llama APIs externas

#### 3. **E2E Tests** (sandbox)
- Usar tokens de prueba de MercadoPago
- Tarjetas de prueba
- Verificar en Shopify

### Tarjetas de Prueba

| Nombre | Resultado | Número |
|--------|-----------|--------|
| APRO | Aprobado | 5031 7557 3453 0604 |
| CONT | Rechazado (saldo insuficiente) | 5031 7557 3453 0604 |
| CALL | Rechazado (llamar para autorizar) | 5031 7557 3453 0604 |

**Uso**:
- CVV: cualquier 3 dígitos
- Vencimiento: cualquier fecha futura

---

## 📈 Escalabilidad

### Límites Actuales

| Recurso | Límite (Free Tier) | Límite (Pro) |
|---------|-------------------|--------------|
| Supabase DB | 500 MB | 8 GB |
| Edge Functions | 500K requests/mes | 2M requests/mes |
| Transacciones simultáneas | ~100/seg | ~1000/seg |

### Optimizaciones Futuras

#### 1. **Caching Avanzado**
```typescript
// Redis para sesiones de checkout
const redis = new Redis(process.env.REDIS_URL);
await redis.setex(`cart:${userId}`, 3600, JSON.stringify(cart));
```

#### 2. **Queue System**
```typescript
// Para procesar órdenes de forma asíncrona
await queue.add('create-shopify-orders', {
  transactionId: 123,
  priority: 'high'
});
```

#### 3. **Database Replication**
- Read replicas para consultas pesadas
- Write master para transacciones

---

## 🔧 Troubleshooting

### Logs de Edge Functions

```bash
# Ver logs en tiempo real
npx supabase functions logs mp-webhook --follow

# Ver últimos 100 logs
npx supabase functions logs create-mp-preference --limit 100
```

### Queries de Debugging

#### Transacciones fallidas
```sql
SELECT
  id,
  status,
  buyer_email,
  created_at,
  mp_payment_id
FROM transactions
WHERE status IN ('rejected', 'cancelled')
ORDER BY created_at DESC;
```

#### Órdenes fallidas en Shopify
```sql
SELECT
  so.id,
  so.store_domain,
  so.error_message,
  t.buyer_email,
  so.created_at
FROM shopify_orders so
JOIN transactions t ON so.transaction_id = t.id
WHERE so.status = 'failed'
ORDER BY so.created_at DESC;
```

#### Balance pendiente por tienda
```sql
SELECT
  store_domain,
  get_store_pending_balance(store_domain) as pending
FROM stores;
```

---

## 📚 Referencias

### Documentación Oficial

- **MercadoPago**: https://www.mercadopago.cl/developers/es/docs
- **Shopify Admin API**: https://shopify.dev/docs/api/admin-rest
- **Supabase**: https://supabase.com/docs
- **Expo**: https://docs.expo.dev

### Recursos Útiles

- **MercadoPago Webhooks**: https://www.mercadopago.cl/developers/es/docs/your-integrations/notifications/webhooks
- **Shopify Draft Orders**: https://shopify.dev/docs/api/admin-rest/2024-01/resources/draftorder
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions

---

## 🚀 Roadmap Técnico

### Fase 2: Mejoras Inmediatas
- [ ] Autenticación de usuarios (Supabase Auth)
- [ ] Dashboard para comerciantes
- [ ] Sistema de notificaciones push
- [ ] Historial de órdenes para usuarios

### Fase 3: Optimizaciones
- [ ] Transferencias automáticas a tiendas
- [ ] MercadoPago Split Payments
- [ ] Sistema de comisiones configurable
- [ ] Analytics y métricas

### Fase 4: Escalamiento
- [ ] Multi-país (Argentina, México, Colombia)
- [ ] Sistema de reviews y ratings
- [ ] Programa de lealtad
- [ ] Suscripciones y productos digitales

---

¿Preguntas técnicas? Revisa el código comentado o los logs de Edge Functions. 🤓
