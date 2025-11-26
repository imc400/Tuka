-- Migration: Add enhanced product fields for full Shopify data sync
-- This enables showing everything the store has configured in their product page

-- =====================================================
-- PRODUCTS TABLE - New fields
-- =====================================================

-- Description HTML (rich text)
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_html TEXT;

-- Product handle (URL slug)
ALTER TABLE products ADD COLUMN IF NOT EXISTS handle TEXT;

-- Total inventory across all variants
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_inventory INTEGER;

-- Product options (Color, Size, etc.) - stored as JSONB array
-- Example: [{"id": "...", "name": "Color", "values": ["Red", "Blue"]}]
ALTER TABLE products ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb;

-- Metafields from Shopify (material, care instructions, etc.)
-- Example: {"custom.material": "100% Cotton", "custom.care_instructions": "Machine wash cold"}
ALTER TABLE products ADD COLUMN IF NOT EXISTS metafields JSONB DEFAULT '{}'::jsonb;

-- SEO fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo JSONB DEFAULT NULL;

-- =====================================================
-- PRODUCT_VARIANTS TABLE - New fields
-- =====================================================

-- Selected options for this variant
-- Example: [{"name": "Color", "value": "Red"}, {"name": "Size", "value": "M"}]
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS selected_options JSONB DEFAULT '[]'::jsonb;

-- Variant-specific image URL
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS image_url TEXT;

-- =====================================================
-- INDEXES for performance
-- =====================================================

-- Index for handle lookups (useful for deeplinks)
CREATE INDEX IF NOT EXISTS idx_products_handle ON products(handle);

-- Index for vendor filtering
CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor);

-- Index for product type filtering
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);

-- GIN index for tags array search
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING GIN(tags);

-- GIN index for metafields JSONB search
CREATE INDEX IF NOT EXISTS idx_products_metafields ON products USING GIN(metafields);

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON COLUMN products.description_html IS 'Rich HTML description from Shopify';
COMMENT ON COLUMN products.handle IS 'URL-friendly slug for the product';
COMMENT ON COLUMN products.total_inventory IS 'Total stock across all variants';
COMMENT ON COLUMN products.options IS 'Product options like Color, Size as JSONB array';
COMMENT ON COLUMN products.metafields IS 'Custom fields from Shopify metafields';
COMMENT ON COLUMN products.seo IS 'SEO title and description';
COMMENT ON COLUMN product_variants.selected_options IS 'Option values for this variant';
COMMENT ON COLUMN product_variants.image_url IS 'Variant-specific product image';
