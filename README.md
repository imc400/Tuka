# Tuka - Marketplace Multi-Tienda

Marketplace de comercio electrónico que permite a usuarios comprar productos de múltiples tiendas Shopify en una sola transacción, con pago unificado a través de MercadoPago.

## 🚀 Características

### Para Compradores
- 🛍️ **Compra en múltiples tiendas** con un solo pago
- 💳 **Pagos con MercadoPago** (tarjetas de crédito/débito)
- 📍 **Selector de región y comuna** específico para Chile
- 🔔 **Suscripciones a tiendas** con notificaciones push
- 📦 **Historial de pedidos**
- ⭐ **Productos favoritos**
- 🏠 **Direcciones guardadas**

### Para Tiendas
- 🏪 **Integración con Shopify** automática
- 📊 **Órdenes sincronizadas** en tiempo real
- 👥 **Clientes asociados** correctamente
- 🚚 **Sistema de envíos** (próximamente)
- 📦 **Control de inventario** (próximamente)

## 🛠️ Stack Tecnológico

- **Frontend**: React Native + Expo SDK 54
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Pagos**: MercadoPago Checkout Pro
- **E-commerce**: Shopify Admin API + GraphQL
- **Notificaciones**: Expo Push Notifications
- **Estilos**: NativeWind (Tailwind CSS)

## 📦 Estructura del Proyecto

```
shopunite-marketplace/
├── App.tsx                      # Componente principal de la app
├── src/
│   ├── data/
│   │   └── chileanRegions.ts   # Regiones y comunas de Chile
│   ├── services/
│   │   └── mercadopagoService.ts # Integración con MercadoPago
│   └── types/                   # TypeScript types
├── supabase/
│   └── functions/
│       ├── create-mp-preference/ # Crea preferencia de pago
│       ├── mp-webhook/          # Recibe notificaciones de MP
│       └── sync-stores/         # Sincroniza tiendas Shopify
├── scripts/                     # Scripts útiles para debugging
├── docs/                        # Documentación técnica
│   ├── SHIPPING_INTEGRATION.md  # Sistema de envíos
│   └── INVENTORY_SYNC.md        # Sistema de inventario
└── package.json

## 🚦 Estado del Proyecto

### ✅ Completado
- [x] Integración con Shopify (múltiples tiendas)
- [x] Sistema de pagos con MercadoPago (Producción - 100/100 puntos)
- [x] Webhooks para creación automática de órdenes
- [x] Selector de regiones/comunas de Chile
- [x] Creación de clientes en Shopify
- [x] Dashboard web para agregar tiendas
- [x] Carrito multi-tienda

### 🚧 En Progreso
- [ ] Sistema de autenticación de usuarios
- [ ] Suscripciones a tiendas
- [ ] Notificaciones push

### 📋 Pendiente
- [ ] Sistema de envíos con Shopify Shipping API
- [ ] Sincronización de inventario
- [ ] Historial de pedidos
- [ ] Favoritos y listas
- [ ] Panel de administración

## 🔧 Configuración

### Requisitos Previos
- Node.js 18+
- Expo CLI
- Cuenta de Supabase
- Cuenta de MercadoPago (Chile)
- Tiendas Shopify con Admin API access

### Variables de Entorno

Crear archivo `.env` con:

```env
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

### Instalación

```bash
# Instalar dependencias
npm install

# Iniciar en desarrollo
npm start

# Ejecutar en web
npm run web

# Ejecutar en iOS
npm run ios

# Ejecutar en Android
npm run android
```

### Configuración de Supabase

1. Crear proyecto en Supabase
2. Ejecutar migraciones SQL (ver `/supabase/migrations/`)
3. Configurar secrets:

```bash
supabase secrets set MERCADOPAGO_ACCESS_TOKEN="tu-token-de-produccion"
```

4. Desplegar Edge Functions:

```bash
supabase functions deploy create-mp-preference
supabase functions deploy mp-webhook
supabase functions deploy sync-stores
```

### Configuración de MercadoPago

1. Crear aplicación en https://www.mercadopago.cl/developers
2. Activar credenciales de producción
3. Configurar webhook: `https://tu-proyecto.supabase.co/functions/v1/mp-webhook`
4. Eventos: `Pagos`

## 📊 Base de Datos

### Tablas Principales

- `stores` - Tiendas Shopify conectadas
- `transactions` - Transacciones de pago
- `shopify_orders` - Órdenes creadas en Shopify
- `user_profiles` - Perfiles de usuarios (próximamente)
- `store_subscriptions` - Suscripciones de usuarios a tiendas (próximamente)

## 🔐 Seguridad

- ✅ Credenciales de MercadoPago en secrets de Supabase
- ✅ Tokens de Shopify encriptados en DB
- ✅ Webhooks sin autenticación pública (JWT desactivado)
- ✅ Validación de stock antes de pagar
- ✅ Row Level Security (RLS) en Supabase

## 📱 Calidad de Integración MercadoPago

**Puntuación: 100/100** ✅

Mejores prácticas implementadas:
- Items detallados con IDs, descripciones y categorías
- Información completa del pagador (nombre, apellido, email, teléfono)
- statement_descriptor para evitar contracargos
- notification_url configurada
- external_reference para tracking

## 🤝 Contribuir

Este es un proyecto privado. Para contribuir, contacta al equipo.

## 📄 Licencia

Propietario - Todos los derechos reservados

## 📞 Soporte

Para soporte técnico o consultas, contacta al equipo de desarrollo.
