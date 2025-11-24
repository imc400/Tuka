/**
 * Test directo de Draft Order API
 * Para verificar qué responde Shopify exactamente
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kscgibfmxnyfjxpcwoac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjQwOTIsImV4cCI6MjA3OTE0MDA5Mn0.L5qfpmx64yVJ1ZhZmNQfMSlY2pVFVsNKpQSrNd2XSnk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDraftOrder(storeDomain, adminToken, variantId) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing ${storeDomain}`);
  console.log(`${'='.repeat(80)}\n`);

  // Extract numeric ID from GID
  const numericId = variantId.includes('gid://')
    ? variantId.split('/').pop()
    : variantId;

  console.log(`📦 Variant ID: ${variantId}`);
  console.log(`🔢 Numeric ID: ${numericId}\n`);

  const draftOrderPayload = {
    draft_order: {
      line_items: [{
        variant_id: parseInt(numericId, 10),
        quantity: 1
      }],
      shipping_address: {
        address1: 'Av. Providencia 2222',
        city: 'Providencia',
        province: 'Región Metropolitana',
        zip: '7500000',
        country_code: 'CL'
      },
      use_customer_default_address: false
    }
  };

  console.log('📤 Creating draft order...');
  console.log(JSON.stringify(draftOrderPayload, null, 2));
  console.log('');

  try {
    // Step 1: Create draft order
    const createResponse = await fetch(
      `https://${storeDomain}/admin/api/2024-10/draft_orders.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': adminToken,
        },
        body: JSON.stringify(draftOrderPayload),
      }
    );

    console.log(`📊 Create Response Status: ${createResponse.status} ${createResponse.statusText}\n`);

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('❌ Error creating draft order:');
      console.error(errorText);
      return;
    }

    const createData = await createResponse.json();
    console.log('✅ Draft order created:');
    console.log(JSON.stringify(createData, null, 2));
    console.log('');

    const draftOrderId = createData.draft_order?.id;

    if (!draftOrderId) {
      console.error('❌ No draft order ID returned');
      return;
    }

    // Step 2: Wait and fetch with shipping rates
    console.log(`⏳ Waiting 1 second for Shopify to calculate shipping...\n`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`📥 Fetching draft order ${draftOrderId} with shipping rates...\n`);

    const fetchResponse = await fetch(
      `https://${storeDomain}/admin/api/2024-10/draft_orders/${draftOrderId}.json`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': adminToken,
        },
      }
    );

    console.log(`📊 Fetch Response Status: ${fetchResponse.status} ${fetchResponse.statusText}\n`);

    const fetchData = await fetchResponse.json();
    console.log('📦 Draft order with rates:');
    console.log(JSON.stringify(fetchData, null, 2));
    console.log('');

    // Analyze shipping info
    const draftOrder = fetchData.draft_order;

    console.log('\n📊 ANÁLISIS DE SHIPPING:\n');
    console.log(`   Shipping line: ${draftOrder.shipping_line ? 'SÍ' : 'NO'}`);
    if (draftOrder.shipping_line) {
      console.log(`      Title: ${draftOrder.shipping_line.title}`);
      console.log(`      Price: $${draftOrder.shipping_line.price}`);
      console.log(`      Code: ${draftOrder.shipping_line.code || 'N/A'}`);
    }

    console.log(`\n   Available shipping rates: ${draftOrder.available_shipping_rates ? 'SÍ' : 'NO'}`);
    if (draftOrder.available_shipping_rates) {
      const rates = draftOrder.available_shipping_rates.shipping_rates || [];
      console.log(`      Count: ${rates.length}`);
      rates.forEach((rate, i) => {
        console.log(`\n      Rate ${i + 1}:`);
        console.log(`         Title: ${rate.title}`);
        console.log(`         Price: $${rate.price}`);
        console.log(`         Code: ${rate.code || 'N/A'}`);
        console.log(`         Source: ${rate.source || 'N/A'}`);
      });
    }

    // Step 3: Cleanup
    console.log(`\n🗑️  Deleting draft order ${draftOrderId}...\n`);

    await fetch(
      `https://${storeDomain}/admin/api/2024-10/draft_orders/${draftOrderId}.json`,
      {
        method: 'DELETE',
        headers: {
          'X-Shopify-Access-Token': adminToken,
        },
      }
    );

    console.log('✅ Draft order deleted\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

async function main() {
  console.log('\n🧪 TEST DIRECTO DE DRAFT ORDER API\n');

  // Get stores with admin tokens
  const { data: stores } = await supabase
    .from('stores')
    .select('domain, access_token, admin_api_token')
    .in('domain', ['spot-essence.myshopify.com', 'braintoys-chile.myshopify.com']);

  for (const store of stores) {
    if (!store.admin_api_token) {
      console.log(`⚠️  ${store.domain} no tiene admin_api_token\n`);
      continue;
    }

    // Get a product
    const query = `{ products(first: 1) { edges { node { id variants(first: 1) { edges { node { id } } } } } } }`;

    const response = await fetch(`https://${store.domain}/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': store.access_token,
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    const variantId = result.data.products.edges[0]?.node.variants.edges[0]?.node.id;

    if (!variantId) {
      console.log(`⚠️  No se pudo obtener producto de ${store.domain}\n`);
      continue;
    }

    await testDraftOrder(store.domain, store.admin_api_token, variantId);
  }
}

main();
