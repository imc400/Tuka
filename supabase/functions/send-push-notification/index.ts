// Supabase Edge Function para enviar Push Notifications via Expo
// Esto evita el problema de CORS al llamar a exp.host desde el navegador

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushMessage {
  to: string
  title: string
  body: string
  sound?: string
  data?: Record<string, any>
  // Campos para rich notifications (iOS)
  _contentAvailable?: boolean
  mutableContent?: boolean
  // Rich content para imágenes (Expo official API)
  richContent?: {
    image?: string
  }
  // Android specific
  channelId?: string
  // Custom fields que se pasan directamente al payload
  [key: string]: any
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { tokens, title, body, data, imageUrl } = await req.json()

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return new Response(
        JSON.stringify({ error: 'tokens array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'title and body are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Preparar mensajes para Expo
    // Solo incluir imagen si la tienda la proporciona
    // El isotipo de Grumo ya aparece como ícono de la app en todas las notificaciones

    const messages: PushMessage[] = tokens.map((token: string) => {
      // Solo incluir imageUrl en data si la tienda la proporcionó
      const messageData = imageUrl ? { ...data, imageUrl } : { ...data }

      const message: PushMessage = {
        to: token,
        sound: 'default',
        title,
        body,
        data: messageData,
      }

      // Solo agregar campos de rich notification si hay imagen
      if (imageUrl) {
        message.mutableContent = true
        message._contentAvailable = true
        message.richContent = { image: imageUrl }
        message.imageUrl = imageUrl
      }

      return message
    })

    // Log del mensaje que se enviará
    console.log('📦 Mensaje a enviar:', JSON.stringify(messages[0], null, 2))

    console.log(`📤 Enviando ${messages.length} notificaciones a Expo Push API...`)

    // Enviar a Expo Push API
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })

    const result = await response.json()
    console.log('📬 Respuesta de Expo:', JSON.stringify(result))

    // Contar éxitos y fallos
    let totalSent = 0
    let totalFailed = 0
    const errors: string[] = []

    if (result.data) {
      for (const ticket of result.data) {
        if (ticket.status === 'ok') {
          totalSent++
        } else {
          totalFailed++
          if (ticket.message) {
            errors.push(ticket.message)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: totalSent > 0,
        totalSent,
        totalFailed,
        errors,
        tickets: result.data || [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
