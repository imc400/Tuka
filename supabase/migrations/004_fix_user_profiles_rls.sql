-- =====================================================
-- MIGRATION 004: Fix user_profiles RLS for registration
-- =====================================================
-- PROBLEMA: Usuarios no pueden crear su propio perfil al registrarse
-- SOLUCIÓN: Agregar policy de INSERT para usuarios autenticados
-- =====================================================

-- Agregar política para que usuarios puedan crear su propio perfil
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Verificar que todas las policies estén activas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

SELECT '✅ MIGRACIÓN 004 COMPLETADA - Policy de INSERT agregada' as status;
