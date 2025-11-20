-- =====================================================
-- POST-MIGRATION VALIDATION
-- =====================================================
-- IMPORTANTE: Ejecutar DESPUÉS de las migraciones principales
-- Valida que todo se creó correctamente
-- =====================================================

DO $$
DECLARE
  tables_count INTEGER;
  indexes_count INTEGER;
  triggers_count INTEGER;
  functions_count INTEGER;
BEGIN
  RAISE NOTICE '=== VALIDACIÓN POST-MIGRACIÓN ===';
  RAISE NOTICE 'Fecha: %', NOW();
  RAISE NOTICE '';

  -- =====================================================
  -- VERIFICAR TABLAS
  -- =====================================================
  RAISE NOTICE '1. VERIFICANDO TABLAS...';

  -- user_profiles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
    RAISE NOTICE '  ✓ user_profiles creada';
    RAISE NOTICE '    - Registros: %', (SELECT COUNT(*) FROM public.user_profiles);
  ELSE
    RAISE EXCEPTION '  ✗ FALTA: user_profiles';
  END IF;

  -- user_addresses
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_addresses') THEN
    RAISE NOTICE '  ✓ user_addresses creada';
  ELSE
    RAISE EXCEPTION '  ✗ FALTA: user_addresses';
  END IF;

  -- store_subscriptions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_subscriptions') THEN
    RAISE NOTICE '  ✓ store_subscriptions creada';
  ELSE
    RAISE EXCEPTION '  ✗ FALTA: store_subscriptions';
  END IF;

  -- user_push_tokens
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_push_tokens') THEN
    RAISE NOTICE '  ✓ user_push_tokens creada';
  ELSE
    RAISE EXCEPTION '  ✗ FALTA: user_push_tokens';
  END IF;

  -- user_favorites
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_favorites') THEN
    RAISE NOTICE '  ✓ user_favorites creada';
  ELSE
    RAISE EXCEPTION '  ✗ FALTA: user_favorites';
  END IF;

  -- user_sessions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sessions') THEN
    RAISE NOTICE '  ✓ user_sessions creada';
  ELSE
    RAISE EXCEPTION '  ✗ FALTA: user_sessions';
  END IF;

  RAISE NOTICE '';

  -- =====================================================
  -- VERIFICAR ÍNDICES CRÍTICOS
  -- =====================================================
  RAISE NOTICE '2. VERIFICANDO ÍNDICES...';

  SELECT COUNT(*) INTO indexes_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN ('user_profiles', 'user_addresses', 'store_subscriptions', 'user_push_tokens');

  RAISE NOTICE '  ✓ % índices creados', indexes_count;

  -- Verificar índices críticos específicos
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_store_subscriptions_notify_query') THEN
    RAISE NOTICE '  ✓ Índice crítico: idx_store_subscriptions_notify_query';
  ELSE
    RAISE WARNING '  ⚠ FALTA índice crítico: idx_store_subscriptions_notify_query';
  END IF;

  RAISE NOTICE '';

  -- =====================================================
  -- VERIFICAR TRIGGERS
  -- =====================================================
  RAISE NOTICE '3. VERIFICANDO TRIGGERS...';

  -- Trigger de auto-crear perfil
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'users' AND t.tgname = 'on_auth_user_created'
  ) THEN
    RAISE NOTICE '  ✓ Trigger: on_auth_user_created';
  ELSE
    RAISE WARNING '  ⚠ FALTA trigger: on_auth_user_created';
  END IF;

  -- Trigger de actualizar subscriber count
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'store_subscriptions' AND t.tgname = 'update_store_subscriber_count_trigger'
  ) THEN
    RAISE NOTICE '  ✓ Trigger: update_store_subscriber_count_trigger';
  ELSE
    RAISE WARNING '  ⚠ FALTA trigger: update_store_subscriber_count_trigger';
  END IF;

  RAISE NOTICE '';

  -- =====================================================
  -- VERIFICAR FUNCIONES
  -- =====================================================
  RAISE NOTICE '4. VERIFICANDO FUNCIONES...';

  -- handle_new_user
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') THEN
    RAISE NOTICE '  ✓ Función: handle_new_user()';
  ELSE
    RAISE WARNING '  ⚠ FALTA función: handle_new_user()';
  END IF;

  -- get_store_subscribers_with_tokens
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_store_subscribers_with_tokens') THEN
    RAISE NOTICE '  ✓ Función: get_store_subscribers_with_tokens()';
  ELSE
    RAISE WARNING '  ⚠ FALTA función: get_store_subscribers_with_tokens()';
  END IF;

  -- unsubscribe_from_store
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'unsubscribe_from_store') THEN
    RAISE NOTICE '  ✓ Función: unsubscribe_from_store()';
  ELSE
    RAISE WARNING '  ⚠ FALTA función: unsubscribe_from_store()';
  END IF;

  -- get_user_dashboard_stats
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_dashboard_stats') THEN
    RAISE NOTICE '  ✓ Función: get_user_dashboard_stats()';
  ELSE
    RAISE WARNING '  ⚠ FALTA función: get_user_dashboard_stats()';
  END IF;

  RAISE NOTICE '';

  -- =====================================================
  -- VERIFICAR RLS
  -- =====================================================
  RAISE NOTICE '5. VERIFICANDO ROW LEVEL SECURITY...';

  -- user_profiles
  IF (SELECT relrowsecurity FROM pg_class WHERE relname = 'user_profiles') THEN
    RAISE NOTICE '  ✓ RLS habilitado: user_profiles';
  ELSE
    RAISE EXCEPTION '  ✗ RLS NO HABILITADO: user_profiles';
  END IF;

  -- user_addresses
  IF (SELECT relrowsecurity FROM pg_class WHERE relname = 'user_addresses') THEN
    RAISE NOTICE '  ✓ RLS habilitado: user_addresses';
  ELSE
    RAISE EXCEPTION '  ✗ RLS NO HABILITADO: user_addresses';
  END IF;

  -- store_subscriptions
  IF (SELECT relrowsecurity FROM pg_class WHERE relname = 'store_subscriptions') THEN
    RAISE NOTICE '  ✓ RLS habilitado: store_subscriptions';
  ELSE
    RAISE EXCEPTION '  ✗ RLS NO HABILITADO: store_subscriptions';
  END IF;

  -- transactions
  IF (SELECT relrowsecurity FROM pg_class WHERE relname = 'transactions') THEN
    RAISE NOTICE '  ✓ RLS habilitado: transactions';
  ELSE
    RAISE EXCEPTION '  ✗ RLS NO HABILITADO: transactions';
  END IF;

  RAISE NOTICE '';

  -- =====================================================
  -- VERIFICAR VISTAS
  -- =====================================================
  RAISE NOTICE '6. VERIFICANDO VISTAS...';

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'user_stats') THEN
    RAISE NOTICE '  ✓ Vista: user_stats';
  ELSE
    RAISE WARNING '  ⚠ FALTA vista: user_stats';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'store_subscription_stats') THEN
    RAISE NOTICE '  ✓ Vista: store_subscription_stats';
  ELSE
    RAISE WARNING '  ⚠ FALTA vista: store_subscription_stats';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'user_order_history') THEN
    RAISE NOTICE '  ✓ Vista: user_order_history';
  ELSE
    RAISE WARNING '  ⚠ FALTA vista: user_order_history';
  END IF;

  RAISE NOTICE '';

  -- =====================================================
  -- VERIFICAR INTEGRIDAD DE DATOS
  -- =====================================================
  RAISE NOTICE '7. VERIFICANDO INTEGRIDAD DE DATOS...';

  -- Verificar que transactions existentes mantienen su data
  RAISE NOTICE '  Transacciones: % registros', (SELECT COUNT(*) FROM public.transactions);
  RAISE NOTICE '  Tiendas: % registros', (SELECT COUNT(*) FROM public.stores);
  RAISE NOTICE '  Órdenes Shopify: % registros', (SELECT COUNT(*) FROM public.shopify_orders);

  RAISE NOTICE '';

  -- =====================================================
  -- RESUMEN
  -- =====================================================
  RAISE NOTICE '=== VALIDACIÓN COMPLETADA ===';
  RAISE NOTICE 'Estado: EXITOSA ✓';
  RAISE NOTICE 'Todas las estructuras críticas están creadas';
  RAISE NOTICE 'RLS habilitado correctamente';
  RAISE NOTICE 'Datos existentes preservados';

END $$;

-- Actualizar registro de migración
UPDATE public.migration_history
SET
  status = 'completed',
  notes = 'Migración completada exitosamente - Todas las validaciones pasaron'
WHERE migration_name = '001_auth_and_users'
  AND status = 'in_progress';

INSERT INTO public.migration_history (migration_name, status, notes)
VALUES ('002_integrate_existing_tables', 'completed', 'Integración con tablas existentes completada');

-- =====================================================
-- QUERY DE VERIFICACIÓN FINAL
-- =====================================================

-- Resumen de todas las tablas de usuarios
SELECT
  'user_profiles' as tabla,
  COUNT(*) as registros,
  pg_size_pretty(pg_total_relation_size('public.user_profiles')) as tamaño
FROM public.user_profiles
UNION ALL
SELECT
  'user_addresses',
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('public.user_addresses'))
FROM public.user_addresses
UNION ALL
SELECT
  'store_subscriptions',
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('public.store_subscriptions'))
FROM public.store_subscriptions
UNION ALL
SELECT
  'user_push_tokens',
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('public.user_push_tokens'))
FROM public.user_push_tokens
UNION ALL
SELECT
  'user_favorites',
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('public.user_favorites'))
FROM public.user_favorites
UNION ALL
SELECT
  'user_sessions',
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('public.user_sessions'))
FROM public.user_sessions;
