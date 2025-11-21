-- =====================================================
-- MIGRATION 003: Create auth.users triggers
-- =====================================================
-- IMPORTANTE: Este trigger debe ejecutarse con permisos de superusuario
-- Si falla, usar Database Webhooks en el Dashboard
-- =====================================================

-- Trigger para crear perfil automáticamente al registrarse
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Comentario
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
  'Crea automáticamente user_profile cuando se registra un nuevo usuario';

SELECT '✅ TRIGGER CREADO EXITOSAMENTE' as status;
