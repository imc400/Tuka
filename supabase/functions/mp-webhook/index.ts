/**
 * Edge Function: mp-webhook
 * Webhook de MercadoPago para recibir notificaciones de pagos
 * Cuando un pago es aprobado, crea las órdenes en Shopify
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  storeId: string;
  storeName: string;
  selectedVariant?: {
    id: string;
    title: string;
    price: number;
  };
}

interface ShopifyOrderResponse {
  order?: {
    id: number;
    order_number: number;
    admin_graphql_api_id: string;
  };
  errors?: any;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) {
      throw new Error('MercadoPago Access Token not configured');
    }

    // MercadoPago envía notificaciones en este formato
    const body = await req.json();
    console.log('Webhook received:', body);

    // Tipos de notificación de MercadoPago
    const { type, data } = body;

    // Solo procesamos notificaciones de pago
    if (type !== 'payment') {
      return new Response(JSON.stringify({ status: 'ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Obtener info del pago desde MercadoPago
    const paymentId = data.id;
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        },
      }
    );

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error('MercadoPago API Error:', mpResponse.status, errorText);
      throw new Error(`Error fetching payment from MercadoPago: ${mpResponse.status} - ${errorText}`);
    }

    const payment = await mpResponse.json();
    console.log('Payment data:', payment);

    // Obtener el transaction_id desde external_reference
    const transactionId = parseInt(payment.external_reference);
    if (!transactionId) {
      throw new Error('No transaction_id in external_reference');
    }

    // Conectar a Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Actualizar estado de la transacción
    const newStatus = payment.status === 'approved' ? 'approved' :
                      payment.status === 'rejected' ? 'rejected' :
                      'pending';

    await supabaseClient
      .from('transactions')
      .update({
        status: newStatus,
        mp_payment_id: paymentId.toString(),
        payment_method: payment.payment_method_id,
        paid_at: payment.status === 'approved' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId);

    // Si el pago fue aprobado, crear órdenes en Shopify
    if (payment.status === 'approved') {
      console.log('Payment approved, creating Shopify orders...');
      await createShopifyOrders(transactionId, supabaseClient);
    }

    return new Response(JSON.stringify({ status: 'processed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * Crea órdenes en cada tienda Shopify
 */
async function createShopifyOrders(transactionId: number, supabaseClient: any) {
  try {
    // Obtener la transacción completa
    const { data: transaction, error: txError } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      throw new Error('Transaction not found');
    }

    const cartItems: CartItem[] = transaction.cart_items;
    const shippingAddress = transaction.shipping_address;

    // Agrupar items por tienda (limpiar prefijo "real-" si existe)
    const itemsByStore: Record<string, CartItem[]> = {};
    cartItems.forEach((item) => {
      const cleanStoreDomain = item.storeId.replace(/^real-/, '');
      if (!itemsByStore[cleanStoreDomain]) {
        itemsByStore[cleanStoreDomain] = [];
      }
      itemsByStore[cleanStoreDomain].push(item);
    });

    // Obtener configuraciones de las tiendas
    const storeDomains = Object.keys(itemsByStore);
    const { data: stores, error: storesError } = await supabaseClient
      .from('stores')
      .select('domain, admin_api_token, store_name')
      .in('domain', storeDomains);

    if (storesError || !stores) {
      throw new Error('Error fetching stores');
    }

    // Crear órdenes en cada tienda
    const orderPromises = stores.map(async (store) => {
      const storeItems = itemsByStore[store.domain];
      const orderAmount = storeItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      try {
        // Verificar si ya existe una orden para esta transacción y tienda (idempotencia)
        const { data: existingOrders } = await supabaseClient
          .from('shopify_orders')
          .select('id, shopify_order_number')
          .eq('transaction_id', transactionId)
          .eq('store_domain', store.domain)
          .eq('status', 'created')
          .limit(1);

        if (existingOrders && existingOrders.length > 0) {
          console.log(`Order already exists for transaction ${transactionId} in ${store.domain}: ${existingOrders[0].shopify_order_number}`);
          return { success: true, store: store.domain, orderNumber: existingOrders[0].shopify_order_number, skipped: true };
        }

        // Verificar que la tienda tiene Admin API token
        if (!store.admin_api_token) {
          throw new Error(`Store ${store.domain} does not have Admin API token configured`);
        }

        // Primero, buscar o crear el cliente en Shopify
        const customerEmail = transaction.buyer_email;
        let customerId: number | null = null;

        // Buscar cliente existente
        const searchResponse = await fetch(
          `https://${store.domain}/admin/api/2024-01/customers/search.json?query=email:${encodeURIComponent(customerEmail)}`,
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
            console.log(`Customer found: ${customerId}`);
          }
        }

        // Si no existe, crear el cliente
        if (!customerId) {
          const customerData = {
            customer: {
              email: transaction.buyer_email,
              first_name: transaction.buyer_name.split(' ')[0],
              last_name: transaction.buyer_name.split(' ').slice(1).join(' ') || transaction.buyer_name.split(' ')[0],
              phone: transaction.buyer_phone,
              addresses: [
                {
                  address1: shippingAddress.street,
                  city: shippingAddress.city,
                  province: shippingAddress.region,
                  zip: shippingAddress.zip_code,
                  country: 'Chile',
                  country_code: 'CL',
                },
              ],
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
            console.log(`Customer created: ${customerId}`);
          } else {
            const error = await createCustomerResponse.json();
            console.error('Error creating customer:', error);
          }
        }

        // Obtener costo de envío seleccionado para esta tienda
        const shippingCost = transaction.shipping_costs?.[store.domain];

        // Crear Draft Order en Shopify
        const draftOrder: any = {
          draft_order: {
            line_items: storeItems.map((item) => {
              // Extraer el ID numérico del GraphQL ID
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
              address1: shippingAddress.street,
              city: shippingAddress.city,
              province: shippingAddress.region,
              zip: shippingAddress.zip_code,
              country: 'Chile',
              country_code: 'CL',
            },
            // Agregar línea de envío si existe
            ...(shippingCost && {
              shipping_line: {
                title: shippingCost.title,
                price: shippingCost.price.toString(),
                code: shippingCost.code,
              },
            }),
            note: `Orden de Grumo - Transacción #${transactionId}`,
            tags: 'grumo, marketplace',
            financial_status: 'paid', // Marcar como pagada
          },
        };

        // Si tenemos customer ID, asociarlo al draft order
        if (customerId) {
          draftOrder.draft_order.customer = { id: customerId };
        }

        // Crear Draft Order usando Admin API Token
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
          console.error('Shopify Draft Order Error:', error);
          throw new Error('Error creating draft order');
        }

        const draftData = await draftResponse.json();
        const draftOrderId = draftData.draft_order.id;

        // Completar el Draft Order (convertirlo en Order)
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
          console.error('Shopify Complete Order Error:', error);
          throw new Error('Error completing draft order');
        }

        const orderData = await completeResponse.json();
        // La respuesta de complete.json viene en draft_order.order
        const completedOrder = orderData.draft_order?.order || orderData.order;
        const orderId = completedOrder?.admin_graphql_api_id || '';
        const orderNumber = completedOrder?.order_number || completedOrder?.name || 'N/A';

        // Guardar en la DB
        await supabaseClient.from('shopify_orders').insert({
          transaction_id: transactionId,
          store_domain: store.domain,
          order_amount: orderAmount,
          order_items: storeItems,
          status: 'created',
          shopify_order_id: orderId,
          shopify_order_number: `#${orderNumber}`,
          shopify_draft_order_id: draftOrderId.toString(),
          synced_at: new Date().toISOString(),
        });

        console.log(`Order created in ${store.domain}: #${orderNumber}`);
        return { success: true, store: store.domain, orderNumber };
      } catch (error) {
        console.error(`Error creating order in ${store.domain}:`, error);

        // Guardar error en la DB
        await supabaseClient.from('shopify_orders').insert({
          transaction_id: transactionId,
          store_domain: store.domain,
          order_amount: orderAmount,
          order_items: storeItems,
          status: 'failed',
          error_message: error.message,
        });

        return { success: false, store: store.domain, error: error.message };
      }
    });

    const results = await Promise.all(orderPromises);
    console.log('Orders creation results:', results);

    return results;
  } catch (error) {
    console.error('Error in createShopifyOrders:', error);
    throw error;
  }
}
