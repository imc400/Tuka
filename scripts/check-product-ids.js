const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkProductIds() {
  const { data: transaction } = await supabase
    .from('transactions')
    .select('cart_items')
    .eq('id', 8)
    .single();

  console.log('\n📦 Items del carrito en la transacción 8:\n');

  transaction.cart_items.forEach((item, index) => {
    console.log(`Item ${index + 1}: ${item.name}`);
    console.log(`  Store ID: ${item.storeId}`);
    console.log(`  Selected Variant:`, JSON.stringify(item.selectedVariant, null, 2));
    console.log('');
  });
}

checkProductIds();
