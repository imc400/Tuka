-- ============================================
-- MIGRACIÓN: Agregar Admin API Token a stores
-- ============================================
-- Este script agrega una columna separada para el Admin API Token
-- que se usa para crear órdenes (Draft Orders)

-- Agregar nueva columna para Admin API Token
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS admin_api_token text;

-- Renombrar la columna existente para claridad
-- NOTA: Si prefieres mantener el nombre 'access_token', sáltate este paso
-- ALTER TABLE stores RENAME COLUMN access_token TO storefront_token;

-- Agregar comentarios para documentación
COMMENT ON COLUMN stores.access_token IS 'Storefront API Token - Para consultar catálogo de productos (empieza con shpat_ o es un token público)';
COMMENT ON COLUMN stores.admin_api_token IS 'Admin API Token - Para crear órdenes vía Draft Orders (empieza con shpat_ y tiene permisos de write_orders)';

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_stores_has_admin_token ON stores((admin_api_token IS NOT NULL));

-- Verificación: Mostrar tiendas y estado de tokens
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ✅ MIGRACIÓN COMPLETADA                       ║';
  RAISE NOTICE '╚════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Estado de tiendas:';
  RAISE NOTICE '';
END $$;

-- Mostrar resumen de tiendas
SELECT
  domain,
  store_name,
  CASE
    WHEN access_token IS NOT NULL THEN '✅ Storefront'
    ELSE '❌ Sin Storefront'
  END as storefront_status,
  CASE
    WHEN admin_api_token IS NOT NULL THEN '✅ Admin API'
    ELSE '❌ Sin Admin API'
  END as admin_status
FROM stores
ORDER BY created_at DESC;
