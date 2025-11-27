/**
 * Notification Analytics Service
 *
 * Trackea clicks y conversiones de notificaciones push
 * para medir la efectividad de las campañas.
 */

import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_CLICKED_NOTIFICATION_KEY = 'last_clicked_notification';
const NOTIFICATION_CLICK_WINDOW_MS = 30 * 60 * 1000; // 30 minutos para atribuir conversión

interface LastClickedNotification {
  notificationId: number;
  storeId: string;
  clickedAt: string;
  userId?: string;
}

/**
 * Registra un click en una notificación
 * Llamar cuando el usuario toca una notificación push
 */
export async function trackNotificationClick(
  storeId: string,
  userId?: string
): Promise<{ success: boolean; notificationId?: number }> {
  try {
    console.log('📊 [Analytics] Tracking notification click for store:', storeId);

    // 1. Buscar la notificación más reciente enviada a esta tienda (últimos 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: notifications, error: fetchError } = await supabase
      .from('notifications_sent')
      .select('id, recipients')
      .eq('store_id', storeId)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(5);

    if (fetchError) {
      console.error('❌ [Analytics] Error fetching notifications:', fetchError);
      return { success: false };
    }

    if (!notifications || notifications.length === 0) {
      console.log('📊 [Analytics] No recent notifications found for store');
      return { success: false };
    }

    // 2. Encontrar la notificación que corresponde al usuario (si tenemos userId)
    let targetNotification = notifications[0]; // Por defecto, la más reciente

    if (userId) {
      const userNotification = notifications.find(n => {
        const recipients = n.recipients || [];
        return recipients.some((r: any) => r.user_id === userId);
      });
      if (userNotification) {
        targetNotification = userNotification;
      }
    }

    // 3. Incrementar el contador de clicks
    const { error: updateError } = await supabase.rpc('increment_notification_clicks', {
      notification_id: targetNotification.id,
    });

    if (updateError) {
      // Si el RPC no existe, intentar update directo
      console.log('📊 [Analytics] RPC not found, trying direct update...');
      const { error: directError } = await supabase
        .from('notifications_sent')
        .update({ total_clicked: supabase.rpc('coalesce', { value: 'total_clicked', default_value: 0 }) })
        .eq('id', targetNotification.id);

      // Fallback: hacer un select + update manual
      const { data: current } = await supabase
        .from('notifications_sent')
        .select('total_clicked')
        .eq('id', targetNotification.id)
        .single();

      await supabase
        .from('notifications_sent')
        .update({ total_clicked: (current?.total_clicked || 0) + 1 })
        .eq('id', targetNotification.id);
    }

    console.log('✅ [Analytics] Click tracked for notification:', targetNotification.id);

    // 4. Guardar en AsyncStorage para tracking de conversión
    const lastClicked: LastClickedNotification = {
      notificationId: targetNotification.id,
      storeId,
      clickedAt: new Date().toISOString(),
      userId,
    };
    await AsyncStorage.setItem(LAST_CLICKED_NOTIFICATION_KEY, JSON.stringify(lastClicked));

    return { success: true, notificationId: targetNotification.id };
  } catch (error) {
    console.error('❌ [Analytics] Error tracking click:', error);
    return { success: false };
  }
}

/**
 * Registra una conversión (compra) asociada a una notificación
 * Llamar después de una compra exitosa
 */
export async function trackConversion(
  storeId: string,
  orderTotal: number,
  orderId?: string
): Promise<{ success: boolean; attributed: boolean }> {
  try {
    console.log('📊 [Analytics] Tracking conversion for store:', storeId, 'total:', orderTotal);

    // 1. Verificar si hay una notificación clickeada recientemente
    const lastClickedStr = await AsyncStorage.getItem(LAST_CLICKED_NOTIFICATION_KEY);

    if (!lastClickedStr) {
      console.log('📊 [Analytics] No recent notification click found');
      return { success: true, attributed: false };
    }

    const lastClicked: LastClickedNotification = JSON.parse(lastClickedStr);

    // 2. Verificar que sea de la misma tienda
    // IMPORTANTE: Solo atribuir conversión a la tienda que envió la notificación
    // Si el usuario compra de múltiples tiendas, solo cuenta para la que envió el push
    if (lastClicked.storeId !== storeId) {
      console.log(`📊 [Analytics] Store mismatch - notification was from ${lastClicked.storeId}, purchase is from ${storeId}`);
      // NO limpiar el click aquí - puede que aún compre de la tienda correcta
      return { success: true, attributed: false };
    }

    // 3. Verificar que esté dentro de la ventana de atribución (30 min)
    const clickedAt = new Date(lastClicked.clickedAt).getTime();
    const now = Date.now();

    if (now - clickedAt > NOTIFICATION_CLICK_WINDOW_MS) {
      console.log('📊 [Analytics] Click outside attribution window (30 min)');
      // Limpiar el click guardado porque ya expiró
      await AsyncStorage.removeItem(LAST_CLICKED_NOTIFICATION_KEY);
      return { success: true, attributed: false };
    }

    // 4. Registrar la conversión
    const { data: notification, error: fetchError } = await supabase
      .from('notifications_sent')
      .select('conversions, revenue')
      .eq('id', lastClicked.notificationId)
      .single();

    if (fetchError) {
      console.error('❌ [Analytics] Error fetching notification:', fetchError);
      return { success: false, attributed: false };
    }

    const newConversions = (notification?.conversions || 0) + 1;
    const newRevenue = (notification?.revenue || 0) + orderTotal;

    const { error: updateError } = await supabase
      .from('notifications_sent')
      .update({
        conversions: newConversions,
        revenue: newRevenue,
      })
      .eq('id', lastClicked.notificationId);

    if (updateError) {
      console.error('❌ [Analytics] Error updating conversion:', updateError);
      return { success: false, attributed: false };
    }

    console.log('✅ [Analytics] Conversion tracked! Notification:', lastClicked.notificationId);
    console.log('📊 [Analytics] Total conversions:', newConversions, 'Revenue:', newRevenue);

    // 5. Limpiar el click guardado para no atribuir múltiples compras
    await AsyncStorage.removeItem(LAST_CLICKED_NOTIFICATION_KEY);

    return { success: true, attributed: true };
  } catch (error) {
    console.error('❌ [Analytics] Error tracking conversion:', error);
    return { success: false, attributed: false };
  }
}

/**
 * Obtiene las métricas de una campaña/notificación específica
 */
export async function getNotificationMetrics(notificationId: number) {
  try {
    const { data, error } = await supabase
      .from('notifications_sent')
      .select('total_sent, total_delivered, total_clicked, conversions, revenue')
      .eq('id', notificationId)
      .single();

    if (error) {
      console.error('❌ [Analytics] Error fetching metrics:', error);
      return null;
    }

    const totalSent = data.total_sent || 0;
    const totalClicked = data.total_clicked || 0;
    const ctr = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
    const conversionRate = totalClicked > 0 ? ((data.conversions || 0) / totalClicked) * 100 : 0;

    return {
      totalSent,
      totalDelivered: data.total_delivered || totalSent,
      totalClicked,
      ctr: ctr.toFixed(2),
      conversions: data.conversions || 0,
      revenue: data.revenue || 0,
      conversionRate: conversionRate.toFixed(2),
    };
  } catch (error) {
    console.error('❌ [Analytics] Error getting metrics:', error);
    return null;
  }
}

/**
 * Limpia los datos de click guardados (útil para testing o logout)
 */
export async function clearNotificationClickData(): Promise<void> {
  await AsyncStorage.removeItem(LAST_CLICKED_NOTIFICATION_KEY);
}
