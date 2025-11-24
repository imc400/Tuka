/**
 * Test directo de Shipping Zones via Admin API
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kscgibfmxnyfjxpcwoac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzY2dpYmZteG55Zmp4cGN3b2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjQwOTIsImV4cCI6MjA3OTE0MDA5Mn0.L5qfpmx64yVJ1ZhZmNQfMSlY2pVFVsNKpQSrNd2XSnk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAdminShippingZones() {
  console.log('\n🧪 Testing Admin API Shipping Zones\n');

  const { data: stores } = await supabase
    .from('stores')
    .select('domain, admin_api_token')
    .in('domain', ['spot-essence.myshopify.com', 'braintoys-chile.myshopify.com']);

  for (const store of stores) {
    console.log(`${'='.repeat(80)}`);
    console.log(`🏪 ${store.domain}`);
    console.log(`${'='.repeat(80)}\n`);

    if (!store.admin_api_token) {
      console.log('❌ No admin_api_token configured\n');
      continue;
    }

    try {
      console.log('📥 Fetching shipping zones...\n');

      const response = await fetch(
        `https://${store.domain}/admin/api/2024-10/shipping_zones.json`,
        {
          headers: {
            'X-Shopify-Access-Token': store.admin_api_token,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`Status: ${response.status} ${response.statusText}\n`);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Error response:');
        console.log(errorText);
        console.log('');
        continue;
      }

      const data = await response.json();
      const zones = data.shipping_zones || [];

      console.log(`✅ Found ${zones.length} shipping zones\n`);

      for (const zone of zones) {
        console.log(`📦 Zone: ${zone.name}`);
        console.log(`   Countries: ${zone.countries?.map(c => c.name).join(', ') || 'N/A'}`);

        const priceRates = zone.price_based_shipping_rates || [];
        const weightRates = zone.weight_based_shipping_rates || [];

        console.log(`\n   💰 Price-based rates (${priceRates.length}):`);
        for (const rate of priceRates) {
          console.log(`      • ${rate.name}: $${rate.price}`);
          console.log(`        Min: $${rate.min_order_subtotal || '0'}`);
          console.log(`        Max: ${rate.max_order_subtotal ? '$' + rate.max_order_subtotal : 'No max'}`);
        }

        console.log(`\n   ⚖️  Weight-based rates (${weightRates.length}):`);
        for (const rate of weightRates) {
          console.log(`      • ${rate.name}: $${rate.price}`);
          console.log(`        Weight: ${rate.weight_low}-${rate.weight_high}${rate.weight_unit}`);
        }

        console.log('');
      }

      // Simular cálculo con subtotal
      console.log('📊 Testing with different cart values:\n');

      const testSubtotals = [10000, 30000, 60000, 70000];

      for (const subtotal of testSubtotals) {
        console.log(`   Cart: $${subtotal.toLocaleString('es-CL')}`);

        const applicable = [];

        for (const zone of zones) {
          for (const rate of zone.price_based_shipping_rates || []) {
            const min = parseFloat(rate.min_order_subtotal || '0');
            const max = rate.max_order_subtotal ? parseFloat(rate.max_order_subtotal) : Infinity;

            if (subtotal >= min && subtotal <= max) {
              applicable.push(`${rate.name} ($${rate.price})`);
            }
          }
        }

        if (applicable.length > 0) {
          console.log(`      → ${applicable.join(', ')}`);
        } else {
          console.log(`      → No applicable rates`);
        }
      }

      console.log('\n');

    } catch (error) {
      console.error('❌ Error:', error.message);
      console.error(error.stack);
      console.log('');
    }
  }
}

testAdminShippingZones();
