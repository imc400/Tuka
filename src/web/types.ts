/**
 * Tipos compartidos para el dashboard web
 */

export interface Store {
  id: number;
  domain: string;
  access_token: string;
  admin_api_token?: string;
  store_name?: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  theme_color?: string;
  is_hidden?: boolean;
  created_at?: string;
  updated_at?: string;
  // Mercado Pago OAuth
  mp_user_id?: string;
  mp_email?: string;
  mp_access_token?: string;
  mp_refresh_token?: string;
  mp_token_expires_at?: string;
  mp_connected_at?: string;
  mp_public_key?: string;
  commission_rate?: number;
}

export interface NotificationRecipient {
  user_id: string;
  token: string;
  clicked?: boolean;
  converted?: boolean;
}

export interface NotificationRecord {
  id: number;
  store_id: string;
  store_name: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  image_url?: string;
  total_sent: number;
  total_delivered?: number;
  total_failed?: number;
  total_clicked?: number;
  total_opened?: number;
  conversions?: number;
  revenue?: number;
  recipients?: NotificationRecipient[];
  ticket_ids?: string[];
  sent_at: string;
  sent_by_admin: boolean;
  created_at: string;
}

export interface StoreFormData {
  domain: string;
  storefrontToken: string;
  adminToken: string;
  storeName: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
  themeColor: string;
}

export type DashboardView = 'stores' | 'store-detail';

export type StoreTabType = 'notifications' | 'analytics' | 'sales' | 'shipping' | 'collections' | 'settings' | 'subscribers' | 'payments';

// Tipos para pagos/disbursements
export interface StorePayment {
  id: number;
  store_domain: string;
  transaction_id: number;
  shopify_order_id?: string;
  gross_amount: number;
  mp_fee_amount: number;
  grumo_commission: number;
  net_amount: number;
  status: 'pending' | 'transferred' | 'failed' | 'manual' | 'cancelled';
  mp_transfer_id?: string;
  mp_transfer_status?: string;
  transfer_error?: string;
  transferred_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StoreBalance {
  store_domain: string;
  pending_amount: number;
  transferred_amount: number;
  failed_amount: number;
  pending_count: number;
  transferred_count: number;
  last_transfer_at?: string;
  updated_at: string;
}

export interface StoreMPConnection {
  mp_user_id?: string;
  mp_email?: string;
  mp_connected_at?: string;
  mp_token_expires_at?: string;
  commission_rate: number;
}
