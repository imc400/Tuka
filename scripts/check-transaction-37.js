require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkTransaction() {
  console.log('=== Transacción #37 ===\n');

  // Obtener transacción
  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', 37)
    .single();

  if (txError) {
    console.error('Error:', txError);
    return;
  }

  console.log('ID:', tx.id);
  console.log('Status:', tx.status);
  console.log('Total:', tx.total_amount, 'CLP');
  console.log('MP Payment ID:', tx.mp_payment_id || 'N/A');
  console.log('Paid At:', tx.paid_at || 'N/A');
  console.log('Buyer:', tx.buyer_name, '-', tx.buyer_email);
  console.log('Phone:', tx.buyer_phone);
  console.log('\nShipping Address:');
  console.log(JSON.stringify(tx.shipping_address, null, 2));
  console.log('\nCart Items:');
  tx.cart_items.forEach((item, i) => {
    console.log(`  ${i+1}. ${item.name}`);
    console.log(`     Store: ${item.storeId}`);
    console.log(`     Price: $${item.price} x ${item.quantity}`);
    if (item.selectedVariant) {
      console.log(`     Variant: ${item.selectedVariant.title} (${item.selectedVariant.id})`);
    }
  });

  console.log('\nShipping Costs:');
  console.log(JSON.stringify(tx.shipping_costs, null, 2));

  // Verificar tokens de las tiendas involucradas
  const storeIds = [...new Set(tx.cart_items.map(item => item.storeId.replace(/^real-/, '')))];
  console.log('\n=== Tiendas involucradas ===');

  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('domain, store_name, admin_api_token')
    .in('domain', storeIds);

  if (storesError) {
    console.error('Error obteniendo tiendas:', storesError);
    return;
  }

  stores.forEach(store => {
    console.log(`\n${store.store_name} (${store.domain}):`);
    console.log(`  Admin API Token: ${store.admin_api_token ? '✅ Configurado (' + store.admin_api_token.substring(0, 10) + '...)' : '❌ NO CONFIGURADO'}`);
  });

  // Verificar órdenes existentes
  console.log('\n=== Órdenes en DB para esta transacción ===');
  const { data: orders, error: ordersError } = await supabase
    .from('shopify_orders')
    .select('*')
    .eq('transaction_id', 37);

  if (ordersError) {
    console.error('Error:', ordersError);
    return;
  }

  if (orders.length === 0) {
    console.log('No hay órdenes creadas aún');
  } else {
    orders.forEach(order => {
      console.log(`\n  Store: ${order.store_domain}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  Shopify Order: ${order.shopify_order_number || 'N/A'}`);
      if (order.error_message) {
        console.log(`  ERROR: ${order.error_message}`);
      }
    });
  }
}

checkTransaction().then(() => process.exit(0));
