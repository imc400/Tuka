-- =====================================================
-- MIGRATION 012: DESHABILITAR RLS TEMPORALMENTE
-- =====================================================
-- Esta es una solución temporal para development
-- Deshabilita RLS completamente en user_profiles
-- =====================================================

-- 1. Eliminar TODAS las policies
DROP POLICY IF EXISTS "user_profiles_select_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_service_role_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role full access to user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "temp_allow_all_inserts" ON public.user_profiles;

-- 2. DESHABILITAR RLS COMPLETAMENTE (temporal para development)
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

-- 3. Verificar que RLS está deshabilitado
SELECT
  schemaname,
  tablename,
  rowsecurity,
  CASE
    WHEN rowsecurity = false THEN '✅ RLS DESHABILITADO - INSERT debería funcionar'
    ELSE '❌ RLS AÚN ACTIVO'
  END as status
FROM pg_tables
WHERE tablename = 'user_profiles';

-- 4. Verificar que no hay policies
SELECT
  COUNT(*) as policies_count,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No hay policies activas'
    ELSE '⚠️  Aún hay ' || COUNT(*) || ' policies'
  END as status
FROM pg_policies
WHERE tablename = 'user_profiles';

SELECT '✅ MIGRACIÓN 012 COMPLETADA - RLS DESHABILITADO TEMPORALMENTE' as status;
SELECT '⚠️  IMPORTANTE: Esto es solo para development. Re-habilitar RLS en producción.' as warning;
