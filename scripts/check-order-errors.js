const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkOrderErrors() {
  const { data: orders } = await supabase
    .from('shopify_orders')
    .select('*')
    .eq('transaction_id', 8)
    .order('created_at', { ascending: false });

  console.log('\n📋 Detalles de las órdenes fallidas:\n');

  orders.forEach((order, i) => {
    console.log(`Orden ${i + 1}:`);
    console.log(`  Tienda: ${order.store_domain}`);
    console.log(`  Estado: ${order.status}`);
    console.log(`  Error: ${order.error_message || 'N/A'}`);
    console.log('');
  });
}

checkOrderErrors();
