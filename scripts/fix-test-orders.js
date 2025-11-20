const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function fixTestOrders() {
  console.log('\n🔧 Arreglando órdenes de prueba...\n');

  // Get transaction
  const { data: transaction } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', 1)
    .single();

  if (!transaction) {
    console.log('❌ No se encontró la transacción\n');
    return;
  }

  console.log('📦 Transacción encontrada:', transaction.id);
  console.log('   Monto total:', transaction.total_amount, 'CLP');
  console.log('');

  // Group items by store
  const itemsByStore = {};

  transaction.cart_items.forEach((item) => {
    // Clean "real-" prefix
    const cleanDomain = item.storeId.replace(/^real-/, '');

    if (!itemsByStore[cleanDomain]) {
      itemsByStore[cleanDomain] = [];
    }
    itemsByStore[cleanDomain].push(item);
  });

  console.log('🛒 Creando órdenes para', Object.keys(itemsByStore).length, 'tienda(s)...\n');

  // Create orders
  for (const [storeDomain, items] of Object.entries(itemsByStore)) {
    const orderAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    console.log('   📝 Tienda:', storeDomain);
    console.log('      Items:', items.length);
    console.log('      Monto:', orderAmount, 'CLP');

    const { data, error } = await supabase.from('shopify_orders').insert({
      transaction_id: transaction.id,
      store_domain: storeDomain,
      order_amount: orderAmount,
      order_items: items,
      status: 'created',
      shopify_order_id: `test_${Date.now()}_${storeDomain}`,
      shopify_order_number: `#TEST-${Math.floor(1000 + Math.random() * 9000)}`,
      synced_at: new Date().toISOString(),
    }).select();

    if (error) {
      console.log('      ❌ Error:', error.message);
    } else {
      console.log('      ✅ Orden creada:', data[0].shopify_order_number);
    }
    console.log('');
  }

  console.log('═'.repeat(60));
  console.log('✅ Órdenes creadas exitosamente');
  console.log('');
  console.log('Verifica en Supabase → Table Editor → shopify_orders');
  console.log('═'.repeat(60));
  console.log('');
}

fixTestOrders();
