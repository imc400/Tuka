# ⏭️ Próximos Pasos - Checklist Completo

Usa este checklist para poner tu marketplace en producción paso a paso.

---

## ✅ Fase 1: Setup Inicial (Ya completado)

- [x] Código base implementado
- [x] Checkout unificado con MercadoPago
- [x] Edge Functions creadas
- [x] Schema de base de datos diseñado
- [x] Botón de prueba para testing

---

## 🔧 Fase 2: Configuración (Hoy - 30 minutos)

### 1. Ejecutar Schema de Órdenes

- [ ] Ir a Supabase SQL Editor
- [ ] Ejecutar `supabase_orders_schema.sql`
- [ ] Verificar que se crearon 4 tablas:
  - `transactions`
  - `shopify_orders`
  - `payouts`
  - `users`

**Verificar**:
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('transactions', 'shopify_orders', 'payouts', 'users');
```

### 2. Generar Admin API Tokens de Shopify

Para **cada tienda** que quieras agregar:

- [ ] Ir a `https://[tu-tienda].myshopify.com/admin/settings/apps/development`
- [ ] Crear Custom App: "ShopUnite Marketplace"
- [ ] Configurar scopes:
  - `read_orders`, `write_orders`
  - `read_draft_orders`, `write_draft_orders`
  - `read_products` (ya lo tienes)
  - `read_customers`, `write_customers`
- [ ] Instalar app y copiar Access Token (empieza con `shpat_...`)
- [ ] Actualizar en Supabase:

```sql
UPDATE stores
SET access_token = 'shpat_tu_token_aqui'
WHERE domain = 'tu-tienda.myshopify.com';
```

**Repetir para cada tienda**.

### 3. Verificar Setup

```bash
npm run check-setup
```

Debe mostrar:
```
✅ Setup completo! Todo listo para empezar
```

---

## 🧪 Fase 3: Testing Local (Hoy - 15 minutos)

### 1. Probar Pago de Prueba (sin MercadoPago)

- [ ] Ejecutar: `npm start`
- [ ] Agregar productos de 2-3 tiendas diferentes al carrito
- [ ] Ir a checkout
- [ ] Llenar formulario con datos de prueba
- [ ] Click en **"Pago de Prueba (Testing)"** (botón naranja)
- [ ] Verificar mensaje: "✅ Prueba Exitosa"

### 2. Verificar en Supabase

- [ ] Ir a Table Editor → `transactions`
- [ ] Debe haber 1 registro con `status = 'approved'` y `is_test = true`
- [ ] Ir a Table Editor → `shopify_orders`
- [ ] Debe haber N registros (uno por tienda)
- [ ] `shopify_order_id` debe empezar con `test_`

**Si todo está OK**, continúa al siguiente paso.

---

## 🚀 Fase 4: Deploy de Edge Functions (Mañana - 20 minutos)

### 1. Instalar Supabase CLI

**macOS**:
```bash
brew install supabase/tap/supabase
```

**Windows**:
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### 2. Login y Link

- [ ] `npx supabase login`
- [ ] `npx supabase link --project-ref TU_PROJECT_REF`
  - Tu PROJECT_REF está en la URL de Supabase

### 3. Obtener Access Token de MercadoPago

- [ ] Ir a: https://www.mercadopago.cl/developers/panel
- [ ] Crear aplicación si no tienes
- [ ] Copiar **Access Token de Prueba** (empieza con `TEST-`)

### 4. Configurar Secret

```bash
npx supabase secrets set MERCADOPAGO_ACCESS_TOKEN=TEST-tu-token-aqui
```

### 5. Desplegar Edge Functions

- [ ] `npx supabase functions deploy create-mp-preference`
- [ ] `npx supabase functions deploy check-payment-status`
- [ ] `npx supabase functions deploy mp-webhook`

**Verificar**:
```bash
npx supabase functions list
```

Debe mostrar las 3 funciones.

---

## 🔔 Fase 5: Configurar Webhook (Mañana - 5 minutos)

### 1. Obtener URL del Webhook

Tu URL es:
```
https://TU_PROJECT_REF.supabase.co/functions/v1/mp-webhook
```

### 2. Configurar en MercadoPago

- [ ] Ir a: https://www.mercadopago.cl/developers/panel/notifications/webhooks
- [ ] Click "Crear webhook"
- [ ] URL: pegar tu URL del paso anterior
- [ ] Eventos: Marcar solo **"Pagos"** (payment)
- [ ] Guardar

### 3. Probar (opcional)

- [ ] En el panel de MercadoPago, hay opción "Enviar prueba"
- [ ] Ver logs: `npx supabase functions logs mp-webhook`

---

## 💳 Fase 6: Testing con MercadoPago (Mañana - 10 minutos)

### 1. Reiniciar la App

```bash
# Ctrl+C y luego
npm start
```

### 2. Flujo Completo

- [ ] Agregar productos de múltiples tiendas
- [ ] Ir a checkout
- [ ] Llenar formulario (usar tu email real para recibir confirmación)
- [ ] Click en **"Pagar"** (botón azul)
- [ ] Se abre navegador con MercadoPago
- [ ] Usar tarjeta de prueba:

**Tarjeta que APRUEBA**:
```
Número: 5031 7557 3453 0604
Vencimiento: 11/25
CVV: 123
Nombre: APRO
```

- [ ] Completar pago
- [ ] Volver a la app
- [ ] Ver mensaje: "✅ Pago Exitoso"

### 3. Verificar Órdenes en Shopify

Para **cada tienda**:

- [ ] Ir a `https://tu-tienda.myshopify.com/admin/orders`
- [ ] Debe aparecer la orden con:
  - Estado: **Pagado**
  - Tag: "shopunite"
  - Productos correctos
  - Dirección de envío correcta

**Si todo funciona**, ¡Felicidades! Tu sistema está listo.

---

## 🎯 Fase 7: Preparar Producción (Esta semana)

### 1. Cambiar a Tokens de Producción

#### MercadoPago

- [ ] Obtener Access Token de PRODUCCIÓN (empieza con `APP_USR-`)
- [ ] Actualizar secret:
```bash
npx supabase secrets set MERCADOPAGO_ACCESS_TOKEN=APP_USR-tu-token-produccion
```

#### Webhook

- [ ] Actualizar URL del webhook en panel de MercadoPago
- [ ] Cambiar de "Prueba" a "Producción"

### 2. Configurar RLS Políticas

**Importante para seguridad**:

```sql
-- Revocar políticas de desarrollo
DROP POLICY "transactions_insert_policy" ON transactions;
DROP POLICY "transactions_update_policy" ON transactions;

-- Crear políticas de producción
CREATE POLICY "service_only_insert_transactions" ON transactions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "user_view_own_transactions" ON transactions
  FOR SELECT USING (auth.email() = buyer_email);
```

### 3. Testing en Producción (con tarjetas reales)

- [ ] Hacer una compra pequeña de prueba con tu tarjeta
- [ ] Verificar que todo el flujo funciona
- [ ] Verificar órdenes en Shopify
- [ ] Verificar transacciones en Supabase

---

## 📱 Fase 8: Lanzamiento (Próxima semana)

### 1. Build de Producción

#### Mobile App

- [ ] Configurar EAS Build (Expo Application Services)
- [ ] Crear builds para iOS y Android
- [ ] Subir a App Store / Play Store

**Guía**: https://docs.expo.dev/build/introduction/

#### Admin Dashboard

- [ ] `npm run build:web`
- [ ] Desplegar en Vercel/Netlify
- [ ] Configurar dominio personalizado

### 2. Agregar Tiendas Reales

- [ ] Usar Admin Dashboard para agregar más tiendas
- [ ] Solicitar Admin API tokens a cada tienda
- [ ] Ejecutar `npm run sync` para sincronizar productos

### 3. Monitoreo

- [ ] Configurar alertas en Supabase (uso de DB, errores)
- [ ] Monitorear logs de Edge Functions diariamente
- [ ] Revisar tabla `shopify_orders` para órdenes fallidas

---

## 💰 Fase 9: Gestión de Fondos (Post-lanzamiento)

### 1. Sistema de Payouts Manual (Ahora)

**Cada semana/mes**:

1. Ver balance de cada tienda:
```sql
SELECT store_domain, get_store_pending_balance(store_domain)
FROM stores;
```

2. Transferir fondos desde tu cuenta MercadoPago a cuenta bancaria de cada tienda

3. Registrar payout:
```sql
INSERT INTO payouts (store_domain, amount, status, transfer_method)
VALUES ('tienda.myshopify.com', 150000.00, 'completed', 'bank_transfer');
```

### 2. Automatización (Futuro - Fase 2)

- [ ] Investigar MercadoPago Split Payments
- [ ] Implementar transferencias automáticas
- [ ] Crear dashboard para tiendas (ver balance, historial)

---

## 🔄 Fase 10: Mejoras Continuas

### Prioridad Alta (Próximos 1-2 meses)

- [ ] **Autenticación de usuarios**
  - Supabase Auth (Google, email/password)
  - Historial de órdenes por usuario
  - Guardar direcciones

- [ ] **Dashboard para comerciantes**
  - Ver ventas en tiempo real
  - Ver balance pendiente
  - Descargar reportes

- [ ] **Notificaciones push**
  - Confirmar compra
  - Estado de envío
  - Ofertas personalizadas

### Prioridad Media (3-6 meses)

- [ ] **Sistema de búsqueda avanzada**
  - Filtros por categoría, precio, tienda
  - Búsqueda full-text en español

- [ ] **Carritos guardados**
  - Persistir carrito entre sesiones
  - Recuperar carritos abandonados

- [ ] **Analytics**
  - Productos más vendidos
  - Tiendas con mejor rendimiento
  - Conversión de checkout

### Prioridad Baja (6+ meses)

- [ ] Multi-país (Argentina, México, Colombia)
- [ ] Sistema de reviews y ratings
- [ ] Programa de lealtad/puntos
- [ ] Cupones y descuentos
- [ ] Suscripciones

---

## 📊 KPIs a Monitorear

### Semanalmente

- **Transacciones totales**: `SELECT COUNT(*) FROM transactions WHERE status = 'approved'`
- **Ventas totales**: `SELECT SUM(total_amount) FROM transactions WHERE status = 'approved'`
- **Órdenes fallidas**: `SELECT COUNT(*) FROM shopify_orders WHERE status = 'failed'`
- **Tasa de conversión**: (Transacciones aprobadas / Transacciones totales) * 100

### Mensualmente

- Ventas por tienda
- Balance pendiente por tienda
- Nuevos usuarios (cuando implementes auth)
- Productos más vendidos

---

## 🆘 Soporte y Recursos

### Documentación

- [QUICK_START.md](QUICK_START.md) - Guía rápida de inicio
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Deployment completo
- [ARCHITECTURE.md](ARCHITECTURE.md) - Arquitectura técnica

### Comunidades

- **Supabase Discord**: https://discord.supabase.com
- **Expo Discord**: https://discord.gg/expo
- **MercadoPago Developers**: https://www.mercadopago.cl/developers/es/support

### Debugging

```bash
# Ver logs de Edge Functions
npx supabase functions logs mp-webhook --follow

# Ver últimos 100 logs
npx supabase functions logs create-mp-preference --limit 100

# Verificar setup
npm run check-setup
```

---

## 📅 Timeline Sugerido

| Día | Tarea | Tiempo Estimado |
|-----|-------|----------------|
| Hoy | Ejecutar schema + generar tokens | 30 min |
| Hoy | Testing local (pago de prueba) | 15 min |
| Mañana | Deploy Edge Functions | 20 min |
| Mañana | Configurar webhook | 5 min |
| Mañana | Testing con MercadoPago sandbox | 10 min |
| Esta semana | Preparar producción | 2-3 horas |
| Próxima semana | Lanzamiento MVP | 1 día |

**Total**: ~1 semana para MVP en producción

---

## ✅ Checklist de Lanzamiento

Antes de hacer público el marketplace, verificar:

- [ ] Edge Functions desplegadas y funcionando
- [ ] Webhook de MercadoPago configurado (producción)
- [ ] Todas las tiendas tienen Admin API tokens válidos
- [ ] RLS policies configuradas (seguridad)
- [ ] Testing completo con tarjetas reales
- [ ] Órdenes llegan correctamente a Shopify
- [ ] Inventario se sincroniza correctamente
- [ ] Sistema de payouts documentado y probado
- [ ] Documentación actualizada para nuevas tiendas
- [ ] Monitoreo configurado

---

¡Estás listo! 🚀

Comienza por la **Fase 2** hoy mismo y en una semana tendrás tu marketplace funcionando.

¿Dudas? Revisa la documentación o los logs de Edge Functions.
