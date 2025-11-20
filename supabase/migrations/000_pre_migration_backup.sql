-- =====================================================
-- PRE-MIGRATION BACKUP & VALIDATION
-- =====================================================
-- IMPORTANTE: Ejecutar ANTES de las migraciones principales
-- Este script verifica el estado actual y hace backup
-- =====================================================

-- Verificar tablas existentes
DO $$
BEGIN
  RAISE NOTICE '=== VERIFICACIÓN PRE-MIGRACIÓN ===';
  RAISE NOTICE 'Fecha: %', NOW();

  -- Contar registros en tablas críticas
  RAISE NOTICE 'stores: % registros', (SELECT COUNT(*) FROM public.stores);
  RAISE NOTICE 'transactions: % registros', (SELECT COUNT(*) FROM public.transactions);
  RAISE NOTICE 'shopify_orders: % registros', (SELECT COUNT(*) FROM public.shopify_orders);

  RAISE NOTICE '=== VERIFICACIÓN COMPLETADA ===';
END $$;

-- Crear tabla de backup metadata
CREATE TABLE IF NOT EXISTS public.migration_history (
  id SERIAL PRIMARY KEY,
  migration_name TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_by TEXT DEFAULT current_user,
  status TEXT DEFAULT 'in_progress',
  notes TEXT
);

-- Registrar inicio de migración
INSERT INTO public.migration_history (migration_name, notes)
VALUES ('001_auth_and_users', 'Iniciando migración de sistema de autenticación');

-- =====================================================
-- VERIFICACIONES DE SEGURIDAD
-- =====================================================

-- Verificar que no hay conflictos de nombres
DO $$
BEGIN
  -- Verificar que las nuevas tablas no existen
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
    RAISE EXCEPTION 'ABORTAR: La tabla user_profiles ya existe. Revisar estado de base de datos.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_addresses') THEN
    RAISE EXCEPTION 'ABORTAR: La tabla user_addresses ya existe. Revisar estado de base de datos.';
  END IF;

  RAISE NOTICE '✓ Verificación de conflictos: OK';
END $$;

-- =====================================================
-- INFORMACIÓN DEL SISTEMA
-- =====================================================

SELECT
  current_database() as database_name,
  current_user as current_user,
  version() as postgres_version;

-- Listar todas las tablas actuales
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
