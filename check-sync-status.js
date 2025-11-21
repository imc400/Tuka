const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSyncStatus() {
  console.log('🔍 Checking sync status and product counts...\n');

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
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏪 ${store.store_name} (${store.domain})`);
    console.log(`${'='.repeat(60)}`);

    // Count all products (available + unavailable)
    const { count: totalCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_domain', store.domain);

    // Count available products
    const { count: availableCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_domain', store.domain)
      .eq('available', true);

    // Count unavailable products
    const { count: unavailableCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_domain', store.domain)
      .eq('available', false);

    console.log(`  📦 Total products in DB: ${totalCount}`);
    console.log(`  ✅ Available (shown in app): ${availableCount}`);
    console.log(`  ❌ Unavailable (hidden): ${unavailableCount}`);

    // Get last sync info
    const { data: lastSync } = await supabase
      .from('sync_logs')
      .select('*')
      .eq('store_domain', store.domain)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (lastSync) {
      console.log(`\n  📅 Last sync:`);
      console.log(`     Started: ${new Date(lastSync.started_at).toLocaleString()}`);
      console.log(`     Status: ${lastSync.status}`);
      console.log(`     Products synced: ${lastSync.products_synced || 'N/A'}`);
      console.log(`     Duration: ${lastSync.duration_seconds || 'N/A'}s`);

      if (lastSync.completed_at) {
        console.log(`     Completed: ${new Date(lastSync.completed_at).toLocaleString()}`);
      }
    } else {
      console.log(`\n  ⚠️  No sync history found`);
    }

    // Sample some unavailable products to see why
    const { data: unavailableSamples } = await supabase
      .from('products')
      .select('id, title, available')
      .eq('store_domain', store.domain)
      .eq('available', false)
      .limit(5);

    if (unavailableSamples && unavailableSamples.length > 0) {
      console.log(`\n  🔍 Sample unavailable products:`);
      unavailableSamples.forEach(p => {
        console.log(`     - ${p.title}`);
      });
    }
  }

  console.log(`\n${'='.repeat(60)}\n`);
}

checkSyncStatus()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
