export interface SelectedOption {
  name: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  title: string;
  price: number;
  compareAtPrice?: number | null; // Original price (for discounts)
  available: boolean;
  quantityAvailable?: number | null; // Stock quantity
  sku?: string | null;
  barcode?: string | null;
  selectedOptions?: SelectedOption[]; // e.g., [{name: "Color", value: "Red"}, {name: "Size", value: "M"}]
  weight?: number | null;
  weightUnit?: string | null;
  image?: string | null; // Variant-specific image
}

export interface ProductOption {
  id: string;
  name: string; // e.g., "Color", "Size", "Material"
  values: string[]; // e.g., ["Red", "Blue", "Green"]
}

export interface ProductSEO {
  title?: string | null;
  description?: string | null;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  descriptionHtml?: string | null; // Rich HTML description
  price: number;
  compareAtPrice?: number | null; // Original price before discount (if on sale)
  imagePrompt: string; // Used to seed the placeholder image
  images?: string[]; // For real shopify images (multiple images)
  variants?: ProductVariant[]; // Product variants (sizes, colors, etc)

  // Extended product data
  handle?: string; // URL slug
  vendor?: string | null; // Brand/manufacturer
  productType?: string | null; // Category
  tags?: string[]; // Product tags
  availableForSale?: boolean; // Overall availability
  totalInventory?: number | null; // Total stock across all variants
  options?: ProductOption[]; // Product options (Color, Size, etc.)
  metafields?: Record<string, string>; // Custom fields from Shopify
  seo?: ProductSEO | null; // SEO metadata
}

export interface Store {
  id: string;
  dbId?: number; // Database ID from Supabase stores table
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
  id?: number; // Supabase store ID
  domain: string;
  accessToken: string;
  storeName?: string; // Override from Supabase
  description?: string; // Override from Supabase
  logoUrl?: string; // Logo circular - From Supabase
  bannerUrl?: string; // Banner image - From Supabase
  themeColor?: string; // From Supabase
}

export enum ViewState {
  WELCOME = 'WELCOME',
  HOME = 'HOME',
  EXPLORE = 'EXPLORE',
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
