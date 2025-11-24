/**
 * Debug simple para ver qué está pasando
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kscgibfmxnyfjxpcwoac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjQwOTIsImV4cCI6MjA3OTE0MDA5Mn0.L5qfpmx64yVJ1ZhZmNQfMSlY2pVFVsNKpQSrNd2XSnk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  console.log('\n🔍 Debug: Obtener productos reales y probar\n');

  // 1. Obtener tienda y token
  const { data: store } = await supabase
    .from('stores')
    .select('domain, access_token')
    .eq('domain', 'spot-essence.myshopify.com')
    .single();

  console.log('✅ Tienda:', store.domain);

  // 2. Obtener un producto real
  const query = `
    {
      products(first: 1) {
        edges {
          node {
            id
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

  console.log('✅ Producto:', product.title);
  console.log('✅ Variant ID:', variant.id);
  console.log('✅ Price:', variant.price.amount);

  // 3. Crear payload con subtotal alto para que califique para tarifas
  const payload = {
    cartItems: [
      {
        id: variant.id,
        quantity: 10, // Alto para alcanzar el mínimo
        price: parseFloat(variant.price.amount) * 10,
        storeId: store.domain,
        selectedVariant: { id: variant.id }
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

  console.log('\n📦 Cart subtotal:', payload.cartItems[0].price.toLocaleString('es-CL'));
  console.log('📡 Calling Edge Function...\n');

  // 4. Llamar Edge Function
  const shippingResponse = await fetch(
    `${SUPABASE_URL}/functions/v1/calculate-shipping`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    }
  );

  const shippingResult = await shippingResponse.json();

  console.log('📥 Response:');
  console.log(JSON.stringify(shippingResult, null, 2));
}

test().catch(console.error);
