-- =====================================================
-- PUSH NOTIFICATIONS SYSTEM
-- Sistema completo de notificaciones push para tiendas
-- =====================================================

-- =====================================================
-- TABLA: push_tokens
-- Almacena tokens de dispositivos para enviar notificaciones
-- =====================================================

CREATE TABLE IF NOT EXISTS push_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE,
  device_id TEXT,
  device_name TEXT,
  device_os TEXT, -- 'ios' | 'android' | 'web'
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para push_tokens
CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_token ON push_tokens(expo_push_token);
CREATE INDEX idx_push_tokens_active ON push_tokens(is_active);

-- RLS para push_tokens
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own push tokens"
  ON push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push tokens"
  ON push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens"
  ON push_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens"
  ON push_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- TABLA: notifications_sent
-- Historial de notificaciones enviadas con analytics
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications_sent (
  id BIGSERIAL PRIMARY KEY,
  store_id TEXT NOT NULL,
  store_name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB, -- Deep link data (product_id, etc)

  -- Analytics
  total_sent INT DEFAULT 0,
  total_delivered INT DEFAULT 0,
  total_opened INT DEFAULT 0,
  total_failed INT DEFAULT 0,

  -- Programación
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Metadata
  sent_by_admin BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para notifications_sent
CREATE INDEX idx_notifications_store_id ON notifications_sent(store_id);
CREATE INDEX idx_notifications_sent_at ON notifications_sent(sent_at DESC);
CREATE INDEX idx_notifications_scheduled_for ON notifications_sent(scheduled_for);
CREATE INDEX idx_notifications_created_at ON notifications_sent(created_at DESC);

-- RLS para notifications_sent (solo admins pueden ver)
ALTER TABLE notifications_sent ENABLE ROW LEVEL SECURITY;

-- Por ahora sin políticas RLS (solo backend puede escribir)
-- Cuando implementes roles de admin, agregarás las políticas aquí

-- =====================================================
-- TABLA: notification_interactions
-- Tracking de interacciones de usuarios con notificaciones
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_interactions (
  id BIGSERIAL PRIMARY KEY,
  notification_id BIGINT REFERENCES notifications_sent(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT,

  -- Tipo de interacción
  interaction_type TEXT NOT NULL, -- 'delivered' | 'opened' | 'failed'
  error_message TEXT, -- Si falló

  -- Timestamp
  interacted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para notification_interactions
CREATE INDEX idx_notif_interactions_notification_id ON notification_interactions(notification_id);
CREATE INDEX idx_notif_interactions_user_id ON notification_interactions(user_id);
CREATE INDEX idx_notif_interactions_type ON notification_interactions(interaction_type);

-- RLS para notification_interactions
ALTER TABLE notification_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification interactions"
  ON notification_interactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification interactions"
  ON notification_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- FUNCIONES
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_push_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_push_notifications_updated_at();

CREATE TRIGGER trigger_update_notifications_sent_updated_at
  BEFORE UPDATE ON notifications_sent
  FOR EACH ROW
  EXECUTE FUNCTION update_push_notifications_updated_at();

-- =====================================================
-- FUNCIÓN: get_store_subscribers
-- Obtiene lista de tokens de suscriptores activos de una tienda
-- =====================================================

CREATE OR REPLACE FUNCTION get_store_subscribers(store_domain TEXT)
RETURNS TABLE (
  user_id UUID,
  expo_push_token TEXT,
  device_os TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    pt.user_id,
    pt.expo_push_token,
    pt.device_os
  FROM push_tokens pt
  INNER JOIN store_subscriptions ss ON pt.user_id = ss.user_id
  WHERE ss.store_domain = store_domain
    AND ss.is_active = true
    AND pt.is_active = true
  ORDER BY pt.last_used_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: get_subscriber_stats
-- Obtiene estadísticas de suscriptores de una tienda
-- =====================================================

CREATE OR REPLACE FUNCTION get_subscriber_stats(
  store_domain TEXT,
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  date DATE,
  new_subscribers INT,
  lost_subscribers INT,
  total_subscribers INT
) AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(start_date::DATE, end_date::DATE, '1 day'::INTERVAL)::DATE AS date
  ),
  new_subs AS (
    SELECT
      created_at::DATE AS date,
      COUNT(*) AS count
    FROM store_subscriptions
    WHERE store_domain = store_domain
      AND is_active = true
      AND created_at >= start_date
      AND created_at <= end_date
    GROUP BY created_at::DATE
  ),
  lost_subs AS (
    SELECT
      updated_at::DATE AS date,
      COUNT(*) AS count
    FROM store_subscriptions
    WHERE store_domain = store_domain
      AND is_active = false
      AND updated_at >= start_date
      AND updated_at <= end_date
    GROUP BY updated_at::DATE
  )
  SELECT
    ds.date,
    COALESCE(ns.count, 0)::INT AS new_subscribers,
    COALESCE(ls.count, 0)::INT AS lost_subscribers,
    (
      SELECT COUNT(*)::INT
      FROM store_subscriptions
      WHERE store_domain = store_domain
        AND is_active = true
        AND created_at <= ds.date
    ) AS total_subscribers
  FROM date_series ds
  LEFT JOIN new_subs ns ON ds.date = ns.date
  LEFT JOIN lost_subs ls ON ds.date = ls.date
  ORDER BY ds.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON TABLE push_tokens IS 'Tokens de dispositivos para notificaciones push';
COMMENT ON TABLE notifications_sent IS 'Historial de notificaciones enviadas con analytics';
COMMENT ON TABLE notification_interactions IS 'Tracking de interacciones de usuarios con notificaciones';
COMMENT ON FUNCTION get_store_subscribers IS 'Obtiene tokens de suscriptores activos de una tienda';
COMMENT ON FUNCTION get_subscriber_stats IS 'Obtiene estadísticas de suscriptores por fecha';
