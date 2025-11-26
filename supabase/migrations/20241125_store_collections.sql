-- Migration: Store Collections
-- Permite a las tiendas seleccionar y ordenar las colecciones de Shopify que aparecen en Grumo

-- Tabla de colecciones seleccionadas por tienda
CREATE TABLE IF NOT EXISTS store_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  -- Datos de Shopify
  collection_id TEXT NOT NULL,           -- ID de Shopify (gid://shopify/Collection/xxx)
  collection_handle TEXT NOT NULL,       -- Handle para queries (ej: "poleras")
  collection_title TEXT NOT NULL,        -- Nombre para mostrar (ej: "Poleras")
  collection_image TEXT,                 -- URL de imagen de la colección (opcional)
  products_count INTEGER DEFAULT 0,      -- Cantidad de productos en la colección
  -- Configuración de display
  display_order INTEGER NOT NULL DEFAULT 0,  -- Orden en el menú (menor = primero)
  is_active BOOLEAN DEFAULT true,            -- Si está visible en la app
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Constraints
  UNIQUE(store_id, collection_id)
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_store_collections_store ON store_collections(store_id);
CREATE INDEX IF NOT EXISTS idx_store_collections_order ON store_collections(store_id, display_order);
CREATE INDEX IF NOT EXISTS idx_store_collections_active ON store_collections(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_store_collections_handle ON store_collections(store_id, collection_handle);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_store_collections_updated
  BEFORE UPDATE ON store_collections
  FOR EACH ROW EXECUTE FUNCTION update_collections_updated_at();

-- RLS Policies
ALTER TABLE store_collections ENABLE ROW LEVEL SECURITY;

-- Lectura pública (la app necesita leer las colecciones)
CREATE POLICY "Allow public read on store_collections"
  ON store_collections FOR SELECT
  USING (true);

-- Escritura (dashboard)
CREATE POLICY "Allow authenticated insert on store_collections"
  ON store_collections FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update on store_collections"
  ON store_collections FOR UPDATE
  USING (true);

CREATE POLICY "Allow authenticated delete on store_collections"
  ON store_collections FOR DELETE
  USING (true);

-- Comentarios para documentación
COMMENT ON TABLE store_collections IS 'Colecciones de Shopify seleccionadas por cada tienda para mostrar en Grumo';
COMMENT ON COLUMN store_collections.collection_handle IS 'Handle de Shopify usado para queries de productos';
COMMENT ON COLUMN store_collections.display_order IS 'Orden de aparición en el menú horizontal (0 = primero)';
