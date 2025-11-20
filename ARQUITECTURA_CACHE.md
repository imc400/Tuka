# 🏗️ ARQUITECTURA DE CACHE - NIVEL ENTERPRISE

## 🎯 **PROBLEMA QUE RESUELVE**

### **Arquitectura Anterior (LENTA):**
```
Usuario abre app
    ↓
App llama a Shopify API (por cada tienda)
    ↓
Espera 5-10 segundos por request
    ↓
Procesa miles de productos
    ↓
App lenta, mala UX
```

**Problemas:**
- ❌ Lenta (5-15 segundos de carga)
- ❌ Depende de Shopify en tiempo real
- ❌ Si Shopify está lento/caído → App lenta/caída
- ❌ Muchas requests = costos API
- ❌ No hay búsqueda/filtros potentes

---

### **Nueva Arquitectura (RÁPIDA):**
```
Cron Job (1x al día, 3 AM)
    ↓
Shopify API → Supabase (cache)
    ↓
Usuario abre app
    ↓
App lee de Supabase (instantáneo)
    ↓
App ultra rápida, UX perfecta
```

**Beneficios:**
- ✅ **10-20x más rápida** (0.5-1 segundo)
- ✅ **Independiente de Shopify** (si Shopify cae, app sigue)
- ✅ **Búsqueda full-text** en español
- ✅ **Filtros potentes** (precio, categoría, tags)
- ✅ **Menos costos API** (1 sync/día vs miles de requests)
- ✅ **Analytics** (productos más vistos, clicks, etc.)
- ✅ **Escalable** a miles de tiendas

---

## 📊 **SCHEMA DE BASE DE DATOS**

### **Tablas Nuevas:**

#### **1. `products` (Cache de productos)**
```sql
- id (PK, Shopify ID)
- store_domain (FK)
- title
- description
- price
- compare_at_price (para mostrar descuentos)
- vendor (marca)
- product_type (categoría)
- tags[] (array para filtros)
- images[] (array de URLs)
- available (boolean)
- synced_at (última sincronización)
```

#### **2. `product_variants` (Tallas, colores, etc.)**
```sql
- id (PK, Shopify variant ID)
- product_id (FK)
- title ("Small", "Red", etc.)
- price
- compare_at_price
- sku, barcode
- inventory_quantity
- available
- weight, weight_unit
```

#### **3. `sync_logs` (Historial de sincronizaciones)**
```sql
- id (PK)
- store_domain (FK)
- status (success/error/in_progress)
- products_synced, products_added, products_updated, products_deleted
- error_message
- started_at, completed_at, duration_seconds
```

---

## 🔄 **FLUJO DE SINCRONIZACIÓN**

### **Sincronización Diaria Automática:**

```
03:00 AM (hora servidor)
    ↓
Cron Job se activa
    ↓
Para cada tienda registrada:
    1. Fetch TODOS los productos de Shopify
    2. Compara con productos en cache
    3. INSERT nuevos productos
    4. UPDATE productos existentes
    5. DELETE productos descontinuados
    6. Log del resultado
    ↓
Fin (usuarios despiertan con datos frescos)
```

### **Sincronización Manual (Dashboard):**

```
Admin → Dashboard → Click "Sincronizar Ahora"
    ↓
Mismo proceso que sync diaria
    ↓
Feedback en tiempo real
    ↓
Toast: "✅ 247 productos sincronizados"
```

---

## 🚀 **IMPLEMENTACIÓN**

### **PASO 1: Ejecutar SQL en Supabase**

```bash
# Archivo: supabase_products_schema.sql
```

1. Abre Supabase → SQL Editor
2. Copia todo el contenido del archivo
3. Click "Run"
4. Verifica: Deben crearse 3 tablas + índices

---

### **PASO 2: Primera Sincronización**

```bash
# En Node.js o en el dashboard
import { syncAllStores } from './src/services/syncService';

await syncAllStores();
```

**Output esperado:**
```
🚀 Starting sync for all stores...
🔄 Starting full sync for tienda1.myshopify.com...
  📦 Fetched 250 products (total: 250)
  📦 Fetched 180 products (total: 430)
✅ Fetched 430 total products from tienda1.myshopify.com
  🗑️  Deleted 3 discontinued products
✅ Sync completed for tienda1.myshopify.com in 12s
   📊 Added: 15, Updated: 412, Deleted: 3

🔄 Starting full sync for tienda2.myshopify.com...
...
✅ All stores synced successfully!
```

---

### **PASO 3: Modificar App para Leer de Supabase**

**Antes:**
```typescript
// src/services/marketplaceService.ts
const stores = await fetchShopifyStore(config); // Shopify directo
```

**Después:**
```typescript
// src/services/marketplaceService.ts
const { data: products } = await supabase
  .from('products')
  .select('*, product_variants(*)')
  .eq('store_domain', config.domain)
  .eq('available', true);
```

**Resultado:** Instantáneo (< 500ms)

---

## ⚡ **FUNCIONALIDADES ENTERPRISE**

### **1. Búsqueda Full-Text**

```typescript
// Buscar "zapatillas nike rojas"
const { data } = await supabase
  .rpc('search_products', {
    search_query: 'zapatillas nike rojas',
    limit_count: 50
  });
```

**Búsqueda en:**
- Título del producto
- Descripción
- Tags
- En español (stemming correcto)

---

### **2. Filtros Potentes**

```typescript
// Filtrar por precio y categoría
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('store_domain', 'tienda.com')
  .eq('product_type', 'Zapatillas')
  .gte('price', 20)
  .lte('price', 100)
  .order('price', { ascending: true });
```

---

### **3. Productos Relacionados**

```typescript
// Productos de la misma categoría
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('product_type', producto.product_type)
  .neq('id', producto.id)
  .limit(4);
```

---

### **4. Analytics (Próximamente)**

```sql
-- Tabla de tracking
CREATE TABLE product_views (
  id bigint PRIMARY KEY,
  product_id text,
  user_id text,
  viewed_at timestamp
);

-- Query: Productos más vistos
SELECT product_id, COUNT(*) as views
FROM product_views
WHERE viewed_at > NOW() - INTERVAL '7 days'
GROUP BY product_id
ORDER BY views DESC
LIMIT 10;
```

---

## 🕐 **CRON JOB (Automatización)**

### **Opción 1: Supabase Edge Functions**

```typescript
// supabase/functions/sync-products/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';
import { syncAllStores } from './syncService.ts';

serve(async (req) => {
  // Verificar secret para seguridad
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  await syncAllStores();

  return new Response('Sync completed', { status: 200 });
});
```

**Configurar cron en Supabase:**
```bash
# Dashboard → Edge Functions → Cron Jobs
0 3 * * * # Diario a las 3 AM
```

---

### **Opción 2: Vercel Cron Jobs**

```typescript
// api/cron/sync.ts
import { syncAllStores } from '../../src/services/syncService';

export default async function handler(req, res) {
  // Verificar que viene de Vercel Cron
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  await syncAllStores();

  res.status(200).json({ success: true });
}
```

**vercel.json:**
```json
{
  "crons": [{
    "path": "/api/cron/sync",
    "schedule": "0 3 * * *"
  }]
}
```

---

### **Opción 3: GitHub Actions (Gratis)**

```yaml
# .github/workflows/sync-products.yml
name: Sync Products
on:
  schedule:
    - cron: '0 3 * * *'  # 3 AM daily
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: node scripts/sync.js
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
```

---

## 🎨 **UI DEL DASHBOARD - BOTÓN SINCRONIZAR**

Agregar al dashboard web:

```typescript
const [syncing, setSyncing] = useState(false);
const [syncResult, setSyncResult] = useState(null);

const handleSync = async (domain: string) => {
  setSyncing(true);
  try {
    const result = await syncStoreProducts(domain, store.access_token);
    setSyncResult(result);
    alert(`✅ ${result.productsAdded + result.productsUpdated} productos sincronizados`);
  } catch (error) {
    alert('Error al sincronizar');
  } finally {
    setSyncing(false);
  }
};

// En el render:
<button onClick={() => handleSync(store.domain)} disabled={syncing}>
  {syncing ? '⏳ Sincronizando...' : '🔄 Sincronizar Ahora'}
</button>
```

---

## 📊 **MÉTRICAS Y MONITORING**

### **Vista de Logs en Dashboard:**

```typescript
const { data: logs } = await supabase
  .from('sync_logs')
  .select('*')
  .order('started_at', { ascending: false })
  .limit(20);

// Mostrar tabla:
<table>
  <tr>
    <th>Tienda</th>
    <th>Status</th>
    <th>Productos</th>
    <th>Duración</th>
    <th>Fecha</th>
  </tr>
  {logs.map(log => (
    <tr>
      <td>{log.store_domain}</td>
      <td>{log.status}</td>
      <td>
        +{log.products_added}
        ~{log.products_updated}
        -{log.products_deleted}
      </td>
      <td>{log.duration_seconds}s</td>
      <td>{log.started_at}</td>
    </tr>
  ))}
</table>
```

---

## 🎯 **ROADMAP DE IMPLEMENTACIÓN**

### **Fase 1: Setup (Hoy)**
- [x] Schema SQL
- [x] Servicio de sincronización
- [ ] Primera sincronización manual

### **Fase 2: Integración App (Mañana)**
- [ ] Modificar marketplaceService para leer de Supabase
- [ ] Agregar botón "Sincronizar" en dashboard
- [ ] Testing con datos reales

### **Fase 3: Cron Job (Esta semana)**
- [ ] Configurar Vercel/Supabase Edge Function
- [ ] Programar sincronización diaria (3 AM)
- [ ] Notificaciones si falla el sync

### **Fase 4: Features Avanzados (Próxima semana)**
- [ ] Búsqueda full-text en la app
- [ ] Filtros por precio/categoría
- [ ] Productos relacionados
- [ ] Analytics básico

---

## 🚀 **PERFORMANCE ESPERADA**

| Métrica | Antes (Shopify directo) | Después (Supabase cache) |
|---------|-------------------------|--------------------------|
| Tiempo de carga | 5-15 segundos | 0.5-1 segundo |
| Requests por usuario | 3-5 (Shopify) | 1 (Supabase) |
| Dependencia externa | Alta | Baja |
| Búsqueda | No disponible | Full-text instant |
| Filtros | Lentos | Instantáneos |
| Escalabilidad | Limitada | Ilimitada |

---

## 💰 **COSTOS**

### **Antes:**
- Shopify API: Límite de 2 requests/segundo
- Miles de requests al día
- Potencial throttling

### **Después:**
- Shopify API: 1 sync completo/día
- Supabase: Gratis hasta 500MB DB + 2GB bandwidth
- Mucho más predecible y barato

---

## 🔒 **SEGURIDAD**

### **RLS Policies:**
- ✅ Productos: Lectura pública (marketplace público)
- ✅ Escritura: Solo desde backend (cron job)
- ✅ En producción: Autenticación para escritura

### **Cron Job:**
- ✅ Bearer token secreto
- ✅ Solo endpoints autorizados
- ✅ Rate limiting

---

## 📚 **DOCUMENTACIÓN DE API**

### **Leer productos de una tienda:**
```typescript
GET /rest/v1/products?store_domain=eq.tienda.com&select=*,product_variants(*)
```

### **Buscar productos:**
```typescript
POST /rest/v1/rpc/search_products
{
  "search_query": "zapatillas nike",
  "store_filter": "tienda.com",
  "limit_count": 50
}
```

### **Filtrar por precio:**
```typescript
GET /rest/v1/products?price=gte.20&price=lte.100&order=price.asc
```

---

## ✅ **PRÓXIMOS PASOS**

1. **Ejecuta el SQL** en Supabase (archivo `supabase_products_schema.sql`)
2. **Primera sincronización** manual para poblar la DB
3. **Modificar la app** para leer de Supabase en vez de Shopify
4. **Configurar cron job** para sync diario

¿Empezamos con el paso 1? 🚀
