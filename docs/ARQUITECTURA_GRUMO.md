# ARQUITECTURA DEL SISTEMA GRUMO
## Análisis Técnico Completo - Noviembre 2024

---

## 1. VISIÓN GENERAL

### 1.1 Stack Tecnológico

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ARQUITECTURA GRUMO                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────────┐         ┌─────────────────────────────────────┐  │
│   │  App Móvil       │         │          SUPABASE (Pro)             │  │
│   │  React Native    │◄───────►│  ┌─────────────────────────────┐   │  │
│   │  + Expo          │         │  │  PostgreSQL Database        │   │  │
│   └──────────────────┘         │  │  • 8 GB storage             │   │  │
│                                │  │  • 60 conexiones directas   │   │  │
│   ┌──────────────────┐         │  │  • Connection Pooling       │   │  │
│   │  Dashboard Web   │◄───────►│  └─────────────────────────────┘   │  │
│   │  React + Vite    │         │                                     │  │
│   └──────────────────┘         │  ┌─────────────────────────────┐   │  │
│                                │  │  Auth (Supabase Auth)       │   │  │
│   ┌──────────────────┐         │  │  • JWT tokens               │   │  │
│   │  Shopify Stores  │◄───────►│  │  • Google OAuth             │   │  │
│   │  (GraphQL API)   │         │  │  • Apple Sign-In            │   │  │
│   └──────────────────┘         │  └─────────────────────────────┘   │  │
│                                │                                     │  │
│   ┌──────────────────┐         │  ┌─────────────────────────────┐   │  │
│   │  MercadoPago     │◄───────►│  │  Edge Functions (Deno)      │   │  │
│   │  Payments API    │         │  │  • 2M invocaciones/mes      │   │  │
│   └──────────────────┘         │  │  • Serverless               │   │  │
│                                │  └─────────────────────────────┘   │  │
│   ┌──────────────────┐         │                                     │  │
│   │  Expo Push       │◄───────►│  ┌─────────────────────────────┐   │  │
│   │  Notifications   │         │  │  Realtime (WebSockets)      │   │  │
│   └──────────────────┘         │  └─────────────────────────────┘   │  │
│                                │                                     │  │
│                                └─────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Tipo de Arquitectura

**Backend-as-a-Service (BaaS) - Serverless**

- **NO hay servidor propio** - Todo corre en Supabase
- **Edge Functions** para lógica de negocio (Deno runtime)
- **PostgreSQL** como base de datos principal
- **Escalamiento automático** manejado por Supabase

---

## 2. EDGE FUNCTIONS (Backend Serverless)

### 2.1 Inventario de Funciones (13 total)

| # | Función | Propósito | Tipo |
|---|---------|-----------|------|
| 1 | `calculate-shipping` | Calcula tarifas de envío por zona/peso/precio | API |
| 2 | `create-mp-preference` | Crea preferencia de pago en MercadoPago | API |
| 3 | `check-payment-status` | Verifica estado de un pago | API |
| 4 | `mp-webhook` | Recibe notificaciones de pagos de MP | **WEBHOOK** |
| 5 | `mp-webhook-multi` | Recibe notificaciones de pagos split | **WEBHOOK** |
| 6 | `mp-oauth-callback` | Callback de OAuth para conectar tiendas | **WEBHOOK** |
| 7 | `mp-refresh-token` | Renueva tokens OAuth expirados | API/Cron |
| 8 | `create-multi-payment` | Crea pago split multi-vendor | API |
| 9 | `check-multi-payment-status` | Verifica estado de pago split | API |
| 10 | `send-push-notification` | Envía notificaciones push via Expo | API |
| 11 | `shopify-webhook` | Recibe eventos de Shopify (inventario, etc) | **WEBHOOK** |
| 12 | `create-user-profile` | Crea perfil automático al registrar | Trigger |
| 13 | `create-shopify-orders` | Crea órdenes en Shopify post-pago | Internal |

### 2.2 Webhooks Activos (4)

```
MercadoPago ──────► mp-webhook ──────► Actualiza transacción + Crea orden Shopify

MercadoPago ──────► mp-webhook-multi ──► Pagos split marketplace

MercadoPago ──────► mp-oauth-callback ──► Conecta tienda con MP OAuth

Shopify ──────────► shopify-webhook ────► Sync inventario/precios
```

---

## 3. BASE DE DATOS

### 3.1 Esquema de Tablas (~25 tablas)

#### CORE - Tiendas y Catálogo

| Tabla | Descripción | Registros Est. | Tamaño/Registro |
|-------|-------------|----------------|-----------------|
| `stores` | Tiendas Shopify registradas | 10-100 | ~2 KB |
| `products` | Productos sincronizados | 1K-100K | ~1 KB |
| `product_variants` | Variantes (talla, color) | 5K-500K | ~500 B |
| `store_collections` | Colecciones de productos | 100-1K | ~200 B |

#### USUARIOS Y AUTENTICACIÓN

| Tabla | Descripción | Registros Est. | Tamaño/Registro |
|-------|-------------|----------------|-----------------|
| `auth.users` | Usuarios (Supabase Auth) | 1K-100K | ~1 KB |
| `user_profiles` | Perfiles extendidos | 1K-100K | ~500 B |
| `user_addresses` | Direcciones guardadas | 2K-200K | ~300 B |
| `push_tokens` | Tokens de dispositivos | 1K-100K | ~200 B |
| `user_favorites` | Productos favoritos | 5K-500K | ~100 B |
| `user_sessions` | Sesiones de usuario | 10K-1M | ~200 B |

#### TRANSACCIONES Y ÓRDENES

| Tabla | Descripción | Registros Est. | Tamaño/Registro |
|-------|-------------|----------------|-----------------|
| `transactions` | Transacciones de pago | 100-1M | ~1 KB |
| `shopify_orders` | Órdenes creadas en Shopify | 100-1M | ~500 B |
| `cart_items` | Items en carrito (temporal) | 1K-100K | ~200 B |

#### SUSCRIPCIONES Y NOTIFICACIONES

| Tabla | Descripción | Registros Est. | Tamaño/Registro |
|-------|-------------|----------------|-----------------|
| `store_subscriptions` | Usuarios suscritos a tiendas | 5K-500K | ~100 B |
| `notifications_sent` | Historial de campañas push | 100-10K | ~500 B |
| `notification_interactions` | Opens/clicks de notificaciones | 1K-100K | ~100 B |
| `notification_analytics` | Métricas agregadas | 1K-10K | ~200 B |

#### PAGOS MARKETPLACE

| Tabla | Descripción | Registros Est. | Tamaño/Registro |
|-------|-------------|----------------|-----------------|
| `store_payments` | Pagos/disbursements a tiendas | 100-1M | ~300 B |
| `store_balance` | Balance acumulado por tienda | 10-100 | ~100 B |

#### SHIPPING

| Tabla | Descripción | Registros Est. | Tamaño/Registro |
|-------|-------------|----------------|-----------------|
| `shipping_zones` | Zonas de envío | 50-500 | ~200 B |
| `shipping_methods` | Métodos (Estándar, Express) | 100-1K | ~200 B |
| `shipping_rates` | Tarifas por zona/peso | 500-5K | ~150 B |
| `free_shipping_rules` | Reglas de envío gratis | 50-500 | ~200 B |

#### LOGS Y ANALYTICS

| Tabla | Descripción | Registros Est. | Tamaño/Registro |
|-------|-------------|----------------|-----------------|
| `sync_logs` | Logs de sincronización | 1K-100K | ~300 B |

### 3.2 Índices Implementados

```sql
-- Búsqueda de productos por tienda
idx_products_store_domain

-- Órdenes por usuario y fecha
idx_transactions_user_date
idx_transactions_status_date

-- Suscripciones activas
idx_store_subscriptions_active

-- Búsqueda full-text (pg_trgm)
idx_user_profiles_full_name_trgm

-- BRIN para timestamps (ultra eficiente)
idx_transactions_created_at_brin
```

### 3.3 Row Level Security (RLS)

Todas las tablas tienen RLS habilitado:
- Usuarios solo ven sus propios datos
- Service role tiene acceso completo
- Políticas específicas por tabla

---

## 4. FLUJOS DE DATOS PRINCIPALES

### 4.1 Flujo de Compra

```
┌─────────┐    ┌──────────┐    ┌─────────────────┐    ┌───────────┐
│   App   │───►│ Supabase │───►│ create-mp-pref  │───►│MercadoPago│
│ (Cart)  │    │   DB     │    │ Edge Function   │    │  API      │
└─────────┘    └──────────┘    └─────────────────┘    └───────────┘
                                                            │
                                                            ▼
┌─────────┐    ┌──────────┐    ┌─────────────────┐    ┌───────────┐
│ Shopify │◄───│ mp-webhook│◄───│    Webhook     │◄───│  Pago OK  │
│ Orders  │    │ Function  │    │   Endpoint     │    │           │
└─────────┘    └──────────┘    └─────────────────┘    └───────────┘
```

### 4.2 Flujo de Sincronización

```
┌─────────────┐    ┌──────────────┐    ┌──────────┐
│  Dashboard  │───►│   Shopify    │───►│ Supabase │
│  (Admin)    │    │ GraphQL API  │    │    DB    │
└─────────────┘    └──────────────┘    └──────────┘
      │
      ▼
┌─────────────┐
│  sync_logs  │
└─────────────┘
```

### 4.3 Flujo de Notificaciones Push

```
┌─────────────┐    ┌───────────────────┐    ┌──────────┐    ┌───────┐
│  Dashboard  │───►│ send-push-notif   │───►│   Expo   │───►│ Device│
│  (Admin)    │    │   Edge Function   │    │Push API  │    │       │
└─────────────┘    └───────────────────┘    └──────────┘    └───────┘
      │
      ▼
┌─────────────────────┐
│ notifications_sent  │
│ notification_inter. │
└─────────────────────┘
```

---

## 5. CAPACIDAD Y ESCALABILIDAD

### 5.1 Límites Supabase Pro ($25/mes)

| Recurso | Límite | Uso Estimado Actual |
|---------|--------|---------------------|
| Database Storage | 8 GB | ~100 MB |
| Bandwidth | 250 GB/mes | ~5 GB/mes |
| Edge Function Invocations | 2,000,000/mes | ~10,000/mes |
| Auth Users MAU | 100,000 | ~100 |
| Realtime Messages | 5,000,000/mes | ~1,000/mes |
| Storage | 100 GB | ~0 |

### 5.2 Capacidad Estimada

| Métrica | Capacidad con Pro |
|---------|-------------------|
| **Tiendas** | 50-100 tiendas |
| **Productos totales** | 500,000-800,000 |
| **Usuarios registrados** | 100,000 |
| **Compras por día** | ~2,000 |
| **Usuarios simultáneos** | 500-1,000 |

### 5.3 Cuellos de Botella Identificados

| Bottleneck | Riesgo | Mitigación |
|------------|--------|------------|
| Database connections (60 max) | Medio | Connection Pooling (PgBouncer) |
| Edge Function cold start | Bajo | Funciones pequeñas (<200ms) |
| Supabase query limit 1000 | **Resuelto** | Count queries implementados |
| MercadoPago rate limits | Bajo | 1000 req/min suficiente |

---

## 6. SEGURIDAD

### 6.1 Autenticación
- JWT tokens via Supabase Auth
- Google OAuth implementado
- Apple Sign-In implementado
- Refresh tokens automáticos

### 6.2 Autorización
- Row Level Security (RLS) en todas las tablas
- Service Role Key solo en Edge Functions
- Anon Key en cliente (limitado por RLS)

### 6.3 Datos Sensibles
- Tokens de Shopify en DB (considerar encriptar)
- Tokens de MercadoPago OAuth en DB
- Passwords hasheados por Supabase Auth

---

## 7. MONITOREO Y OBSERVABILIDAD

### 7.1 Logs Disponibles
- Edge Function logs en Supabase Dashboard
- `sync_logs` para sincronizaciones
- `notification_interactions` para push analytics

### 7.2 Métricas Recomendadas
- Tasa de éxito de pagos
- Tiempo de respuesta de Edge Functions
- Errores de webhook
- Uso de base de datos

---

## 8. COSTOS

### 8.1 Costos Actuales

| Servicio | Costo/mes |
|----------|-----------|
| Supabase Pro | $25 |
| MercadoPago | 0 (comisión por transacción) |
| Expo Push | $0 (free tier) |
| Dominio/DNS | ~$12/año |
| **TOTAL** | **~$25/mes** |

### 8.2 Costos por Transacción

| Concepto | Porcentaje |
|----------|------------|
| MercadoPago fee | ~3.5% + IVA |
| Comisión Grumo | 10% (configurable) |

---

## 9. ROADMAP TÉCNICO

### Fase 1 - Actual (MVP)
- ✅ Multi-tienda con sync Shopify
- ✅ Pagos MercadoPago
- ✅ Push notifications
- ✅ Dashboard admin

### Fase 2 - Optimización
- [ ] Connection Pooling habilitado
- [ ] Cache con Redis (Upstash)
- [ ] CDN para imágenes

### Fase 3 - Escala
- [ ] Separación por región
- [ ] Queue system para webhooks
- [ ] Analytics avanzados

---

## 10. CONTACTO TÉCNICO

**Repositorio:** github.com/imc400/Tuka
**Stack:** React Native + Supabase + Shopify + MercadoPago

---

*Documento generado: Noviembre 2024*
*Versión: 1.0*
