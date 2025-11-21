/**
 * Push Notification Service
 *
 * Maneja todo el sistema de notificaciones push:
 * - Registro de tokens
 * - Solicitud de permisos
 * - Envío de notificaciones a suscriptores
 * - Analytics e historial
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

// =====================================================
// TYPES
// =====================================================

export interface PushToken {
  id: number;
  user_id: string;
  expo_push_token: string;
  device_id: string | null;
  device_name: string | null;
  device_os: string;
  is_active: boolean;
  last_used_at: string;
  created_at: string;
}

export interface NotificationData {
  productId?: string;
  storeId?: string;
  type?: 'product' | 'store' | 'general';
  url?: string;
}

export interface SendNotificationParams {
  storeId: string;
  storeName: string;
  title: string;
  body: string;
  data?: NotificationData;
  scheduledFor?: Date; // Opcional: programar para después
}

export interface NotificationStats {
  date: string;
  new_subscribers: number;
  lost_subscribers: number;
  total_subscribers: number;
}

// =====================================================
// CONFIGURACIÓN DE NOTIFICACIONES
// =====================================================

/**
 * Configurar cómo se muestran las notificaciones
 */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// =====================================================
// PERMISOS Y REGISTRO DE TOKEN
// =====================================================

/**
 * Solicitar permisos de notificaciones y registrar token
 */
export async function registerForPushNotifications(
  userId: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    // Solo funciona en dispositivos físicos
    if (!Device.isDevice) {
      console.log('[PushNotif] Push notifications only work on physical devices');
      return {
        success: false,
        error: 'Las notificaciones solo funcionan en dispositivos físicos',
      };
    }

    // Verificar si ya tiene permisos
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Si no tiene permisos, solicitarlos
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // Si no otorgó permisos
    if (finalStatus !== 'granted') {
      console.log('[PushNotif] Permission not granted');
      return {
        success: false,
        error: 'No se otorgaron permisos para notificaciones',
      };
    }

    // Obtener token de Expo
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    console.log('[PushNotif] Using projectId:', projectId);

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });

    const expoPushToken = tokenData.data;
    console.log('[PushNotif] Token obtained:', expoPushToken);

    // Información del dispositivo
    const deviceInfo = {
      deviceId: Constants.sessionId || null,
      deviceName: Device.deviceName || null,
      deviceOS: Platform.OS,
    };

    // Guardar token en la base de datos
    const { error: dbError } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        expo_push_token: expoPushToken,
        device_id: deviceInfo.deviceId,
        device_name: deviceInfo.deviceName,
        device_os: deviceInfo.deviceOS,
        is_active: true,
        last_used_at: new Date().toISOString(),
      },
      {
        onConflict: 'expo_push_token',
      }
    );

    if (dbError) {
      console.error('[PushNotif] Error saving token:', dbError);
      return {
        success: false,
        error: 'Error al guardar token en base de datos',
      };
    }

    console.log('[PushNotif] Token registered successfully');
    return {
      success: true,
      token: expoPushToken,
    };
  } catch (error: any) {
    console.error('[PushNotif] Error registering for push notifications:', error);
    return {
      success: false,
      error: error.message || 'Error al registrar notificaciones',
    };
  }
}

// =====================================================
// ENVIAR NOTIFICACIONES
// =====================================================

/**
 * Enviar notificación a todos los suscriptores de una tienda
 */
export async function sendNotificationToStoreSubscribers(
  params: SendNotificationParams
): Promise<{ success: boolean; sentCount?: number; error?: string }> {
  try {
    console.log('[PushNotif] Sending notification to store:', params.storeId);

    // 1. Obtener tokens de suscriptores de la tienda
    const { data: subscribers, error: subsError } = await supabase.rpc(
      'get_store_subscribers',
      {
        store_domain: params.storeId,
      }
    );

    if (subsError) {
      console.error('[PushNotif] Error getting subscribers:', subsError);
      return {
        success: false,
        error: 'Error al obtener suscriptores',
      };
    }

    if (!subscribers || subscribers.length === 0) {
      console.log('[PushNotif] No subscribers found');
      return {
        success: true,
        sentCount: 0,
      };
    }

    console.log('[PushNotif] Found', subscribers.length, 'subscribers');

    // 2. Crear registro en notifications_sent
    const { data: notificationRecord, error: recordError } = await supabase
      .from('notifications_sent')
      .insert({
        store_id: params.storeId,
        store_name: params.storeName,
        title: params.title,
        body: params.body,
        data: params.data || {},
        total_sent: subscribers.length,
        scheduled_for: params.scheduledFor?.toISOString() || null,
        sent_at: params.scheduledFor ? null : new Date().toISOString(),
        sent_by_admin: true,
      })
      .select()
      .single();

    if (recordError) {
      console.error('[PushNotif] Error creating notification record:', recordError);
      return {
        success: false,
        error: 'Error al crear registro de notificación',
      };
    }

    // 3. Si está programada para después, no enviar ahora
    if (params.scheduledFor && params.scheduledFor > new Date()) {
      console.log('[PushNotif] Notification scheduled for:', params.scheduledFor);
      return {
        success: true,
        sentCount: 0,
      };
    }

    // 4. Preparar mensajes para enviar
    const messages = subscribers.map((sub: any) => ({
      to: sub.expo_push_token,
      sound: 'default',
      title: params.title,
      body: params.body,
      data: params.data || {},
      badge: 1,
    }));

    // 5. Enviar notificaciones en lotes de 100 (límite de Expo)
    const chunks = chunkArray(messages, 100);
    let totalSent = 0;
    let totalFailed = 0;

    for (const chunk of chunks) {
      try {
        const tickets = await Notifications.scheduleNotificationAsync({
          content: chunk[0],
          trigger: null, // Enviar inmediatamente
        });

        totalSent += chunk.length;
        console.log('[PushNotif] Chunk sent:', chunk.length, 'notifications');
      } catch (error) {
        console.error('[PushNotif] Error sending chunk:', error);
        totalFailed += chunk.length;
      }
    }

    // 6. Actualizar estadísticas
    await supabase
      .from('notifications_sent')
      .update({
        total_delivered: totalSent,
        total_failed: totalFailed,
      })
      .eq('id', notificationRecord.id);

    console.log('[PushNotif] Notification sent successfully');
    return {
      success: true,
      sentCount: totalSent,
    };
  } catch (error: any) {
    console.error('[PushNotif] Error sending notification:', error);
    return {
      success: false,
      error: error.message || 'Error al enviar notificación',
    };
  }
}

// =====================================================
// ANALYTICS
// =====================================================

/**
 * Obtener estadísticas de suscriptores de una tienda
 */
export async function getSubscriberStats(
  storeId: string,
  startDate: Date,
  endDate: Date
): Promise<{ stats: NotificationStats[]; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('get_subscriber_stats', {
      store_domain: storeId,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    });

    if (error) {
      console.error('[PushNotif] Error getting stats:', error);
      return {
        stats: [],
        error: 'Error al obtener estadísticas',
      };
    }

    return {
      stats: data || [],
    };
  } catch (error: any) {
    console.error('[PushNotif] Exception getting stats:', error);
    return {
      stats: [],
      error: error.message || 'Error al obtener estadísticas',
    };
  }
}

/**
 * Obtener historial de notificaciones enviadas
 */
export async function getNotificationHistory(
  storeId: string,
  limit: number = 50
): Promise<{ notifications: any[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('notifications_sent')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[PushNotif] Error getting history:', error);
      return {
        notifications: [],
        error: 'Error al obtener historial',
      };
    }

    return {
      notifications: data || [],
    };
  } catch (error: any) {
    console.error('[PushNotif] Exception getting history:', error);
    return {
      notifications: [],
      error: error.message || 'Error al obtener historial',
    };
  }
}

/**
 * Registrar interacción con notificación (opened, delivered, failed)
 */
export async function trackNotificationInteraction(
  notificationId: number,
  userId: string,
  interactionType: 'delivered' | 'opened' | 'failed',
  errorMessage?: string
): Promise<{ success: boolean }> {
  try {
    await supabase.from('notification_interactions').insert({
      notification_id: notificationId,
      user_id: userId,
      interaction_type: interactionType,
      error_message: errorMessage || null,
    });

    // Actualizar contadores en notifications_sent
    const field =
      interactionType === 'opened'
        ? 'total_opened'
        : interactionType === 'delivered'
        ? 'total_delivered'
        : 'total_failed';

    await supabase.rpc('increment', {
      table_name: 'notifications_sent',
      row_id: notificationId,
      field_name: field,
    });

    return { success: true };
  } catch (error) {
    console.error('[PushNotif] Error tracking interaction:', error);
    return { success: false };
  }
}

// =====================================================
// UTILIDADES
// =====================================================

/**
 * Dividir array en chunks
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Desactivar token (cuando el usuario desinstala la app o hace logout)
 */
export async function deactivatePushToken(
  userId: string,
  token?: string
): Promise<{ success: boolean }> {
  try {
    const query = supabase.from('push_tokens').update({ is_active: false }).eq('user_id', userId);

    if (token) {
      query.eq('expo_push_token', token);
    }

    await query;

    return { success: true };
  } catch (error) {
    console.error('[PushNotif] Error deactivating token:', error);
    return { success: false };
  }
}
