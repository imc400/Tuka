-- =====================================================
-- MIGRATION 007: Verificar y limpiar trigger problemático
-- =====================================================

-- 1. Ver si el trigger se creó en auth.users (esto causaría el error)
SELECT
  trigger_schema,
  trigger_name,
  event_object_schema,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 2. Intentar eliminar el trigger de auth.users si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Verificar que se eliminó
SELECT
  trigger_schema,
  trigger_name,
  event_object_schema,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

SELECT '✅ Trigger verificado y limpiado' as status;
