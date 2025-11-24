/**
 * Ver detalle del último pedido
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kscgibfmxnyfjxpcwoac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjQwOTIsImV4cCI6MjA3OTE0MDA5Mn0.L5qfpmx64yVJ1ZhZmNQfMSlY2pVFVsNKpQSrNd2XSnk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTransaction() {
  console.log('\n🔍 Verificando último pedido (ID 28)...\n');

  const { data: transaction, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', 28)
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('═'.repeat(80));
  console.log('📦 PEDIDO DETALLADO');
  console.log('═'.repeat(80));
  console.log('');

  console.log('🆔 INFORMACIÓN GENERAL:');
  console.log(`   ID Transacción: ${transaction.id}`);
  console.log(`   MercadoPago Payment ID: ${transaction.mp_payment_id || 'N/A'}`);
  console.log(`   Estado: ${transaction.status}`);
  console.log(`   Fecha: ${new Date(transaction.created_at).toLocaleString('es-CL')}`);
  console.log(`   Usuario: ${transaction.user_id}`);
  console.log('');

  console.log('💰 TOTALES:');
  console.log(`   Total pagado: $${transaction.total_amount?.toLocaleString('es-CL')}`);
  console.log(`   Moneda: ${transaction.currency || 'CLP'}`);
  console.log('');

  // Cart items
  if (transaction.cart_items) {
    const items = typeof transaction.cart_items === 'string'
      ? JSON.parse(transaction.cart_items)
      : transaction.cart_items;

    console.log('🛒 PRODUCTOS EN EL CARRITO:');

    if (Array.isArray(items)) {
      let subtotal = 0;

      items.forEach((item, idx) => {
        const title = item.title || item.name || 'Sin título';
        const quantity = item.quantity || 1;
        const price = item.price || 0;
        const itemTotal = price * quantity;
        subtotal += itemTotal;

        console.log(`\n   ${idx + 1}. ${title}`);
        console.log(`      Tienda: ${item.storeId || item.store_id || 'N/A'}`);
        console.log(`      Cantidad: ${quantity}`);
        console.log(`      Precio unitario: $${price.toLocaleString('es-CL')}`);
        console.log(`      Subtotal item: $${itemTotal.toLocaleString('es-CL')}`);
      });

      console.log(`\n   ──────────────────────────`);
      console.log(`   Subtotal productos: $${subtotal.toLocaleString('es-CL')}`);
    }

    console.log('');
  }

  // Shipping costs
  if (transaction.shipping_costs) {
    const shipping = typeof transaction.shipping_costs === 'string'
      ? JSON.parse(transaction.shipping_costs)
      : transaction.shipping_costs;

    console.log('🚚 COSTOS DE ENVÍO:');

    if (typeof shipping === 'object') {
      let totalShipping = 0;

      Object.entries(shipping).forEach(([storeDomain, rates]) => {
        console.log(`\n   🏪 ${storeDomain}:`);

        if (Array.isArray(rates)) {
          rates.forEach(rate => {
            console.log(`      📦 ${rate.title}`);
            console.log(`         Precio: $${rate.price?.toLocaleString('es-CL')}`);
            console.log(`         Fuente: ${rate.source}`);
            console.log(`         ID: ${rate.id}`);

            totalShipping += rate.price || 0;
          });
        } else if (rates.price !== undefined) {
          // Caso de un solo rate
          console.log(`      📦 ${rates.title || 'Envío'}`);
          console.log(`         Precio: $${rates.price?.toLocaleString('es-CL')}`);
          console.log(`         Fuente: ${rates.source}`);

          totalShipping += rates.price || 0;
        }
      });

      console.log(`\n   ──────────────────────────`);
      console.log(`   Total envío: $${totalShipping.toLocaleString('es-CL')}`);

      // Verificar tipo de envío aplicado
      console.log('');
      console.log('✅ ANÁLISIS DE ENVÍO:');

      if (totalShipping === 0) {
        console.log('   🎉 ENVÍO GRATIS aplicado (calificó para promoción)');
      } else if (totalShipping === 3990) {
        console.log('   📦 Envío estándar MVP ($3.990) aplicado');
      } else if (totalShipping === 990) {
        console.log('   📦 Envío promocional Shopify ($990) aplicado');
      } else {
        console.log(`   📦 Envío personalizado: $${totalShipping.toLocaleString('es-CL')}`);
      }
    }

    console.log('');
  }

  // Shipping address
  if (transaction.shipping_address) {
    const addr = typeof transaction.shipping_address === 'string'
      ? JSON.parse(transaction.shipping_address)
      : transaction.shipping_address;

    console.log('📍 DIRECCIÓN DE ENVÍO:');
    console.log(`   ${addr.address1 || addr.street || 'Sin dirección'}`);
    if (addr.address2) console.log(`   ${addr.address2}`);
    console.log(`   ${addr.city || 'Sin ciudad'}, ${addr.province || addr.state || ''}`);
    console.log(`   CP: ${addr.zip || addr.postal_code || 'N/A'}`);
    console.log(`   País: ${addr.country || addr.country_code || 'Chile'}`);
    console.log('');
  }

  // Store splits
  if (transaction.store_splits) {
    const splits = typeof transaction.store_splits === 'string'
      ? JSON.parse(transaction.store_splits)
      : transaction.store_splits;

    console.log('🏪 DISTRIBUCIÓN POR TIENDA (Store Splits):');

    Object.entries(splits).forEach(([store, amount]) => {
      console.log(`   ${store}: $${amount?.toLocaleString('es-CL')}`);
    });

    console.log('');
  }

  // Payment info
  console.log('💳 INFORMACIÓN DE PAGO:');
  console.log(`   Método: ${transaction.payment_method || 'N/A'}`);
  console.log(`   Email: ${transaction.buyer_email || 'N/A'}`);
  console.log(`   Nombre: ${transaction.buyer_name || 'N/A'}`);
  console.log(`   Teléfono: ${transaction.buyer_phone || 'N/A'}`);
  console.log(`   Fecha de pago: ${transaction.paid_at ? new Date(transaction.paid_at).toLocaleString('es-CL') : 'N/A'}`);
  console.log(`   Test: ${transaction.is_test ? 'SÍ' : 'NO'}`);
  console.log('');

  console.log('═'.repeat(80));
  console.log('✅ PEDIDO REGISTRADO CORRECTAMENTE');
  console.log('═'.repeat(80));
  console.log('');
}

checkTransaction();
