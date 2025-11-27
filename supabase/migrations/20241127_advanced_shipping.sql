-- Migration: Advanced Shipping System
-- Permite múltiples métodos de envío por zona con tarifas por peso y/o precio
-- Soporta condiciones combinables y envío gratis condicional

-- ============================================================================
-- 1. MÉTODOS DE ENVÍO POR ZONA
-- ============================================================================
-- Cada zona puede tener múltiples métodos (Estándar, Express, Same Day, etc.)

CREATE TABLE IF NOT EXISTS store_shipping_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES store_shipping_zones(id) ON DELETE CASCADE,

  -- Información del método
  name TEXT NOT NULL,                    -- "Envío Estándar", "Express", "Same Day"
  code TEXT NOT NULL,                    -- "standard", "express", "same_day"
  description TEXT,                      -- Descripción opcional
  estimated_delivery TEXT,               -- "3-5 días hábiles", "1-2 días", "Hoy"

  -- Orden de visualización
  sort_order INTEGER DEFAULT 0,

  -- Estado
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(zone_id, code)
);

-- ============================================================================
-- 2. TARIFAS DE ENVÍO (Múltiples condiciones por método)
-- ============================================================================
-- Cada método puede tener múltiples tarifas con diferentes condiciones

CREATE TABLE IF NOT EXISTS store_shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method_id UUID REFERENCES store_shipping_methods(id) ON DELETE CASCADE,

  -- Nombre de la tarifa (para UI admin)
  name TEXT,                             -- "Hasta 1kg", "1-3kg", "Compras sobre $50k"

  -- Condiciones de peso (en gramos para precisión)
  min_weight_grams INTEGER DEFAULT 0,    -- Peso mínimo en gramos (0 = sin mínimo)
  max_weight_grams INTEGER,              -- Peso máximo en gramos (null = sin límite)

  -- Condiciones de precio/subtotal
  min_subtotal INTEGER DEFAULT 0,        -- Subtotal mínimo en pesos (0 = sin mínimo)
  max_subtotal INTEGER,                  -- Subtotal máximo en pesos (null = sin límite)

  -- Precio de la tarifa
  price INTEGER NOT NULL,                -- Precio base en pesos chilenos

  -- Precio adicional por kg (para envíos pesados)
  price_per_extra_kg INTEGER DEFAULT 0,  -- Precio por kg adicional sobre max_weight

  -- Prioridad (para resolver conflictos cuando múltiples tarifas aplican)
  priority INTEGER DEFAULT 0,            -- Mayor prioridad = se evalúa primero

  -- Estado
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. CONFIGURACIÓN DE ENVÍO GRATIS (Mejorada)
-- ============================================================================
-- Ahora soporta condiciones combinables

CREATE TABLE IF NOT EXISTS store_free_shipping_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,

  -- Nombre de la regla
  name TEXT NOT NULL,                    -- "Envío gratis sobre $50k", "Envío gratis productos livianos"

  -- Condiciones (todas deben cumplirse para aplicar - AND logic)
  min_subtotal INTEGER,                  -- Subtotal mínimo (null = no aplica)
  max_subtotal INTEGER,                  -- Subtotal máximo (null = sin límite)
  min_weight_grams INTEGER,              -- Peso mínimo (null = no aplica)
  max_weight_grams INTEGER,              -- Peso máximo (null = sin límite)
  min_items INTEGER,                     -- Cantidad mínima de items (null = no aplica)

  -- A qué métodos aplica (null = todos los métodos)
  applies_to_methods TEXT[],             -- Array de códigos: ['standard', 'express'] o null para todos

  -- A qué zonas aplica (null = todas las zonas)
  applies_to_zones TEXT[],               -- Array de códigos de región: ['RM', 'V'] o null para todas

  -- Prioridad
  priority INTEGER DEFAULT 0,

  -- Estado
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. OVERRIDE POR COMUNA (Actualizado para métodos)
-- ============================================================================
-- Permite precio diferente por comuna para un método específico

CREATE TABLE IF NOT EXISTS store_shipping_commune_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method_id UUID REFERENCES store_shipping_methods(id) ON DELETE CASCADE,

  commune_code TEXT NOT NULL,
  commune_name TEXT NOT NULL,

  -- Override de precio (reemplaza el precio calculado del método)
  price_override INTEGER,                -- Si es null, usa el precio normal del método

  -- O ajuste de precio (suma/resta al precio normal)
  price_adjustment INTEGER DEFAULT 0,    -- Ej: +1000 para comunas remotas

  -- Estado
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(method_id, commune_code)
);

-- ============================================================================
-- 5. ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_shipping_methods_zone ON store_shipping_methods(zone_id);
CREATE INDEX IF NOT EXISTS idx_shipping_methods_active ON store_shipping_methods(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_shipping_rates_method ON store_shipping_rates(method_id);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_active ON store_shipping_rates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_free_shipping_rules_store ON store_free_shipping_rules(store_id);
CREATE INDEX IF NOT EXISTS idx_commune_rates_method ON store_shipping_commune_rates(method_id);

-- ============================================================================
-- 6. TRIGGERS PARA UPDATED_AT
-- ============================================================================

CREATE TRIGGER trigger_shipping_methods_updated
  BEFORE UPDATE ON store_shipping_methods
  FOR EACH ROW EXECUTE FUNCTION update_shipping_updated_at();

CREATE TRIGGER trigger_shipping_rates_updated
  BEFORE UPDATE ON store_shipping_rates
  FOR EACH ROW EXECUTE FUNCTION update_shipping_updated_at();

CREATE TRIGGER trigger_free_shipping_rules_updated
  BEFORE UPDATE ON store_free_shipping_rules
  FOR EACH ROW EXECUTE FUNCTION update_shipping_updated_at();

CREATE TRIGGER trigger_commune_rates_updated
  BEFORE UPDATE ON store_shipping_commune_rates
  FOR EACH ROW EXECUTE FUNCTION update_shipping_updated_at();

-- ============================================================================
-- 7. RLS POLICIES
-- ============================================================================

ALTER TABLE store_shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_free_shipping_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_shipping_commune_rates ENABLE ROW LEVEL SECURITY;

-- Lectura pública (la app necesita leer las tarifas)
CREATE POLICY "Allow public read on store_shipping_methods"
  ON store_shipping_methods FOR SELECT USING (true);

CREATE POLICY "Allow public read on store_shipping_rates"
  ON store_shipping_rates FOR SELECT USING (true);

CREATE POLICY "Allow public read on store_free_shipping_rules"
  ON store_free_shipping_rules FOR SELECT USING (true);

CREATE POLICY "Allow public read on store_shipping_commune_rates"
  ON store_shipping_commune_rates FOR SELECT USING (true);

-- Escritura (service role o autenticados)
CREATE POLICY "Allow authenticated write on store_shipping_methods"
  ON store_shipping_methods FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated write on store_shipping_rates"
  ON store_shipping_rates FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated write on store_free_shipping_rules"
  ON store_free_shipping_rules FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated write on store_shipping_commune_rates"
  ON store_shipping_commune_rates FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 8. COMENTARIOS DE DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE store_shipping_methods IS 'Métodos de envío por zona (Estándar, Express, Same Day, etc.)';
COMMENT ON TABLE store_shipping_rates IS 'Tarifas con condiciones por peso y/o precio para cada método';
COMMENT ON TABLE store_free_shipping_rules IS 'Reglas de envío gratis con condiciones combinables';
COMMENT ON TABLE store_shipping_commune_rates IS 'Ajustes de precio por comuna para métodos específicos';

COMMENT ON COLUMN store_shipping_rates.min_weight_grams IS 'Peso mínimo en gramos (1kg = 1000g)';
COMMENT ON COLUMN store_shipping_rates.max_weight_grams IS 'Peso máximo en gramos, null = sin límite';
COMMENT ON COLUMN store_shipping_rates.price_per_extra_kg IS 'Precio adicional por cada kg sobre max_weight';
COMMENT ON COLUMN store_free_shipping_rules.applies_to_methods IS 'Array de códigos de método, null = todos';
COMMENT ON COLUMN store_free_shipping_rules.applies_to_zones IS 'Array de códigos de región, null = todas';

-- ============================================================================
-- 9. MIGRAR DATOS EXISTENTES (Si hay zonas con base_price)
-- ============================================================================
-- Crea un método "Estándar" para cada zona existente que tenga precio

DO $$
DECLARE
  zone_record RECORD;
BEGIN
  FOR zone_record IN
    SELECT id, region_code, base_price
    FROM store_shipping_zones
    WHERE base_price IS NOT NULL AND base_price > 0
  LOOP
    -- Crear método estándar
    INSERT INTO store_shipping_methods (zone_id, name, code, estimated_delivery, sort_order)
    VALUES (zone_record.id, 'Envío Estándar', 'standard', '3-5 días hábiles', 0)
    ON CONFLICT (zone_id, code) DO NOTHING;

    -- Crear tarifa plana para ese método
    INSERT INTO store_shipping_rates (method_id, name, price, priority)
    SELECT m.id, 'Tarifa base', zone_record.base_price::INTEGER, 0
    FROM store_shipping_methods m
    WHERE m.zone_id = zone_record.id AND m.code = 'standard'
    AND NOT EXISTS (
      SELECT 1 FROM store_shipping_rates r WHERE r.method_id = m.id
    );
  END LOOP;
END $$;

-- ============================================================================
-- 10. MIGRAR REGLAS DE ENVÍO GRATIS EXISTENTES
-- ============================================================================

INSERT INTO store_free_shipping_rules (store_id, name, min_subtotal, priority)
SELECT
  store_id,
  'Envío gratis sobre $' || free_shipping_threshold::INTEGER,
  free_shipping_threshold::INTEGER,
  0
FROM store_shipping_config
WHERE free_shipping_threshold IS NOT NULL AND free_shipping_threshold > 0
ON CONFLICT DO NOTHING;
