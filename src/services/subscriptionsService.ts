/**
 * Subscriptions Service
 *
 * Maneja la lógica para guardar y obtener suscripciones a tiendas
 *
 * @module subscriptionsService
 */

import { supabase } from '../lib/supabase';

// =====================================================
// TYPES
// =====================================================

export interface StoreSubscription {
  id: number;
  user_id: string;
  store_domain: string;
  store_name: string;
  created_at: string;
}

// =====================================================
// GET USER SUBSCRIPTIONS
// =====================================================

/**
 * Obtener las suscripciones del usuario
 */
export async function getUserSubscriptions(
  userId: string
): Promise<{ subscriptions: string[]; error?: string }> {
  try {
    console.log('🔔 [SubscriptionsService] Obteniendo suscripciones del usuario:', userId);

    const { data, error } = await supabase
      .from('store_subscriptions')
      .select('store_domain')
      .eq('user_id', userId)
      .is('unsubscribed_at', null); // Suscripciones activas tienen unsubscribed_at IS NULL

    if (error) {
      console.error('❌ [SubscriptionsService] Error obteniendo suscripciones:', error);
      return { subscriptions: [], error: error.message };
    }

    const storeDomains = (data || []).map((sub: any) => sub.store_domain);
    console.log(`✅ [SubscriptionsService] ${storeDomains.length} suscripciones obtenidas`);

    return { subscriptions: storeDomains };
  } catch (error: any) {
    console.error('❌ [SubscriptionsService] Error inesperado:', error);
    return { subscriptions: [], error: error.message || 'Error desconocido' };
  }
}

// =====================================================
// SUBSCRIBE TO STORE
// =====================================================

/**
 * Suscribirse a una tienda usando la función SQL resubscribe_to_store
 */
export async function subscribeToStore(
  userId: string,
  storeDomain: string,
  storeName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🔔 [SubscriptionsService] Suscribiendo a tienda:', storeDomain);

    // Usar la función SQL que maneja tanto insert como update
    const { data, error } = await supabase.rpc('resubscribe_to_store', {
      p_user_id: userId,
      p_store_domain: storeDomain,
    });

    if (error) {
      console.error('❌ [SubscriptionsService] Error suscribiendo:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ [SubscriptionsService] Suscripción exitosa');
    return { success: true };
  } catch (error: any) {
    console.error('❌ [SubscriptionsService] Error inesperado:', error);
    return { success: false, error: error.message || 'Error desconocido' };
  }
}

// =====================================================
// UNSUBSCRIBE FROM STORE
// =====================================================

/**
 * Desuscribirse de una tienda usando la función SQL unsubscribe_from_store
 */
export async function unsubscribeFromStore(
  userId: string,
  storeDomain: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🔕 [SubscriptionsService] Desuscribiendo de tienda:', storeDomain);

    // Usar la función SQL que hace soft delete (setea unsubscribed_at)
    const { data, error } = await supabase.rpc('unsubscribe_from_store', {
      p_user_id: userId,
      p_store_domain: storeDomain,
    });

    if (error) {
      console.error('❌ [SubscriptionsService] Error desuscribiendo:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ [SubscriptionsService] Desuscripción exitosa');
    return { success: true };
  } catch (error: any) {
    console.error('❌ [SubscriptionsService] Error inesperado:', error);
    return { success: false, error: error.message || 'Error desconocido' };
  }
}
