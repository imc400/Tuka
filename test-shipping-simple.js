/**
 * Test simple y directo de la Edge Function calculate-shipping
 */

const SUPABASE_URL = 'https://kscgibfmxnyfjxpcwoac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjQwOTIsImV4cCI6MjA3OTE0MDA5Mn0.L5qfpmx64yVJ1ZhZmNQfMSlY2pVFVsNKpQSrNd2XSnk';

async function testSimple() {
  console.log('🧪 Test simple de calculate-shipping\n');

  // Test con spot-essence - subtotal $60.000 (debería calificar para $990 y Gratis)
  const testPayload = {
    cartItems: [
      {
        id: 'gid://shopify/ProductVariant/12345',
        quantity: 1,
        price: 60000,
        storeId: 'real-spot-essence.myshopify.com',
        selectedVariant: {
          id: 'gid://shopify/ProductVariant/12345'
        }
      }
    ],
    shippingAddress: {
      address1: 'Av. Providencia 2222',
      city: 'Santiago',
      province: 'Región Metropolitana',
      zip: '7500000',
      country_code: 'CL'
    }
  };

  console.log('📦 Payload:');
  console.log(JSON.stringify(testPayload, null, 2));
  console.log('\n📡 Calling Edge Function...\n');

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/calculate-shipping`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(testPayload),
      }
    );

    console.log(`Status: ${response.status} ${response.statusText}\n`);

    const data = await response.json();

    console.log('📥 Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    if (data.success && data.shippingRates['spot-essence.myshopify.com']) {
      const rates = data.shippingRates['spot-essence.myshopify.com'];
      console.log(`✅ SUCCESS! Found ${rates.length} rates:\n`);

      rates.forEach((rate, i) => {
        console.log(`   ${i + 1}. ${rate.title}`);
        console.log(`      💰 $${rate.price.toLocaleString('es-CL')}`);
        console.log(`      🔖 Source: ${rate.source}`);
        console.log('');
      });
    } else {
      console.log('❌ FAILED\n');

      if (data.errors) {
        console.log('Errors:');
        console.log(JSON.stringify(data.errors, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testSimple();
