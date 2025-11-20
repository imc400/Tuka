/**
 * SCRIPT DE SINCRONIZACIÓN - Primera Sincronización Manual
 *
 * Este script sincroniza todas las tiendas de Shopify a Supabase
 * Ejecutar: node scripts/sync.js
 */

const { createClient } = require('@supabase/supabase-js');

// Cargar variables de entorno
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Variables de entorno no configuradas');
  console.error('   Asegúrate de que .env tenga:');
  console.error('   - EXPO_PUBLIC_SUPABASE_URL');
  console.error('   - EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fetch ALL products from Shopify for syncing
 */
async function fetchAllShopifyProducts(domain, accessToken) {
  const allProducts = [];
  let hasNextPage = true;
  let cursor = null;

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
                    price { amount }
                    compareAtPrice { amount }
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
      const products = productsData.edges.map((edge) => ({
        id: edge.node.id,
        title: edge.node.title,
        description: edge.node.description || '',
        vendor: edge.node.vendor || '',
        product_type: edge.node.productType || '',
        tags: edge.node.tags || [],
        variants: edge.node.variants.edges.map((v) => ({
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
        images: edge.node.images.edges.map((img) => img.node.src),
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
async function syncStoreProducts(domain, accessToken) {
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

    const existingIds = new Set((existingProducts || []).map((p) => p.id));
    const shopifyIds = new Set(shopifyProducts.map((p) => p.id));

    // Find products to delete
    const idsToDelete = Array.from(existingIds).filter((id) => !shopifyIds.has(id));

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

      await supabase.from('products').upsert(productData, { onConflict: 'id' });

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
          inventory_quantity: 0, // Not available in Storefront API
          available: variant.available,
          weight: variant.weight,
          weight_unit: variant.weight_unit,
        };

        await supabase.from('product_variants').upsert(variantData, { onConflict: 'id' });
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
  } catch (error) {
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
async function syncAllStores() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   🚀 SHOPUNITE - PRIMERA SINCRONIZACIÓN     ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  const { data: stores } = await supabase.from('stores').select('domain, access_token');

  if (!stores || stores.length === 0) {
    console.log('❌ No stores to sync. Add stores via the Admin Dashboard.');
    process.exit(1);
  }

  console.log(`🚀 Starting sync for ${stores.length} store(s)...\n`);

  for (const store of stores) {
    await syncStoreProducts(store.domain, store.access_token);
    console.log('');
  }

  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   ✅ SINCRONIZACIÓN COMPLETADA CON ÉXITO     ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  console.log('📊 Verifica los resultados en Supabase:');
  console.log('   1. Tabla "products" debe tener productos');
  console.log('   2. Tabla "product_variants" debe tener variantes');
  console.log('   3. Tabla "sync_logs" debe tener registros\n');
}

// Ejecutar
syncAllStores()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n╔═══════════════════════════════════════════════╗');
    console.error('║   ❌ ERROR EN LA SINCRONIZACIÓN              ║');
    console.error('╚═══════════════════════════════════════════════╝\n');
    console.error(error);
    process.exit(1);
  });
