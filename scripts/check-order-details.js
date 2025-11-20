const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkOrderDetails() {
  const { data: orders } = await supabase
    .from('shopify_orders')
    .select('*')
    .eq('transaction_id', 10);

  console.log('\n📋 Detalles completos de las órdenes:\n');

  orders.forEach((order, index) => {
    console.log(`Orden ${index + 1}:`);
    console.log(`  Tienda: ${order.store_domain}`);
    console.log(`  Estado: ${order.status}`);
    console.log(`  Shopify Order ID: ${order.shopify_order_id || 'N/A'}`);
    console.log(`  Shopify Order Number: ${order.shopify_order_number || 'N/A'}`);
    console.log(`  Shopify Draft Order ID: ${order.shopify_draft_order_id || 'N/A'}`);
    console.log(`  Error: ${order.error_message || 'N/A'}`);
    console.log('');
  });
}

checkOrderDetails();
