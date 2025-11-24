# ShopUnite Marketplace

**Versión:** 1.0.0
**Última actualización:** 2025-11-24
**Bundle ID:** com.shopunite.marketplace
**App Store Connect ID:** 6755695544

---

## 📱 ¿Qué es ShopUnite?

ShopUnite es una aplicación móvil marketplace que permite a los usuarios comprar productos de **múltiples tiendas Shopify** con un **único carrito unificado** y **un solo pago**.

Los usuarios pueden agregar productos de diferentes tiendas, pagar una vez con Mercado Pago, y recibir sus pedidos por separado de cada tienda.

### Propuesta de Valor

**Para Compradores:**
- 🛍️ Compra en múltiples tiendas sin cambiar de app
- 💳 Un solo pago para todas tus compras
- 📦 Seguimiento en tiempo real de todos tus pedidos
- ⭐ Descubre nuevas tiendas y productos fácilmente

**Para Vendedores:**
- 📈 Accede a una base de clientes más amplia
- 🛒 Vende más (los clientes no abandonan por múltiples checkouts)
- 🏪 Mantén tu tienda Shopify independiente
- 🔄 Sincronización automática de productos

---

## 🏗️ Arquitectura del Sistema

### Stack Tecnológico

```
Frontend:  React Native + Expo SDK 54 + NativeWind (Tailwind CSS)
Backend:   Supabase (PostgreSQL + Edge Functions)
Auth:      Supabase Auth + Google OAuth + Apple Sign In (próximamente)
Pagos:     Mercado Pago
E-commerce: Shopify Admin API + Storefront API
Push:      Expo Notifications + FCM
Envíos:    Cálculo dinámico vía Shopify Admin API
```

### Flujo de Datos

```
Usuario → React Native App → Supabase Edge Functions → Shopify APIs
                           ↓
                    PostgreSQL (Supabase)
                           ↓
                    Mercado Pago Webhooks
```

---

## 🔑 Componentes Principales

### 1. Conexión de Tiendas Shopify

Las tiendas se conectan mediante un **Dashboard Web** (externo, no incluido en este repo).

#### Tokens Requeridos:

| Token | Permisos | Uso |
|-------|----------|-----|
| **Storefront API Token** | `unauthenticated_read_product_listings` | Leer productos y crear carritos |
| **Admin API Token** | `write_draft_orders`, `read_shipping`, `read_orders` | Crear órdenes y calcular envíos |

#### Tabla `stores`

```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  shopify_domain TEXT NOT NULL UNIQUE, -- tienda.myshopify.com
  storefront_api_token TEXT NOT NULL,
  admin_api_access_token TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Sincronización de Productos

Los productos se sincronizan automáticamente vía **webhooks de Shopify**.

**Webhook URL:**
```
https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/shopify-webhook
```

**Eventos:**
- `products/create` → Crear producto
- `products/update` → Actualizar producto
- `products/delete` → Marcar como no disponible

#### Tabla `products`

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  shopify_product_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  inventory_quantity INTEGER DEFAULT 0,
  available BOOLEAN DEFAULT true,
  UNIQUE(store_id, shopify_product_id)
);
```

### 3. Carrito Unificado

El usuario tiene **UN solo carrito** con productos de múltiples tiendas.

#### Tabla `cart_items`

```sql
CREATE TABLE cart_items (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE(user_id, product_id)
);
```

**Lógica:**
- Productos de N tiendas en un solo carrito
- Al checkout: se crea **una orden por tienda**
- Usuario paga el total (suma de todas las órdenes)
- Cada tienda recibe su orden individualmente en Shopify

### 4. Sistema de Checkout

#### Flujo:

```
1. Usuario → "Proceder al pago"
   ↓
2. App → create-mercadopago-preference (Edge Function)
   ↓
3. Agrupa productos por tienda
   Calcula envíos por tienda (Shopify Admin API)
   Crea preferencia en Mercado Pago
   Guarda orders en "pending"
   ↓
4. Usuario paga en Mercado Pago
   ↓
5. Webhook → mp-webhook (Edge Function)
   ↓
6. Actualiza orders a "processing"
   Crea Draft Order en Shopify (una por tienda)
   Limpia carrito
   Envía notificación push
```

#### Tabla `orders`

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  store_id UUID REFERENCES stores(id),
  mp_payment_id TEXT,
  shopify_order_id TEXT,
  status TEXT DEFAULT 'pending', -- pending | processing | completed | cancelled
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  shipping_address JSONB,
  items JSONB, -- [{product_id, title, price, quantity}, ...]
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. Sistema de Envíos

Los costos se calculan dinámicamente usando **Shopify Admin API**.

**Edge Function:** `calculate-shipping`

**Proceso:**
1. Crea Draft Order temporal en Shopify con productos
2. Aplica dirección de envío
3. Shopify calcula el costo según zonas configuradas en la tienda
4. Lee `shipping_lines` del Draft Order
5. Elimina el Draft Order
6. Retorna opciones de envío

**Input:**
```json
{
  "store_id": "uuid",
  "items": [{"shopify_product_id": "123", "variant_id": "456", "quantity": 2}],
  "shipping_address": {
    "country": "MX",
    "province": "CDMX",
    "city": "Ciudad de México",
    "zip": "06100",
    "address1": "Calle Ejemplo 123"
  }
}
```

**Output:**
```json
{
  "shipping_methods": [
    {"id": "shopify-Standard-12.50", "name": "Standard", "price": 12.50, "currency": "MXN"}
  ]
}
```

**Configuración en Shopify:**
- Settings → Shipping and delivery
- Crear zonas geográficas
- Definir tarifas (flat rate, weight-based, etc.)
- ShopUnite lee automáticamente estas configuraciones

### 6. Autenticación

#### Métodos Disponibles:

1. **Email + Password** (Supabase Auth nativo)
2. **Google OAuth** ✅ (Implementado)
3. **Apple Sign In** 🔄 (Próximamente)

#### Google OAuth Setup

**Credenciales:**
- Web Client ID: `411618353526-e2u2btfioqf9q82ru503msieuefepuqi.apps.googleusercontent.com`
- Callback URL: `https://kscgibfmxnyfjxpcwoac.supabase.co/auth/v1/callback`

**Archivos clave:**
- `src/services/authService.ts` → Funciones `signInWithGoogle()`, `configureGoogleSignIn()`
- `App.tsx` → Configuración inicial
- `src/screens/LoginScreen.tsx` y `SignUpScreen.tsx` → Botones de Google

**Documentación completa:** Ver `GOOGLE_OAUTH_SETUP.md`

#### Tabla `user_profiles`

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  last_active TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7. Notificaciones Push

Se envían cuando:
- ✅ Pago confirmado
- ✅ Orden procesada
- 🔄 Orden enviada (próximamente)
- 🔄 Orden entregada (próximamente)

#### Tabla `user_push_tokens`

```sql
CREATE TABLE user_push_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Edge Function:** `send-notification`
- Envía vía Expo Push Notifications API
- Soporta múltiples dispositivos por usuario

---

## 🚀 Edge Functions (Supabase)

### 1. `create-mercadopago-preference`

Crea preferencia de pago en Mercado Pago.

**Proceso:**
1. Lee cart_items del usuario (auth vía JWT)
2. Agrupa por tienda
3. Calcula shipping por tienda
4. Crea preference en Mercado Pago
5. Crea orders en "pending"
6. Retorna preference_id

### 2. `mp-webhook`

Procesa notificaciones de pago de Mercado Pago.

**Proceso:**
1. Valida webhook signature
2. Busca orders por mp_payment_id
3. Si pago aprobado:
   - Actualiza orders a "processing"
   - Crea Draft Order en Shopify por tienda
   - Limpia carrito
   - Envía notificación push

### 3. `calculate-shipping`

Calcula costos de envío vía Shopify Admin API.

**Proceso:**
1. Obtiene admin_api_access_token de la tienda
2. Crea Draft Order temporal en Shopify
3. Aplica dirección de envío
4. Lee shipping_lines (Shopify calcula automáticamente)
5. Elimina Draft Order
6. Retorna opciones

### 4. `shopify-webhook`

Sincroniza productos desde Shopify.

**Eventos:**
- `products/create` → Crea en Supabase
- `products/update` → Actualiza en Supabase
- `products/delete` → Marca como no disponible

### 5. `send-notification`

Envía notificaciones push a usuarios.

**Input:**
```json
{
  "user_id": "uuid",
  "title": "Pago confirmado",
  "body": "Tu orden está siendo procesada",
  "data": {"order_id": "uuid"}
}
```

---

## 📊 Base de Datos (Supabase)

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `stores` | Tiendas Shopify conectadas |
| `products` | Productos sincronizados |
| `user_profiles` | Perfiles de usuarios |
| `cart_items` | Carrito de compras |
| `orders` | Órdenes de compra |
| `user_push_tokens` | Tokens de notificaciones |
| `favorites` | Productos favoritos |

### Migraciones

Las migraciones están en `supabase/migrations/`:

1. `001_initial_schema.sql` - Esquema inicial
2. `002_add_favorites.sql` - Sistema de favoritos
3. `003_add_shipping_costs.sql` - Costos de envío en orders
4. `004_add_storefront_api_token.sql` - Token de Storefront API
5. `005_add_admin_api_token.sql` - Token de Admin API

### Row Level Security (RLS)

✅ **RLS habilitado en todas las tablas:**
- Users solo leen sus propios cart_items, orders, favorites
- Users leen todos los products y stores (públicos)
- Solo service role modifica stores y products

---

## 🔧 Configuración del Proyecto

### Variables de Entorno (`.env.local`)

```bash
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://kscgibfmxnyfjxpcwoac.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Google OAuth
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=411618353526-e2u2btfioqf9q82ru503msieuefepuqi.apps.googleusercontent.com

# Mercado Pago
EXPO_PUBLIC_MP_PUBLIC_KEY=your-mp-public-key

# Gemini AI (opcional)
GEMINI_API_KEY=your-gemini-key
```

### Instalación

```bash
# Instalar dependencias
npm install

# Instalar pods de iOS (solo Mac)
cd ios && pod install && cd ..

# Desarrollo local
npx expo run:ios     # iOS
npx expo run:android # Android

# Expo Go (limitado, sin módulos nativos)
npx expo start
```

### Build para Producción

```bash
# Development Build (testing con módulos nativos)
eas build --profile development --platform ios

# TestFlight Build (beta testing)
eas build --profile testflight --platform ios
eas submit --profile testflight --platform ios --latest

# Production Build (App Store / Play Store)
eas build --profile production --platform all
```

**Configuración:** Ver `eas.json`

---

## 📱 Estructura del Código

```
shopunite-marketplace/
├── src/
│   ├── components/
│   │   ├── ProductCard.tsx
│   │   ├── StoreCard.tsx
│   │   ├── CartItem.tsx
│   │   ├── ShippingSection.tsx
│   │   ├── ShippingMethodSelector.tsx
│   │   ├── WelcomeFlow.tsx
│   │   └── SplashScreen.tsx
│   ├── screens/
│   │   ├── WelcomeScreen.tsx       # Primera pantalla (nuevos usuarios)
│   │   ├── LoginScreen.tsx         # Login (email + Google)
│   │   ├── SignUpScreen.tsx        # Registro (email + Google)
│   │   ├── HomeScreen.tsx          # Explorar productos
│   │   ├── StoresScreen.tsx        # Listado de tiendas
│   │   ├── ProductDetailScreen.tsx
│   │   ├── CartScreen.tsx
│   │   ├── CheckoutScreen.tsx
│   │   ├── OrdersScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── services/
│   │   ├── authService.ts          # Auth (Supabase + Google)
│   │   ├── productService.ts
│   │   ├── cartService.ts
│   │   ├── orderService.ts
│   │   ├── shippingService.ts
│   │   └── notificationService.ts
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       └── supabase.ts
├── supabase/
│   ├── functions/                  # Edge Functions
│   └── migrations/                 # Migraciones SQL
├── App.tsx                         # Entry point
├── app.json                        # Configuración Expo
├── eas.json                        # Configuración EAS Build
└── .env.local                      # Variables de entorno (NO commitear)
```

---

## 🎨 UI/UX

### Diseño

- **Framework:** NativeWind (Tailwind CSS para React Native)
- **Colores:**
  - Primary: Indigo (#4F46E5, #6366F1)
  - Secondary: Púrpura (#7C3AED)
  - Gradientes: Indigo → Púrpura
- **Estilo:**
  - Cards con sombras suaves
  - Bordes redondeados
  - Glassmorphism

### Flujo de Usuario

```
Welcome Screen → Login/SignUp → Home → Carrito → Checkout → Pago → Órdenes
```

---

## 🔒 Seguridad

### Implementado:

- ✅ Row Level Security (RLS) en todas las tablas
- ✅ HTTPS obligatorio
- ✅ Tokens en .env.local (nunca en código)
- ✅ Webhook validation (HMAC para Shopify, signature para Mercado Pago)
- ✅ JWT authentication en Edge Functions
- ✅ Encriptación en tránsito

### Checklist:

- ✅ `.env.local` en `.gitignore`
- ✅ Anon key (solo permite operaciones RLS)
- ✅ Service role key NUNCA en frontend
- ✅ Validación de inputs
- ✅ Rate limiting (Supabase)

---

## 📝 Documentación Adicional

### Archivos en el Proyecto:

- **`DEVELOPMENT_WORKFLOW.md`** - Flujo de desarrollo, builds, comandos
- **`GOOGLE_OAUTH_SETUP.md`** - Setup completo de Google OAuth
- **`GOOGLE_OAUTH_CREDENTIALS.md`** - Credenciales guardadas
- **`SHIPPING_IMPLEMENTATION_GUIDE.md`** - Guía de implementación de envíos
- **`MVP_SHIPPING_READY.md`** - Estado del MVP de envíos
- **`AUTH_IMPROVEMENT_PLAN.md`** - Plan de mejoras de autenticación
- **`ADMIN_API_SETUP.md`** - Configuración de Admin API

### Enlaces Útiles:

- **Supabase:** https://supabase.com/dashboard/project/kscgibfmxnyfjxpcwoac
- **App Store Connect:** https://appstoreconnect.apple.com/apps/6755695544
- **Expo:** https://expo.dev/accounts/nachodev2025/projects/shopunite-marketplace
- **Google Cloud:** https://console.cloud.google.com

---

## 🚀 Roadmap

### ✅ v1.0.0 (Actual)

- Autenticación (email + Google OAuth)
- Catálogo de productos
- Carrito unificado
- Checkout con Mercado Pago
- Cálculo dinámico de envíos
- Sincronización vía webhooks
- Notificaciones push
- Historial de órdenes

### 🔄 v1.1.0 (Próximo)

- Apple Sign In
- Landing page web
- Dashboard web para tiendas
- Sistema de reviews

### 📋 v2.0.0 (Futuro)

- Chat con vendedores
- Seguimiento en tiempo real de envíos
- Programa de lealtad
- Recomendaciones AI
- Más pasarelas de pago

---

## 🤝 Contribución

### Convención de Commits:

```
feat: Nueva funcionalidad
fix: Corrección de bug
docs: Cambios en documentación
style: Formato (no afecta lógica)
refactor: Refactorización
test: Tests
chore: Mantenimiento
```

---

## 📞 Información

**Desarrollador:** Ignacio Blanco
**Email:** igblancora@gmail.com
**Proyecto:** ShopUnite Marketplace
**Versión:** 1.0.0
**Estado:** ✅ En producción (TestFlight)

---

## 📄 Licencia

Propiedad privada. Todos los derechos reservados © 2024 ShopUnite.

---

**Última actualización:** 2025-11-24
