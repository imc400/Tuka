-- =====================================================
-- MIGRATION 010: Verificar y forzar recreación de policies
-- =====================================================

-- 1. Ver todas las policies actuales
SELECT
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY cmd, policyname;

-- 2. ELIMINAR TODAS las policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated users can insert profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role full access to user_profiles" ON public.user_profiles;

-- 3. Recrear policies desde cero

-- Policy: SELECT - Ver su propio perfil
CREATE POLICY "user_profiles_select_policy"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: INSERT - CUALQUIER usuario autenticado puede insertar
-- (más permisivo, necesario para el registro)
CREATE POLICY "user_profiles_insert_policy"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- ✅ SIN restricción de auth.uid() = id

-- Policy: UPDATE - Solo su propio perfil
CREATE POLICY "user_profiles_update_policy"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: DELETE - Solo su propio perfil
CREATE POLICY "user_profiles_delete_policy"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Service role tiene acceso total
CREATE POLICY "user_profiles_service_role_policy"
  ON public.user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Asegurar que RLS está activo
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 5. Verificar policies creadas
SELECT
  policyname,
  roles,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY cmd, policyname;

-- 6. Verificar que RLS está activo
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_profiles';

SELECT '✅ MIGRACIÓN 010 COMPLETADA - Policies recreadas correctamente' as status;
