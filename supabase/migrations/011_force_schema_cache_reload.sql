-- =====================================================
-- MIGRATION 011: Forzar recarga del schema cache
-- =====================================================

-- Supabase usa PostgREST que tiene un schema cache
-- Necesitamos notificar que el schema cambió

-- 1. Notificar a PostgREST que recargue el schema
NOTIFY pgrst, 'reload schema';

-- 2. También podemos forzar un cambio en la tabla para invalidar cache
COMMENT ON TABLE public.user_profiles IS 'User profiles with extended information - Updated 2025-11-20';

-- 3. Verificar policies están activas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY cmd, policyname;

SELECT '✅ Schema cache reload solicitado' as status;
