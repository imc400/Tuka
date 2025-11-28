/**
 * Edge Function: create-multi-payment
 *
 * Crea múltiples preferencias de pago en MercadoPago (una por tienda)
 * Cada pago va directo a la cuenta MP de la tienda, con application_fee para Grumo
 *
 * Modelo: Multi-Payment Marketplace
 * - Cliente hace N pagos (1 por tienda)
 * - Cada tienda recibe su dinero directo
 * - Grumo cobra comisión via application_fee
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

interface StorePaymentRequest {
  transactionId: number;
  cartItems: CartItem[];
  buyerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  shippingCosts: Record<string, { price: number; title: string }>;
}

interface StorePreference {
  storeDomain: string;
  storeName: string;
  preferenceId: string;
  initPoint: string;
  amount: number;
  applicationFee: number;
  items: CartItem[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Access Token de Grumo (para crear preferencias con marketplace_fee)
    const GRUMO_MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!GRUMO_MP_ACCESS_TOKEN) {
      throw new Error('MercadoPago Access Token not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: StorePaymentRequest = await req.json();
    const { transactionId, cartItems, buyerInfo, shippingCosts } = body;

    console.log(`Creating multi-payment for transaction ${transactionId}`);
    console.log(`Total items: ${cartItems.length}`);

    // Agrupar items por tienda
    const itemsByStore: Record<string, CartItem[]> = {};
    cartItems.forEach((item) => {
      const storeDomain = item.storeId.replace(/^real-/, '');
      if (!itemsByStore[storeDomain]) {
        itemsByStore[storeDomain] = [];
      }
      itemsByStore[storeDomain].push(item);
    });

    const storeDomains = Object.keys(itemsByStore);
    console.log(`Stores involved: ${storeDomains.join(', ')}`);

    // Obtener info de las tiendas (collector_id, commission_rate)
    const { data: stores, error: storesError } = await supabaseClient
      .from('stores')
      .select('domain, store_name, mp_collector_id, mp_access_token, commission_rate')
      .in('domain', storeDomains);

    if (storesError || !stores) {
      throw new Error(`Error fetching stores: ${storesError?.message}`);
    }

    // Crear mapa de tiendas para acceso rápido
    const storeMap = new Map(stores.map(s => [s.domain, s]));

    // Generar URLs base
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '').replace(/\/$/, '');
    const baseBackUrl = 'https://shopunite.cl'; // TODO: Configurar URL de producción

    // Crear preferencias para cada tienda
    const preferences: StorePreference[] = [];
    const errors: Array<{ store: string; error: string }> = [];

    for (const [storeDomain, items] of Object.entries(itemsByStore)) {
      const store = storeMap.get(storeDomain);

      if (!store) {
        errors.push({ store: storeDomain, error: 'Store not found' });
        continue;
      }

      // Calcular monto de esta tienda
      const itemsAmount = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      // Agregar costo de envío si existe
      const shippingCost = shippingCosts?.[storeDomain]?.price || 0;
      const totalAmount = itemsAmount + shippingCost;

      // Calcular commission de Grumo (usa el rate configurado, 0 si no hay)
      const commissionRate = store.commission_rate ?? 0;
      const applicationFee = Math.round(totalAmount * commissionRate);

      console.log(`Store ${storeDomain}: amount=${totalAmount}, fee=${applicationFee}`);

      // Construir items para MP (productos + envío)
      const mpItems = items.map((item) => ({
        id: item.id,
        title: item.name,
        description: `${item.name} - ${store.store_name}`,
        category_id: 'marketplace',
        quantity: item.quantity,
        unit_price: item.selectedVariant?.price || item.price,
        currency_id: 'CLP',
      }));

      // Agregar envío como item adicional para asegurar que se cobre
      if (shippingCost > 0) {
        mpItems.push({
          id: `shipping-${storeDomain}`,
          title: `Envío - ${store.store_name}`,
          description: shippingCosts?.[storeDomain]?.title || 'Costo de envío',
          category_id: 'shipping',
          quantity: 1,
          unit_price: shippingCost,
          currency_id: 'CLP',
        });
      }

      // Construir preferencia de MP
      const preferenceBody: any = {
        items: mpItems,
        payer: {
          name: buyerInfo.name,
          email: buyerInfo.email,
          phone: { number: buyerInfo.phone },
        },
        back_urls: {
          success: `${baseBackUrl}/payment/success?store=${storeDomain}&tx=${transactionId}`,
          failure: `${baseBackUrl}/payment/failure?store=${storeDomain}&tx=${transactionId}`,
          pending: `${baseBackUrl}/payment/pending?store=${storeDomain}&tx=${transactionId}`,
        },
        auto_return: 'approved',
        // IMPORTANTE: external_reference incluye store para identificar en webhook
        external_reference: `${transactionId}|${storeDomain}`,
        notification_url: `${supabaseUrl}/functions/v1/mp-webhook-multi`,
        statement_descriptor: 'Grumo',
        // APPLICATION FEE - La comisión de Grumo
        marketplace_fee: applicationFee,
        metadata: {
          transaction_id: transactionId,
          store_domain: storeDomain,
          store_name: store.store_name,
          items_count: items.length,
          shipping_cost: shippingCost,
        },
      };

      // Si la tienda tiene collector_id, usarlo para que reciba el pago directo
      // Si no, el pago va a Grumo (fallback)
      if (store.mp_collector_id) {
        preferenceBody.collector_id = parseInt(store.mp_collector_id);
        console.log(`Using store's collector_id: ${store.mp_collector_id}`);
      } else {
        console.log(`Store ${storeDomain} has no collector_id, payment goes to Grumo`);
        // Sin collector_id, no cobramos marketplace_fee (todo va a Grumo)
        delete preferenceBody.marketplace_fee;
      }

      try {
        // Crear preferencia en MP
        const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GRUMO_MP_ACCESS_TOKEN}`,
          },
          body: JSON.stringify(preferenceBody),
        });

        if (!mpResponse.ok) {
          const errorData = await mpResponse.json();
          console.error(`MP Error for ${storeDomain}:`, errorData);
          errors.push({ store: storeDomain, error: JSON.stringify(errorData) });
          continue;
        }

        const mpData = await mpResponse.json();

        // Guardar en store_payments_v2
        await supabaseClient.from('store_payments_v2').insert({
          store_domain: storeDomain,
          transaction_id: transactionId,
          mp_preference_id: mpData.id,
          mp_collector_id: store.mp_collector_id || null,
          gross_amount: totalAmount,
          application_fee: store.mp_collector_id ? applicationFee : 0,
          net_to_store: store.mp_collector_id ? (totalAmount - applicationFee) : totalAmount,
          status: 'pending',
        });

        preferences.push({
          storeDomain,
          storeName: store.store_name || storeDomain,
          preferenceId: mpData.id,
          initPoint: mpData.init_point,
          amount: totalAmount,
          applicationFee: store.mp_collector_id ? applicationFee : 0,
          items,
        });

        console.log(`Preference created for ${storeDomain}: ${mpData.id}`);
      } catch (err: any) {
        console.error(`Error creating preference for ${storeDomain}:`, err);
        errors.push({ store: storeDomain, error: err.message });
      }
    }

    // Actualizar transaction con el modo multi-payment
    await supabaseClient
      .from('transactions')
      .update({
        payment_mode: 'multi',
        total_payments: preferences.length,
        completed_payments: 0,
        failed_payments: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId);

    // Responder con todas las preferencias
    return new Response(
      JSON.stringify({
        success: true,
        mode: 'multi',
        totalPayments: preferences.length,
        preferences,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
