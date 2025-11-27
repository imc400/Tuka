-- =====================================================
-- Notification Analytics: Conversions and Revenue Tracking
-- =====================================================

-- Add conversions and revenue columns to notifications_sent
ALTER TABLE public.notifications_sent
ADD COLUMN IF NOT EXISTS conversions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue DECIMAL(12, 2) DEFAULT 0;

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_notifications_sent_store_created
ON public.notifications_sent(store_id, created_at DESC);

-- Function to increment clicks (atomic operation)
CREATE OR REPLACE FUNCTION public.increment_notification_clicks(notification_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications_sent
  SET total_clicked = COALESCE(total_clicked, 0) + 1,
      updated_at = NOW()
  WHERE id = notification_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_notification_clicks(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_notification_clicks(BIGINT) TO anon;

-- Function to record conversion (atomic operation)
CREATE OR REPLACE FUNCTION public.record_notification_conversion(
  notification_id BIGINT,
  order_total DECIMAL(12, 2)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications_sent
  SET conversions = COALESCE(conversions, 0) + 1,
      revenue = COALESCE(revenue, 0) + order_total,
      updated_at = NOW()
  WHERE id = notification_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.record_notification_conversion(BIGINT, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_notification_conversion(BIGINT, DECIMAL) TO anon;

-- View for campaign analytics
CREATE OR REPLACE VIEW public.notification_analytics AS
SELECT
  ns.id,
  ns.store_id,
  ns.store_name,
  ns.title,
  ns.body,
  ns.image_url,
  ns.created_at,
  ns.total_sent,
  ns.total_delivered,
  ns.total_clicked,
  ns.conversions,
  ns.revenue,
  -- Calculated metrics
  CASE WHEN ns.total_sent > 0
    THEN ROUND((ns.total_clicked::DECIMAL / ns.total_sent) * 100, 2)
    ELSE 0
  END AS ctr,
  CASE WHEN ns.total_clicked > 0
    THEN ROUND((ns.conversions::DECIMAL / ns.total_clicked) * 100, 2)
    ELSE 0
  END AS conversion_rate,
  CASE WHEN ns.conversions > 0
    THEN ROUND(ns.revenue / ns.conversions, 2)
    ELSE 0
  END AS avg_order_value
FROM public.notifications_sent ns
ORDER BY ns.created_at DESC;

-- Grant access to the view
GRANT SELECT ON public.notification_analytics TO authenticated;
GRANT SELECT ON public.notification_analytics TO anon;

COMMENT ON VIEW public.notification_analytics IS 'Analytics view for push notification campaigns with calculated metrics';
