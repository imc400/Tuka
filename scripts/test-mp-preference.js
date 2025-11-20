const fetch = require('node-fetch');
require('dotenv').config();

async function testMPPreference() {
  const MP_ACCESS_TOKEN = 'APP_USR-1188586297017944-112013-b833681fab9290f731867859c7f8d5e1-216550704';

  const preference = {
    items: [
      {
        title: 'Test - Compra en ShopUnite',
        quantity: 1,
        unit_price: 1000,
        currency_id: 'CLP',
      },
    ],
    payer: {
      name: 'Test User',
      email: 'test@example.com',
      phone: {
        number: '56912345678',
      },
    },
    back_urls: {
      success: 'https://shopunite.com/success',
      failure: 'https://shopunite.com/failure',
      pending: 'https://shopunite.com/pending',
    },
    auto_return: 'approved',
    external_reference: '999',
    notification_url: 'https://kscgibfmxnyfjxpcwoac.supabase.co/functions/v1/mp-webhook',
    metadata: {
      transaction_id: 999,
      is_test: false,
    },
  };

  console.log('📤 Enviando preferencia a MercadoPago...\n');
  console.log('Datos:', JSON.stringify(preference, null, 2));

  try {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(preference),
    });

    console.log('\n📥 Respuesta de MercadoPago:');
    console.log('Status:', response.status, response.statusText);

    const data = await response.json();
    console.log('\nDatos:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Preferencia creada exitosamente!');
      console.log('ID:', data.id);
      console.log('Init Point:', data.init_point);
    } else {
      console.log('\n❌ Error creando preferencia');
    }
  } catch (error) {
    console.error('\n💥 Error:', error.message);
  }
}

testMPPreference();
