export interface ProductVariant {
  id: string;
  title: string;
  price: number;
  available: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imagePrompt: string; // Used to seed the placeholder image
  images?: string[]; // For real shopify images (multiple images)
  variants?: ProductVariant[]; // Product variants (sizes, colors, etc)
}

export interface Store {
  id: string;
  name: string;
  category: string;
  description: string;
  themeColor: string;
  logoUrl?: string; // Custom logo from Admin (circular)
  bannerUrl?: string; // Custom banner from Admin (header)
  products: Product[];
  isSubscribed?: boolean;
  isRealStore?: boolean; // Flag to identify real Shopify stores
  shopifyConfig?: ShopifyConfig; // Keep reference to config for API calls
}

export interface CartItem extends Product {
  storeName: string;
  storeId: string;
  quantity: number;
  selectedVariant?: ProductVariant; // Selected variant when adding to cart
}

export interface ShopifyConfig {
  domain: string;
  accessToken: string;
  storeName?: string; // Override from Supabase
  description?: string; // Override from Supabase
  logoUrl?: string; // Logo circular - From Supabase
  bannerUrl?: string; // Banner image - From Supabase
  themeColor?: string; // From Supabase
}

export enum ViewState {
  HOME = 'HOME',
  STORE_DETAIL = 'STORE_DETAIL',
  PRODUCT_DETAIL = 'PRODUCT_DETAIL',
  CART = 'CART',
  PROFILE = 'PROFILE',
  SEARCH = 'SEARCH',
  CHECKOUT = 'CHECKOUT',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  LOGIN = 'LOGIN',
  ORDERS = 'ORDERS',
  ORDER_DETAIL = 'ORDER_DETAIL',
  SIGNUP = 'SIGNUP',
  ADDRESSES = 'ADDRESSES',
  NOTIFICATIONS_ADMIN = 'NOTIFICATIONS_ADMIN',
}

// =====================================================
// AUTH TYPES
// =====================================================

export interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  email: string;
  total_orders: number;
  total_spent: number;
  created_at: string;
  last_active_at: string;
}

export interface UserAddress {
  id: number;
  user_id: string;
  label: string;
  street: string;
  street_number: string | null;
  apartment: string | null;
  city: string;
  region: string;
  zip_code: string | null;
  instructions: string | null;
  phone: string | null;
  recipient_name: string | null;
  is_default: boolean;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  last_used_at: string | null;
}
