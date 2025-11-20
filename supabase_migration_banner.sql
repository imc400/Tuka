-- Migration: Add banner_url to stores table
-- Run this in Supabase SQL Editor

-- Add banner_url column
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS banner_url text;

-- Add comment to document the field
COMMENT ON COLUMN stores.banner_url IS 'URL of the store banner image displayed in the mobile app';

-- Verify the change
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'stores'
ORDER BY ordinal_position;
