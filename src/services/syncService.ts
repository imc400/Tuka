/**
 * SYNC SERVICE
 * Sincroniza productos de Shopify → Supabase
 * Se ejecuta 1 vez al día o manualmente desde el dashboard
 */

import { supabase } from '../lib/supabase';

interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: Array<{
    id: string;
    title: string;
    price: string;
    compare_at_price: string | null;
    sku: string | null;
    barcode: string | null;
    inventory_quantity: number;
    available: boolean;
    weight: number | null;
    weight_unit: string | null;
  }>;
  images: Array<{
    src: string;
    alt: string | null;
  }>;
}

/**
 * Fetch ALL products from Shopify for syncing
 * No limit - we want everything
 */
async function fetchAllShopifyProducts(
  domain: string,
  accessToken: string
): Promise<ShopifyProduct[]> {
  const allProducts: ShopifyProduct[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  console.log(`🔄 Starting full sync for ${domain}...`);

  while (hasNextPage) {
    const query = `
      {
        products(first: 250${cursor ? `, after: "${cursor}"` : ''}) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              description
              vendor
              productType
              tags
              variants(first: 100) {
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
                    sku
                    barcode
                    availableForSale
                    weight
                    weightUnit
                  }
                }
              }
              images(first: 10) {
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
      const response = await fetch(
        `https://${domain}/api/2023-01/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': accessToken,
          },
          body: JSON.stringify({ query }),
        }
      );

      const json = await response.json();

      if (json.errors) {
        throw new Error(JSON.stringify(json.errors));
      }

      const productsData = json.data.products;

      // Transform to our format
      const products = productsData.edges.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        description: edge.node.description || '',
        vendor: edge.node.vendor || '',
        product_type: edge.node.productType || '',
        tags: edge.node.tags || [],
        variants: edge.node.variants.edges.map((v: any) => ({
          id: v.node.id,
          title: v.node.title,
          price: v.node.price.amount,
          compare_at_price: v.node.compareAtPrice?.amount || null,
          sku: v.node.sku,
          barcode: v.node.barcode,
          inventory_quantity: 0, // Not available in Storefront API
          available: v.node.availableForSale,
          weight: v.node.weight,
          weight_unit: v.node.weightUnit,
        })),
        images: edge.node.images.edges.map((img: any) => img.node.src),
      }));

      allProducts.push(...products);

      hasNextPage = productsData.pageInfo.hasNextPage;
      cursor = productsData.pageInfo.endCursor;

      console.log(`  📦 Fetched ${products.length} products (total: ${allProducts.length})`);
    } catch (error) {
      console.error(`❌ Error fetching products from ${domain}:`, error);
      throw error;
    }
  }

  console.log(`✅ Fetched ${allProducts.length} total products from ${domain}`);
  return allProducts;
}

/**
 * Sync products from Shopify to Supabase
 */
export async function syncStoreProducts(
  domain: string,
  accessToken: string
): Promise<{
  success: boolean;
  productsAdded: number;
  productsUpdated: number;
  productsDeleted: number;
  error?: string;
}> {
  const startTime = Date.now();
  let productsAdded = 0;
  let productsUpdated = 0;
  let productsDeleted = 0;

  try {
    // Create sync log
    const { data: syncLog, error: logError } = await supabase
      .from('sync_logs')
      .insert({
        store_domain: domain,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) throw logError;

    // Fetch all products from Shopify
    const shopifyProducts = await fetchAllShopifyProducts(domain, accessToken);

    // Get existing products from Supabase
    const { data: existingProducts } = await supabase
      .from('products')
      .select('id')
      .eq('store_domain', domain);

    const existingIds = new Set(existingProducts?.map((p) => p.id) || []);
    const shopifyIds = new Set(shopifyProducts.map((p) => p.id));

    // Find products to delete (exist in DB but not in Shopify)
    const idsToDelete = Array.from(existingIds).filter(
      (id) => !shopifyIds.has(id)
    );

    // Delete old products
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .in('id', idsToDelete);

      if (!deleteError) {
        productsDeleted = idsToDelete.length;
        console.log(`  🗑️  Deleted ${productsDeleted} discontinued products`);
      }
    }

    // Upsert products
    for (const product of shopifyProducts) {
      const defaultVariant = product.variants[0];

      const productData = {
        id: product.id,
        store_domain: domain,
        title: product.title,
        description: product.description,
        price: parseFloat(defaultVariant.price),
        compare_at_price: defaultVariant.compare_at_price
          ? parseFloat(defaultVariant.compare_at_price)
          : null,
        vendor: product.vendor,
        product_type: product.product_type,
        tags: product.tags,
        images: product.images,
        available: product.variants.some((v) => v.available),
        synced_at: new Date().toISOString(),
      };

      const { error: productError } = await supabase
        .from('products')
        .upsert(productData, { onConflict: 'id' });

      if (productError) {
        console.error(`Error upserting product ${product.id}:`, productError);
        continue;
      }

      if (existingIds.has(product.id)) {
        productsUpdated++;
      } else {
        productsAdded++;
      }

      // Upsert variants
      for (const variant of product.variants) {
        const variantData = {
          id: variant.id,
          product_id: product.id,
          title: variant.title,
          price: parseFloat(variant.price),
          compare_at_price: variant.compare_at_price
            ? parseFloat(variant.compare_at_price)
            : null,
          sku: variant.sku,
          barcode: variant.barcode,
          inventory_quantity: variant.inventory_quantity,
          available: variant.available,
          weight: variant.weight,
          weight_unit: variant.weight_unit,
        };

        await supabase
          .from('product_variants')
          .upsert(variantData, { onConflict: 'id' });
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    // Update sync log
    await supabase
      .from('sync_logs')
      .update({
        status: 'success',
        products_synced: shopifyProducts.length,
        products_added: productsAdded,
        products_updated: productsUpdated,
        products_deleted: productsDeleted,
        completed_at: new Date().toISOString(),
        duration_seconds: duration,
      })
      .eq('id', syncLog.id);

    console.log(`✅ Sync completed for ${domain} in ${duration}s`);
    console.log(`   📊 Added: ${productsAdded}, Updated: ${productsUpdated}, Deleted: ${productsDeleted}`);

    return {
      success: true,
      productsAdded,
      productsUpdated,
      productsDeleted,
    };
  } catch (error: any) {
    console.error(`❌ Sync failed for ${domain}:`, error);

    return {
      success: false,
      productsAdded,
      productsUpdated,
      productsDeleted,
      error: error.message,
    };
  }
}

/**
 * Sync all registered stores
 */
export async function syncAllStores(): Promise<void> {
  console.log('🚀 Starting sync for all stores...');

  const { data: stores } = await supabase.from('stores').select('domain, access_token');

  if (!stores || stores.length === 0) {
    console.log('No stores to sync');
    return;
  }

  for (const store of stores) {
    await syncStoreProducts(store.domain, store.access_token);
  }

  console.log('✅ All stores synced successfully!');
}
