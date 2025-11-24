/**
 * Verificar último pedido en la base de datos
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kscgibfmxnyfjxpcwoac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjQwOTIsImV4cCI6MjA3OTE0MDA5Mn0.L5qfpmx64yVJ1ZhZmNQfMSlY2pVFVsNKpQSrNd2XSnk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkLastOrder() {
  console.log('\n🔍 Verificando últimos pedidos en la base de datos...\n');

  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) {
      console.error('❌ Error al consultar pedidos:', error.message);
      return;
    }

    if (!orders || orders.length === 0) {
      console.log('❌ No se encontraron pedidos en la base de datos');
      return;
    }

    console.log(`✅ Encontrados ${orders.length} pedidos recientes:\n`);

    orders.forEach((order, i) => {
      console.log('═'.repeat(80));
      console.log(`📦 PEDIDO ${i + 1}`);
      console.log('═'.repeat(80));
      console.log(`ID: ${order.id}`);
      console.log(`Estado: ${order.status}`);
      console.log(`Usuario ID: ${order.user_id}`);
      console.log(`Fecha: ${new Date(order.created_at).toLocaleString('es-CL')}`);
      console.log('');

      // Totales
      console.log('💰 TOTALES:');
      console.log(`   Subtotal: $${order.subtotal?.toLocaleString('es-CL') || '0'}`);
      console.log(`   Envío:    $${order.shipping_cost?.toLocaleString('es-CL') || '0'}`);
      console.log(`   Total:    $${order.total?.toLocaleString('es-CL') || '0'}`);
      console.log('');

      // Items
      if (order.items) {
        console.log('📋 ITEMS:');
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

        if (Array.isArray(items)) {
          items.forEach((item, idx) => {
            const title = item.title || item.name || item.product_title || 'Sin título';
            const quantity = item.quantity || 1;
            const price = item.price || 0;
            const store = item.store_id || item.storeId || 'Sin tienda';

            console.log(`   ${idx + 1}. ${title}`);
            console.log(`      Cantidad: ${quantity}`);
            console.log(`      Precio: $${price.toLocaleString('es-CL')}`);
            console.log(`      Tienda: ${store}`);
            console.log('');
          });
        } else {
          console.log('   ⚠️  Items no es un array:', typeof items);
        }
      } else {
        console.log('📋 ITEMS: No hay items registrados');
      }

      // Dirección de envío
      if (order.shipping_address) {
        console.log('📍 DIRECCIÓN DE ENVÍO:');
        const addr = typeof order.shipping_address === 'string'
          ? JSON.parse(order.shipping_address)
          : order.shipping_address;

        console.log(`   ${addr.address1 || addr.street || 'Sin dirección'}`);
        console.log(`   ${addr.city || 'Sin ciudad'}, ${addr.province || addr.state || ''}`);
        console.log(`   ${addr.zip || addr.postal_code || 'Sin código postal'}`);
        console.log(`   ${addr.country || addr.country_code || 'Sin país'}`);
      } else {
        console.log('📍 DIRECCIÓN: No registrada');
      }

      // Método de envío seleccionado
      if (order.shipping_method) {
        console.log('');
        console.log('🚚 MÉTODO DE ENVÍO SELECCIONADO:');
        const method = typeof order.shipping_method === 'string'
          ? JSON.parse(order.shipping_method)
          : order.shipping_method;

        console.log(`   ${method.title || 'Sin título'}`);
        console.log(`   Costo: $${(method.price || 0).toLocaleString('es-CL')}`);
        console.log(`   Fuente: ${method.source || 'No especificado'}`);
      }

      // Payment info
      if (order.payment_id) {
        console.log('');
        console.log('💳 PAGO:');
        console.log(`   Payment ID: ${order.payment_id}`);
        console.log(`   Método: ${order.payment_method || 'No especificado'}`);
      }

      console.log('\n');
    });

    // Resumen
    console.log('═'.repeat(80));
    console.log('📊 RESUMEN');
    console.log('═'.repeat(80));

    const lastOrder = orders[0];
    const shippingCost = lastOrder.shipping_cost || 0;

    if (shippingCost === 0) {
      console.log('✅ Envío GRATIS aplicado correctamente');
    } else if (shippingCost === 3990) {
      console.log('✅ Envío estándar MVP ($3.990) aplicado correctamente');
    } else if (shippingCost === 990) {
      console.log('✅ Envío nativo de Shopify ($990) aplicado correctamente');
    } else {
      console.log(`ℹ️  Costo de envío: $${shippingCost.toLocaleString('es-CL')}`);
    }

    console.log(`\nTotal del pedido: $${(lastOrder.total || 0).toLocaleString('es-CL')}`);
    console.log(`Estado: ${lastOrder.status}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

checkLastOrder();
