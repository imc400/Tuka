-- =====================================================
-- Migration: Performance Indexes for Supabase Pro
-- Optimizes queries for dashboard analytics and app performance
-- =====================================================

-- =====================================================
-- 1. Products table - Most queried table
-- =====================================================

-- Composite index for store filtering with availability (most common query)
CREATE INDEX IF NOT EXISTS idx_products_store_available
ON products(store_domain, available)
WHERE available = true;

-- Index for price range queries
CREATE INDEX IF NOT EXISTS idx_products_price
ON products(store_domain, price);

-- Index for product type filtering
CREATE INDEX IF NOT EXISTS idx_products_type
ON products(store_domain, product_type)
WHERE product_type IS NOT NULL AND product_type != '';

-- Index for vendor filtering
CREATE INDEX IF NOT EXISTS idx_products_vendor
ON products(store_domain, vendor)
WHERE vendor IS NOT NULL AND vendor != '';

-- Index for recent sync (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_products_synced_at
ON products(synced_at DESC);

-- =====================================================
-- 2. Transactions & Orders - Critical for payments
-- =====================================================

-- Composite index for user's recent orders
CREATE INDEX IF NOT EXISTS idx_transactions_user_recent
ON transactions(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

-- Index for pending payments (webhook processing)
CREATE INDEX IF NOT EXISTS idx_transactions_pending
ON transactions(status, created_at DESC)
WHERE status = 'pending';

-- Index for approved transactions (analytics)
CREATE INDEX IF NOT EXISTS idx_transactions_approved_date
ON transactions(created_at DESC)
WHERE status = 'approved';

-- Shopify orders by store (admin analytics)
CREATE INDEX IF NOT EXISTS idx_shopify_orders_store_date
ON shopify_orders(store_domain, created_at DESC);

-- =====================================================
-- 3. Store Subscriptions - Push notifications
-- =====================================================

-- Active subscriptions by store (send push)
CREATE INDEX IF NOT EXISTS idx_subscriptions_store_active
ON store_subscriptions(store_domain, user_id)
WHERE unsubscribed_at IS NULL;

-- User's subscriptions (app my stores)
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active
ON store_subscriptions(user_id, store_domain)
WHERE unsubscribed_at IS NULL;

-- =====================================================
-- 4. Push Tokens - Notification delivery
-- =====================================================

-- Active tokens by user
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active
ON push_tokens(user_id)
WHERE is_active = true;

-- =====================================================
-- 5. Cart Items - Checkout performance
-- =====================================================

-- User's cart items
CREATE INDEX IF NOT EXISTS idx_cart_items_user
ON cart_items(user_id, created_at DESC);

-- =====================================================
-- 6. Store Payments - Admin dashboard
-- =====================================================

-- Pending payments by store
CREATE INDEX IF NOT EXISTS idx_store_payments_pending
ON store_payments(store_domain, created_at DESC)
WHERE status = 'pending';

-- =====================================================
-- 7. Notifications - Campaign analytics
-- =====================================================

-- Recent notifications by store
CREATE INDEX IF NOT EXISTS idx_notifications_store_recent
ON notifications_sent(store_id, sent_at DESC);

-- =====================================================
-- 8. Shipping - Checkout performance
-- =====================================================

-- Active zones by store
CREATE INDEX IF NOT EXISTS idx_shipping_zones_store_active
ON shipping_zones(store_domain)
WHERE is_active = true;

-- Methods by zone
CREATE INDEX IF NOT EXISTS idx_shipping_methods_zone_active
ON shipping_methods(zone_id)
WHERE is_active = true;

-- =====================================================
-- 9. Collections - Browse performance
-- =====================================================

-- Collections by store
CREATE INDEX IF NOT EXISTS idx_collections_store
ON store_collections(store_domain, position);

-- =====================================================
-- 10. Analyze tables for query planner
-- =====================================================

-- Update statistics for query optimization
ANALYZE products;
ANALYZE transactions;
ANALYZE shopify_orders;
ANALYZE store_subscriptions;
ANALYZE push_tokens;
ANALYZE cart_items;
ANALYZE store_payments;
ANALYZE notifications_sent;
ANALYZE shipping_zones;
ANALYZE shipping_methods;
ANALYZE store_collections;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON INDEX idx_products_store_available IS 'Optimizes product listing by store (main app query)';
COMMENT ON INDEX idx_transactions_pending IS 'Optimizes webhook payment processing';
COMMENT ON INDEX idx_subscriptions_store_active IS 'Optimizes push notification delivery';
COMMENT ON INDEX idx_push_tokens_user_active IS 'Optimizes push token lookup';
