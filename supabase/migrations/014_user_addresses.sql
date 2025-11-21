-- =====================================================
-- MIGRATION: User Addresses Management
-- Descripción: Tabla para almacenar direcciones de envío de usuarios
-- =====================================================

-- Crear tabla de direcciones de usuario
CREATE TABLE IF NOT EXISTS public.user_addresses (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Información de la dirección
  full_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  postal_code TEXT,
  phone TEXT NOT NULL,

  -- Dirección por defecto
  is_default BOOLEAN DEFAULT false,

  -- Metadatos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT user_addresses_user_id_check CHECK (user_id IS NOT NULL)
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON public.user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_default ON public.user_addresses(user_id, is_default) WHERE is_default = true;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_user_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_addresses_updated_at
  BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_user_addresses_updated_at();

-- Función para asegurar que solo haya una dirección por defecto por usuario
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  -- Si esta dirección se marca como default, desmarcar las demás del mismo usuario
  IF NEW.is_default = true THEN
    UPDATE public.user_addresses
    SET is_default = false
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_address_trigger
  BEFORE INSERT OR UPDATE ON public.user_addresses
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_address();

-- RLS Policies
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo pueden ver sus propias direcciones
CREATE POLICY "Users can view own addresses"
  ON public.user_addresses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Los usuarios pueden crear sus propias direcciones
CREATE POLICY "Users can create own addresses"
  ON public.user_addresses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar sus propias direcciones
CREATE POLICY "Users can update own addresses"
  ON public.user_addresses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden eliminar sus propias direcciones
CREATE POLICY "Users can delete own addresses"
  ON public.user_addresses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Comentarios
COMMENT ON TABLE public.user_addresses IS 'Direcciones de envío de los usuarios';
COMMENT ON COLUMN public.user_addresses.is_default IS 'Indica si es la dirección por defecto del usuario (solo una puede ser true)';
