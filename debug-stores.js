const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function debugStores() {
  console.log('\n📊 DEBUGGING STORES AND PRODUCTS\n');
  console.log('='.repeat(60));

  // 1. Check stores table
  console.log('\n1️⃣  STORES TABLE:');
  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('domain, store_name, access_token');

  if (storesError) {
    console.error('Error:', storesError);
  } else {
    console.log(`Found ${stores.length} stores:\n`);
    stores.forEach((store, i) => {
      console.log(`${i + 1}. ${store.store_name || store.domain}`);
      console.log(`   Domain: ${store.domain}`);
      console.log(`   Has token: ${store.access_token ? 'Yes ✅' : 'No ❌'}`);
    });
  }

  // 2. Check products by store
  console.log('\n2️⃣  PRODUCTS BY STORE:');
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('store_domain, available', { count: 'exact' });

  if (productsError) {
    console.error('Error:', productsError);
  } else {
    const byStore = {};
    products.forEach(p => {
      if (!byStore[p.store_domain]) {
        byStore[p.store_domain] = { total: 0, available: 0 };
      }
      byStore[p.store_domain].total++;
      if (p.available) byStore[p.store_domain].available++;
    });

    Object.entries(byStore).forEach(([domain, counts]) => {
      console.log(`\n${domain}:`);
      console.log(`   Total: ${counts.total}`);
      console.log(`   Available: ${counts.available}`);
      console.log(`   Unavailable: ${counts.total - counts.available}`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

debugStores()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
