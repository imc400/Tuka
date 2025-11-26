const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkOrders() {
  console.log('=== Últimas 5 transacciones ===');
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('id, status, mp_payment_id, paid_at, created_at, total_amount, buyer_email')
    .order('created_at', { ascending: false })
    .limit(5);

  if (txError) {
    console.error('Error:', txError);
    return;
  }

  transactions.forEach(tx => {
    console.log(`\nTx #${tx.id}:`);
    console.log(`  Status: ${tx.status}`);
    console.log(`  MP Payment ID: ${tx.mp_payment_id || 'N/A'}`);
    console.log(`  Paid At: ${tx.paid_at || 'N/A'}`);
    console.log(`  Total: $${tx.total_amount}`);
    console.log(`  Email: ${tx.buyer_email}`);
    console.log(`  Created: ${tx.created_at}`);
  });

  console.log('\n=== Últimos 10 shopify_orders ===');
  const { data: orders, error: ordersError } = await supabase
    .from('shopify_orders')
    .select('id, transaction_id, store_domain, status, shopify_order_id, shopify_order_number, error_message, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (ordersError) {
    console.error('Error:', ordersError);
    return;
  }

  orders.forEach(order => {
    console.log(`\nOrder for Tx #${order.transaction_id}:`);
    console.log(`  Store: ${order.store_domain}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Shopify Order: ${order.shopify_order_number || 'N/A'}`);
    console.log(`  Shopify ID: ${order.shopify_order_id || 'N/A'}`);
    if (order.error_message) {
      console.log(`  ERROR: ${order.error_message}`);
    }
  });
}

checkOrders().then(() => process.exit(0));
