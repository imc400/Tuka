# 🚀 GUÍA DE IMPLEMENTACIÓN - ARQUITECTURA DE CACHE

## 📋 PASOS A SEGUIR

### ✅ **PASO 1: Ejecutar SQL en Supabase** (5 minutos)

1. **Abre Supabase Dashboard:**
   - Ve a: https://supabase.com/dashboard
   - Selecciona tu proyecto: `kscgibfmxnyfjxpcwoac`

2. **Abre el SQL Editor:**
   - Click en el ícono de terminal/SQL en el menú izquierdo
   - O ve directamente a: https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac/sql/new

3. **Copia y ejecuta el SQL:**
   - Abre el archivo: `supabase_products_schema.sql`
   - Copia TODO el contenido
   - Pégalo en el SQL Editor de Supabase
   - Click en **"Run"** (botón verde)

4. **Verifica que se creó correctamente:**
   - Deberías ver un mensaje de éxito
   - Ve a "Table Editor" en el menú izquierdo
   - Debes ver 3 nuevas tablas:
     - ✅ `products`
     - ✅ `product_variants`
     - ✅ `sync_logs`

---

### ✅ **PASO 2: Ejecutar Primera Sincronización** (2-5 minutos)

1. **Abre una terminal en el proyecto:**
   ```bash
   cd /Users/ignacioblanco/Desktop/shopunite-marketplace
   ```

2. **Ejecuta el comando de sincronización:**
   ```bash
   npm run sync
   ```

3. **Observa el output esperado:**
   ```
   ╔═══════════════════════════════════════════════╗
   ║   🚀 SHOPUNITE - PRIMERA SINCRONIZACIÓN     ║
   ╚═══════════════════════════════════════════════╝

   🚀 Starting sync for all stores...
   🔄 Starting full sync for tienda1.myshopify.com...
     📦 Fetched 250 products (total: 250)
     📦 Fetched 180 products (total: 430)
   ✅ Fetched 430 total products from tienda1.myshopify.com
     🗑️  Deleted 0 discontinued products
   ✅ Sync completed for tienda1.myshopify.com in 12s
      📊 Added: 430, Updated: 0, Deleted: 0

   🔄 Starting full sync for tienda2.myshopify.com...
   ...

   ╔═══════════════════════════════════════════════╗
   ║   ✅ SINCRONIZACIÓN COMPLETADA CON ÉXITO     ║
   ╚═══════════════════════════════════════════════╝
   ```

4. **Si hay errores:**
   - **Error "No stores to sync":** No tienes tiendas registradas en la tabla `stores`
   - **Error de autenticación:** Verifica que los `access_token` de Shopify sean correctos
   - **Error de conexión:** Verifica que las variables de entorno EXPO_PUBLIC_SUPABASE_* estén en `.env`

5. **Verifica en Supabase:**
   - Ve a Table Editor → `products`
   - Debes ver todos los productos de tus tiendas
   - Ve a Table Editor → `sync_logs`
   - Debes ver un registro por cada tienda sincronizada con status "success"

---

### ✅ **PASO 3: Modificar la App para Leer de Supabase** (10 minutos)

Ahora vamos a modificar `src/services/marketplaceService.ts` para que lea de Supabase en vez de Shopify:

**Archivo a modificar:** `src/services/marketplaceService.ts`

**Código actual (lee de Shopify directo):**
```typescript
export async function loadMarketplace(): Promise<{ stores: Store[]; products: Product[] }> {
  const configs = await getShopifyConfigs();
  const stores: Store[] = [];
  const allProducts: Product[] = [];

  for (const config of configs) {
    const storeData = await fetchShopifyStore(config); // ← LEE DE SHOPIFY
    stores.push(storeData.store);
    allProducts.push(...storeData.products);
  }

  return { stores, allProducts };
}
```

**Nuevo código (lee de Supabase cache):**
```typescript
export async function loadMarketplace(): Promise<{ stores: Store[]; products: Product[] }> {
  const configs = await getShopifyConfigs();
  const stores: Store[] = [];
  const allProducts: Product[] = [];

  for (const config of configs) {
    // 1. Info de la tienda (igual que antes)
    const store: Store = {
      domain: config.domain,
      name: config.storeName || config.domain,
      description: config.description,
      logoUrl: config.logoUrl,
      bannerUrl: config.bannerUrl,
      themeColor: config.themeColor || '#000000',
    };

    // 2. Productos desde Supabase (NUEVO)
    const { data: cachedProducts, error } = await supabase
      .from('products')
      .select(`
        *,
        product_variants (*)
      `)
      .eq('store_domain', config.domain)
      .eq('available', true);

    if (error) {
      console.error(`Error loading products from cache for ${config.domain}:`, error);
      continue;
    }

    // 3. Transformar a formato de la app
    const products: Product[] = (cachedProducts || []).map((p: any) => ({
      id: p.id,
      name: p.title,
      description: p.description || '',
      price: parseFloat(p.price),
      compareAtPrice: p.compare_at_price ? parseFloat(p.compare_at_price) : undefined,
      imagePrompt: '', // Ya no se usa
      images: p.images || [],
      vendor: p.vendor,
      productType: p.product_type,
      tags: p.tags || [],
      variants: (p.product_variants || []).map((v: any) => ({
        id: v.id,
        title: v.title,
        price: parseFloat(v.price),
        available: v.available,
      })),
      store: store,
    }));

    stores.push(store);
    allProducts.push(...products);
  }

  console.log(`✅ Loaded ${allProducts.length} products from ${stores.length} stores (from cache)`);
  return { stores, allProducts };
}
```

**Beneficios inmediatos:**
- ⚡ 10-20x más rápido (0.5-1s vs 5-15s)
- ✅ No depende de la disponibilidad de Shopify
- ✅ Búsquedas y filtros más potentes
- ✅ Menos costo de API

---

### ✅ **PASO 4: Probar la App** (5 minutos)

1. **Reinicia la app:**
   ```bash
   npm start
   ```

2. **Abre en Expo Go:**
   - Escanea el QR code
   - La app debe cargar MUCHO más rápido

3. **Verifica en la consola:**
   ```
   ✅ Loaded 850 products from 3 stores (from cache)
   ```

4. **Prueba pull-to-refresh:**
   - Jala hacia abajo en el home
   - Los productos se recargan de la cache (instantáneo)

---

### ✅ **PASO 5: Agregar Botón de Sincronización en Dashboard** (10 minutos)

Ahora vamos a agregar un botón "Sincronizar Ahora" en el dashboard web.

**Archivo a modificar:** `App.web.tsx`

**Agregar import:**
```typescript
import { syncStoreProducts } from './src/services/syncService';
```

**Agregar estado para sincronización:**
```typescript
const [syncing, setSyncing] = useState<string | null>(null);
const [syncResult, setSyncResult] = useState<any>(null);
```

**Función para sincronizar:**
```typescript
const handleSyncStore = async (store: any) => {
  setSyncing(store.domain);
  setSyncResult(null);

  try {
    const result = await syncStoreProducts(store.domain, store.access_token);

    if (result.success) {
      setSyncResult(result);
      alert(`✅ Sincronización exitosa\n\n` +
            `📦 Productos agregados: ${result.productsAdded}\n` +
            `🔄 Productos actualizados: ${result.productsUpdated}\n` +
            `🗑️ Productos eliminados: ${result.productsDeleted}`);
      loadStores(); // Recargar lista
    } else {
      alert(`❌ Error: ${result.error}`);
    }
  } catch (error: any) {
    alert(`❌ Error al sincronizar: ${error.message}`);
  } finally {
    setSyncing(null);
  }
};
```

**Modificar el botón en la lista de tiendas:**
```typescript
<div className="flex gap-2">
  <button
    onClick={() => handleEdit(store)}
    className="px-3 py-1 bg-amber-500 text-white rounded hover:bg-amber-600"
  >
    ✏️ Editar
  </button>

  {/* NUEVO BOTÓN */}
  <button
    onClick={() => handleSyncStore(store)}
    disabled={syncing === store.domain}
    className="px-3 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
  >
    {syncing === store.domain ? '⏳ Sincronizando...' : '🔄 Sincronizar'}
  </button>

  <button
    onClick={() => handleDelete(store.domain)}
    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
  >
    🗑️
  </button>
</div>
```

---

### ✅ **PASO 6: Configurar Sincronización Automática Diaria** (OPCIONAL)

#### **Opción A: Vercel Cron Jobs** (Recomendado si usas Vercel)

1. **Crear archivo de API:**
   ```typescript
   // api/cron/sync.ts
   import { syncAllStores } from '../../src/services/syncService';

   export default async function handler(req: any, res: any) {
     // Verificar autorización
     if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
       return res.status(401).json({ error: 'Unauthorized' });
     }

     await syncAllStores();
     res.status(200).json({ success: true });
   }
   ```

2. **Configurar en vercel.json:**
   ```json
   {
     "crons": [{
       "path": "/api/cron/sync",
       "schedule": "0 3 * * *"
     }]
   }
   ```

3. **Agregar variable de entorno en Vercel:**
   - `CRON_SECRET`: Un token secreto aleatorio

#### **Opción B: GitHub Actions** (Gratis)

Ver archivo `.github/workflows/sync-products.yml` en ARQUITECTURA_CACHE.md

#### **Opción C: Supabase Edge Functions**

Ver detalles completos en ARQUITECTURA_CACHE.md

---

## 🎯 **CHECKLIST FINAL**

Antes de dar por completada la implementación, verifica:

- [ ] ✅ SQL ejecutado en Supabase (3 tablas creadas)
- [ ] ✅ Primera sincronización completada (`npm run sync`)
- [ ] ✅ Productos visibles en tabla `products` de Supabase
- [ ] ✅ App modificada para leer de Supabase
- [ ] ✅ App carga rápido (< 2 segundos)
- [ ] ✅ Botón "Sincronizar" en dashboard funciona
- [ ] ✅ (Opcional) Cron job configurado para sync diario

---

## 🐛 **TROUBLESHOOTING**

### Problema: "No stores to sync"
**Solución:** No hay tiendas en la base de datos. Agrega una desde el dashboard web.

### Problema: Error de autenticación Shopify
**Solución:**
1. Verifica que uses el **Storefront API token** (no Admin API)
2. Regenera el token en Shopify Admin → Settings → Apps and sales channels → Develop apps

### Problema: App sigue lenta después del cambio
**Solución:**
1. Verifica que modificaste `marketplaceService.ts` correctamente
2. Verifica en la consola que diga "from cache"
3. Reinicia completamente la app (npm start)

### Problema: Productos desactualizados en la app
**Solución:**
1. Click en "Sincronizar" en el dashboard
2. O ejecuta `npm run sync` manualmente
3. En la app móvil, haz pull-to-refresh

---

## 📊 **MÉTRICAS DE ÉXITO**

Después de implementar, deberías ver:

| Métrica | Antes | Después |
|---------|-------|---------|
| Tiempo de carga | 5-15s | 0.5-1s |
| Requests a Shopify | 3-5 por carga | 1 por día |
| Experiencia offline | ❌ No funciona | ✅ Funciona |
| Búsqueda/Filtros | ❌ No disponible | ✅ Disponible |

---

## 🚀 **PRÓXIMOS PASOS**

Una vez que todo funcione:

1. **Implementar búsqueda full-text:** Usar la función `search_products()` de Supabase
2. **Agregar filtros:** Por precio, categoría, marca
3. **Analytics básico:** Productos más vistos
4. **Productos relacionados:** Basados en categoría/tags

Ver detalles en `ARQUITECTURA_CACHE.md`

---

**¿Necesitas ayuda?**
Revisa la documentación completa en `ARQUITECTURA_CACHE.md`
