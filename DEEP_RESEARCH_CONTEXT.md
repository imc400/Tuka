# 🔍 Contexto Completo para Deep Research: Productos Faltantes

**Fecha:** 2025-11-21
**Investigador:** Claude (Senior Dev)
**Cliente:** ShopUnite Marketplace

---

## 📋 Resumen Ejecutivo

**Problema Reportado:**
Usuario reporta que la app muestra solo 228 productos de Ximena Rogat cuando Shopify indica "1,339 productos activos".

**Hallazgo Principal:**
La app funciona correctamente. Los 1,338 productos están sincronizados en la base de datos, pero solo 228 están marcados como `available=true` (disponibles para venta). Los 1,110 restantes están en Shopify pero NO disponibles para venta.

---

## 🔢 Números Exactos

### Ximena Rogat (ximenarogat.myshopify.com)
- **Total en Shopify:** 1,338 productos
- **Total en Supabase:** 1,338 productos ✅ (sync correcto)
- **Disponibles (available=true):** 228 productos
- **No disponibles (available=false):** 1,110 productos (83% del catálogo)
- **Mostrados en app:** 228 productos ✅ (comportamiento correcto)

### Dentobal (dentobal.myshopify.com)
- **Total en Shopify:** 1,055 productos
- **Total en Supabase:** 1,055 productos ✅ (sync correcto)
- **Disponibles (available=true):** 867 productos
- **No disponibles (available=false):** 188 productos (18% del catálogo)
- **Mostrados en app:** 867 productos ✅ (comportamiento correcto)

### BrainToys Chile (braintoys-chile.myshopify.com)
- **Total:** 101 productos (100% disponibles)

### Spot Essence (spot-essence.myshopify.com)
- **Total:** 75 productos (100% disponibles)

---

## 🏗️ Arquitectura del Sistema

### Flujo de Datos:

```
┌─────────────────────┐
│  Shopify API        │ (Tienda real - GraphQL Storefront API)
│  - products         │
│  - variants         │
│    - availableForSale ← Campo crítico
└──────────┬──────────┘
           │
           │ Sync diario (scripts/sync.js)
           │ Usa GraphQL: products.variants.availableForSale
           ↓
┌─────────────────────┐
│  Supabase           │ (PostgreSQL)
│  - products table   │
│    - available: boolean
│  - product_variants │
│    - available: boolean
└──────────┬──────────┘
           │
           │ Query con filtro (marketplaceService.ts)
           │ .eq('available', true) ← Solo productos disponibles
           ↓
┌─────────────────────┐
│  React Native App   │
│  - Muestra SOLO     │
│    productos con    │
│    available=true   │
└─────────────────────┘
```

### Lógica de Disponibilidad:

**En scripts/sync.js (línea 209):**
```javascript
available: product.variants.some((v) => v.available)
```

Un producto se marca como `available=true` si y solo si **al menos 1 de sus variantes** tiene `availableForSale=true` en Shopify.

**En marketplaceService.ts (línea 55):**
```javascript
.eq('available', true)
```

La app filtra y muestra SOLO productos con `available=true`.

---

## 🐛 Bug History & Fixes

### Bug #1: Límite de 1000 Productos (RESUELTO ✅)
**Ubicación:** `src/services/marketplaceService.ts:38-76`
**Problema:** Queries a Supabase sin `.range()` tienen límite implícito de 1000 registros.
**Fix:** Implementada paginación automática con `while` loop.
**Estado:** RESUELTO - La paginación funciona correctamente ahora.

### Bug #2: Sync sin Error Handling (RESUELTO ✅)
**Ubicación:** `scripts/sync.js:210 (antes del fix)`
**Problema:** Los `upsert()` no verificaban errores. Si fallaban, el script continuaba contando productos como sincronizados.
**Fix:** Agregado manejo de errores en líneas 213-256.
**Estado:** RESUELTO - Última sync ejecutó sin errores.

### Issue Actual: Mayoría de Productos "No Disponibles" (INVESTIGAR ❓)
**Ubicación:** Shopify admin de Ximena Rogat
**Problema:** 1,110 de 1,338 productos (83%) están marcados como NO disponibles.
**Pregunta crítica:** ¿Es esto intencional o hay un problema en Shopify?

---

## 🔍 Preguntas para Deep Research

### 1. Verificar en Shopify Admin (ximenarogat.myshopify.com)

**Preguntas clave:**
- ¿Cuántos productos tienen status "Active" vs "Draft"?
- De los productos activos, ¿cuántos tienen **al menos 1 variante con stock > 0**?
- ¿Hay políticas de inventario que puedan estar marcando productos como "unavailable for sale"?
- ¿Hay productos pausados temporalmente?

**Cómo verificar:**
1. Ir a Shopify Admin → Products
2. Filtrar por "Active products"
3. Exportar lista de productos con columnas:
   - Product ID
   - Title
   - Status
   - Inventory (total)
   - Variants → Available for sale

### 2. Verificar Campo `availableForSale` en Shopify GraphQL

El campo `availableForSale` en Shopify puede ser `false` por varias razones:

**Causas comunes:**
- ❌ **Producto sin stock** (inventory = 0 y no permite "continue selling when out of stock")
- ❌ **Variante deshabilitada manualmente** (checkbox "Available for sale" desmarcado)
- ❌ **Producto en Draft** (no publicado)
- ❌ **Sales channel deshabilitado** (no disponible en "Online Store" o API)
- ❌ **Producto arquivado**
- ❌ **Restricciones de mercado** (no disponible en ciertos países/regiones)

**Query GraphQL para verificar (usar en Shopify Admin → GraphiQL):**
```graphql
{
  products(first: 10, query: "status:active") {
    edges {
      node {
        id
        title
        status
        totalInventory
        variants(first: 5) {
          edges {
            node {
              id
              title
              availableForSale
              inventoryQuantity
              inventoryPolicy
            }
          }
        }
      }
    }
  }
}
```

### 3. Comparar con Admin Dashboard de Shopify

**Hipótesis a validar:**

**Hipótesis A: Stock = 0 (Más probable)**
- Los 1,110 productos no tienen stock disponible
- Shopify cuenta productos "activos" aunque tengan stock=0
- La app solo muestra productos que SÍ se pueden comprar (stock > 0)

**Hipótesis B: Configuración de Sales Channel**
- Los productos existen pero no están habilitados para "Storefront API"
- Solo se sincronizaron los productos disponibles en el sales channel correcto

**Hipótesis C: Variantes sin stock**
- Todos los productos tienen variantes, pero ninguna variante tiene `availableForSale=true`
- Esto ocurre si todas las variantes tienen stock=0 o están deshabilitadas

---

## 📊 Muestra de Productos NO Disponibles

**Productos de Ximena Rogat con `available=false` (sample de 10):**
1. Bandeja negra espejada
2. Bandeja fuente bronce
3. Espejos distintos diseños
4. Lámpara colgante
5. VELADOR PUERTA
6. Macetero negro pedestal
7. Lámpara colgante malla dorada
8. Mesa lateral negra rejilla A
9. Caja negra
10. Botellas plata

**Acción recomendada:** Buscar alguno de estos productos en Shopify Admin y verificar:
- ¿Está marcado como "Active"?
- ¿Tiene stock disponible?
- ¿Sus variantes tienen "Available for sale" = Yes?
- ¿Está habilitado en "Online Store" o "Storefront API"?

---

## 🧪 Comandos de Verificación

### Verificar conteo real en base de datos:
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);
async function check() {
  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('store_domain', 'ximenarogat.myshopify.com');
  console.log('Total products:', count);

  const { count: avail } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('store_domain', 'ximenarogat.myshopify.com')
    .eq('available', true);
  console.log('Available:', avail);
}
check().then(() => process.exit(0));
"
```

### Re-sync manual:
```bash
npm run sync
```

### Ver logs de última sync:
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);
async function check() {
  const { data } = await supabase
    .from('sync_logs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(5);
  console.log(data);
}
check().then(() => process.exit(0));
"
```

---

## 🎯 Conclusión & Próximos Pasos

### Estado Actual del Sistema: ✅ FUNCIONANDO CORRECTAMENTE

La arquitectura y código están funcionando como esperado:
- ✅ Sync descarga TODOS los productos (1,338) desde Shopify
- ✅ Paginación funciona correctamente (soporta tiendas con +1000 productos)
- ✅ App filtra y muestra solo productos disponibles para venta
- ✅ Error handling implementado en sync script

### Problema Real: 🟡 CONFIGURACIÓN DE SHOPIFY

El 83% de los productos de Ximena Rogat están marcados como NO disponibles en Shopify (`availableForSale=false`). Esto NO es un bug del código, es un problema de configuración/inventario en Shopify.

### Acciones Requeridas:

**Acción 1: Verificar en Shopify Admin (URGENTE)**
- Revisar por qué 1,110 productos tienen `availableForSale=false`
- Verificar inventario de productos sample listados arriba
- Confirmar si es intencional o error de configuración

**Acción 2: Opciones de Solución**

**Opción A: Fix en Shopify (RECOMENDADO)**
- Si los productos SÍ deberían estar disponibles:
  - Actualizar inventario (agregar stock)
  - Habilitar "Available for sale" en variantes
  - Publicar productos en sales channel correcto
- Luego correr `npm run sync` para actualizar app

**Opción B: Cambiar filtro en app (NO RECOMENDADO)**
- Remover filtro `.eq('available', true)` en `marketplaceService.ts`
- Esto mostraría productos sin stock (mala UX, usuarios no podrán comprar)
- Solo usar si los productos NO están realmente disponibles pero quieren mostrarse igual

**Opción C: Mostrar con badge "Sin Stock" (COMPROMISO)**
- Mostrar todos los productos pero con indicador visual
- Deshabilitar botón "Agregar al carrito" si `available=false`
- Permite que usuarios vean catálogo completo aunque no puedan comprar

---

## 📁 Archivos Relevantes

### Código Principal:
- `src/services/marketplaceService.ts` (líneas 37-79: paginación, línea 55: filtro available)
- `scripts/sync.js` (línea 209: cálculo de available, líneas 213-256: error handling)
- `src/services/shopifyService.ts` (obtiene configs de tiendas)

### Scripts de Debugging:
- `debug-stores.js` (conteo de productos por tienda)
- `check-sync-status.js` (verifica status de última sync)
- `check-products-count.js` (conteo detallado)

### Base de Datos (Supabase):
- Tabla `products` (id, store_domain, title, available, synced_at, ...)
- Tabla `product_variants` (id, product_id, price, available, ...)
- Tabla `sync_logs` (status, products_synced, started_at, ...)
- Tabla `shopify_configs` (domain, store_name, access_token, ...)

---

## 🔗 Referencias Técnicas

### Shopify GraphQL API:
- **Campo:** `product.variants.availableForSale`
- **Tipo:** Boolean
- **Definición:** Indica si la variante está disponible para compra
- **Valores:**
  - `true`: Variante puede ser comprada (tiene stock o permite overselling)
  - `false`: Variante NO puede ser comprada (sin stock, deshabilitada, etc)

### Supabase Pagination:
- **Método:** `.range(from, to)`
- **Límite default sin range:** 1000 registros
- **Implementación actual:** Loop con pages de 1000 registros

### React Native App:
- **Framework:** Expo
- **State management:** React Context API
- **Navegación:** Custom ViewState enum
- **Data fetching:** Supabase client

---

**Fin del reporte. Última actualización: 2025-11-21 20:22 UTC**
