-- =====================================================
-- MIGRATION 006: Auto-create user profile con trigger
-- =====================================================
-- PROBLEMA: RLS policy bloquea INSERT desde el cliente
-- SOLUCIÓN: Trigger SECURITY DEFINER que crea el perfil automáticamente
-- =====================================================

-- 1. Función que crea el perfil automáticamente
-- SECURITY DEFINER = se ejecuta con privilegios del owner, bypass RLS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    full_name,
    phone,
    email,
    avatar_url,
    total_orders,
    total_spent,
    created_at,
    last_active_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    0,
    0,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- 2. Trigger que se ejecuta DESPUÉS de crear usuario en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Comentario explicativo
COMMENT ON FUNCTION public.handle_new_user IS
  'Automatically creates user_profile when a new user signs up. Uses SECURITY DEFINER to bypass RLS.';

-- 4. Verificar que el trigger se creó
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

SELECT '✅ MIGRACIÓN 006 COMPLETADA - Trigger de auto-creación de perfil configurado' as status;
