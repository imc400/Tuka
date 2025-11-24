-- Migration: Add shipping_costs to transactions table
-- Date: 2025-11-24
-- Purpose: Store selected shipping rates for each store in marketplace orders

-- Add shipping_costs column to transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS shipping_costs JSONB DEFAULT '{}'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN transactions.shipping_costs IS 'Shipping costs selected by user per store. Format: {"store.myshopify.com": {"rate_id": "shopify-Standard-5.00", "title": "Standard Shipping", "price": 5000}}';

-- Create index for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_transactions_shipping_costs ON transactions USING GIN (shipping_costs);

-- Example data structure:
-- {
--   "imanix.myshopify.com": {
--     "rate_id": "shopify-Standard-5.00",
--     "title": "Standard Shipping",
--     "price": 5000,
--     "code": "STANDARD"
--   },
--   "spot-essence.myshopify.com": {
--     "rate_id": "shopify-Express-10.00",
--     "title": "Express Shipping",
--     "price": 10000,
--     "code": "EXPRESS"
--   }
-- }
