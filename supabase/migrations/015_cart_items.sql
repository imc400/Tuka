-- =====================================================
-- CART ITEMS TABLE
-- Tabla para almacenar items del carrito persistente
-- =====================================================

-- Crear tabla cart_items
CREATE TABLE IF NOT EXISTS cart_items (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_price NUMERIC NOT NULL,
  product_image_url TEXT,
  quantity INT NOT NULL DEFAULT 1,
  store_id TEXT NOT NULL,
  store_name TEXT NOT NULL,
  variant_id TEXT,
  variant_title TEXT,
  variant_price NUMERIC,
  variant_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Evitar duplicados: mismo producto + variante para el mismo usuario
  UNIQUE(user_id, product_id, variant_id)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Índice para buscar carrito de usuario (query más común)
CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);

-- Índice para buscar por producto
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);

-- Índice para ordenar por fecha (mostrar últimos agregados primero)
CREATE INDEX idx_cart_items_created_at ON cart_items(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver su propio carrito
CREATE POLICY "Users can view their own cart items"
  ON cart_items FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Los usuarios solo pueden insertar en su propio carrito
CREATE POLICY "Users can insert their own cart items"
  ON cart_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios solo pueden actualizar su propio carrito
CREATE POLICY "Users can update their own cart items"
  ON cart_items FOR UPDATE
  USING (auth.uid() = user_id);

-- Política: Los usuarios solo pueden eliminar de su propio carrito
CREATE POLICY "Users can delete their own cart items"
  ON cart_items FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_cart_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW
  EXECUTE FUNCTION update_cart_items_updated_at();

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Función para limpiar carritos viejos (items sin actualizar por más de 30 días)
CREATE OR REPLACE FUNCTION cleanup_old_cart_items()
RETURNS void AS $$
BEGIN
  DELETE FROM cart_items
  WHERE updated_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios para documentación
COMMENT ON TABLE cart_items IS 'Almacena items del carrito de compras persistente de cada usuario';
COMMENT ON COLUMN cart_items.user_id IS 'ID del usuario dueño del carrito';
COMMENT ON COLUMN cart_items.product_id IS 'ID del producto en Shopify';
COMMENT ON COLUMN cart_items.variant_id IS 'ID de la variante seleccionada (puede ser null)';
COMMENT ON COLUMN cart_items.quantity IS 'Cantidad de este producto en el carrito';
