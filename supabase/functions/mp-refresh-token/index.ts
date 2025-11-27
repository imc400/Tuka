/**
 * Edge Function: mp-refresh-token
 *
 * Renueva el access_token de MP de una tienda cuando está por expirar.
 * Puede ser llamada:
 * 1. Manualmente desde el dashboard
 * 2. Automáticamente por un cron job
 * 3. Antes de hacer una transferencia si el token está por expirar
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { store_domain } = await req.json();

    if (!store_domain) {
      throw new Error('store_domain is required');
    }

    const MP_CLIENT_ID = Deno.env.get('MERCADOPAGO_CLIENT_ID');
    const MP_CLIENT_SECRET = Deno.env.get('MERCADOPAGO_CLIENT_SECRET');

    if (!MP_CLIENT_ID || !MP_CLIENT_SECRET) {
      throw new Error('MercadoPago credentials not configured');
    }

    // Conectar a Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obtener refresh_token de la tienda
    const { data: store, error: storeError } = await supabaseClient
      .from('stores')
      .select('mp_refresh_token, mp_token_expires_at')
      .eq('domain', store_domain)
      .single();

    if (storeError || !store) {
      throw new Error('Store not found');
    }

    if (!store.mp_refresh_token) {
      throw new Error('Store not connected to MercadoPago');
    }

    console.log(`Refreshing token for store: ${store_domain}`);

    // Refrescar el token
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: MP_CLIENT_ID,
        client_secret: MP_CLIENT_SECRET,
        refresh_token: store.mp_refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('MP Token refresh error:', errorData);
      throw new Error('Token refresh failed - store may need to reconnect');
    }

    const tokenData = await tokenResponse.json();

    const {
      access_token,
      refresh_token,
      expires_in,
      public_key,
    } = tokenData;

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Actualizar tokens en la DB
    const { error: updateError } = await supabaseClient
      .from('stores')
      .update({
        mp_access_token: access_token,
        mp_refresh_token: refresh_token,
        mp_token_expires_at: expiresAt,
        mp_public_key: public_key,
        updated_at: new Date().toISOString(),
      })
      .eq('domain', store_domain);

    if (updateError) {
      throw new Error('Failed to update store tokens');
    }

    console.log(`Token refreshed for store: ${store_domain}`);

    return new Response(
      JSON.stringify({
        success: true,
        expires_at: expiresAt,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Token refresh error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
