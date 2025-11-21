-- =====================================================
-- MIGRATION 001: Authentication & User Management System (FIXED)
-- =====================================================
-- NOTA: Esta versión omite los triggers en auth.users que requieren
--       permisos de superusuario. Los crearemos via Dashboard después.
-- =====================================================

-- =====================================================
-- EXTENSIONES REQUERIDAS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "moddatetime";

-- =====================================================
-- TABLAS DE USUARIOS
-- =====================================================

-- -----------------------------------------------------
-- 1. USER PROFILES
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  date_of_birth DATE,
  language TEXT DEFAULT 'es',
  currency TEXT DEFAULT 'CLP',
  timezone TEXT DEFAULT 'America/Santiago',
  push_notifications_enabled BOOLEAN DEFAULT true,
  email_notifications_enabled BOOLEAN DEFAULT true,
  marketing_emails_enabled BOOLEAN DEFAULT false,
  onboarding_completed BOOLEAN DEFAULT false,
  terms_accepted_at TIMESTAMP WITH TIME ZONE,
  privacy_accepted_at TIMESTAMP WITH TIME ZONE,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(15,2) DEFAULT 0,
  favorite_stores TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT phone_format CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{8,15}$'),
  CONSTRAINT language_valid CHECK (language IN ('es', 'en', 'pt')),
  CONSTRAINT currency_valid CHECK (currency IN ('CLP', 'USD', 'EUR'))
);

CREATE INDEX idx_user_profiles_phone ON public.user_profiles(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_user_profiles_last_active ON public.user_profiles(last_active_at DESC);
CREATE INDEX idx_user_profiles_total_orders ON public.user_profiles(total_orders DESC) WHERE total_orders > 0;
CREATE INDEX idx_user_profiles_created_at ON public.user_profiles(created_at DESC);

CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

COMMENT ON TABLE public.user_profiles IS 'Perfiles extendidos de usuarios con información personal y preferencias';

-- -----------------------------------------------------
-- 2. USER ADDRESSES
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_addresses (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  street TEXT NOT NULL,
  street_number TEXT,
  apartment TEXT,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  zip_code TEXT,
  country TEXT DEFAULT 'Chile',
  country_code TEXT DEFAULT 'CL',
  instructions TEXT,
  phone TEXT,
  recipient_name TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_user_label UNIQUE(user_id, label),
  CONSTRAINT region_valid CHECK (region ~ '^(XV|I{1,3}|IV|V|VI{0,2}|IX|X{1,2}|XIV|RM)$'),
  CONSTRAINT country_code_valid CHECK (country_code = 'CL'),
  CONSTRAINT only_one_default_per_user EXCLUDE USING btree (user_id WITH =) WHERE (is_default = true)
);

CREATE INDEX idx_user_addresses_user_id ON public.user_addresses(user_id);
CREATE INDEX idx_user_addresses_default ON public.user_addresses(user_id, is_default) WHERE is_default = true;
CREATE INDEX idx_user_addresses_active ON public.user_addresses(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_addresses_last_used ON public.user_addresses(last_used_at DESC NULLS LAST);
CREATE INDEX idx_user_addresses_region ON public.user_addresses(region) WHERE is_active = true;

CREATE TRIGGER set_user_addresses_updated_at
  BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

COMMENT ON TABLE public.user_addresses IS 'Direcciones de envío guardadas por usuario';

-- -----------------------------------------------------
-- 3. STORE SUBSCRIPTIONS (CORE FEATURE)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_domain TEXT NOT NULL REFERENCES public.stores(domain) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT true,
  notify_new_products BOOLEAN DEFAULT true,
  notify_promotions BOOLEAN DEFAULT true,
  notify_restocks BOOLEAN DEFAULT false,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_user_store_subscription UNIQUE(user_id, store_domain)
);

CREATE INDEX idx_store_subscriptions_user ON public.store_subscriptions(user_id);
CREATE INDEX idx_store_subscriptions_store ON public.store_subscriptions(store_domain);
CREATE INDEX idx_store_subscriptions_active ON public.store_subscriptions(user_id, store_domain)
  WHERE unsubscribed_at IS NULL;
CREATE INDEX idx_store_subscriptions_notifications ON public.store_subscriptions(store_domain, notifications_enabled)
  WHERE unsubscribed_at IS NULL AND notifications_enabled = true;
CREATE INDEX idx_store_subscriptions_notify_query ON public.store_subscriptions(store_domain, user_id)
  WHERE unsubscribed_at IS NULL AND notifications_enabled = true;

COMMENT ON TABLE public.store_subscriptions IS 'Suscripciones de usuarios a tiendas con preferencias de notificaciones';

-- -----------------------------------------------------
-- 4. USER PUSH TOKENS
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  device_name TEXT,
  device_id TEXT,
  app_version TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_user_token UNIQUE(user_id, token),
  CONSTRAINT platform_valid CHECK (platform IN ('ios', 'android', 'web'))
);

CREATE INDEX idx_user_push_tokens_user ON public.user_push_tokens(user_id);
CREATE INDEX idx_user_push_tokens_active ON public.user_push_tokens(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_push_tokens_platform ON public.user_push_tokens(platform, is_active) WHERE is_active = true;
CREATE INDEX idx_user_push_tokens_expires ON public.user_push_tokens(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE public.user_push_tokens IS 'Tokens de push notifications por dispositivo/usuario';

-- -----------------------------------------------------
-- 5. USER FAVORITES
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_domain TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  product_title TEXT,
  product_image_url TEXT,
  product_price DECIMAL(10,2),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_favorite UNIQUE(user_id, store_domain, product_id, variant_id)
);

CREATE INDEX idx_user_favorites_user ON public.user_favorites(user_id, added_at DESC);
CREATE INDEX idx_user_favorites_product ON public.user_favorites(store_domain, product_id);

COMMENT ON TABLE public.user_favorites IS 'Lista de favoritos/wishlist de usuarios';

-- -----------------------------------------------------
-- 6. USER SESSIONS
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_type TEXT,
  device_os TEXT,
  device_model TEXT,
  app_version TEXT,
  ip_address INET,
  user_agent TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pages_viewed INTEGER DEFAULT 0,
  products_viewed INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0
);

CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id, started_at DESC);
CREATE INDEX idx_user_sessions_active ON public.user_sessions(user_id) WHERE ended_at IS NULL;
CREATE INDEX idx_user_sessions_date ON public.user_sessions(started_at DESC);

COMMENT ON TABLE public.user_sessions IS 'Tracking de sesiones para analytics y seguridad';

-- =====================================================
-- ACTUALIZAR TABLA TRANSACTIONS
-- =====================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Service role full access to user_profiles"
  ON public.user_profiles FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- User Addresses Policies
CREATE POLICY "Users can view own addresses"
  ON public.user_addresses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own addresses"
  ON public.user_addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses"
  ON public.user_addresses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses"
  ON public.user_addresses FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to user_addresses"
  ON public.user_addresses FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Store Subscriptions Policies
CREATE POLICY "Users can view own subscriptions"
  ON public.store_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON public.store_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON public.store_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON public.store_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Stores can view their subscribers count"
  ON public.store_subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Service role full access to store_subscriptions"
  ON public.store_subscriptions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- User Favorites Policies
CREATE POLICY "Users can manage own favorites"
  ON public.user_favorites FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to user_favorites"
  ON public.user_favorites FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Push Tokens & Sessions (Service role only)
CREATE POLICY "Service role full access to push_tokens"
  ON public.user_push_tokens FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to sessions"
  ON public.user_sessions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- FUNCIONES HELPER
-- =====================================================

-- Función: Crear perfil automáticamente al registrarse
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

-- NOTA: El trigger on_auth_user_created debe crearse via Dashboard de Supabase
-- debido a restricciones de permisos

-- Función: Soft delete de suscripción
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
  SET unsubscribed_at = NOW(), notifications_enabled = false
  WHERE user_id = p_user_id AND store_domain = p_store_domain AND unsubscribed_at IS NULL;
  RETURN FOUND;
END;
$$;

-- Función: Re-suscribirse a tienda
CREATE OR REPLACE FUNCTION public.resubscribe_to_store(
  p_user_id UUID,
  p_store_domain TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.store_subscriptions
  SET unsubscribed_at = NULL, notifications_enabled = true, subscribed_at = NOW()
  WHERE user_id = p_user_id AND store_domain = p_store_domain;
  IF NOT FOUND THEN
    INSERT INTO public.store_subscriptions (user_id, store_domain)
    VALUES (p_user_id, p_store_domain);
  END IF;
  RETURN TRUE;
END;
$$;

-- Función: Obtener usuarios suscritos con tokens
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
  SELECT ss.user_id, pt.token AS push_token, pt.platform, ss.notify_new_products, ss.notify_promotions
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
-- VISTAS ÚTILES
-- =====================================================

CREATE OR REPLACE VIEW public.user_stats AS
SELECT
  up.id, up.full_name, up.created_at, up.last_active_at, up.total_orders, up.total_spent,
  COUNT(DISTINCT ss.id) FILTER (WHERE ss.unsubscribed_at IS NULL) AS active_subscriptions,
  COUNT(DISTINCT uf.id) AS favorites_count,
  COUNT(DISTINCT ua.id) FILTER (WHERE ua.is_active) AS saved_addresses_count
FROM public.user_profiles up
LEFT JOIN public.store_subscriptions ss ON ss.user_id = up.id
LEFT JOIN public.user_favorites uf ON uf.user_id = up.id
LEFT JOIN public.user_addresses ua ON ua.user_id = up.id
GROUP BY up.id, up.full_name, up.created_at, up.last_active_at, up.total_orders, up.total_spent;

CREATE OR REPLACE VIEW public.store_subscription_stats AS
SELECT
  s.domain, s.store_name,
  COUNT(ss.id) FILTER (WHERE ss.unsubscribed_at IS NULL) AS active_subscribers,
  COUNT(ss.id) AS total_subscriptions_ever,
  COUNT(ss.id) FILTER (WHERE ss.subscribed_at >= NOW() - INTERVAL '30 days' AND ss.unsubscribed_at IS NULL) AS new_subscribers_last_30d
FROM public.stores s
LEFT JOIN public.store_subscriptions ss ON ss.store_domain = s.domain
GROUP BY s.domain, s.store_name;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT ON public.stores TO authenticated;
GRANT SELECT ON public.store_subscription_stats TO authenticated;

-- =====================================================
-- ACTUALIZAR MIGRATION HISTORY
-- =====================================================

UPDATE public.migration_history
SET status = 'completed', notes = 'Migración 001 completada (sin triggers en auth.users)'
WHERE migration_name = '001_auth_and_users';

SELECT '✅ MIGRACIÓN 001 COMPLETADA' as status;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
