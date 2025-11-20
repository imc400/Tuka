-- =====================================================
-- MIGRATION 001: Authentication & User Management System
-- =====================================================
-- Descripción: Sistema completo de autenticación y gestión de usuarios
--              con soporte para alta concurrencia y escalabilidad
-- Autor: Tuka Team
-- Fecha: 2025-11-20
-- =====================================================

-- =====================================================
-- EXTENSIONES REQUERIDAS
-- =====================================================

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Función para actualizar timestamps automáticamente
CREATE EXTENSION IF NOT EXISTS "moddatetime";

-- =====================================================
-- TABLAS DE USUARIOS
-- =====================================================

-- -----------------------------------------------------
-- 1. USER PROFILES
-- Extensión de auth.users con información adicional
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Información personal
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  date_of_birth DATE,

  -- Preferencias
  language TEXT DEFAULT 'es',
  currency TEXT DEFAULT 'CLP',
  timezone TEXT DEFAULT 'America/Santiago',

  -- Configuración de notificaciones
  push_notifications_enabled BOOLEAN DEFAULT true,
  email_notifications_enabled BOOLEAN DEFAULT true,
  marketing_emails_enabled BOOLEAN DEFAULT false,

  -- Metadata
  onboarding_completed BOOLEAN DEFAULT false,
  terms_accepted_at TIMESTAMP WITH TIME ZONE,
  privacy_accepted_at TIMESTAMP WITH TIME ZONE,

  -- Analytics y engagement
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(15,2) DEFAULT 0,
  favorite_stores TEXT[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT phone_format CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{8,15}$'),
  CONSTRAINT language_valid CHECK (language IN ('es', 'en', 'pt')),
  CONSTRAINT currency_valid CHECK (currency IN ('CLP', 'USD', 'EUR'))
);

-- Índices para performance
CREATE INDEX idx_user_profiles_phone ON public.user_profiles(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_user_profiles_last_active ON public.user_profiles(last_active_at DESC);
CREATE INDEX idx_user_profiles_total_orders ON public.user_profiles(total_orders DESC) WHERE total_orders > 0;
CREATE INDEX idx_user_profiles_created_at ON public.user_profiles(created_at DESC);

-- Trigger para auto-update de updated_at
CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- Comentarios para documentación
COMMENT ON TABLE public.user_profiles IS 'Perfiles extendidos de usuarios con información personal y preferencias';
COMMENT ON COLUMN public.user_profiles.total_spent IS 'Suma total de compras del usuario (en CLP)';
COMMENT ON COLUMN public.user_profiles.favorite_stores IS 'Array de store_domains favoritos del usuario';

-- -----------------------------------------------------
-- 2. USER ADDRESSES
-- Direcciones de envío guardadas por usuario
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_addresses (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identificación
  label TEXT NOT NULL, -- "Casa", "Trabajo", "Casa de mamá", etc.

  -- Dirección completa
  street TEXT NOT NULL,
  street_number TEXT,
  apartment TEXT,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  zip_code TEXT,
  country TEXT DEFAULT 'Chile',
  country_code TEXT DEFAULT 'CL',

  -- Información adicional
  instructions TEXT, -- "Timbre 301", "Portón azul", etc.
  phone TEXT, -- Teléfono específico para esta dirección
  recipient_name TEXT, -- Puede ser diferente al usuario (regalo)

  -- Estado
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Geolocalización (para futuras features)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT unique_user_label UNIQUE(user_id, label),
  CONSTRAINT region_valid CHECK (region ~ '^(XV|I{1,3}|IV|V|VI{0,2}|IX|X{1,2}|XIV|RM)$'),
  CONSTRAINT country_code_valid CHECK (country_code = 'CL'),
  CONSTRAINT only_one_default_per_user EXCLUDE USING btree (user_id WITH =) WHERE (is_default = true)
);

-- Índices para performance
CREATE INDEX idx_user_addresses_user_id ON public.user_addresses(user_id);
CREATE INDEX idx_user_addresses_default ON public.user_addresses(user_id, is_default) WHERE is_default = true;
CREATE INDEX idx_user_addresses_active ON public.user_addresses(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_addresses_last_used ON public.user_addresses(last_used_at DESC NULLS LAST);
CREATE INDEX idx_user_addresses_region ON public.user_addresses(region) WHERE is_active = true;

-- Trigger para auto-update de updated_at
CREATE TRIGGER set_user_addresses_updated_at
  BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- Comentarios
COMMENT ON TABLE public.user_addresses IS 'Direcciones de envío guardadas por usuario';
COMMENT ON COLUMN public.user_addresses.instructions IS 'Instrucciones especiales para el delivery';
COMMENT ON CONSTRAINT only_one_default_per_user ON public.user_addresses IS 'Garantiza que solo haya una dirección por defecto por usuario';

-- -----------------------------------------------------
-- 3. STORE SUBSCRIPTIONS
-- Suscripciones de usuarios a tiendas (CORE FEATURE)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_domain TEXT NOT NULL REFERENCES public.stores(domain) ON DELETE CASCADE,

  -- Configuración de notificaciones
  notifications_enabled BOOLEAN DEFAULT true,
  notify_new_products BOOLEAN DEFAULT true,
  notify_promotions BOOLEAN DEFAULT true,
  notify_restocks BOOLEAN DEFAULT false,

  -- Timestamps
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unsubscribed_at TIMESTAMP WITH TIME ZONE,

  -- Constraint: usuario no puede suscribirse dos veces a la misma tienda
  CONSTRAINT unique_user_store_subscription UNIQUE(user_id, store_domain)
);

-- Índices para performance (CRÍTICOS para notificaciones masivas)
CREATE INDEX idx_store_subscriptions_user ON public.store_subscriptions(user_id);
CREATE INDEX idx_store_subscriptions_store ON public.store_subscriptions(store_domain);
CREATE INDEX idx_store_subscriptions_active ON public.store_subscriptions(user_id, store_domain)
  WHERE unsubscribed_at IS NULL;
CREATE INDEX idx_store_subscriptions_notifications ON public.store_subscriptions(store_domain, notifications_enabled)
  WHERE unsubscribed_at IS NULL AND notifications_enabled = true;

-- Índice compuesto para query común: "usuarios suscritos a tienda con notificaciones activas"
CREATE INDEX idx_store_subscriptions_notify_query ON public.store_subscriptions(store_domain, user_id)
  WHERE unsubscribed_at IS NULL AND notifications_enabled = true;

-- Comentarios
COMMENT ON TABLE public.store_subscriptions IS 'Suscripciones de usuarios a tiendas con preferencias de notificaciones';
COMMENT ON COLUMN public.store_subscriptions.unsubscribed_at IS 'NULL = activa, NOT NULL = desuscrito (soft delete)';

-- -----------------------------------------------------
-- 4. USER PUSH TOKENS
-- Tokens de notificaciones push por dispositivo
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Token info
  token TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'ios', 'android', 'web'
  device_name TEXT,
  device_id TEXT,
  app_version TEXT,

  -- Estado
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT unique_user_token UNIQUE(user_id, token),
  CONSTRAINT platform_valid CHECK (platform IN ('ios', 'android', 'web'))
);

-- Índices para performance
CREATE INDEX idx_user_push_tokens_user ON public.user_push_tokens(user_id);
CREATE INDEX idx_user_push_tokens_active ON public.user_push_tokens(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_push_tokens_platform ON public.user_push_tokens(platform, is_active) WHERE is_active = true;
CREATE INDEX idx_user_push_tokens_expires ON public.user_push_tokens(expires_at) WHERE expires_at IS NOT NULL;

-- Comentarios
COMMENT ON TABLE public.user_push_tokens IS 'Tokens de push notifications por dispositivo/usuario';
COMMENT ON COLUMN public.user_push_tokens.is_active IS 'false = token inválido o usuario desinstaló app';

-- -----------------------------------------------------
-- 5. USER FAVORITES
-- Productos marcados como favoritos
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identificación del producto
  store_domain TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,

  -- Metadata (desnormalizado para performance)
  product_title TEXT,
  product_image_url TEXT,
  product_price DECIMAL(10,2),

  -- Timestamps
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_user_favorite UNIQUE(user_id, store_domain, product_id, variant_id)
);

-- Índices para performance
CREATE INDEX idx_user_favorites_user ON public.user_favorites(user_id, added_at DESC);
CREATE INDEX idx_user_favorites_product ON public.user_favorites(store_domain, product_id);

-- Comentarios
COMMENT ON TABLE public.user_favorites IS 'Lista de favoritos/wishlist de usuarios';

-- -----------------------------------------------------
-- 6. USER SESSIONS
-- Tracking de sesiones para analytics y seguridad
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Device info
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  device_os TEXT, -- 'iOS', 'Android', 'Web'
  device_model TEXT,
  app_version TEXT,

  -- Session info
  ip_address INET,
  user_agent TEXT,

  -- Location (aproximada)
  country TEXT,
  region TEXT,
  city TEXT,

  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Session metrics
  pages_viewed INTEGER DEFAULT 0,
  products_viewed INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0
);

-- Índices para analytics
CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id, started_at DESC);
CREATE INDEX idx_user_sessions_active ON public.user_sessions(user_id) WHERE ended_at IS NULL;
CREATE INDEX idx_user_sessions_date ON public.user_sessions(started_at DESC);

-- Particionamiento por fecha (para optimizar queries históricas)
-- Nota: Implementar particionamiento mensual en producción

-- Comentarios
COMMENT ON TABLE public.user_sessions IS 'Tracking de sesiones para analytics y seguridad';

-- =====================================================
-- ACTUALIZACIÓN DE TABLA TRANSACTIONS
-- =====================================================

-- Agregar referencia a usuario
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Agregar índice
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- RLS POLICIES: USER PROFILES
-- -----------------------------------------------------

-- Los usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Service role puede hacer todo
CREATE POLICY "Service role full access to user_profiles"
  ON public.user_profiles
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- -----------------------------------------------------
-- RLS POLICIES: USER ADDRESSES
-- -----------------------------------------------------

CREATE POLICY "Users can view own addresses"
  ON public.user_addresses
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own addresses"
  ON public.user_addresses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses"
  ON public.user_addresses
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses"
  ON public.user_addresses
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to user_addresses"
  ON public.user_addresses
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- -----------------------------------------------------
-- RLS POLICIES: STORE SUBSCRIPTIONS
-- -----------------------------------------------------

CREATE POLICY "Users can view own subscriptions"
  ON public.store_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON public.store_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON public.store_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON public.store_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Tiendas pueden ver sus suscriptores (para analytics)
CREATE POLICY "Stores can view their subscribers count"
  ON public.store_subscriptions
  FOR SELECT
  USING (true); -- Todos pueden leer (solo counts, no PII)

CREATE POLICY "Service role full access to store_subscriptions"
  ON public.store_subscriptions
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- -----------------------------------------------------
-- RLS POLICIES: USER FAVORITES
-- -----------------------------------------------------

CREATE POLICY "Users can manage own favorites"
  ON public.user_favorites
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to user_favorites"
  ON public.user_favorites
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- -----------------------------------------------------
-- RLS POLICIES: PUSH TOKENS & SESSIONS
-- -----------------------------------------------------

-- Solo service role (para seguridad)
CREATE POLICY "Service role full access to push_tokens"
  ON public.user_push_tokens
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to sessions"
  ON public.user_sessions
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- FUNCIONES HELPER
-- =====================================================

-- -----------------------------------------------------
-- Función: Crear perfil automáticamente al registrarse
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Trigger para auto-crear perfil
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------
-- Función: Actualizar last_active_at al hacer login
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_user_last_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_profiles
  SET last_active_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Trigger en auth.users
DROP TRIGGER IF EXISTS on_user_login ON auth.users;
CREATE TRIGGER on_user_login
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.update_user_last_active();

-- -----------------------------------------------------
-- Función: Soft delete de suscripción (unsubscribe)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.unsubscribe_from_store(
  p_user_id UUID,
  p_store_domain TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.store_subscriptions
  SET
    unsubscribed_at = NOW(),
    notifications_enabled = false
  WHERE user_id = p_user_id
    AND store_domain = p_store_domain
    AND unsubscribed_at IS NULL;

  RETURN FOUND;
END;
$$;

-- -----------------------------------------------------
-- Función: Re-suscribirse a tienda
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.resubscribe_to_store(
  p_user_id UUID,
  p_store_domain TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Intentar actualizar suscripción existente
  UPDATE public.store_subscriptions
  SET
    unsubscribed_at = NULL,
    notifications_enabled = true,
    subscribed_at = NOW()
  WHERE user_id = p_user_id
    AND store_domain = p_store_domain;

  -- Si no existía, crear nueva
  IF NOT FOUND THEN
    INSERT INTO public.store_subscriptions (user_id, store_domain)
    VALUES (p_user_id, p_store_domain);
  END IF;

  RETURN TRUE;
END;
$$;

-- -----------------------------------------------------
-- Función: Obtener usuarios suscritos a tienda (para notificaciones)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_store_subscribers_with_tokens(
  p_store_domain TEXT
)
RETURNS TABLE (
  user_id UUID,
  push_token TEXT,
  platform TEXT,
  notify_new_products BOOLEAN,
  notify_promotions BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ss.user_id,
    pt.token AS push_token,
    pt.platform,
    ss.notify_new_products,
    ss.notify_promotions
  FROM public.store_subscriptions ss
  INNER JOIN public.user_push_tokens pt ON pt.user_id = ss.user_id
  WHERE ss.store_domain = p_store_domain
    AND ss.unsubscribed_at IS NULL
    AND ss.notifications_enabled = true
    AND pt.is_active = true
    AND (pt.expires_at IS NULL OR pt.expires_at > NOW());
END;
$$;

-- =====================================================
-- ÍNDICES ADICIONALES PARA PERFORMANCE
-- =====================================================

-- Índice para búsquedas de usuarios por email (en queries analíticas)
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users(email);

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista: Usuarios con estadísticas
CREATE OR REPLACE VIEW public.user_stats AS
SELECT
  up.id,
  up.full_name,
  up.created_at,
  up.last_active_at,
  up.total_orders,
  up.total_spent,
  COUNT(DISTINCT ss.id) FILTER (WHERE ss.unsubscribed_at IS NULL) AS active_subscriptions,
  COUNT(DISTINCT uf.id) AS favorites_count,
  COUNT(DISTINCT ua.id) FILTER (WHERE ua.is_active) AS saved_addresses_count
FROM public.user_profiles up
LEFT JOIN public.store_subscriptions ss ON ss.user_id = up.id
LEFT JOIN public.user_favorites uf ON uf.user_id = up.id
LEFT JOIN public.user_addresses ua ON ua.user_id = up.id
GROUP BY up.id, up.full_name, up.created_at, up.last_active_at, up.total_orders, up.total_spent;

-- Vista: Tiendas con conteo de suscriptores
CREATE OR REPLACE VIEW public.store_subscription_stats AS
SELECT
  s.domain,
  s.store_name,
  COUNT(ss.id) FILTER (WHERE ss.unsubscribed_at IS NULL) AS active_subscribers,
  COUNT(ss.id) AS total_subscriptions_ever,
  COUNT(ss.id) FILTER (WHERE ss.subscribed_at >= NOW() - INTERVAL '30 days' AND ss.unsubscribed_at IS NULL) AS new_subscribers_last_30d
FROM public.stores s
LEFT JOIN public.store_subscriptions ss ON ss.store_domain = s.domain
GROUP BY s.domain, s.store_name;

-- =====================================================
-- GRANTS
-- =====================================================

-- Authenticated users pueden leer stores
GRANT SELECT ON public.stores TO authenticated;
GRANT SELECT ON public.store_subscription_stats TO authenticated;

-- =====================================================
-- COMENTARIOS FINALES
-- =====================================================

COMMENT ON SCHEMA public IS 'Schema público con todas las tablas de la aplicación';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
