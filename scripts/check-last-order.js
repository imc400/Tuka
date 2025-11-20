const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkLastOrder() {
  console.log('\n🔍 Verificando última transacción...\n');

  // Get last transaction
  const { data: transaction } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!transaction) {
    console.log('❌ No se encontró ninguna transacción\n');
    return;
  }

  console.log('📦 TRANSACCIÓN:');
  console.log('   ID:', transaction.id);
  console.log('   Monto Total:', transaction.total_amount, transaction.currency);
  console.log('   Estado:', transaction.status);
  console.log('   Es prueba:', transaction.is_test ? 'SÍ ✅' : 'NO');
  console.log('   Comprador:', transaction.buyer_name);
  console.log('   Email:', transaction.buyer_email);
  console.log('   Creada:', new Date(transaction.created_at).toLocaleString());
  console.log('');

  // Get orders for this transaction
  const { data: orders } = await supabase
    .from('shopify_orders')
    .select('*')
    .eq('transaction_id', transaction.id);

  console.log('🛒 ÓRDENES CREADAS:');
  console.log('   Total órdenes:', orders ? orders.length : 0);
  console.log('');

  if (orders && orders.length > 0) {
    orders.forEach((order, index) => {
      console.log('   Orden', index + 1 + ':');
      console.log('      Tienda:', order.store_domain);
      console.log('      Monto:', order.order_amount, 'CLP');
      console.log('      Estado:', order.status);
      console.log('      Shopify Order ID:', order.shopify_order_id || 'N/A');
      console.log('      Número de Orden:', order.shopify_order_number || 'N/A');
      console.log('      Cantidad de items:', order.order_items ? order.order_items.length : 0);
      console.log('');
    });
  }

  // Summary
  console.log('═'.repeat(60));
  if (transaction.is_test) {
    console.log('✅ PRUEBA EXITOSA');
    console.log('');
    console.log('📝 Sobre las órdenes en Shopify:');
    console.log('   El "Pago de Prueba" NO crea órdenes reales en Shopify.');
    console.log('   Solo crea registros en Supabase para testing.');
    console.log('');
    console.log('   Para crear órdenes REALES en Shopify, necesitas:');
    console.log('   1. Desplegar las Edge Functions (mp-webhook)');
    console.log('   2. Configurar webhook de MercadoPago');
    console.log('   3. Usar el botón "Pagar" (azul) con MercadoPago');
    console.log('');
    console.log('   Entonces el flujo será:');
    console.log('   Usuario paga → MercadoPago notifica webhook →');
    console.log('   Webhook crea Draft Orders en Shopify →');
    console.log('   Draft Orders se completan → Órdenes marcadas como pagadas');
    console.log('');
  } else {
    console.log('✅ TRANSACCIÓN REAL');
    console.log('   Las órdenes DEBERÍAN estar en Shopify como Draft Orders.');
    console.log('   Verifica en: https://TIENDA.myshopify.com/admin/orders');
  }
  console.log('═'.repeat(60));
  console.log('');
}

checkLastOrder().catch(console.error);
