-- Add admin_api_token column to stores table if it doesn't exist
-- This token is needed for Admin API (Draft Orders) to get REAL shipping rates including third-party apps

ALTER TABLE stores
ADD COLUMN IF NOT EXISTS admin_api_token TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN stores.admin_api_token IS 'Shopify Admin API Access Token - Used for Draft Orders to calculate real shipping rates from third-party apps (Chilexpress, 99minutos, etc)';

-- Update comment on access_token to clarify its purpose
COMMENT ON COLUMN stores.access_token IS 'Shopify Storefront API Access Token - Used for fetching products and basic cart operations. For shipping rates, use admin_api_token instead';
