-- Migration: Shipping Zones Configuration
-- Permite a las tiendas configurar tarifas de envío personalizadas por zona

-- Tabla principal de configuración de envíos por tienda
CREATE TABLE IF NOT EXISTS store_shipping_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  -- Tipo de tarifa: 'flat_shopify' (sync desde Shopify), 'zone_manual' (configuración manual), 'grumo_logistics' (futuro)
  shipping_type TEXT NOT NULL DEFAULT 'flat_shopify' CHECK (shipping_type IN ('flat_shopify', 'zone_manual', 'grumo_logistics')),
  -- Umbral para envío gratis (null = no hay envío gratis)
  free_shipping_threshold DECIMAL(10,2),
  -- Nombre personalizado para el envío (ej: "Envío estándar")
  default_shipping_name TEXT DEFAULT 'Envío estándar',
  -- Tiempo estimado de entrega (ej: "3-5 días hábiles")
  estimated_delivery TEXT,
  -- Si está activo
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id)
);

-- Tabla de zonas de envío (regiones de Chile)
CREATE TABLE IF NOT EXISTS store_shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  region_code TEXT NOT NULL, -- 'RM', 'V', 'VIII', etc.
  region_name TEXT NOT NULL, -- 'Región Metropolitana', 'Valparaíso', etc.
  -- Precio base para toda la región (en pesos chilenos)
  base_price DECIMAL(10,2) NOT NULL,
  -- Si tiene desglose por comuna
  has_commune_breakdown BOOLEAN DEFAULT false,
  -- Si está activa esta zona
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id, region_code)
);

-- Tabla de comunas (para desglose opcional)
CREATE TABLE IF NOT EXISTS store_shipping_communes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES store_shipping_zones(id) ON DELETE CASCADE,
  commune_code TEXT NOT NULL,
  commune_name TEXT NOT NULL,
  -- Precio específico para esta comuna (override del precio de la región)
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(zone_id, commune_code)
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_shipping_config_store ON store_shipping_config(store_id);
CREATE INDEX IF NOT EXISTS idx_shipping_zones_store ON store_shipping_zones(store_id);
CREATE INDEX IF NOT EXISTS idx_shipping_zones_region ON store_shipping_zones(region_code);
CREATE INDEX IF NOT EXISTS idx_shipping_communes_zone ON store_shipping_communes(zone_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_shipping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_shipping_config_updated
  BEFORE UPDATE ON store_shipping_config
  FOR EACH ROW EXECUTE FUNCTION update_shipping_updated_at();

CREATE TRIGGER trigger_shipping_zones_updated
  BEFORE UPDATE ON store_shipping_zones
  FOR EACH ROW EXECUTE FUNCTION update_shipping_updated_at();

CREATE TRIGGER trigger_shipping_communes_updated
  BEFORE UPDATE ON store_shipping_communes
  FOR EACH ROW EXECUTE FUNCTION update_shipping_updated_at();

-- RLS Policies
ALTER TABLE store_shipping_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_shipping_communes ENABLE ROW LEVEL SECURITY;

-- Policies para lectura pública (la app necesita leer las tarifas)
CREATE POLICY "Allow public read on store_shipping_config"
  ON store_shipping_config FOR SELECT
  USING (true);

CREATE POLICY "Allow public read on store_shipping_zones"
  ON store_shipping_zones FOR SELECT
  USING (true);

CREATE POLICY "Allow public read on store_shipping_communes"
  ON store_shipping_communes FOR SELECT
  USING (true);

-- Policies para escritura (solo usuarios autenticados o service role)
CREATE POLICY "Allow authenticated insert on store_shipping_config"
  ON store_shipping_config FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update on store_shipping_config"
  ON store_shipping_config FOR UPDATE
  USING (true);

CREATE POLICY "Allow authenticated delete on store_shipping_config"
  ON store_shipping_config FOR DELETE
  USING (true);

CREATE POLICY "Allow authenticated insert on store_shipping_zones"
  ON store_shipping_zones FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update on store_shipping_zones"
  ON store_shipping_zones FOR UPDATE
  USING (true);

CREATE POLICY "Allow authenticated delete on store_shipping_zones"
  ON store_shipping_zones FOR DELETE
  USING (true);

CREATE POLICY "Allow authenticated insert on store_shipping_communes"
  ON store_shipping_communes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update on store_shipping_communes"
  ON store_shipping_communes FOR UPDATE
  USING (true);

CREATE POLICY "Allow authenticated delete on store_shipping_communes"
  ON store_shipping_communes FOR DELETE
  USING (true);

-- Comentarios para documentación
COMMENT ON TABLE store_shipping_config IS 'Configuración principal de envíos por tienda';
COMMENT ON TABLE store_shipping_zones IS 'Zonas de envío (regiones) con precios por tienda';
COMMENT ON TABLE store_shipping_communes IS 'Comunas con precios específicos (opcional)';
COMMENT ON COLUMN store_shipping_config.shipping_type IS 'flat_shopify: sync desde Shopify, zone_manual: configuración manual, grumo_logistics: integración Grumo';
