/**
 * Test MVP con subtotal bajo (debe mostrar $3.990 default)
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kscgibfmxnyfjxpcwoac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjQwOTIsImV4cCI6MjA3OTE0MDA5Mn0.L5qfpmx64yVJ1ZhZmNQfMSlY2pVFVsNKpQSrNd2XSnk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testLowSubtotal() {
  console.log('\n🧪 Test MVP - Subtotal Bajo (debe mostrar $3.990)\n');

  // Obtener productos reales
  const { data: stores } = await supabase
    .from('stores')
    .select('domain, access_token')
    .in('domain', ['spot-essence.myshopify.com', 'braintoys-chile.myshopify.com']);

  const cartItems = [];

  for (const store of stores) {
    const query = `
      {
        products(first: 1) {
          edges {
            node {
              title
              variants(first: 1) {
                edges {
                  node {
                    id
                    price { amount }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(`https://${store.domain}/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': store.access_token,
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    const product = result.data.products.edges[0].node;
    const variant = product.variants.edges[0].node;

    console.log(`✅ ${store.domain}`);
    console.log(`   ${product.title}`);
    console.log(`   $${parseFloat(variant.price.amount).toLocaleString('es-CL')}\n`);

    cartItems.push({
      id: variant.id,
      quantity: 1,
      price: parseFloat(variant.price.amount),
      storeId: store.domain,
      selectedVariant: { id: variant.id }
    });
  }

  const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
  console.log(`💰 Subtotal total: $${subtotal.toLocaleString('es-CL')}`);
  console.log(`   (Este monto NO califica para tarifas nativas)\n`);

  // Llamar Edge Function
  console.log('📡 Calculando envíos...\n');

  const shippingResponse = await fetch(
    `${SUPABASE_URL}/functions/v1/calculate-shipping`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cartItems,
        shippingAddress: {
          address1: 'Av. Providencia 2222',
          city: 'Santiago',
          province: 'Región Metropolitana',
          zip: '7500000',
          country_code: 'CL'
        }
      })
    }
  );

  const result = await shippingResponse.json();

  if (result.success) {
    console.log('✅ SUCCESS! Tarifas obtenidas:\n');

    Object.entries(result.shippingRates).forEach(([domain, rates]) => {
      console.log(`🏪 ${domain}:`);
      rates.forEach(rate => {
        console.log(`   📦 ${rate.title}: $${rate.price.toLocaleString('es-CL')}`);
        console.log(`      Fuente: ${rate.source}`);
      });
      console.log('');
    });

    // Verificar que muestra $3.990
    const allRates = Object.values(result.shippingRates).flat();
    const hasDefaultRate = allRates.some(r => r.price === 3990 && r.source === 'default-mvp');

    if (hasDefaultRate) {
      console.log('✅ CORRECTO: Muestra tarifa default MVP de $3.990');
    } else {
      console.log('⚠️  Advertencia: No se encontró tarifa default de $3.990');
    }

  } else {
    console.log('❌ FAILED');
    console.log(JSON.stringify(result, null, 2));
  }
}

testLowSubtotal().catch(console.error);
