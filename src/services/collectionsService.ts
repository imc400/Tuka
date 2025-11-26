/**
 * Collections Service
 *
 * Maneja la obtención de colecciones y productos filtrados por colección
 */

import { supabase } from '../lib/supabase';
import { Product, ProductVariant, ShopifyConfig } from '../types';

// Tipos
export interface StoreCollection {
  id: string;
  store_id: number;
  collection_id: string;
  collection_handle: string;
  collection_title: string;
  collection_image?: string;
  products_count: number;
  display_order: number;
  is_active: boolean;
}

/**
 * Obtiene las colecciones activas de una tienda desde Supabase
 */
export const getStoreCollections = async (storeId: number): Promise<StoreCollection[]> => {
  try {
    const { data, error } = await supabase
      .from('store_collections')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error loading collections:', err);
    return [];
  }
};

/**
 * Obtiene productos de una colección específica desde Shopify
 */
export const getCollectionProducts = async (
  shopifyConfig: ShopifyConfig,
  collectionHandle: string
): Promise<Product[]> => {
  try {
    const query = `
      query GetCollectionProducts($handle: String!) {
        collection(handle: $handle) {
          products(first: 100) {
            edges {
              node {
                id
                title
                description
                images(first: 5) {
                  edges {
                    node {
                      url
                    }
                  }
                }
                variants(first: 20) {
                  edges {
                    node {
                      id
                      title
                      price {
                        amount
                      }
                      compareAtPrice {
                        amount
                      }
                      availableForSale
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(
      `https://${shopifyConfig.domain}/api/2024-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': shopifyConfig.accessToken,
        },
        body: JSON.stringify({
          query,
          variables: { handle: collectionHandle },
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Error connecting to Shopify');
    }

    const data = await response.json();

    if (data.errors) {
      console.error('Shopify GraphQL errors:', data.errors);
      throw new Error(data.errors[0]?.message || 'Error in Shopify query');
    }

    if (!data.data?.collection?.products?.edges) {
      console.log(`Collection "${collectionHandle}" not found or empty`);
      return [];
    }

    // Transform Shopify products to app format
    const products: Product[] = data.data.collection.products.edges.map(
      (edge: any) => {
        const node = edge.node;
        // Get first variant for default pricing
        const defaultVariant = node.variants.edges[0]?.node;
        const defaultPrice = defaultVariant?.price?.amount || '0';
        const defaultCompareAtPrice = defaultVariant?.compareAtPrice?.amount || null;

        return {
          id: node.id,
          name: node.title,
          description: node.description || 'Descripción no disponible',
          price: parseFloat(defaultPrice),
          compareAtPrice: defaultCompareAtPrice ? parseFloat(defaultCompareAtPrice) : null,
          imagePrompt: 'shopify-product',
          images: node.images.edges.map((img: any) => img.node.url),
          variants: node.variants.edges.map((v: any) => ({
            id: v.node.id,
            title: v.node.title,
            price: parseFloat(v.node.price?.amount || '0'),
            compareAtPrice: v.node.compareAtPrice?.amount ? parseFloat(v.node.compareAtPrice.amount) : null,
            available: v.node.availableForSale,
          })),
        };
      }
    );

    console.log(
      `📦 [CollectionsService] Loaded ${products.length} products from collection "${collectionHandle}"`
    );

    return products;
  } catch (err) {
    console.error('Error fetching collection products:', err);
    return [];
  }
};

/**
 * Filtra productos locales por los IDs de una colección
 * (Alternativa más rápida si los productos ya están cargados)
 */
export const filterProductsByCollection = async (
  shopifyConfig: ShopifyConfig,
  collectionHandle: string,
  allProducts: Product[]
): Promise<Product[]> => {
  try {
    // Obtener los IDs de productos en la colección
    const query = `
      query GetCollectionProductIds($handle: String!) {
        collection(handle: $handle) {
          products(first: 250) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    `;

    const response = await fetch(
      `https://${shopifyConfig.domain}/api/2024-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': shopifyConfig.accessToken,
        },
        body: JSON.stringify({
          query,
          variables: { handle: collectionHandle },
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Error connecting to Shopify');
    }

    const data = await response.json();

    if (!data.data?.collection?.products?.edges) {
      return [];
    }

    // Get set of product IDs in the collection
    const collectionProductIds = new Set(
      data.data.collection.products.edges.map((edge: any) => edge.node.id)
    );

    // Filter local products by collection IDs
    const filteredProducts = allProducts.filter((product) =>
      collectionProductIds.has(product.id)
    );

    console.log(
      `🔍 [CollectionsService] Filtered ${filteredProducts.length} products for collection "${collectionHandle}"`
    );

    return filteredProducts;
  } catch (err) {
    console.error('Error filtering products by collection:', err);
    return allProducts; // Return all products on error
  }
};
