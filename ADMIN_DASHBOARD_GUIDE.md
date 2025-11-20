# 🎛️ Guía del Admin Dashboard

Guía rápida para usar el Admin Dashboard web de ShopUnite.

---

## 🚀 Acceso

```bash
npm run dev:web
```

Abre: http://localhost:3002

---

## 📝 Agregar una Nueva Tienda

### Paso 1: Campos Obligatorios

#### 1.1 Shopify Domain
- Formato: `tu-tienda.myshopify.com`
- Ejemplo: `nike-chile.myshopify.com`
- **No cambiar** después de crear

#### 1.2 Storefront API Token
- **Para qué**: Sincronizar catálogo de productos
- **Cómo obtener**:
  1. Ir a: `https://tu-tienda.myshopify.com/admin/settings/apps/development`
  2. Crear Custom App: "ShopUnite Sync"
  3. Configurar permisos:
     - ✅ `read_products`
  4. Instalar app y copiar **Storefront API access token**

#### 1.3 Admin API Token ⚠️ **IMPORTANTE**
- **Para qué**: Crear órdenes automáticas cuando hay ventas
- **Cómo obtener**:
  1. Ir a: `https://tu-tienda.myshopify.com/admin/settings/apps/development`
  2. Crear Custom App: "ShopUnite Orders"
  3. Configurar permisos:
     - ✅ `read_orders`
     - ✅ `write_orders`
     - ✅ `read_draft_orders`
     - ✅ `write_draft_orders`
     - ✅ `read_customers`
     - ✅ `write_customers`
  4. Instalar app y copiar **Admin API access token**
  5. **IMPORTANTE**: Empieza con `shpat_...`

**Nota**: Puedes usar la misma Custom App para ambos tokens si configuras todos los permisos juntos.

---

### Paso 2: Campos Opcionales (Personalización)

#### Nombre Personalizado
- Ejemplo: "Nike Oficial Chile"
- Se muestra en la app en vez del dominio

#### Descripción Corta
- Ejemplo: "Lo mejor en deportes y lifestyle"
- Aparece en la tarjeta de la tienda

#### URL del Logo (Circular)
- Imagen cuadrada (recomendado: 200x200px)
- Se muestra como avatar circular
- Ejemplo: `https://cdn.shopify.com/logo.png`

#### URL del Banner
- Imagen rectangular (recomendado: 1200x400px)
- Banner principal en la página de la tienda
- Ejemplo: `https://cdn.shopify.com/banner.jpg`

#### Color del Tema
- Color HEX (ejemplo: `#FF5733`)
- Se usa en la UI de la tienda

---

## ✅ Estado de Tokens

Al ver la lista de tiendas, verás badges de estado:

### ✅ Storefront API
- **Verde**: Token configurado correctamente
- Puedes sincronizar productos

### ✅ Admin API
- **Verde**: Token configurado correctamente
- Sistema puede crear órdenes automáticamente

### ⚠️ Falta Admin API
- **Amarillo**: Solo tienes Storefront token
- **URGENTE**: Agrega Admin API token para que funcionen las compras

### ❌ Sin Storefront
- **Rojo**: No tienes Storefront token
- No puedes sincronizar productos

---

## 🔄 Sincronizar Productos

Una vez agregada la tienda con **Storefront API Token**:

1. Click en botón **"Sincronizar"**
2. Espera (puede tomar 10-30 segundos)
3. Verás resumen:
   ```
   ✅ Sincronización exitosa para Nike Chile

   📦 Productos agregados: 45
   🔄 Productos actualizados: 12
   🗑️ Productos eliminados: 3
   ⏱️ Tiempo: 18s
   ```

**Recomendación**: Sincronizar diariamente o cuando agregues productos nuevos.

---

## ✏️ Editar una Tienda

1. Click en botón **"Editar"**
2. Formulario se llena con datos actuales
3. **Tokens no se muestran** (por seguridad)
4. Campos que puedes editar:
   - Admin API Token (si no lo agregaste antes)
   - Storefront API Token (si cambió)
   - Personalización (nombre, logo, banner, etc.)
5. Click **"Actualizar Tienda"**

**Nota**: Si dejas los campos de tokens vacíos, se mantienen los actuales.

---

## 🗑️ Eliminar una Tienda

1. Click en botón **"Eliminar"**
2. Confirmar
3. **Importante**: También elimina:
   - Todos los productos sincronizados de esa tienda
   - Historial de sincronizaciones
   - (NO elimina órdenes ya creadas)

---

## 🎯 Checklist al Agregar Tienda

Antes de considerar la tienda "lista":

- [ ] Domain agregado
- [ ] Storefront API Token configurado
- [ ] Admin API Token configurado ⚠️
- [ ] Sincronización exitosa (botón "Sincronizar")
- [ ] Productos visibles en la app mobile
- [ ] Personalización agregada (opcional)

---

## 🐛 Problemas Comunes

### "Error al sincronizar"

**Causa**: Storefront API Token inválido o sin permisos

**Solución**:
1. Verificar que el token empiece con el formato correcto
2. Verificar permisos `read_products` en Shopify
3. Regenerar token si es necesario

### "Error al guardar"

**Causa**: Dominio duplicado o formato inválido

**Solución**:
1. Verificar formato: `tienda.myshopify.com`
2. No usar `https://` ni rutas

### "Órdenes no se crean en Shopify"

**Causa**: Falta Admin API Token o permisos incorrectos

**Solución**:
1. Verificar badge "✅ Admin API" está verde
2. Si está amarillo, editar tienda y agregar Admin API Token
3. Verificar permisos: `write_orders`, `write_draft_orders`, `write_customers`

---

## 💡 Tips Profesionales

### Organización de Custom Apps en Shopify

Recomiendo crear **1 Custom App por tienda** con todos los permisos:

**Nombre**: "ShopUnite Integration"

**Permisos**:
```
✅ read_products
✅ read_orders
✅ write_orders
✅ read_draft_orders
✅ write_draft_orders
✅ read_customers
✅ write_customers
```

Así obtienes:
- **Storefront API Token** (para catálogo)
- **Admin API Token** (para órdenes)

De una sola Custom App.

---

### Seguridad de Tokens

- **NUNCA** compartir tokens públicamente
- **NUNCA** commitear tokens en Git
- Tokens se guardan encriptados en Supabase
- Si comprometes un token, regenerar en Shopify

---

### Frecuencia de Sincronización

**Manual** (por ahora):
- Sincronizar cuando agregues productos nuevos
- Sincronizar si cambias precios
- Sincronizar si cambias disponibilidad

**Automático** (futuro):
- Cron job diario a las 3 AM
- Webhook de Shopify cuando productos cambien

---

## 📊 Verificar que Todo Funciona

### 1. En el Admin Dashboard
```
✅ Tienda agregada con ambos tokens
✅ Sincronización exitosa
✅ Badges verdes en la lista
```

### 2. En Supabase (SQL Editor)
```sql
-- Ver tiendas y estado de tokens
SELECT
  domain,
  store_name,
  CASE WHEN access_token IS NOT NULL THEN '✅' ELSE '❌' END as storefront,
  CASE WHEN admin_api_token IS NOT NULL THEN '✅' ELSE '❌' END as admin
FROM stores;

-- Ver productos sincronizados
SELECT store_domain, COUNT(*) as total_products
FROM products
GROUP BY store_domain;
```

### 3. En la App Mobile
```bash
npm start
```

- Deberías ver la tienda en el home
- Al entrar, ver los productos
- Poder agregarlos al carrito

### 4. Probar Compra (Testing)
1. Agregar productos al carrito
2. Ir a checkout
3. Llenar formulario
4. Click "Pago de Prueba"
5. Verificar en Supabase:
```sql
SELECT * FROM shopify_orders ORDER BY created_at DESC LIMIT 5;
```

---

## 🆘 Soporte

Si algo no funciona:

1. **Ver logs**: Console del navegador (F12)
2. **Verificar Supabase**: Table Editor → `stores`
3. **Revisar guías**: `QUICK_START.md`, `DEPLOYMENT_GUIDE.md`
4. **Regenerar tokens**: En Shopify si es necesario

---

## 🎨 Personalización Avanzada

### Colores Recomendados

Usa colores de la marca de la tienda:
- Nike: `#FF6B00`
- Adidas: `#000000`
- Zara: `#000000`

### Logos

**Formatos aceptados**:
- PNG (recomendado)
- JPG
- SVG (puede no funcionar en algunos casos)

**Tamaño óptimo**:
- Logo: 200x200px (cuadrado)
- Banner: 1200x400px (3:1 ratio)

### Hosting de Imágenes

Opciones:
1. **Shopify CDN** (recomendado): Usar URLs de Shopify Files
2. **Imgur**: Gratuito, fácil
3. **Cloudinary**: Profesional, con optimización
4. **Tu propio CDN**: Más control

---

¡Listo! Con esto deberías poder gestionar todas tus tiendas desde el Admin Dashboard. 🚀
