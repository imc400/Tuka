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
  created_at?: string;
  updated_at?: string;
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

export type StoreTabType = 'notifications' | 'analytics' | 'sales' | 'shipping' | 'collections' | 'settings';
