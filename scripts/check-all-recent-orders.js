const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAllRecentOrders() {
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n📊 Últimas 5 transacciones:\n');

  for (const tx of transactions) {
    console.log(`Transacción #${tx.id}:`);
    console.log(`  Monto: ${tx.total_amount} ${tx.currency}`);
    console.log(`  Estado: ${tx.status}`);
    console.log(`  MercadoPago Payment ID: ${tx.mp_payment_id || 'N/A'}`);
    console.log(`  Fecha: ${new Date(tx.created_at).toLocaleString()}`);

    const { data: orders } = await supabase
      .from('shopify_orders')
      .select('*')
      .eq('transaction_id', tx.id);

    console.log(`  Órdenes: ${orders ? orders.length : 0}`);
    
    if (orders && orders.length > 0) {
      orders.forEach(order => {
        console.log(`    - ${order.store_domain}: ${order.status} (${order.shopify_order_number || 'N/A'})`);
      });
    }
    console.log('');
  }
}

checkAllRecentOrders();
