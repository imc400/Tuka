/**
 * Script para procesar manualmente una transacción y crear órdenes en Shopify
 * Uso: node scripts/process-transaction-manually.js <transaction_id>
 */

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno SUPABASE');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TRANSACTION_ID = parseInt(process.argv[2]) || 37;

async function processTransaction() {
  console.log(`\n🔄 Procesando transacción #${TRANSACTION_ID}...\n`);

  // 1. Obtener transacción
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', TRANSACTION_ID)
    .single();

  if (txError || !transaction) {
    console.error('❌ Error obteniendo transacción:', txError);
    return;
  }

  console.log('📋 Transacción encontrada:');
  console.log(`   Buyer: ${transaction.buyer_name} (${transaction.buyer_email})`);
  console.log(`   Total: $${transaction.total_amount} CLP`);
  console.log(`   Status: ${transaction.status}`);

  const cartItems = transaction.cart_items;
  const shippingAddress = transaction.shipping_address;

  // 2. Agrupar items por tienda
  const itemsByStore = {};
  cartItems.forEach((item) => {
    const cleanStoreDomain = item.storeId.replace(/^real-/, '');
    if (!itemsByStore[cleanStoreDomain]) {
      itemsByStore[cleanStoreDomain] = [];
    }
    itemsByStore[cleanStoreDomain].push(item);
  });

  console.log(`\n📦 Tiendas a procesar: ${Object.keys(itemsByStore).join(', ')}`);

  // 3. Obtener configuraciones de las tiendas
  const storeDomains = Object.keys(itemsByStore);
  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('domain, admin_api_token, store_name')
    .in('domain', storeDomains);

  if (storesError || !stores) {
    console.error('❌ Error obteniendo tiendas:', storesError);
    return;
  }

  // 4. Crear órdenes en cada tienda
  for (const store of stores) {
    const storeItems = itemsByStore[store.domain];
    const orderAmount = storeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    console.log(`\n🏪 Procesando ${store.store_name} (${store.domain})...`);
    console.log(`   Items: ${storeItems.length}`);
    console.log(`   Monto: $${orderAmount} CLP`);

    if (!store.admin_api_token) {
      console.error(`   ❌ No tiene Admin API Token configurado`);
      await saveOrderError(store.domain, orderAmount, storeItems, 'No Admin API Token');
      continue;
    }

    try {
      // 4a. Buscar o crear cliente
      let customerId = null;
      const searchResponse = await fetch(
        `https://${store.domain}/admin/api/2024-01/customers/search.json?query=email:${encodeURIComponent(transaction.buyer_email)}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': store.admin_api_token,
          },
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.customers && searchData.customers.length > 0) {
          customerId = searchData.customers[0].id;
          console.log(`   ✅ Cliente encontrado: ${customerId}`);
        }
      }

      if (!customerId) {
        // Crear cliente
        const nameParts = transaction.buyer_name.split(' ');
        const customerData = {
          customer: {
            email: transaction.buyer_email,
            first_name: nameParts[0],
            last_name: nameParts.slice(1).join(' ') || nameParts[0],
            phone: transaction.buyer_phone,
            addresses: [{
              address1: shippingAddress.street,
              city: shippingAddress.city,
              province: shippingAddress.region,
              zip: shippingAddress.zip_code,
              country: 'Chile',
              country_code: 'CL',
            }],
          },
        };

        const createCustomerResponse = await fetch(
          `https://${store.domain}/admin/api/2024-01/customers.json`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': store.admin_api_token,
            },
            body: JSON.stringify(customerData),
          }
        );

        if (createCustomerResponse.ok) {
          const customerResult = await createCustomerResponse.json();
          customerId = customerResult.customer.id;
          console.log(`   ✅ Cliente creado: ${customerId}`);
        } else {
          const error = await createCustomerResponse.json();
          console.log(`   ⚠️  No se pudo crear cliente:`, error.errors || error);
        }
      }

      // 4b. Obtener costo de envío
      const shippingCost = transaction.shipping_costs?.[store.domain];

      // 4c. Crear Draft Order
      const draftOrder = {
        draft_order: {
          line_items: storeItems.map((item) => {
            const variantId = item.selectedVariant?.id
              ? item.selectedVariant.id.split('/').pop()
              : null;

            return {
              variant_id: variantId,
              title: item.name,
              quantity: item.quantity,
              price: item.selectedVariant?.price || item.price,
            };
          }),
          shipping_address: {
            first_name: transaction.buyer_name.split(' ')[0],
            last_name: transaction.buyer_name.split(' ').slice(1).join(' ') || '',
            address1: shippingAddress.street,
            city: shippingAddress.city,
            province: shippingAddress.region,
            zip: shippingAddress.zip_code,
            country: 'Chile',
            country_code: 'CL',
            phone: transaction.buyer_phone,
          },
          email: transaction.buyer_email,
          note: `Orden de Grumo - Transacción #${TRANSACTION_ID}`,
          tags: 'grumo, marketplace',
        },
      };

      // Agregar línea de envío si existe
      if (shippingCost && shippingCost.price > 0) {
        draftOrder.draft_order.shipping_line = {
          title: shippingCost.title,
          price: shippingCost.price.toString(),
          code: shippingCost.code,
        };
      }

      // Asociar cliente si existe
      if (customerId) {
        draftOrder.draft_order.customer = { id: customerId };
      }

      console.log(`   📝 Creando Draft Order...`);

      const draftResponse = await fetch(
        `https://${store.domain}/admin/api/2024-01/draft_orders.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': store.admin_api_token,
          },
          body: JSON.stringify(draftOrder),
        }
      );

      if (!draftResponse.ok) {
        const error = await draftResponse.json();
        console.error(`   ❌ Error creando Draft Order:`, error.errors || error);
        await saveOrderError(store.domain, orderAmount, storeItems, JSON.stringify(error.errors || error));
        continue;
      }

      const draftData = await draftResponse.json();
      const draftOrderId = draftData.draft_order.id;
      console.log(`   ✅ Draft Order creado: ${draftOrderId}`);

      // 4d. Completar Draft Order (convertir en Order)
      console.log(`   🔄 Completando orden...`);

      const completeResponse = await fetch(
        `https://${store.domain}/admin/api/2024-01/draft_orders/${draftOrderId}/complete.json`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': store.admin_api_token,
          },
          body: JSON.stringify({ payment_pending: false }),
        }
      );

      if (!completeResponse.ok) {
        const error = await completeResponse.json();
        console.error(`   ❌ Error completando orden:`, error.errors || error);
        await saveOrderError(store.domain, orderAmount, storeItems, JSON.stringify(error.errors || error));
        continue;
      }

      const orderData = await completeResponse.json();
      const orderId = orderData.draft_order?.order?.admin_graphql_api_id || '';
      const orderNumber = orderData.draft_order?.order?.order_number || orderData.draft_order?.order?.name || 'N/A';

      console.log(`   ✅ Orden completada: #${orderNumber}`);

      // 4e. Guardar en DB
      await supabase.from('shopify_orders').insert({
        transaction_id: TRANSACTION_ID,
        store_domain: store.domain,
        order_amount: orderAmount,
        order_items: storeItems,
        status: 'created',
        shopify_order_id: orderId,
        shopify_order_number: `#${orderNumber}`,
        shopify_draft_order_id: draftOrderId.toString(),
        synced_at: new Date().toISOString(),
      });

      console.log(`   💾 Guardado en base de datos`);

    } catch (error) {
      console.error(`   ❌ Error:`, error.message);
      await saveOrderError(store.domain, orderAmount, storeItems, error.message);
    }
  }

  // 5. Actualizar estado de la transacción
  await supabase
    .from('transactions')
    .update({
      status: 'approved',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', TRANSACTION_ID);

  console.log(`\n✅ Transacción #${TRANSACTION_ID} procesada completamente!\n`);
}

async function saveOrderError(storeDomain, orderAmount, storeItems, errorMessage) {
  await supabase.from('shopify_orders').insert({
    transaction_id: TRANSACTION_ID,
    store_domain: storeDomain,
    order_amount: orderAmount,
    order_items: storeItems,
    status: 'failed',
    error_message: errorMessage,
  });
}

processTransaction().then(() => process.exit(0)).catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
