/**
 * Test de rendimiento - medir tiempo de respuesta
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kscgibfmxnyfjxpcwoac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjQwOTIsImV4cCI6MjA3OTE0MDA5Mn0.L5qfpmx64yVJ1ZhZmNQfMSlY2pVFVsNKpQSrNd2XSnk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testPerformance() {
  console.log('\n⚡ TEST DE RENDIMIENTO - Shipping Calculation\n');

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

    cartItems.push({
      id: variant.id,
      quantity: 1,
      price: parseFloat(variant.price.amount),
      storeId: store.domain,
      selectedVariant: { id: variant.id }
    });
  }

  const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);

  console.log('📦 Escenario de prueba:');
  console.log(`   ${cartItems.length} productos`);
  console.log(`   Subtotal: $${subtotal.toLocaleString('es-CL')}`);
  console.log(`   (Subtotal bajo - debería usar quick fallback)\n`);

  // Test 1: Medir tiempo
  console.log('🚀 Iniciando cálculo...\n');

  const startTime = Date.now();

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

  const endTime = Date.now();
  const duration = endTime - startTime;

  const result = await shippingResponse.json();

  console.log('═'.repeat(70));
  console.log('⏱️  RESULTADO DE RENDIMIENTO');
  console.log('═'.repeat(70));
  console.log('');

  console.log(`⚡ Tiempo de respuesta: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
  console.log('');

  if (duration < 3000) {
    console.log('✅ EXCELENTE: Menos de 3 segundos');
  } else if (duration < 5000) {
    console.log('✅ BUENO: Menos de 5 segundos');
  } else if (duration < 8000) {
    console.log('⚠️  ACEPTABLE: Menos de 8 segundos');
  } else {
    console.log('❌ LENTO: Más de 8 segundos');
  }

  console.log('');

  if (result.success) {
    console.log('✅ Cálculo exitoso\n');

    Object.entries(result.shippingRates).forEach(([domain, rates]) => {
      console.log(`🏪 ${domain}:`);
      rates.forEach(rate => {
        console.log(`   📦 ${rate.title}: $${rate.price.toLocaleString('es-CL')}`);
        console.log(`      Fuente: ${rate.source}`);
      });
      console.log('');
    });
  } else {
    console.log('❌ Cálculo falló');
    console.log(JSON.stringify(result, null, 2));
  }

  console.log('═'.repeat(70));
  console.log('📊 ANÁLISIS');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Optimizaciones aplicadas:');
  console.log('✅ Quick fallback para subtotales bajos (<$40.000)');
  console.log('✅ Polling reducido: 3-5 intentos (vs 10 anteriormente)');
  console.log('✅ Delays reducidos: 500-800ms (vs 1000-1500ms)');
  console.log('✅ Admin API fallback instantáneo con tarifa default');
  console.log('');
  console.log(`Tiempo objetivo: < 5 segundos`);
  console.log(`Tiempo actual: ${(duration / 1000).toFixed(2)}s`);
  console.log('');

  if (duration < 5000) {
    console.log('🎉 ¡OBJETIVO ALCANZADO! UX óptima');
  } else {
    console.log('⚠️  Se puede mejorar más - considerar cache o skip Storefront API directo');
  }

  console.log('');
}

testPerformance().catch(console.error);
