const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAdminTokens() {
  const { data: stores } = await supabase
    .from('stores')
    .select('domain, store_name, access_token, admin_api_token')
    .order('created_at', { ascending: false });

  console.log('\n📊 Estado de Admin API Tokens:\n');

  stores.forEach(store => {
    const hasStorefront = store.access_token ? '✅' : '❌';
    const hasAdmin = store.admin_api_token ? '✅' : '❌';

    console.log(`${store.store_name || store.domain}`);
    console.log(`  ${hasStorefront} Storefront API`);
    console.log(`  ${hasAdmin} Admin API Token ${!store.admin_api_token ? '← FALTA AGREGAR' : ''}`);
    console.log('');
  });

  const allReady = stores.every(s => s.admin_api_token);

  if (allReady) {
    console.log('🎉 ¡Todas las tiendas están listas para procesar órdenes!\n');
  } else {
    console.log('⚠️  Algunas tiendas no tienen Admin API token.');
    console.log('   Agrégalos en: http://localhost:3002\n');
  }
}

checkAdminTokens();
