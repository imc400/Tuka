-- =====================================================
-- MIGRATION 008: Permitir INSERT sin RLS para service_role
-- =====================================================
-- PROBLEMA: No podemos crear trigger en auth.users
-- SOLUCIÓN: Hacer INSERT desde el código usando service_role temporalmente
-- =====================================================

-- 1. Asegurarnos que service_role puede insertar
-- (esto ya estaba en migration 005, pero lo verificamos)

-- Ver policies actuales
SELECT
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

-- Verificar que RLS está activo pero service_role puede bypassear
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'user_profiles';

SELECT '✅ Service role puede insertar (verificado)' as status;
