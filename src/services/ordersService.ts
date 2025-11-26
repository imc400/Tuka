/**
 * Orders Service
 *
 * Maneja la lógica para obtener el historial de pedidos del usuario
 *
 * @module ordersService
 */

import { supabase } from '../lib/supabase';

// =====================================================
// TYPES
// =====================================================

export interface UserOrder {
  transaction_id: number;
  created_at: string;
  total_amount: number;
  status: string;
  orders_count: number;
  stores: string[];
}

export interface LineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  product_id: number;
  variant_id: number | null;
  variant_title: string | null;
  image_url: string | null;
}

export interface OrderDetails {
  id: number;
  transaction_id: number;
  store_domain: string;
  shopify_order_id: string | null;
  total_price: number;
  line_items_count: number;
  line_items: LineItem[];
  created_at: string;
}

// =====================================================
// GET USER ORDERS
// =====================================================

/**
 * Obtener historial de pedidos del usuario
 * Usa la función SQL get_user_recent_orders()
 */
export async function getUserOrders(
  userId: string,
  limit: number = 20
): Promise<{ orders: UserOrder[]; error?: string }> {
  try {
    console.log('📦 [OrdersService] Obteniendo pedidos del usuario:', userId);

    const { data, error } = await supabase.rpc('get_user_recent_orders', {
      p_user_id: userId,
      p_limit: limit,
    });

    if (error) {
      console.error('❌ [OrdersService] Error obteniendo pedidos:', error);
      return { orders: [], error: error.message };
    }

    if (!data || data.length === 0) {
      console.log('📦 [OrdersService] No hay pedidos para este usuario');
      return { orders: [] };
    }

    console.log(`✅ [OrdersService] ${data.length} pedidos obtenidos`);

    return { orders: data as UserOrder[] };
  } catch (error: any) {
    console.error('❌ [OrdersService] Error inesperado:', error);
    return { orders: [], error: error.message || 'Error desconocido' };
  }
}

// =====================================================
// GET ORDER DETAILS
// =====================================================

/**
 * Obtener detalles de una transacción específica
 */
export async function getOrderDetails(
  transactionId: number
): Promise<{ details: OrderDetails[]; error?: string }> {
  try {
    console.log('📋 [OrdersService] Obteniendo detalles de transacción:', transactionId);

    const { data, error } = await supabase
      .from('shopify_orders')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [OrdersService] Error obteniendo detalles:', error);
      return { details: [], error: error.message };
    }

    console.log(`✅ [OrdersService] ${data?.length || 0} órdenes encontradas`);

    return { details: (data as OrderDetails[]) || [] };
  } catch (error: any) {
    console.error('❌ [OrdersService] Error inesperado:', error);
    return { details: [], error: error.message || 'Error desconocido' };
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Formatear fecha para mostrar en UI
 */
export function formatOrderDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return 'Hoy';
  } else if (diffInDays === 1) {
    return 'Ayer';
  } else if (diffInDays < 7) {
    return `Hace ${diffInDays} días`;
  } else {
    return date.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}

/**
 * Formatear precio en formato chileno
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Obtener color del status
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'approved':
      return '#10B981'; // green
    case 'pending':
      return '#F59E0B'; // yellow
    case 'cancelled':
      return '#EF4444'; // red
    default:
      return '#6B7280'; // gray
  }
}

/**
 * Obtener texto del status en español
 */
export function getStatusText(status: string): string {
  switch (status) {
    case 'approved':
      return 'Aprobado';
    case 'pending':
      return 'Pendiente';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status;
  }
}

// =====================================================
// STORE NAMES MAPPING
// =====================================================

/**
 * Cache de nombres de tiendas para evitar consultas repetidas
 */
let storeNamesCache: Record<string, string> | null = null;

/**
 * Obtener mapeo de dominios a nombres de tiendas
 */
export async function getStoreNamesMap(): Promise<Record<string, string>> {
  if (storeNamesCache) {
    return storeNamesCache;
  }

  try {
    console.log('🏪 [OrdersService] Obteniendo nombres de tiendas...');

    const { data, error } = await supabase
      .from('stores')
      .select('domain, store_name');

    if (error) {
      console.error('❌ [OrdersService] Error obteniendo nombres:', error);
      return {};
    }

    const map: Record<string, string> = {};
    data?.forEach((store) => {
      if (store.domain && store.store_name) {
        map[store.domain] = store.store_name;
      }
    });

    storeNamesCache = map;
    console.log(`✅ [OrdersService] ${Object.keys(map).length} nombres de tiendas cargados`);

    return map;
  } catch (error) {
    console.error('❌ [OrdersService] Error inesperado:', error);
    return {};
  }
}

/**
 * Obtener nombre de tienda dado un dominio
 * Retorna el nombre configurado o formatea el dominio si no existe
 */
export function getStoreName(domain: string, storeNamesMap: Record<string, string>): string {
  // Buscar por dominio completo
  if (storeNamesMap[domain]) {
    return storeNamesMap[domain];
  }

  // Buscar agregando .myshopify.com si no está
  const fullDomain = domain.includes('.myshopify.com') ? domain : `${domain}.myshopify.com`;
  if (storeNamesMap[fullDomain]) {
    return storeNamesMap[fullDomain];
  }

  // Si no existe, formatear el dominio
  return domain
    .replace('.myshopify.com', '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
