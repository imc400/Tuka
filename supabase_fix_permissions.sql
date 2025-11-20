-- =========================================
-- FIX: Habilitar permisos para tabla stores
-- =========================================
-- Este script soluciona el problema de que no se pueden actualizar
-- los logos y banners desde el dashboard web

-- 1. Deshabilitar RLS temporalmente para ver si es el problema
ALTER TABLE stores DISABLE ROW LEVEL SECURITY;

-- 2. O si prefieres mantener RLS activo, crea políticas permisivas:
-- (Descomenta esto si quieres usar RLS)

/*
-- Habilitar RLS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- Permitir SELECT para todos (lectura pública)
CREATE POLICY "Allow public read access" ON stores
  FOR SELECT
  USING (true);

-- Permitir INSERT para todos (crear tiendas)
CREATE POLICY "Allow public insert" ON stores
  FOR INSERT
  WITH CHECK (true);

-- Permitir UPDATE para todos (actualizar tiendas)
CREATE POLICY "Allow public update" ON stores
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Permitir DELETE para todos (eliminar tiendas)
CREATE POLICY "Allow public delete" ON stores
  FOR DELETE
  USING (true);
*/

-- Verificar que los cambios se aplicaron
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'stores';
