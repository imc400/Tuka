// Edge Function: create-user-profile
// Crea el perfil del usuario usando service_role (bypass RLS)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Crear cliente con service_role (bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Obtener datos del request
    const { userId, fullName, phone, email } = await req.json()

    console.log('Creating profile for user:', userId)

    // Insertar perfil (bypass RLS con service_role)
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: userId,
        full_name: fullName,
        phone: phone || null,
        email: email,
        total_orders: 0,
        total_spent: 0,
        created_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating profile:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Profile created successfully:', data)

    return new Response(
      JSON.stringify({ profile: data }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
