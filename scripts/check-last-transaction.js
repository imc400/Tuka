const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkLastTransaction() {
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (transactions && transactions.length > 0) {
    const tx = transactions[0];
    console.log('📋 Última transacción:\n');
    console.log(`ID: ${tx.id}`);
    console.log(`Estado: ${tx.status}`);
    console.log(`Monto: ${tx.total_amount} ${tx.currency}`);
    console.log(`MP Preference ID: ${tx.mp_preference_id || 'N/A'}`);
    console.log(`MP Payment ID: ${tx.mp_payment_id || 'N/A'}`);
    console.log(`Fecha: ${new Date(tx.created_at).toLocaleString()}`);
  } else {
    console.log('No hay transacciones');
  }
}

checkLastTransaction();
