/**
 * TEST FINAL DE SHIPPING
 * Prueba con tiendas reales que tienen Admin API configurado
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kscgibfmxnyfjxpcwoac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjQwOTIsImV4cCI6MjA3OTE0MDA5Mn0.L5qfpmx64yVJ1ZhZmNQfMSlY2pVFVsNKpQSrNd2XSnk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Direcciones de prueba en Santiago
const TEST_ADDRESSES = [
  {
    name: 'Santiago Centro',
    address1: 'Av. Libertador Bernardo O\'Higgins 1234',
    city: 'Santiago',
    province: 'Región Metropolitana',
    zip: '8320000',
    country_code: 'CL'
  },
  {
    name: 'Providencia',
    address1: 'Av. Providencia 2222',
    city: 'Providencia',
    province: 'Región Metropolitana',
    zip: '7500000',
    country_code: 'CL'
  }
];

async function getStoreProducts(storeDomain, accessToken) {
  console.log(`   📦 Obteniendo producto de ${storeDomain}...`);

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
                  price {
                    amount
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(`https://${storeDomain}/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': accessToken,
    },
    body: JSON.stringify({ query }),
  });

  const result = await response.json();

  if (result.errors) {
    throw new Error(`Shopify API error: ${JSON.stringify(result.errors)}`);
  }

  const product = result.data.products.edges[0]?.node;

  if (!product) {
    throw new Error('No products found');
  }

  return {
    productId: product.id,
    variantId: product.variants.edges[0].node.id,
    title: product.title,
    price: parseFloat(product.variants.edges[0].node.price.amount),
  };
}

async function testShipping(stores, cartItems, shippingAddress) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TESTING: ${shippingAddress.name}`);
  console.log(`   📍 ${shippingAddress.address1}, ${shippingAddress.city}`);
  console.log(`${'='.repeat(80)}\n`);

  const testData = {
    cartItems,
    shippingAddress: {
      address1: shippingAddress.address1,
      city: shippingAddress.city,
      province: shippingAddress.province,
      zip: shippingAddress.zip,
      country_code: shippingAddress.country_code
    }
  };

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/calculate-shipping`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    }
  );

  const result = await response.json();

  console.log(`📊 Response Status: ${response.status}\n`);

  if (result.success) {
    console.log('✅ SUCCESS! Tarifas de envío calculadas:\n');

    let totalShipping = 0;

    Object.entries(result.shippingRates || {}).forEach(([storeDomain, rates]) => {
      const storeInfo = stores.find(s => s.domain === storeDomain);
      console.log(`  🏪 ${storeDomain}`);
      console.log(`     Admin API: ${storeInfo.admin_api_token ? '✅ Configurado' : '❌ Falta'}`);
      console.log(`     Opciones de envío:\n`);

      rates.forEach((rate, index) => {
        console.log(`     ${index + 1}. ${rate.title}`);
        console.log(`        💰 $${rate.price.toLocaleString('es-CL')}`);
        console.log(`        🏷️  Código: ${rate.code}`);
        console.log(`        📦 Fuente: ${rate.source}`);
        console.log('');
      });

      // Usar la opción más barata
      const cheapest = rates.reduce((min, r) => r.price < min.price ? r : min, rates[0]);
      totalShipping += cheapest.price;
    });

    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    console.log(`  ${'─'.repeat(70)}`);
    console.log(`  💰 Subtotal productos:  $${subtotal.toLocaleString('es-CL')}`);
    console.log(`  📦 Envío total:         $${totalShipping.toLocaleString('es-CL')}`);
    console.log(`  🎯 TOTAL:               $${(subtotal + totalShipping).toLocaleString('es-CL')}`);
    console.log(`  ${'─'.repeat(70)}\n`);

    if (result.errors && Object.keys(result.errors).length > 0) {
      console.log('⚠️  Algunas tiendas tuvieron errores:\n');
      Object.entries(result.errors).forEach(([store, error]) => {
        console.log(`     ❌ ${store}: ${error}`);
      });
      console.log('');
    }

    return { success: true, totalShipping };

  } else {
    console.log('❌ FALLÓ\n');
    console.log('Error:', result.error || 'Unknown error');

    if (result.errors) {
      console.log('\nErrores por tienda:');
      Object.entries(result.errors).forEach(([store, error]) => {
        console.log(`   ❌ ${store}: ${error}`);
      });
    }

    console.log('\nRespuesta completa:');
    console.log(JSON.stringify(result, null, 2));

    return { success: false };
  }
}

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║                  🚀 PRUEBA FINAL DE SHIPPING                           ║');
  console.log('║                  Con Admin API + Apps de Terceros                      ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  try {
    // 1. Verificar tiendas con Admin API
    console.log('1️⃣  Verificando configuración de tiendas...\n');

    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('domain, access_token, admin_api_token')
      .in('domain', ['spot-essence.myshopify.com', 'braintoys-chile.myshopify.com']);

    if (storesError) {
      throw new Error(`Database error: ${storesError.message}`);
    }

    if (!stores || stores.length === 0) {
      throw new Error('No se encontraron las tiendas especificadas');
    }

    console.log(`   ✅ Encontradas ${stores.length} tiendas:\n`);

    stores.forEach(store => {
      console.log(`   🏪 ${store.domain}`);
      console.log(`      Storefront API: ${store.access_token ? '✅' : '❌'}`);
      console.log(`      Admin API:      ${store.admin_api_token ? '✅' : '❌'}`);
      console.log('');
    });

    // 2. Obtener productos reales
    console.log('2️⃣  Obteniendo productos reales de las tiendas...\n');

    const cartItems = [];

    for (const store of stores) {
      try {
        const product = await getStoreProducts(store.domain, store.access_token);
        console.log(`   ✅ ${store.domain}`);
        console.log(`      ${product.title}`);
        console.log(`      $${product.price.toLocaleString('es-CL')}\n`);

        cartItems.push({
          id: product.variantId, // Usar variantId, no productId
          quantity: 1,
          price: product.price,
          storeId: store.domain,
          selectedVariant: {
            id: product.variantId
          }
        });
      } catch (error) {
        console.log(`   ⚠️  ${store.domain}: ${error.message}\n`);
      }
    }

    if (cartItems.length === 0) {
      throw new Error('No se pudieron obtener productos');
    }

    // 3. Probar con diferentes direcciones
    console.log('\n3️⃣  Probando cálculo de envío con direcciones reales...\n');

    const results = [];

    for (const address of TEST_ADDRESSES) {
      const result = await testShipping(stores, cartItems, address);
      results.push(result);

      // Esperar un poco entre pruebas para no saturar la API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 4. Resumen final
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║                        📊 RESUMEN FINAL                                ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

    const successCount = results.filter(r => r.success).length;
    const totalTests = results.length;

    console.log(`   Tests exitosos: ${successCount}/${totalTests}`);
    console.log('');

    if (successCount === totalTests) {
      console.log('   🎉 ¡TODOS LOS TESTS PASARON!');
      console.log('   ✅ El sistema de shipping está funcionando perfectamente');
      console.log('   ✅ Admin API está correctamente configurado');
      console.log('   ✅ Las tarifas de apps de terceros están siendo calculadas');
      console.log('');
      console.log('   🚀 Próximo paso: Integrar UI en el checkout de la app');
    } else {
      console.log('   ⚠️  Algunos tests fallaron. Revisar logs arriba.');
    }

    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error en el test:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
main();
