/**
 * Edge Function: create-mp-preference
 * Crea una preferencia de pago en MercadoPago
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Obtener el Access Token de MercadoPago desde env
    const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) {
      throw new Error('MercadoPago Access Token not configured');
    }

    // Parsear el body
    const body = await req.json();

    // Crear la preferencia en MercadoPago
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.json();
      console.error('MercadoPago Error:', errorData);
      throw new Error('Error creating MercadoPago preference');
    }

    const preferenceData = await mpResponse.json();

    // Actualizar la transacción con el preference_id
    if (body.external_reference) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabaseClient
        .from('transactions')
        .update({
          mp_preference_id: preferenceData.id,
        })
        .eq('id', parseInt(body.external_reference));
    }

    return new Response(JSON.stringify(preferenceData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
