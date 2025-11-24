# 🚚 Configurar Zonas de Envío en Shopify

**CRÍTICO:** Las tiendas **NO tienen zonas de envío configuradas** en Shopify Admin.

Sin zonas de envío, Shopify NO puede calcular tarifas, **incluso con Admin API**.

---

## ❗ Problema Identificado

```
Draft Order creado ✅
  └─ shipping_line: null ❌
  └─ available_shipping_rates: null ❌

Causa: NO HAY ZONAS DE ENVÍO CONFIGURADAS EN SHOPIFY ADMIN
```

---

## ✅ Solución: Configurar Zonas de Envío

### Para cada tienda (spot-essence.myshopify.com, braintoys-chile.myshopify.com):

### 1. Ir a Shopify Admin
```
https://[tu-tienda].myshopify.com/admin
```

### 2. Ir a Settings → Shipping and delivery
```
Settings > Shipping and delivery
```

### 3. Verificar Shipping Zones

#### Si NO hay zonas creadas:

**Click en "Create shipping zone"**

**Configuración básica:**
```
- Name: "Chile"
- Countries/regions: Select "Chile"
```

**Agregar métodos de envío:**

##### Opción A: Tarifa plana (simple)
```
- Click "Add rate"
- Rate name: "Envío a domicilio"
- Price: 5000 (o el costo que quieras)
- Conditions: (opcional)
  - Based on order price: Free shipping over $50,000
```

##### Opción B: Usar app de terceros (Chilexpress, etc.)
```
Si ya tienes Chilexpress u otra app instalada:

1. Ir a Apps en Shopify Admin
2. Abrir la app de shipping (ej: Chilexpress)
3. Configurar la app:
   - API credentials
   - Zonas de cobertura
   - Tarifas

4. Volver a Settings → Shipping
5. La app debería aparecer automáticamente en las zonas
```

### 4. Guardar cambios

Click en **"Save"**

---

## 🧪 Verificar Configuración

### Test Manual en Shopify:

1. Ir a **Orders** → **Create order**
2. Agregar un producto
3. Agregar dirección de envío:
   ```
   Av. Providencia 2222
   Providencia, Región Metropolitana
   7500000
   Chile
   ```
4. **Verificar que aparecen opciones de envío** con precios

Si NO aparecen opciones:
- ❌ La zona de envío no está bien configurada
- ❌ La app de shipping no está funcionando

---

## 🚀 Después de Configurar

### Probar desde la app:

```bash
node test-shipping-final.js
```

**Resultado esperado:**
```
✅ SUCCESS! Tarifas de envío calculadas:

  🏪 braintoys-chile.myshopify.com:
     1. Envío a domicilio
        💰 $5.000
        🏷️  Código: STANDARD
        📦 Fuente: shopify

  🏪 spot-essence.myshopify.com:
     1. Chilexpress - Prioritario
        💰 $4.990
        🏷️  Código: CHXPRIORITY
        📦 Fuente: chilexpress-app
```

---

## 📋 Checklist por Tienda

### spot-essence.myshopify.com
- [ ] Ir a Shopify Admin
- [ ] Settings → Shipping and delivery
- [ ] Verificar si hay zonas creadas
- [ ] Si no, crear zona "Chile"
- [ ] Agregar tarifas o configurar app de shipping
- [ ] Guardar
- [ ] Test manual en Orders → Create order
- [ ] Verificar que aparecen opciones de envío

### braintoys-chile.myshopify.com
- [ ] Ir a Shopify Admin
- [ ] Settings → Shipping and delivery
- [ ] Verificar si hay zonas creadas
- [ ] Si no, crear zona "Chile"
- [ ] Agregar tarifas o configurar app de shipping
- [ ] Guardar
- [ ] Test manual en Orders → Create order
- [ ] Verificar que aparecen opciones de envío

---

## 🔍 Troubleshooting

### "No veo la opción de crear zonas"
→ Puede estar en un plan que no soporta shipping zones personalizado
→ Contactar soporte de Shopify

### "Tengo Chilexpress instalado pero no aparece"
→ Verificar que la app esté activa
→ Verificar credenciales API en la app
→ Verificar zonas de cobertura en la app

### "Las tarifas aparecen en Shopify pero no en la app"
→ Verificar que `admin_api_token` está configurado
→ Verificar permisos: `read_draft_orders`, `write_draft_orders`, `read_shipping`
→ Ejecutar `node test-shipping-final.js` para debugging

---

## 📞 Contacto

Si después de configurar las zonas de envío sigue sin funcionar:

1. Verificar en Shopify Admin que las zonas están activas
2. Hacer test manual creando una orden
3. Si funciona en Shopify pero no en la app → problema de API
4. Si NO funciona ni en Shopify → problema de configuración de la tienda

---

**IMPORTANTE:** Sin zonas de envío configuradas, NO es posible calcular shipping de ninguna manera (ni con Admin API ni con Storefront API).

**Última actualización:** 2025-11-24
