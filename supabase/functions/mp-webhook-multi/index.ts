/**
 * Edge Function: mp-webhook-multi
 *
 * Webhook de MercadoPago para el modelo Multi-Payment
 * Procesa notificaciones de pagos individuales por tienda
 *
 * - Cada pago es independiente y va directo a la tienda
 * - Actualiza store_payments_v2 con el estado
 * - Cuando todos los pagos de una transaction están approved, crea las órdenes en Shopify
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) {
      throw new Error('MercadoPago Access Token not configured');
    }

    const body = await req.json();
    console.log('Webhook multi-payment received:', JSON.stringify(body));

    const { type, data } = body;

    // Solo procesamos notificaciones de pago
    if (type !== 'payment') {
      console.log(`Ignoring notification type: ${type}`);
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
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      }
    );

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error('MercadoPago API Error:', mpResponse.status, errorText);
      throw new Error(`Error fetching payment: ${mpResponse.status}`);
    }

    const payment = await mpResponse.json();
    console.log('Payment data:', JSON.stringify(payment));

    // Parsear external_reference: "transactionId|storeDomain"
    const externalRef = payment.external_reference || '';
    const [transactionIdStr, storeDomain] = externalRef.split('|');
    const transactionId = parseInt(transactionIdStr);

    if (!transactionId || !storeDomain) {
      console.error('Invalid external_reference:', externalRef);
      throw new Error('Invalid external_reference format');
    }

    console.log(`Processing payment for tx=${transactionId}, store=${storeDomain}`);

    // Conectar a Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Mapear estado de MP a nuestro estado
    const statusMap: Record<string, string> = {
      approved: 'approved',
      rejected: 'rejected',
      pending: 'processing',
      in_process: 'processing',
      cancelled: 'cancelled',
      refunded: 'cancelled',
      charged_back: 'cancelled',
    };

    const newStatus = statusMap[payment.status] || 'pending';

    // Calcular MP fee
    const mpFee = payment.fee_details?.reduce(
      (sum: number, fee: any) => sum + (fee.amount || 0),
      0
    ) || 0;

    // Actualizar store_payments_v2
    const { error: updateError } = await supabaseClient
      .from('store_payments_v2')
      .update({
        mp_payment_id: paymentId.toString(),
        status: newStatus,
        payment_method: payment.payment_method_id,
        mp_fee_amount: mpFee,
        paid_at: payment.status === 'approved' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('transaction_id', transactionId)
      .eq('store_domain', storeDomain);

    if (updateError) {
      console.error('Error updating store_payment:', updateError);
      throw new Error(`Error updating payment: ${updateError.message}`);
    }

    console.log(`Updated store_payments_v2: tx=${transactionId}, store=${storeDomain}, status=${newStatus}`);

    // Si el pago fue aprobado, verificar si todos los pagos están completos
    if (payment.status === 'approved') {
      // El trigger check_transaction_completion ya actualiza la transaction
      // Pero necesitamos verificar para crear las órdenes en Shopify

      // Esperar un momento para que el trigger se ejecute
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verificar estado de la transaction
      const { data: transaction, error: txError } = await supabaseClient
        .from('transactions')
        .select('status, total_payments, completed_payments, cart_items, shipping_address, buyer_email, buyer_name, buyer_phone, shipping_costs')
        .eq('id', transactionId)
        .single();

      if (txError) {
        console.error('Error fetching transaction:', txError);
      } else if (transaction?.status === 'approved') {
        // Todos los pagos completados - crear órdenes en Shopify
        console.log(`All payments completed for transaction ${transactionId}, creating Shopify orders...`);
        await createShopifyOrdersForStore(
          transactionId,
          storeDomain,
          transaction,
          supabaseClient
        );
      } else {
        console.log(`Transaction ${transactionId} status: ${transaction?.status}, waiting for more payments (${transaction?.completed_payments}/${transaction?.total_payments})`);
      }
    }

    return new Response(JSON.stringify({ status: 'processed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
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
 * Crea la orden en Shopify para una tienda específica
 */
async function createShopifyOrdersForStore(
  transactionId: number,
  storeDomain: string,
  transaction: any,
  supabaseClient: any
) {
  try {
    // Verificar si ya existe la orden (idempotencia)
    const { data: existingOrder } = await supabaseClient
      .from('shopify_orders')
      .select('id, shopify_order_number')
      .eq('transaction_id', transactionId)
      .eq('store_domain', storeDomain)
      .limit(1);

    if (existingOrder && existingOrder.length > 0) {
      console.log(`Order already exists for ${storeDomain}: ${existingOrder[0].shopify_order_number}`);

      // Actualizar store_payments_v2 con el shopify_order
      await supabaseClient
        .from('store_payments_v2')
        .update({
          shopify_order_id: existingOrder[0].shopify_order_id,
          shopify_order_number: existingOrder[0].shopify_order_number,
        })
        .eq('transaction_id', transactionId)
        .eq('store_domain', storeDomain);

      return;
    }

    // Obtener config de la tienda
    const { data: store, error: storeError } = await supabaseClient
      .from('stores')
      .select('domain, admin_api_token, store_name')
      .eq('domain', storeDomain)
      .single();

    if (storeError || !store?.admin_api_token) {
      console.error(`Store ${storeDomain} not found or no admin token`);
      return;
    }

    // Filtrar items de esta tienda
    const cartItems: CartItem[] = transaction.cart_items || [];
    const storeItems = cartItems.filter((item: CartItem) => {
      const cleanDomain = item.storeId.replace(/^real-/, '');
      return cleanDomain === storeDomain;
    });

    if (storeItems.length === 0) {
      console.log(`No items for store ${storeDomain}`);
      return;
    }

    const shippingAddress = transaction.shipping_address;
    const orderAmount = storeItems.reduce(
      (sum: number, item: CartItem) => sum + item.price * item.quantity,
      0
    );

    // Buscar o crear cliente en Shopify
    let customerId: number | null = null;
    const customerEmail = transaction.buyer_email;

    const searchResponse = await fetch(
      `https://${storeDomain}/admin/api/2024-01/customers/search.json?query=email:${encodeURIComponent(customerEmail)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': store.admin_api_token,
        },
      }
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.customers?.length > 0) {
        customerId = searchData.customers[0].id;
      }
    }

    if (!customerId) {
      // Crear cliente
      const customerData = {
        customer: {
          email: customerEmail,
          first_name: transaction.buyer_name?.split(' ')[0] || 'Cliente',
          last_name: transaction.buyer_name?.split(' ').slice(1).join(' ') || 'Grumo',
          phone: transaction.buyer_phone,
          addresses: [{
            address1: shippingAddress?.street,
            city: shippingAddress?.city,
            province: shippingAddress?.region,
            zip: shippingAddress?.zip_code,
            country: 'Chile',
            country_code: 'CL',
          }],
        },
      };

      const createCustomerResponse = await fetch(
        `https://${storeDomain}/admin/api/2024-01/customers.json`,
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
        customerId = customerResult.customer?.id;
      }
    }

    // Obtener costo de envío
    const shippingCost = transaction.shipping_costs?.[storeDomain];

    // Crear Draft Order
    const draftOrder: any = {
      draft_order: {
        line_items: storeItems.map((item: CartItem) => {
          const variantId = item.selectedVariant?.id?.split('/').pop();
          return {
            variant_id: variantId,
            title: item.name,
            quantity: item.quantity,
            price: item.selectedVariant?.price || item.price,
          };
        }),
        shipping_address: {
          address1: shippingAddress?.street,
          city: shippingAddress?.city,
          province: shippingAddress?.region,
          zip: shippingAddress?.zip_code,
          country: 'Chile',
          country_code: 'CL',
        },
        ...(shippingCost && {
          shipping_line: {
            title: shippingCost.title,
            price: shippingCost.price.toString(),
            code: shippingCost.code || 'custom',
          },
        }),
        note: `Orden de Grumo - Transacción #${transactionId}`,
        tags: 'grumo, marketplace, multi-payment',
        financial_status: 'paid',
      },
    };

    if (customerId) {
      draftOrder.draft_order.customer = { id: customerId };
    }

    // Crear Draft Order
    const draftResponse = await fetch(
      `https://${storeDomain}/admin/api/2024-01/draft_orders.json`,
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

    // Completar Draft Order
    const completeResponse = await fetch(
      `https://${storeDomain}/admin/api/2024-01/draft_orders/${draftOrderId}/complete.json`,
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
    const completedOrder = orderData.draft_order?.order || orderData.order;
    const orderId = completedOrder?.admin_graphql_api_id || '';
    const orderNumber = completedOrder?.order_number || completedOrder?.name || 'N/A';

    // Guardar en shopify_orders
    await supabaseClient.from('shopify_orders').insert({
      transaction_id: transactionId,
      store_domain: storeDomain,
      order_amount: orderAmount,
      order_items: storeItems,
      status: 'created',
      shopify_order_id: orderId,
      shopify_order_number: `#${orderNumber}`,
      shopify_draft_order_id: draftOrderId.toString(),
      synced_at: new Date().toISOString(),
    });

    // Actualizar store_payments_v2 con el shopify_order
    await supabaseClient
      .from('store_payments_v2')
      .update({
        shopify_order_id: orderId,
        shopify_order_number: `#${orderNumber}`,
      })
      .eq('transaction_id', transactionId)
      .eq('store_domain', storeDomain);

    console.log(`Order created in ${storeDomain}: #${orderNumber}`);
  } catch (error: any) {
    console.error(`Error creating order for ${storeDomain}:`, error);

    // Guardar error
    await supabaseClient.from('shopify_orders').insert({
      transaction_id: transactionId,
      store_domain: storeDomain,
      order_amount: 0,
      order_items: [],
      status: 'failed',
      error_message: error.message,
    });
  }
}
