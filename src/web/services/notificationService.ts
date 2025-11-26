/**
 * Web Notification Service
 *
 * Servicio para enviar push notifications desde el dashboard web
 * usando Supabase Edge Function (evita CORS con Expo Push API).
 */

import { supabaseWeb as supabase } from '../../lib/supabaseWeb';

// URL de la Edge Function de Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://kscgibfmxnyfjxpcwoac.supabase.co';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-push-notification`;

export interface NotificationPayload {
  title: string;
  body: string;
  imageUrl?: string;
  data?: {
    productId?: string;
    storeId?: string;
    type?: string;
    [key: string]: any;
  };
}

export interface SendNotificationResult {
  success: boolean;
  totalSent: number;
  totalFailed: number;
  ticketIds: string[];
  errors: string[];
}

export interface StoreSubscriber {
  user_id: string;
  push_token: string;
}

/**
 * Obtiene los suscriptores de una tienda con sus push tokens
 */
export async function getStoreSubscribersWithTokens(storeDomain: string): Promise<StoreSubscriber[]> {
  try {
    // Obtener user_ids suscritos a la tienda (consulta directa, sin RPC)
    const { data: subscriptions, error: subError } = await supabase
      .from('store_subscriptions')
      .select('user_id')
      .eq('store_domain', storeDomain)
      .eq('notifications_enabled', true)
      .is('unsubscribed_at', null);

    if (subError) {
      console.error('❌ Error obteniendo suscripciones:', subError);
      return [];
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('📭 No hay suscriptores para', storeDomain);
      return [];
    }

    const userIds = subscriptions.map((s: any) => s.user_id);
    console.log(`👥 ${userIds.length} suscriptores encontrados para ${storeDomain}`);

    // Obtener push tokens de esos usuarios
    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('user_id, expo_push_token')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (tokenError) {
      console.error('❌ Error obteniendo tokens:', tokenError);
      return [];
    }

    const result = tokens?.map(t => ({
      user_id: t.user_id,
      push_token: t.expo_push_token,
    })) || [];

    console.log(`📱 ${result.length} tokens encontrados`);
    return result;
  } catch (error) {
    console.error('❌ Error en getStoreSubscribersWithTokens:', error);
    return [];
  }
}

/**
 * Envía notificaciones push a través de Supabase Edge Function
 * (Proxy para Expo Push API - evita CORS)
 */
export async function sendPushNotifications(
  tokens: string[],
  payload: NotificationPayload
): Promise<SendNotificationResult> {
  const result: SendNotificationResult = {
    success: false,
    totalSent: 0,
    totalFailed: 0,
    ticketIds: [],
    errors: [],
  };

  if (tokens.length === 0) {
    result.errors.push('No hay tokens para enviar');
    return result;
  }

  console.log(`📤 Enviando ${tokens.length} notificaciones via Edge Function...`);

  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokens,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        imageUrl: payload.imageUrl || null,
      }),
    });

    const responseData = await response.json();
    console.log('📬 Respuesta Edge Function:', responseData);

    if (response.ok) {
      result.success = responseData.success;
      result.totalSent = responseData.totalSent || 0;
      result.totalFailed = responseData.totalFailed || 0;
      result.errors = responseData.errors || [];

      // Extraer ticket IDs si están disponibles
      if (responseData.tickets) {
        for (const ticket of responseData.tickets) {
          if (ticket.id) {
            result.ticketIds.push(ticket.id);
          }
        }
      }
    } else {
      result.errors.push(responseData.error || 'Error en Edge Function');
      result.totalFailed = tokens.length;
    }
  } catch (error: any) {
    console.error('❌ Error llamando Edge Function:', error);
    result.totalFailed = tokens.length;
    result.errors.push(error.message || 'Error de conexión');
  }

  console.log(`✅ Resultado: ${result.totalSent} enviados, ${result.totalFailed} fallidos`);

  return result;
}

/**
 * Guarda el registro de una notificación enviada
 */
export async function saveNotificationRecord(
  storeDomain: string,
  storeName: string,
  payload: NotificationPayload,
  result: SendNotificationResult,
  recipients: { user_id: string; push_token: string }[] = []
): Promise<{ id: number } | null> {
  try {
    const { data, error } = await supabase
      .from('notifications_sent')
      .insert({
        store_id: storeDomain,
        store_name: storeName,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        image_url: payload.imageUrl || null,
        total_sent: result.totalSent,
        total_delivered: result.totalSent,
        recipients: recipients.map(r => ({ user_id: r.user_id, token: r.push_token.slice(-10) })),
        sent_at: new Date().toISOString(),
        sent_by_admin: true,
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Error guardando registro:', error);
      return null;
    }

    console.log('✅ Registro guardado con ID:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Error en saveNotificationRecord:', error);
    return null;
  }
}

/**
 * Obtiene el historial de notificaciones de una tienda
 */
export async function getNotificationHistory(storeDomain: string, limit = 20): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('notifications_sent')
      .select('*')
      .eq('store_id', storeDomain)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error obteniendo historial:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error en getNotificationHistory:', error);
    return [];
  }
}

/**
 * Obtiene el conteo de suscriptores de una tienda
 */
export async function getSubscriberCount(storeDomain: string): Promise<number> {
  try {
    // Contar suscriptores con push tokens activos
    const { data: subscriptions, error: subError } = await supabase
      .from('store_subscriptions')
      .select('user_id')
      .eq('store_domain', storeDomain)
      .eq('notifications_enabled', true)
      .is('unsubscribed_at', null);

    if (subError || !subscriptions) {
      console.error('❌ Error obteniendo suscriptores:', subError);
      return 0;
    }

    // Filtrar solo los que tienen push token activo
    const userIds = subscriptions.map(s => s.user_id);

    if (userIds.length === 0) return 0;

    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('user_id')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (tokenError) {
      console.error('❌ Error obteniendo tokens:', tokenError);
      return subscriptions.length; // Devolver al menos el conteo de suscripciones
    }

    return tokens?.length || 0;
  } catch (error) {
    console.error('❌ Error en getSubscriberCount:', error);
    return 0;
  }
}

/**
 * Función principal para enviar notificación a todos los suscriptores de una tienda
 */
export async function sendStoreNotification(
  storeDomain: string,
  storeName: string,
  payload: NotificationPayload
): Promise<{ success: boolean; message: string; result?: SendNotificationResult }> {
  console.log(`🔔 Iniciando envío de notificación para ${storeName}...`);

  // 1. Obtener suscriptores con tokens
  const subscribers = await getStoreSubscribersWithTokens(storeDomain);

  if (subscribers.length === 0) {
    return {
      success: false,
      message: 'Esta tienda no tiene suscriptores con tokens válidos',
    };
  }

  // 2. Extraer tokens únicos
  const tokens = [...new Set(subscribers.map(s => s.push_token))];
  console.log(`📱 ${tokens.length} tokens únicos para enviar`);

  // 3. Enviar notificaciones
  const result = await sendPushNotifications(tokens, payload);

  // 4. Guardar registro con lista de destinatarios
  await saveNotificationRecord(storeDomain, storeName, payload, result, subscribers);

  // 5. Retornar resultado
  if (result.success) {
    return {
      success: true,
      message: `Notificación enviada exitosamente a ${result.totalSent} dispositivos`,
      result,
    };
  } else {
    return {
      success: false,
      message: result.errors.join(', ') || 'Error al enviar notificaciones',
      result,
    };
  }
}
