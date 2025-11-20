-- =====================================================
-- MIGRATION 002: Integrate Existing Tables with Auth
-- =====================================================
-- Descripción: Integra tablas existentes (stores, transactions, etc.)
--              con el nuevo sistema de autenticación
-- Fecha: 2025-11-20
-- =====================================================

-- =====================================================
-- STORES TABLE - Agregar campos de ownership
-- =====================================================

ALTER TABLE IF EXISTS public.stores
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscriber_count INTEGER DEFAULT 0;

-- Índices
CREATE INDEX IF NOT EXISTS idx_stores_created_by ON public.stores(created_by);
CREATE INDEX IF NOT EXISTS idx_stores_verified ON public.stores(is_verified) WHERE is_verified = true;

-- Trigger para actualizar subscriber_count automáticamente
CREATE OR REPLACE FUNCTION public.update_store_subscriber_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.unsubscribed_at IS NULL THEN
    -- Nueva suscripción
    UPDATE public.stores
    SET subscriber_count = subscriber_count + 1
    WHERE domain = NEW.store_domain;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Cambio de estado de suscripción
    IF OLD.unsubscribed_at IS NULL AND NEW.unsubscribed_at IS NOT NULL THEN
      -- Desuscripción
      UPDATE public.stores
      SET subscriber_count = GREATEST(subscriber_count - 1, 0)
      WHERE domain = NEW.store_domain;
    ELSIF OLD.unsubscribed_at IS NOT NULL AND NEW.unsubscribed_at IS NULL THEN
      -- Re-suscripción
      UPDATE public.stores
      SET subscriber_count = subscriber_count + 1
      WHERE domain = NEW.store_domain;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.unsubscribed_at IS NULL THEN
    -- Borrado (edge case)
    UPDATE public.stores
    SET subscriber_count = GREATEST(subscriber_count - 1, 0)
    WHERE domain = OLD.store_domain;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_store_subscriber_count_trigger ON public.store_subscriptions;
CREATE TRIGGER update_store_subscriber_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.store_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_store_subscriber_count();

-- =====================================================
-- TRANSACTIONS TABLE - Mejorar integración con usuarios
-- =====================================================

-- Índices adicionales para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON public.transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status_date ON public.transactions(status, created_at DESC);

-- RLS para transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios pueden ver sus propias transacciones
CREATE POLICY "Users can view own transactions"
  ON public.transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role full access
CREATE POLICY "Service role full access to transactions"
  ON public.transactions
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- SHOPIFY_ORDERS TABLE - Agregar RLS
-- =====================================================

-- Agregar user_id si no existe (via transactions)
ALTER TABLE IF EXISTS public.shopify_orders
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Índice
CREATE INDEX IF NOT EXISTS idx_shopify_orders_user ON public.shopify_orders(user_id);

-- Trigger para auto-poblar user_id desde transaction
CREATE OR REPLACE FUNCTION public.populate_shopify_order_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Obtener user_id desde la transaction relacionada
  SELECT user_id INTO NEW.user_id
  FROM public.transactions
  WHERE id = NEW.transaction_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS populate_shopify_order_user_id_trigger ON public.shopify_orders;
CREATE TRIGGER populate_shopify_order_user_id_trigger
  BEFORE INSERT ON public.shopify_orders
  FOR EACH ROW
  WHEN (NEW.user_id IS NULL)
  EXECUTE FUNCTION public.populate_shopify_order_user_id();

-- RLS
ALTER TABLE public.shopify_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON public.shopify_orders
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to shopify_orders"
  ON public.shopify_orders
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- TRIGGER: Actualizar user_profiles después de compra
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_user_stats_after_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo actualizar si el pago fue aprobado
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE public.user_profiles
    SET
      total_orders = total_orders + 1,
      total_spent = total_spent + NEW.total_amount,
      updated_at = NOW()
    WHERE id = NEW.user_id AND NEW.user_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_user_stats_trigger ON public.transactions;
CREATE TRIGGER update_user_stats_trigger
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_stats_after_purchase();

-- =====================================================
-- VISTAS ADICIONALES
-- =====================================================

-- Vista: Historial de pedidos del usuario con detalles
CREATE OR REPLACE VIEW public.user_order_history AS
SELECT
  t.id AS transaction_id,
  t.user_id,
  t.created_at,
  t.total_amount,
  t.currency,
  t.status,
  t.mp_payment_id,
  t.shipping_address,
  t.buyer_name,
  t.buyer_email,
  t.buyer_phone,
  jsonb_agg(
    jsonb_build_object(
      'store_domain', so.store_domain,
      'shopify_order_number', so.shopify_order_number,
      'shopify_order_id', so.shopify_order_id,
      'order_amount', so.order_amount,
      'status', so.status,
      'synced_at', so.synced_at
    )
  ) AS orders
FROM public.transactions t
LEFT JOIN public.shopify_orders so ON so.transaction_id = t.id
WHERE t.user_id IS NOT NULL
GROUP BY t.id;

COMMENT ON VIEW public.user_order_history IS 'Vista completa del historial de pedidos por usuario';

-- RLS en la vista
ALTER VIEW public.user_order_history SET (security_invoker = on);

-- =====================================================
-- FUNCIONES HELPER PARA USUARIOS
-- =====================================================

-- Función: Obtener estadísticas del usuario
CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_orders', COALESCE(up.total_orders, 0),
    'total_spent', COALESCE(up.total_spent, 0),
    'active_subscriptions', (
      SELECT COUNT(*)
      FROM public.store_subscriptions
      WHERE user_id = p_user_id AND unsubscribed_at IS NULL
    ),
    'saved_addresses', (
      SELECT COUNT(*)
      FROM public.user_addresses
      WHERE user_id = p_user_id AND is_active = true
    ),
    'favorites_count', (
      SELECT COUNT(*)
      FROM public.user_favorites
      WHERE user_id = p_user_id
    ),
    'pending_orders', (
      SELECT COUNT(*)
      FROM public.transactions
      WHERE user_id = p_user_id AND status = 'pending'
    ),
    'last_order_date', (
      SELECT MAX(created_at)
      FROM public.transactions
      WHERE user_id = p_user_id AND status = 'approved'
    )
  ) INTO result
  FROM public.user_profiles up
  WHERE up.id = p_user_id;

  RETURN result;
END;
$$;

-- Función: Obtener últimos pedidos del usuario
CREATE OR REPLACE FUNCTION public.get_user_recent_orders(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  transaction_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  total_amount DECIMAL,
  status TEXT,
  orders_count BIGINT,
  stores TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS transaction_id,
    t.created_at,
    t.total_amount,
    t.status,
    COUNT(so.id) AS orders_count,
    array_agg(DISTINCT so.store_domain) AS stores
  FROM public.transactions t
  LEFT JOIN public.shopify_orders so ON so.transaction_id = t.id
  WHERE t.user_id = p_user_id
  GROUP BY t.id
  ORDER BY t.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Función: Marcar dirección como usada
CREATE OR REPLACE FUNCTION public.mark_address_as_used(p_address_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_addresses
  SET last_used_at = NOW()
  WHERE id = p_address_id;
END;
$$;

-- =====================================================
-- ÍNDICES PARA BÚSQUEDA Y FILTROS
-- =====================================================

-- Para búsqueda de usuarios por nombre o email (admin)
CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name_trgm ON public.user_profiles USING gin(full_name gin_trgm_ops);

-- Nota: Requiere extensión pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Para filtros de fecha en analytics
CREATE INDEX IF NOT EXISTS idx_transactions_created_at_brin ON public.transactions USING brin(created_at);

-- BRIN índices son ultra compactos para columnas ordenadas (timestamps)
-- 1000x más pequeños que B-tree, perfectos para tablas grandes

-- =====================================================
-- POLÍTICAS DE RETENCIÓN (Data Retention)
-- =====================================================

-- Función: Archivar sesiones antiguas
CREATE OR REPLACE FUNCTION public.archive_old_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Archivar sesiones > 90 días a tabla de archivo (opcional)
  -- Por ahora, solo eliminar
  DELETE FROM public.user_sessions
  WHERE started_at < NOW() - INTERVAL '90 days'
  AND ended_at IS NOT NULL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

-- Función: Limpiar tokens push inválidos
CREATE OR REPLACE FUNCTION public.cleanup_invalid_push_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.user_push_tokens
  WHERE (expires_at IS NOT NULL AND expires_at < NOW())
     OR (is_active = false AND last_used_at < NOW() - INTERVAL '30 days');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

-- =====================================================
-- GRANTS ADICIONALES
-- =====================================================

-- Authenticated users pueden llamar a funciones helper
GRANT EXECUTE ON FUNCTION public.get_user_dashboard_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_recent_orders(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_address_as_used(BIGINT) TO authenticated;

-- Service role puede ejecutar limpieza
GRANT EXECUTE ON FUNCTION public.archive_old_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_invalid_push_tokens() TO service_role;

-- =====================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON FUNCTION public.get_user_dashboard_stats(UUID) IS 'Obtiene estadísticas completas del usuario para el dashboard';
COMMENT ON FUNCTION public.get_user_recent_orders(UUID, INTEGER) IS 'Obtiene los últimos N pedidos del usuario';
COMMENT ON FUNCTION public.mark_address_as_used(BIGINT) IS 'Marca una dirección como usada recientemente';
COMMENT ON FUNCTION public.archive_old_sessions() IS 'Archiva sesiones antiguas (>90 días)';
COMMENT ON FUNCTION public.cleanup_invalid_push_tokens() IS 'Elimina tokens push expirados o inválidos';

-- =====================================================
-- SEEDS DE PRUEBA (Solo para desarrollo)
-- =====================================================

-- Descomentar en ambiente de desarrollo
/*
-- Usuario de prueba
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'test@shopunite.cl',
  crypt('test123', gen_salt('bf')),
  NOW(),
  '{"full_name": "Test User", "avatar_url": null}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
*/

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
