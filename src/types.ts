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
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD'
}
