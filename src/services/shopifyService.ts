import { ShopifyConfig, Store, Product } from "../types";
import { supabase } from '../lib/supabase';

// Use mobile Supabase client by default
// Web version (App.web.tsx) will use supabaseWeb directly

// --- Supabase Management for Admin ---

export const getRegisteredConfigs = async (): Promise<ShopifyConfig[]> => {
  try {
    // Only fetch stores that are NOT hidden (is_hidden = false or null)
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .or('is_hidden.is.null,is_hidden.eq.false');
    if (error) throw error;

    // Map snake_case DB columns to camelCase interface
    return (data || []).map((row: any) => ({
      id: row.id, // Include database ID
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
    // Query optimizado con todos los datos relevantes de producto
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
              descriptionHtml
              vendor
              productType
              tags
              handle
              availableForSale
              totalInventory
              options {
                id
                name
                values
              }
              variants(first: 30) {
                edges {
                  node {
                    id
                    title
                    sku
                    barcode
                    availableForSale
                    quantityAvailable
                    price {
                      amount
                      currencyCode
                    }
                    compareAtPrice {
                      amount
                    }
                    selectedOptions {
                      name
                      value
                    }
                    weight
                    weightUnit
                    image {
                      url
                      altText
                    }
                  }
                }
              }
              images(first: 10) {
                edges {
                  node {
                    url
                    altText
                    width
                    height
                  }
                }
              }
              seo {
                title
                description
              }
              metafields(identifiers: [
                {namespace: "custom", key: "material"},
                {namespace: "custom", key: "care_instructions"},
                {namespace: "custom", key: "dimensions"},
                {namespace: "custom", key: "specifications"},
                {namespace: "descriptors", key: "subtitle"},
                {namespace: "product", key: "rating"},
                {namespace: "reviews", key: "rating"},
                {namespace: "reviews", key: "rating_count"}
              ]) {
                key
                value
                namespace
                type
              }
            }
          }
        }
      }
    `;

    try {
      const response = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
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
    const shopResponse = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
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

      // Get all product images (up to 10)
      const productImages = product.images.edges.map((img: any) => img.node.url);

      // Get the default variant price and compare at price (first variant)
      const defaultVariant = product.variants.edges[0]?.node;
      const defaultPrice = defaultVariant?.price.amount || "0";
      const defaultCompareAtPrice = defaultVariant?.compareAtPrice?.amount || null;

      // Process metafields into a clean object
      const metafields: Record<string, string> = {};
      if (product.metafields) {
        product.metafields.forEach((mf: any) => {
          if (mf && mf.value) {
            metafields[`${mf.namespace}.${mf.key}`] = mf.value;
          }
        });
      }

      // Process options (Color, Size, etc.)
      const options = product.options?.map((opt: any) => ({
        id: opt.id,
        name: opt.name,
        values: opt.values
      })) || [];

      return {
        id: product.id,
        name: product.title,
        description: product.description || "Descripción no disponible",
        descriptionHtml: product.descriptionHtml || null,
        price: parseFloat(defaultPrice),
        compareAtPrice: defaultCompareAtPrice ? parseFloat(defaultCompareAtPrice) : null,
        imagePrompt: "shopify-real",
        images: productImages,
        handle: product.handle,
        vendor: product.vendor || null,
        productType: product.productType || null,
        tags: product.tags || [],
        availableForSale: product.availableForSale,
        totalInventory: product.totalInventory,
        options,
        metafields,
        seo: product.seo || null,
        // Store variants with full data
        variants: product.variants.edges.map((v: any) => ({
          id: v.node.id,
          title: v.node.title,
          sku: v.node.sku || null,
          barcode: v.node.barcode || null,
          price: parseFloat(v.node.price.amount),
          compareAtPrice: v.node.compareAtPrice?.amount ? parseFloat(v.node.compareAtPrice.amount) : null,
          available: v.node.availableForSale,
          quantityAvailable: v.node.quantityAvailable,
          selectedOptions: v.node.selectedOptions || [],
          weight: v.node.weight,
          weightUnit: v.node.weightUnit,
          image: v.node.image?.url || null
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

/**
 * Fetch a single product by ID from Shopify
 * Used for deeplinks when product is not in memory
 *
 * @param config - Shopify store configuration
 * @param productId - Shopify product GID (e.g., "gid://shopify/Product/123")
 * @returns Product or null if not found
 */
export const fetchProductById = async (
  config: ShopifyConfig,
  productId: string
): Promise<Product | null> => {
  const { domain, accessToken } = config;

  const query = `
    query GetProduct($id: ID!) {
      product(id: $id) {
        id
        title
        description
        descriptionHtml
        vendor
        productType
        tags
        handle
        availableForSale
        totalInventory
        options {
          id
          name
          values
        }
        images(first: 10) {
          edges {
            node {
              url
              altText
              width
              height
            }
          }
        }
        variants(first: 50) {
          edges {
            node {
              id
              title
              sku
              barcode
              availableForSale
              quantityAvailable
              price {
                amount
              }
              compareAtPrice {
                amount
              }
              selectedOptions {
                name
                value
              }
              weight
              weightUnit
              image {
                url
              }
            }
          }
        }
        seo {
          title
          description
        }
        metafields(identifiers: [
          {namespace: "custom", key: "material"},
          {namespace: "custom", key: "care_instructions"},
          {namespace: "custom", key: "dimensions"},
          {namespace: "custom", key: "specifications"},
          {namespace: "descriptors", key: "subtitle"},
          {namespace: "product", key: "rating"},
          {namespace: "reviews", key: "rating"},
          {namespace: "reviews", key: "rating_count"}
        ]) {
          key
          value
          namespace
          type
        }
      }
    }
  `;

  try {
    console.log(`🔍 [ShopifyService] Fetching product by ID: ${productId}`);

    const response = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': accessToken,
      },
      body: JSON.stringify({
        query,
        variables: { id: productId },
      }),
    });

    if (!response.ok) {
      console.error(`❌ [ShopifyService] HTTP error: ${response.status}`);
      return null;
    }

    const json = await response.json();

    if (json.errors) {
      console.error('❌ [ShopifyService] GraphQL errors:', json.errors);
      return null;
    }

    const productData = json.data?.product;
    if (!productData) {
      console.warn(`⚠️ [ShopifyService] Product not found: ${productId}`);
      return null;
    }

    // Get first variant for default pricing
    const defaultVariant = productData.variants.edges[0]?.node;
    const defaultPrice = defaultVariant?.price?.amount || '0';
    const defaultCompareAtPrice = defaultVariant?.compareAtPrice?.amount || null;

    // Process metafields into a clean object
    const metafields: Record<string, string> = {};
    if (productData.metafields) {
      productData.metafields.forEach((mf: any) => {
        if (mf && mf.value) {
          metafields[`${mf.namespace}.${mf.key}`] = mf.value;
        }
      });
    }

    // Process options (Color, Size, etc.)
    const options = productData.options?.map((opt: any) => ({
      id: opt.id,
      name: opt.name,
      values: opt.values
    })) || [];

    // Transform to Product format
    const product: Product = {
      id: productData.id,
      name: productData.title,
      description: productData.description || 'Descripción no disponible',
      descriptionHtml: productData.descriptionHtml || null,
      price: parseFloat(defaultPrice),
      compareAtPrice: defaultCompareAtPrice ? parseFloat(defaultCompareAtPrice) : null,
      imagePrompt: 'shopify-product',
      images: productData.images.edges.map((img: any) => img.node.url),
      handle: productData.handle,
      vendor: productData.vendor || null,
      productType: productData.productType || null,
      tags: productData.tags || [],
      availableForSale: productData.availableForSale,
      totalInventory: productData.totalInventory,
      options,
      metafields,
      seo: productData.seo || null,
      variants: productData.variants.edges.map((v: any) => ({
        id: v.node.id,
        title: v.node.title,
        sku: v.node.sku || null,
        barcode: v.node.barcode || null,
        price: parseFloat(v.node.price?.amount || '0'),
        compareAtPrice: v.node.compareAtPrice?.amount ? parseFloat(v.node.compareAtPrice.amount) : null,
        available: v.node.availableForSale,
        quantityAvailable: v.node.quantityAvailable,
        selectedOptions: v.node.selectedOptions || [],
        weight: v.node.weight,
        weightUnit: v.node.weightUnit,
        image: v.node.image?.url || null
      })),
    };

    console.log(`✅ [ShopifyService] Product fetched: ${product.name}`);
    return product;

  } catch (error) {
    console.error(`❌ [ShopifyService] Error fetching product:`, error);
    return null;
  }
};

/**
 * Get store config by domain from Supabase
 * Used for deeplinks when we need to fetch products dynamically
 */
export const getStoreConfigByDomain = async (
  storeDomain: string
): Promise<ShopifyConfig | null> => {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('domain', storeDomain)
      .single();

    if (error || !data) {
      console.warn(`⚠️ [ShopifyService] Store not found: ${storeDomain}`);
      return null;
    }

    return {
      id: data.id,
      domain: data.domain,
      accessToken: data.access_token,
      storeName: data.store_name,
      description: data.description,
      logoUrl: data.logo_url,
      bannerUrl: data.banner_url,
      themeColor: data.theme_color,
    };
  } catch (error) {
    console.error(`❌ [ShopifyService] Error getting store config:`, error);
    return null;
  }
};
