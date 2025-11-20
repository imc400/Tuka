# 🧪 Guía de Testing - ShopUnite Marketplace

## ✅ Checklist de Funcionalidad

### 1. Dashboard Web (http://localhost:3008)

**Verificar que el dashboard carga correctamente:**
- [ ] La página se abre sin errores
- [ ] Se ve el formulario "Nueva Tienda"
- [ ] Se ve la sección "Tiendas Registradas"
- [ ] Si hay tiendas, se muestran en la lista

**Agregar una tienda de prueba:**

```
Domain: quickstart-12345678.myshopify.com
Token: shppa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Nombre: Mi Tienda de Prueba
Descripción: Tienda de ejemplo para testing
Logo URL: https://via.placeholder.com/150
Color: #4F46E5 (o cualquier color)
```

- [ ] El formulario acepta los datos
- [ ] Click en "Guardar Tienda" funciona
- [ ] Aparece un alert de confirmación
- [ ] La tienda aparece en la lista debajo

**Eliminar una tienda:**
- [ ] Click en el botón "Eliminar" (icono de basura rojo)
- [ ] Aparece confirmación
- [ ] La tienda se elimina de la lista

---

### 2. App Mobile (Expo)

**Iniciar la app:**
```bash
npm start
```

**En el simulador/dispositivo:**
- [ ] La app carga sin errores
- [ ] Se ve la pantalla "ShopUnite" con el header morado
- [ ] Se muestra "Tiendas Disponibles"

**Si NO hay tiendas en Supabase:**
- [ ] NO aparece ninguna tienda en la lista
- [ ] El mensaje debe ser claro (pantalla vacía)

**Si SÍ hay tiendas en Supabase:**
- [ ] Aparecen todas las tiendas que agregaste en el dashboard
- [ ] Cada tienda muestra: nombre, categoría, descripción
- [ ] Se ven miniaturas de los primeros 3 productos

**Navegar a una tienda:**
- [ ] Click en una tarjeta de tienda
- [ ] Se abre la vista de detalle de la tienda
- [ ] Se ve el banner con el nombre de la tienda
- [ ] Se muestra la descripción
- [ ] Aparecen todos los productos en un grid

**Ver un producto:**
- [ ] Click en un producto
- [ ] Se abre la vista de detalle del producto
- [ ] Se ve la imagen (de Shopify o placeholder)
- [ ] Se ve el precio correcto
- [ ] Botón "Agregar al Carrito" funciona

**Carrito:**
- [ ] Agregar producto aumenta el contador en el tab inferior
- [ ] Click en el tab "Carrito" muestra los productos agregados
- [ ] Puedes aumentar/disminuir cantidad con +/-
- [ ] El total se calcula correctamente
- [ ] Botón "Ir a Pagar" lleva al checkout

---

### 3. Integración Supabase

**Desde el dashboard web:**
1. Abre las DevTools del navegador (F12)
2. Ve a la pestaña "Console"
3. Agrega una tienda
4. Verifica que NO haya errores rojos

**Verificar en Supabase directamente:**
1. Abre tu proyecto en https://supabase.com
2. Ve a "Table Editor" → tabla `stores`
3. Deberías ver la tienda que agregaste con todos sus campos

**Desde la app mobile:**
1. Abre la terminal donde corre Expo
2. Verifica el log: "Successfully loaded X Shopify stores"
3. Si hay errores, deberían aparecer en rojo

---

### 4. Integración Shopify API

**Requisitos:**
- Tener una tienda Shopify real (o de prueba)
- Haber generado un Storefront API Access Token
- La tienda debe tener al menos 1 producto publicado

**Verificar conexión:**
1. Agrega tu tienda real en el dashboard
2. Ve a la app mobile
3. Verifica que aparezca la tienda
4. Los productos deben cargarse desde Shopify:
   - Nombres reales de tus productos
   - Precios reales
   - Imágenes reales (si las tienes)

**Si algo falla:**
- Revisa la consola de Expo (logs en terminal)
- El error debería decir qué salió mal:
  - "401 Unauthorized" → Token inválido
  - "404 Not Found" → Domain incorrecto
  - "GraphQL errors" → Problema con la query

---

## 🐛 Problemas Comunes

### Dashboard no carga
**Síntomas:** Pantalla blanca o error en consola

**Solución:**
```bash
# Verifica que las variables de entorno estén configuradas
cat .env | grep VITE_

# Debe mostrar:
# VITE_SUPABASE_URL=https://...
# VITE_SUPABASE_ANON_KEY=eyJ...

# Si no están, agrégalas y reinicia el servidor
npm run dev:web
```

### App mobile no muestra tiendas
**Síntomas:** Pantalla vacía en "Tiendas Disponibles"

**Debugging:**
1. Verifica que agregaste tiendas en el dashboard
2. Abre Supabase y confirma que la tabla `stores` tiene datos
3. Revisa la consola de Expo:
   ```
   console.log("Successfully loaded X Shopify stores")
   ```
4. Si dice "0 Shopify stores", hay un problema de conexión

### Error: "Cannot find module 'autoprefixer'"
**Ya resuelto** - Se renombró `postcss.config.cjs` a `postcss.config.js`

### Productos no cargan desde Shopify
**Posibles causas:**
1. Token inválido o expirado
2. Domain incorrecto (debe ser `tutienda.myshopify.com`)
3. La tienda no tiene productos publicados
4. Storefront API no está habilitada

**Verificación manual:**
```bash
# Prueba el token con curl
curl -X POST \
  https://tutienda.myshopify.com/api/2023-01/graphql.json \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Storefront-Access-Token: tu_token_aqui" \
  -d '{"query": "{ shop { name } }"}'

# Si funciona, deberías ver: {"data":{"shop":{"name":"Nombre de tu tienda"}}}
```

---

## 📊 Logs Útiles

### En el Dashboard Web (DevTools Console):
```
✅ "Tienda agregada correctamente" → Insert exitoso
❌ "Error al guardar: ..." → Problema con Supabase
```

### En la App Mobile (Terminal de Expo):
```
✅ "Successfully loaded 3 Shopify stores" → Todo bien
⚠️ "No Shopify stores registered yet" → Dashboard vacío
❌ "Failed to fetch from Shopify (domain.com)" → API error
❌ "Failed to load configs from Supabase" → Conexión DB error
```

---

## 🎯 Test de Extremo a Extremo (E2E)

### Flujo completo:
1. **Dashboard:** Agrega una tienda Shopify con token válido
2. **Supabase:** Verifica que aparece en la tabla `stores`
3. **Mobile:** Cierra y reabre la app (o pull to refresh)
4. **Mobile:** Verifica que la tienda aparece en el home
5. **Mobile:** Click en la tienda → Ver productos
6. **Mobile:** Agrega productos al carrito
7. **Mobile:** Ve al carrito y verifica el total
8. **Dashboard:** Elimina la tienda
9. **Mobile:** Refresca → La tienda ya no aparece

Si todos estos pasos funcionan: **✅ Sistema operativo correctamente**

---

## 🚀 Próximo Paso

Una vez que todo funcione:
1. Sube el código a GitHub
2. Configura Expo EAS para builds de producción
3. Deploy del dashboard a Vercel/Netlify
4. Securiza las políticas RLS de Supabase
