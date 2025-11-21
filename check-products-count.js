const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkProductCounts() {
  console.log('🔍 Checking product counts in database...\n');

  // Get all stores
  const { data: stores, error: storesError } = await supabase
    .from('shopify_configs')
    .select('domain, store_name');

  if (storesError) {
    console.error('❌ Error fetching stores:', storesError);
    return;
  }

  console.log(`📋 Found ${stores.length} stores\n`);

  for (const store of stores) {
    // Count total products
    const { count: totalCount, error: totalError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_domain', store.domain);

    // Count available products
    const { count: availableCount, error: availError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_domain', store.domain)
      .eq('available', true);

    console.log(`🏪 ${store.store_name} (${store.domain})`);
    console.log(`   Total products in DB: ${totalCount}`);
    console.log(`   Available products: ${availableCount}`);
    console.log('');
  }

  // Check if there's a limit in Supabase query
  console.log('🔍 Testing query limit...\n');

  const { data: testQuery, error: testError } = await supabase
    .from('products')
    .select('id')
    .eq('available', true)
    .limit(1000);

  console.log(`Query returned: ${testQuery?.length || 0} products`);
  console.log('Note: Supabase default limit is 1000 rows unless specified\n');

  // Check actual query used in app
  console.log('🔍 Simulating app query for each store...\n');

  for (const store of stores) {
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        *,
        product_variants (*)
      `)
      .eq('store_domain', store.domain)
      .eq('available', true)
      .order('synced_at', { ascending: false });

    console.log(`${store.store_name}: Loaded ${products?.length || 0} products`);
  }
}

checkProductCounts()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
