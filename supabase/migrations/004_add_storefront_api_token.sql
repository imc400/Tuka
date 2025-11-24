-- Add storefront_api_token column to stores table
-- This token is needed for Storefront API (Cart API) to get real shipping rates

ALTER TABLE stores
ADD COLUMN IF NOT EXISTS storefront_api_token TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN stores.storefront_api_token IS 'Shopify Storefront API Access Token - Used for Cart API to calculate real shipping rates including third-party apps';
