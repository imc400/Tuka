import { ShopifyConfig, Store, Product } from "../types";
import { supabase } from '../lib/supabase';

// Use mobile Supabase client by default
// Web version (App.web.tsx) will use supabaseWeb directly

// --- Supabase Management for Admin ---

export const getRegisteredConfigs = async (): Promise<ShopifyConfig[]> => {
  try {
    const { data, error } = await supabase.from('stores').select('*');
    if (error) throw error;
    
    // Map snake_case DB columns to camelCase interface
    return (data || []).map((row: any) => ({
      domain: row.domain,
      accessToken: row.access_token,
      storeName: row.store_name,
      description: row.description,
      logoUrl: row.logo_url,
      bannerUrl: row.banner_url,
      themeColor: row.theme_color
    }));
  } catch (e) {
    console.error("Failed to load configs from Supabase", e);
    return [];
  }
};

export const addStoreConfig = async (config: ShopifyConfig) => {
  const { domain, accessToken, storeName, description, logoUrl, bannerUrl, themeColor } = config;
  try {
    const { error } = await supabase.from('stores').insert({
      domain,
      access_token: accessToken,
      store_name: storeName,
      description,
      logo_url: logoUrl,
      banner_url: bannerUrl,
      theme_color: themeColor
    });
    if (error) throw error;
  } catch (e) {
    console.error("Failed to add store to Supabase", e);
    throw e; // Re-throw to handle in UI
  }
};

export const updateStoreConfig = async (domain: string, config: Partial<ShopifyConfig>) => {
  try {
    const updateData: any = {};
    if (config.accessToken) updateData.access_token = config.accessToken;
    if (config.storeName !== undefined) updateData.store_name = config.storeName;
    if (config.description !== undefined) updateData.description = config.description;
    if (config.logoUrl !== undefined) updateData.logo_url = config.logoUrl;
    if (config.bannerUrl !== undefined) updateData.banner_url = config.bannerUrl;
    if (config.themeColor !== undefined) updateData.theme_color = config.themeColor;

    const { error } = await supabase
      .from('stores')
      .update(updateData)
      .eq('domain', domain);

    if (error) throw error;
  } catch (e) {
    console.error("Failed to update store in Supabase", e);
    throw e;
  }
};

export const removeStoreConfig = async (domain: string) => {
  try {
    const { error } = await supabase.from('stores').delete().eq('domain', domain);
    if (error) throw error;
  } catch (e) {
    console.error("Failed to remove store from Supabase", e);
    throw e;
  }
};

// --- API Fetching ---

/**
 * Fetch products from a Shopify store using cursor-based pagination
 * Shopify API limits: 250 products per request max
 * @param limit - Maximum number of products to fetch (default: 100)
 */
const fetchAllProducts = async (
  domain: string,
  accessToken: string,
  limit: number = 100
): Promise<any[]> => {
  let allProducts: any[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;
  let requestCount = 0;
  const PRODUCTS_PER_REQUEST = 50; // Reducido de 250 para cargas más rápidas
  const MAX_REQUESTS = Math.ceil(limit / PRODUCTS_PER_REQUEST); // Basado en el límite

  while (hasNextPage && requestCount < MAX_REQUESTS && allProducts.length < limit) {
    const productsQuery = `
      {
        products(first: ${PRODUCTS_PER_REQUEST}${cursor ? `, after: "${cursor}"` : ''}) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            cursor
            node {
              id
              title
              description
              variants(first: 3) {
                edges {
                  node {
                    id
                    title
                    price {
                      amount
                    }
                    availableForSale
                  }
                }
              }
              images(first: 3) {
                edges {
                  node {
                    src
                    altText
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await fetch(`https://${domain}/api/2023-01/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": accessToken,
        },
        body: JSON.stringify({ query: productsQuery }),
      });

      const json = await response.json();

      if (json.errors) {
        console.error(`Shopify API Errors for ${domain}:`, json.errors);
        break;
      }

      const productsData = json.data.products;
      allProducts = [...allProducts, ...productsData.edges];

      hasNextPage = productsData.pageInfo.hasNextPage;
      cursor = productsData.pageInfo.endCursor;
      requestCount++;

      // Stop if we've reached the limit
      if (allProducts.length >= limit) {
        console.log(`✅ Reached limit of ${limit} products for ${domain}`);
        break;
      }

      console.log(`📦 Fetched ${productsData.edges.length} products from ${domain} (total: ${allProducts.length}/${limit})`);

    } catch (error) {
      console.error(`Error fetching products page for ${domain}:`, error);
      break;
    }
  }

  if (requestCount >= MAX_REQUESTS) {
    console.warn(`Reached max request limit for ${domain}. Some products may not be loaded.`);
  }

  return allProducts;
};

export const fetchShopifyStore = async (config: ShopifyConfig): Promise<Store | null> => {
  const { domain, accessToken } = config;

  const shopQuery = `
    {
      shop {
        name
        description
      }
    }
  `;

  try {
    // Fetch shop info
    const shopResponse = await fetch(`https://${domain}/api/2023-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: shopQuery }),
    });

    const shopJson = await shopResponse.json();

    if (shopJson.errors) {
      console.error(`Shopify API Errors for ${domain}:`, shopJson.errors);
      return null;
    }

    const shopData = shopJson.data.shop;

    // Fetch ALL products with pagination
    console.log(`🔄 Fetching all products from ${domain}...`);
    const productsData = await fetchAllProducts(domain, accessToken);

    // Transform products with all images and variants
    const realProducts: Product[] = productsData.map((edge: any) => {
      const product = edge.node;

      // Get all product images (up to 5)
      const productImages = product.images.edges.map((img: any) => img.node.src);

      // Get the default variant price (first variant)
      const defaultPrice = product.variants.edges[0]?.node.price.amount || "0";

      return {
        id: product.id,
        name: product.title,
        description: product.description || "Descripción no disponible",
        price: parseFloat(defaultPrice),
        imagePrompt: "shopify-real",
        images: productImages,
        // Store variants for future use
        variants: product.variants.edges.map((v: any) => ({
          id: v.node.id,
          title: v.node.title,
          price: parseFloat(v.node.price.amount),
          available: v.node.availableForSale
        }))
      };
    });

    console.log(`✅ Loaded ${realProducts.length} products from ${domain}`);

    return {
      id: `real-${domain}`,
      name: config.storeName || shopData.name,
      category: "Tienda Oficial",
      description: config.description || shopData.description || "Tienda oficial verificada en ShopUnite",
      themeColor: config.themeColor || "#000000",
      products: realProducts,
      isRealStore: true,
      shopifyConfig: config,
      logoUrl: config.logoUrl,
      bannerUrl: config.bannerUrl
    };

  } catch (error) {
    console.error(`Failed to fetch from Shopify (${domain})`, error);
    return null;
  }
};
