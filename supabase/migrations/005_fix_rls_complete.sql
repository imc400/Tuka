-- =====================================================
-- MIGRATION 005: Fix RLS Completo para user_profiles
-- =====================================================
-- PROBLEMA: Policy de INSERT no funciona correctamente
-- SOLUCIÓN: Eliminar todas las policies y recrearlas correctamente
-- =====================================================

-- 1. Eliminar policies existentes
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role full access to user_profiles" ON public.user_profiles;

-- 2. Recrear policies correctamente

-- Policy: Usuarios pueden INSERTAR su propio perfil
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policy: Usuarios pueden VER su propio perfil
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Usuarios pueden ACTUALIZAR su propio perfil
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Usuarios pueden ELIMINAR su propio perfil
CREATE POLICY "Users can delete own profile"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Service role tiene acceso total
CREATE POLICY "Service role full access to user_profiles"
  ON public.user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Verificar que RLS esté habilitado
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Verificar todas las policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

SELECT '✅ MIGRACIÓN 005 COMPLETADA - RLS configurado correctamente' as status;
