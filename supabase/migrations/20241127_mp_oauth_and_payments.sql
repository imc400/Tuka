/**
 * Migration: Mercado Pago OAuth & Store Payments
 *
 * Agrega soporte para:
 * 1. Conexión OAuth de tiendas con Mercado Pago
 * 2. Tracking de pagos/disbursements a tiendas
 * 3. Balance pendiente por tienda
 */

-- ============================================
-- 1. Agregar campos MP OAuth a tabla stores
-- ============================================

ALTER TABLE stores ADD COLUMN IF NOT EXISTS mp_user_id TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS mp_email TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS mp_access_token TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS mp_refresh_token TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS mp_token_expires_at TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS mp_connected_at TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS mp_public_key TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,4) DEFAULT 0.10; -- 10% por defecto

-- Índice para búsqueda por mp_user_id
CREATE INDEX IF NOT EXISTS idx_stores_mp_user_id ON stores(mp_user_id);

-- ============================================
-- 2. Crear tabla store_payments (disbursements)
-- ============================================

CREATE TABLE IF NOT EXISTS store_payments (
  id SERIAL PRIMARY KEY,

  -- Referencias
  store_domain TEXT NOT NULL REFERENCES stores(domain),
  transaction_id INTEGER NOT NULL REFERENCES transactions(id),
  shopify_order_id TEXT,

  -- Montos
  gross_amount INTEGER NOT NULL,           -- Monto bruto de la venta (en CLP)
  mp_fee_amount INTEGER DEFAULT 0,         -- Comisión de MP del cobro (prorrateada)
  grumo_commission INTEGER NOT NULL,       -- Comisión Grumo
  net_amount INTEGER NOT NULL,             -- Monto a transferir a la tienda

  -- Estado del disbursement
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, transferred, failed, manual

  -- Info de transferencia MP
  mp_transfer_id TEXT,                     -- ID de transferencia en MP
  mp_transfer_status TEXT,                 -- Status de la transferencia
  transfer_error TEXT,                     -- Error si falló

  -- Timestamps
  transferred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'transferred', 'failed', 'manual', 'cancelled'))
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_store_payments_store ON store_payments(store_domain);
CREATE INDEX IF NOT EXISTS idx_store_payments_transaction ON store_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_store_payments_status ON store_payments(status);
CREATE INDEX IF NOT EXISTS idx_store_payments_created ON store_payments(created_at DESC);

-- Índice compuesto para dashboard de tienda
CREATE INDEX IF NOT EXISTS idx_store_payments_store_status ON store_payments(store_domain, status);

-- ============================================
-- 3. Crear tabla store_balance (balance acumulado)
-- ============================================

CREATE TABLE IF NOT EXISTS store_balance (
  store_domain TEXT PRIMARY KEY REFERENCES stores(domain),

  -- Balances
  pending_amount INTEGER DEFAULT 0,        -- Monto pendiente de transferir
  transferred_amount INTEGER DEFAULT 0,    -- Total histórico transferido
  failed_amount INTEGER DEFAULT 0,         -- Monto de transferencias fallidas

  -- Contadores
  pending_count INTEGER DEFAULT 0,
  transferred_count INTEGER DEFAULT 0,

  -- Timestamps
  last_transfer_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. Función para actualizar balance automáticamente
-- ============================================

CREATE OR REPLACE FUNCTION update_store_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcular balance de la tienda
  INSERT INTO store_balance (store_domain, pending_amount, transferred_amount, pending_count, transferred_count, updated_at)
  SELECT
    NEW.store_domain,
    COALESCE(SUM(CASE WHEN status = 'pending' THEN net_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'transferred' THEN net_amount ELSE 0 END), 0),
    COUNT(CASE WHEN status = 'pending' THEN 1 END),
    COUNT(CASE WHEN status = 'transferred' THEN 1 END),
    NOW()
  FROM store_payments
  WHERE store_domain = NEW.store_domain
  ON CONFLICT (store_domain) DO UPDATE SET
    pending_amount = EXCLUDED.pending_amount,
    transferred_amount = EXCLUDED.transferred_amount,
    pending_count = EXCLUDED.pending_count,
    transferred_count = EXCLUDED.transferred_count,
    last_transfer_at = CASE WHEN NEW.status = 'transferred' THEN NOW() ELSE store_balance.last_transfer_at END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar balance
DROP TRIGGER IF EXISTS trigger_update_store_balance ON store_payments;
CREATE TRIGGER trigger_update_store_balance
  AFTER INSERT OR UPDATE ON store_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_store_balance();

-- ============================================
-- 5. Vista para dashboard de pagos por tienda
-- ============================================

CREATE OR REPLACE VIEW store_payments_summary AS
SELECT
  sp.store_domain,
  s.store_name,
  COUNT(*) as total_payments,
  COUNT(CASE WHEN sp.status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN sp.status = 'transferred' THEN 1 END) as transferred_count,
  COUNT(CASE WHEN sp.status = 'failed' THEN 1 END) as failed_count,
  COALESCE(SUM(sp.gross_amount), 0) as total_gross,
  COALESCE(SUM(sp.grumo_commission), 0) as total_commission,
  COALESCE(SUM(sp.net_amount), 0) as total_net,
  COALESCE(SUM(CASE WHEN sp.status = 'pending' THEN sp.net_amount ELSE 0 END), 0) as pending_amount,
  COALESCE(SUM(CASE WHEN sp.status = 'transferred' THEN sp.net_amount ELSE 0 END), 0) as transferred_amount,
  MAX(sp.transferred_at) as last_transfer_at,
  s.mp_connected_at IS NOT NULL as mp_connected
FROM store_payments sp
JOIN stores s ON sp.store_domain = s.domain
GROUP BY sp.store_domain, s.store_name, s.mp_connected_at;

-- ============================================
-- 6. RLS Policies
-- ============================================

-- Habilitar RLS
ALTER TABLE store_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_balance ENABLE ROW LEVEL SECURITY;

-- Policy para store_payments: Service role puede todo
CREATE POLICY "Service role full access to store_payments"
  ON store_payments FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy para store_balance: Service role puede todo
CREATE POLICY "Service role full access to store_balance"
  ON store_balance FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 7. Inicializar balances para tiendas existentes
-- ============================================

INSERT INTO store_balance (store_domain)
SELECT domain FROM stores
ON CONFLICT (store_domain) DO NOTHING;

-- ============================================
-- 8. Comentarios para documentación
-- ============================================

COMMENT ON TABLE store_payments IS 'Registro de pagos/disbursements a tiendas por cada venta';
COMMENT ON TABLE store_balance IS 'Balance acumulado por tienda (cache para consultas rápidas)';
COMMENT ON COLUMN stores.mp_user_id IS 'ID del usuario en Mercado Pago (obtenido via OAuth)';
COMMENT ON COLUMN stores.mp_access_token IS 'Token OAuth para realizar transferencias (encriptado)';
COMMENT ON COLUMN stores.commission_rate IS 'Comisión de Grumo (0.10 = 10%)';
COMMENT ON COLUMN store_payments.status IS 'pending=esperando, transferred=enviado, failed=error, manual=pago manual';
