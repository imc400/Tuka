/**
 * Edge Function: mp-oauth-callback
 *
 * Maneja el callback de OAuth de Mercado Pago cuando una tienda conecta su cuenta.
 *
 * Flujo:
 * 1. Usuario hace click en "Conectar Mercado Pago" en el dashboard
 * 2. Se redirige a MP con client_id de Grumo y state=storeDomain
 * 3. Usuario autoriza en MP
 * 4. MP redirige aquí con ?code=XXX&state=storeDomain
 * 5. Intercambiamos code por access_token
 * 6. Guardamos tokens en la tabla stores
 * 7. Redirigimos al dashboard con success
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Obtener parámetros de MP
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // storeDomain
    const error = url.searchParams.get('error');

    // URL del dashboard para redirect
    const DASHBOARD_URL = Deno.env.get('DASHBOARD_URL') || 'https://grumo.cl/dashboard';

    // Si hay error de autorización
    if (error) {
      console.error('OAuth error from MP:', error);
      return Response.redirect(
        `${DASHBOARD_URL}?mp_error=${encodeURIComponent(error)}`,
        302
      );
    }

    // Validar parámetros requeridos
    if (!code || !state) {
      console.error('Missing code or state');
      return Response.redirect(
        `${DASHBOARD_URL}?mp_error=missing_params`,
        302
      );
    }

    const storeDomain = state;
    console.log(`Processing OAuth callback for store: ${storeDomain}`);

    // Credenciales de la app de Grumo en MP
    const MP_CLIENT_ID = Deno.env.get('MERCADOPAGO_CLIENT_ID');
    const MP_CLIENT_SECRET = Deno.env.get('MERCADOPAGO_CLIENT_SECRET');
    const REDIRECT_URI = Deno.env.get('MERCADOPAGO_REDIRECT_URI');

    if (!MP_CLIENT_ID || !MP_CLIENT_SECRET || !REDIRECT_URI) {
      throw new Error('MercadoPago OAuth credentials not configured');
    }

    // Intercambiar code por access_token
    console.log('Exchanging code for access token...');

    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: MP_CLIENT_ID,
        client_secret: MP_CLIENT_SECRET,
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('MP Token exchange error:', errorData);
      return Response.redirect(
        `${DASHBOARD_URL}?mp_error=token_exchange_failed`,
        302
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful');

    /*
     * tokenData contiene:
     * - access_token: Token para hacer operaciones
     * - token_type: "Bearer"
     * - expires_in: Segundos hasta expiración (ej: 15552000 = 180 días)
     * - scope: Permisos otorgados
     * - user_id: ID del usuario de MP
     * - refresh_token: Para renovar el token
     * - public_key: Public key del usuario
     */

    const {
      access_token,
      refresh_token,
      expires_in,
      user_id,
      public_key,
    } = tokenData;

    // Calcular fecha de expiración
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Obtener info adicional del usuario de MP
    let mpEmail = null;
    try {
      const userResponse = await fetch('https://api.mercadopago.com/users/me', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        mpEmail = userData.email;
        console.log(`MP User: ${mpEmail} (ID: ${user_id})`);
      }
    } catch (e) {
      console.warn('Could not fetch MP user info:', e);
    }

    // Conectar a Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Actualizar la tienda con los datos de MP
    // IMPORTANTE: mp_user_id Y mp_collector_id son el mismo valor
    // mp_collector_id se usa en create-multi-payment para el pago directo
    const { error: updateError } = await supabaseClient
      .from('stores')
      .update({
        mp_user_id: user_id.toString(),
        mp_collector_id: user_id.toString(), // Para multi-payment marketplace
        mp_email: mpEmail,
        mp_access_token: access_token,
        mp_refresh_token: refresh_token,
        mp_token_expires_at: expiresAt,
        mp_connected_at: new Date().toISOString(),
        mp_public_key: public_key,
        updated_at: new Date().toISOString(),
      })
      .eq('domain', storeDomain);

    if (updateError) {
      console.error('Error updating store:', updateError);
      return Response.redirect(
        `${DASHBOARD_URL}?mp_error=db_update_failed`,
        302
      );
    }

    console.log(`Store ${storeDomain} connected to MP successfully`);

    // Redirigir al dashboard con éxito
    return Response.redirect(
      `${DASHBOARD_URL}?store=${encodeURIComponent(storeDomain)}&mp_connected=true`,
      302
    );

  } catch (error) {
    console.error('OAuth callback error:', error);

    const DASHBOARD_URL = Deno.env.get('DASHBOARD_URL') || 'https://grumo.cl/dashboard';
    return Response.redirect(
      `${DASHBOARD_URL}?mp_error=${encodeURIComponent(error.message)}`,
      302
    );
  }
});
