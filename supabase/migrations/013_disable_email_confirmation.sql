-- =====================================================
-- MIGRATION 013: Deshabilitar confirmación de email (development)
-- =====================================================
-- NOTA: Esto se debe hacer via Supabase Dashboard en:
-- Authentication > Providers > Email > Disable "Confirm email"
-- =====================================================

-- Esta query es solo para documentación
-- La configuración real está en auth.config que no podemos modificar vía SQL

-- Para verificar usuarios sin confirmar:
SELECT
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE
    WHEN email_confirmed_at IS NULL THEN '❌ Email NO confirmado'
    ELSE '✅ Email confirmado'
  END as status
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

SELECT '⚠️  IMPORTANTE: Desactiva "Email confirmations" en Dashboard > Auth > Providers > Email' as instrucciones;
