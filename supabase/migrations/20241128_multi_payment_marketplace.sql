/**
 * Migration: Multi-Payment Marketplace Architecture
 *
 * Cambia el modelo de "Grumo recibe todo y redistribuye" a
 * "Pago directo por tienda con application_fee para Grumo"
 *
 * Beneficios:
 * - Cada tienda recibe su pago directamente de MP
 * - Grumo cobra comisión via application_fee
 * - Sin riesgo tributario (no somos vendedores)
 * - Sin riesgo de bloqueo de cuenta MP
 * - Totalmente legal y escalable
 */

-- ============================================
-- 1. Agregar collector_id a stores (MP account ID que recibe el pago)
-- ============================================

-- El collector_id es el ID de la cuenta MP de la tienda
-- Se obtiene cuando la tienda conecta via OAuth
ALTER TABLE stores ADD COLUMN IF NOT EXISTS mp_collector_id TEXT;

-- Comentario
COMMENT ON COLUMN stores.mp_collector_id IS 'ID de la cuenta MP de la tienda que recibe los pagos directamente';

-- ============================================
-- 2. Nueva tabla: store_payments_v2 (pagos por tienda)
-- ============================================

-- Esta tabla reemplaza la lógica de disbursements
-- Ahora cada registro es un pago DIRECTO a la tienda
CREATE TABLE IF NOT EXISTS store_payments_v2 (
  id SERIAL PRIMARY KEY,

  -- Referencias
  store_domain TEXT NOT NULL REFERENCES stores(domain),
  transaction_id INTEGER NOT NULL REFERENCES transactions(id),

  -- Mercado Pago
  mp_preference_id TEXT,           -- Preference ID de MP para este pago
  mp_payment_id TEXT,              -- Payment ID cuando se completa
  mp_collector_id TEXT,            -- Collector ID de la tienda (redundante para queries)

  -- Montos (todos en CLP, enteros)
  gross_amount INTEGER NOT NULL,           -- Monto bruto del pago
  application_fee INTEGER NOT NULL,        -- Comisión de Grumo (application_fee)
  mp_fee_amount INTEGER DEFAULT 0,         -- Fee de MP (se llena post-pago)
  net_to_store INTEGER NOT NULL,           -- Lo que recibe la tienda (gross - application_fee - mp_fee)

  -- Estado
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, approved, rejected, cancelled
  payment_method TEXT,                     -- Método de pago usado

  -- Shopify
  shopify_order_id TEXT,
  shopify_order_number TEXT,

  -- Timestamps
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status_v2 CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'cancelled'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_store_payments_v2_store ON store_payments_v2(store_domain);
CREATE INDEX IF NOT EXISTS idx_store_payments_v2_transaction ON store_payments_v2(transaction_id);
CREATE INDEX IF NOT EXISTS idx_store_payments_v2_mp_preference ON store_payments_v2(mp_preference_id);
CREATE INDEX IF NOT EXISTS idx_store_payments_v2_mp_payment ON store_payments_v2(mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_store_payments_v2_status ON store_payments_v2(status);

-- Índice único para evitar duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_payments_v2_unique
  ON store_payments_v2(transaction_id, store_domain);

-- ============================================
-- 3. Modificar tabla transactions para soportar multi-payment
-- ============================================

-- Agregar campo para tracking de estado global de la orden
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'single';
COMMENT ON COLUMN transactions.payment_mode IS 'single=pago único, multi=pago por tienda';

-- Agregar contadores de pagos
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS total_payments INTEGER DEFAULT 1;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS completed_payments INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS failed_payments INTEGER DEFAULT 0;

-- ============================================
-- 4. Función para verificar si todos los pagos están completos
-- ============================================

CREATE OR REPLACE FUNCTION check_transaction_completion()
RETURNS TRIGGER AS $$
DECLARE
  tx_id INTEGER;
  total_count INTEGER;
  approved_count INTEGER;
  rejected_count INTEGER;
BEGIN
  tx_id := NEW.transaction_id;

  -- Contar pagos por estado
  SELECT
    COUNT(*),
    COUNT(CASE WHEN status = 'approved' THEN 1 END),
    COUNT(CASE WHEN status = 'rejected' THEN 1 END)
  INTO total_count, approved_count, rejected_count
  FROM store_payments_v2
  WHERE transaction_id = tx_id;

  -- Actualizar contadores en transaction
  UPDATE transactions SET
    completed_payments = approved_count,
    failed_payments = rejected_count,
    -- Si todos aprobados -> approved, si alguno rechazado -> partial, else pending
    status = CASE
      WHEN approved_count = total_count THEN 'approved'
      WHEN rejected_count > 0 AND approved_count > 0 THEN 'partial'
      WHEN rejected_count = total_count THEN 'rejected'
      ELSE 'pending'
    END,
    updated_at = NOW(),
    paid_at = CASE WHEN approved_count = total_count THEN NOW() ELSE paid_at END
  WHERE id = tx_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_check_transaction_completion ON store_payments_v2;
CREATE TRIGGER trigger_check_transaction_completion
  AFTER UPDATE OF status ON store_payments_v2
  FOR EACH ROW
  WHEN (NEW.status IN ('approved', 'rejected'))
  EXECUTE FUNCTION check_transaction_completion();

-- ============================================
-- 5. Vista para analytics de marketplace
-- ============================================

CREATE OR REPLACE VIEW marketplace_payments_summary AS
SELECT
  DATE_TRUNC('day', sp.created_at) as date,
  COUNT(*) as total_payments,
  COUNT(CASE WHEN sp.status = 'approved' THEN 1 END) as successful_payments,
  COALESCE(SUM(sp.gross_amount), 0) as total_gmv,
  COALESCE(SUM(sp.application_fee), 0) as total_commission,
  COALESCE(SUM(sp.net_to_store), 0) as total_to_stores,
  COUNT(DISTINCT sp.transaction_id) as unique_orders,
  COUNT(DISTINCT sp.store_domain) as unique_stores
FROM store_payments_v2 sp
WHERE sp.status = 'approved'
GROUP BY DATE_TRUNC('day', sp.created_at)
ORDER BY date DESC;

-- Vista por tienda
CREATE OR REPLACE VIEW store_payments_v2_summary AS
SELECT
  sp.store_domain,
  s.store_name,
  COUNT(*) as total_payments,
  COUNT(CASE WHEN sp.status = 'approved' THEN 1 END) as successful_payments,
  COALESCE(SUM(CASE WHEN sp.status = 'approved' THEN sp.gross_amount ELSE 0 END), 0) as total_sales,
  COALESCE(SUM(CASE WHEN sp.status = 'approved' THEN sp.application_fee ELSE 0 END), 0) as total_fees_paid,
  COALESCE(SUM(CASE WHEN sp.status = 'approved' THEN sp.net_to_store ELSE 0 END), 0) as total_received,
  MAX(sp.paid_at) as last_payment_at,
  s.mp_collector_id IS NOT NULL as mp_connected
FROM store_payments_v2 sp
JOIN stores s ON sp.store_domain = s.domain
GROUP BY sp.store_domain, s.store_name, s.mp_collector_id;

-- ============================================
-- 6. RLS Policies
-- ============================================

ALTER TABLE store_payments_v2 ENABLE ROW LEVEL SECURITY;

-- Service role tiene acceso completo
CREATE POLICY "Service role full access to store_payments_v2"
  ON store_payments_v2 FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 7. Agregar estado 'partial' a transactions
-- ============================================

-- Modificar constraint si existe (para permitir 'partial')
-- Nota: transactions no tiene constraint de status, es solo TEXT

-- ============================================
-- 8. Comentarios de documentación
-- ============================================

COMMENT ON TABLE store_payments_v2 IS 'Pagos directos a tiendas - modelo multi-payment marketplace';
COMMENT ON COLUMN store_payments_v2.mp_preference_id IS 'Preference ID de MP - cada tienda tiene su propia preferencia';
COMMENT ON COLUMN store_payments_v2.application_fee IS 'Comisión de Grumo que queda en nuestra cuenta MP';
COMMENT ON COLUMN store_payments_v2.net_to_store IS 'Monto neto que recibe la tienda directamente';
