-- =====================================================
-- RPC Function: Get Store Subscribers with Email
-- =====================================================
-- Permite obtener los suscriptores de una tienda incluyendo
-- el email que está en auth.users (inaccesible desde cliente)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_store_subscribers_with_email(
  p_store_domain TEXT
)
RETURNS TABLE (
  subscription_id BIGINT,
  user_id UUID,
  subscribed_at TIMESTAMP WITH TIME ZONE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  platform TEXT,
  push_token_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ss.id AS subscription_id,
    ss.user_id,
    ss.subscribed_at,
    up.full_name,
    up.avatar_url,
    au.email,
    upt.platform,
    COALESCE(upt.is_active, false) AS push_token_active
  FROM public.store_subscriptions ss
  LEFT JOIN public.user_profiles up ON up.id = ss.user_id
  LEFT JOIN auth.users au ON au.id = ss.user_id
  LEFT JOIN LATERAL (
    SELECT platform, is_active
    FROM public.user_push_tokens
    WHERE user_id = ss.user_id AND is_active = true
    ORDER BY last_used_at DESC NULLS LAST
    LIMIT 1
  ) upt ON true
  WHERE ss.store_domain = p_store_domain
    AND ss.unsubscribed_at IS NULL
  ORDER BY ss.subscribed_at DESC;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_store_subscribers_with_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_subscribers_with_email(TEXT) TO service_role;

COMMENT ON FUNCTION public.get_store_subscribers_with_email IS
'Obtiene lista de suscriptores de una tienda con email (de auth.users)';
