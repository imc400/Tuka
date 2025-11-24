/**
 * Order Service
 * Maneja la creación de órdenes y procesamiento de pagos
 */

import { supabase } from '../lib/supabase';
import { CartItem } from '../types';

// ============================================
// TYPES
// ============================================

export interface ShippingInfo {
  fullName: string;
  address: string;
  city: string;
  region: string;
  zipCode: string;
  phone: string;
  email: string;
}

export interface ShippingCost {
  rate_id: string;
  title: string;
  price: number;
  code: string;
}

export interface TransactionData {
  cartItems: CartItem[];
  shippingInfo: ShippingInfo;
  totalAmount: number;
  storeSplits: Record<string, number>; // { domain: amount }
  shippingCosts: Record<string, ShippingCost>; // { domain: ShippingCost }
  isTest?: boolean;
  userId?: string; // UUID del usuario autenticado (opcional para guest checkout)
}

export interface ShopifyOrderItem {
  variantId: string;
  quantity: number;
  price: number;
  title: string;
}

export interface CreateOrderResponse {
  success: boolean;
  transactionId?: number;
  shopifyOrders?: Array<{
    storeDomain: string;
    shopifyOrderId?: string;
    status: string;
  }>;
  error?: string;
}

// ============================================
// TRANSACTION MANAGEMENT
// ============================================

/**
 * Crea una transacción pendiente en la base de datos
 * Esto se hace ANTES de procesar el pago
 */
export async function createPendingTransaction(
  data: TransactionData
): Promise<{ transactionId: number } | null> {
  try {
    // Calcular splits por tienda
    const storeSplits: Record<string, number> = {};

    data.cartItems.forEach((item) => {
      const itemTotal = item.price * item.quantity;
      if (storeSplits[item.storeId]) {
        storeSplits[item.storeId] += itemTotal;
      } else {
        storeSplits[item.storeId] = itemTotal;
      }
    });

    // Crear transacción
    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert({
        total_amount: data.totalAmount,
        currency: 'CLP',
        status: 'pending',
        buyer_email: data.shippingInfo.email,
        buyer_name: data.shippingInfo.fullName,
        buyer_phone: data.shippingInfo.phone,
        shipping_address: {
          street: data.shippingInfo.address,
          city: data.shippingInfo.city,
          region: data.shippingInfo.region,
          zip_code: data.shippingInfo.zipCode,
        },
        cart_items: data.cartItems,
        store_splits: storeSplits,
        shipping_costs: data.shippingCosts || {}, // Costos de envío seleccionados
        is_test: data.isTest || false,
        user_id: data.userId || null, // Asociar a usuario si está autenticado
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating transaction:', error);
      return null;
    }

    return { transactionId: transaction.id };
  } catch (error) {
    console.error('Error in createPendingTransaction:', error);
    return null;
  }
}

/**
 * Actualiza el estado de una transacción
 */
export async function updateTransactionStatus(
  transactionId: number,
  status: 'approved' | 'rejected' | 'cancelled',
  mpPaymentId?: string
): Promise<boolean> {
  try {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'approved') {
      updateData.paid_at = new Date().toISOString();
    }

    if (mpPaymentId) {
      updateData.mp_payment_id = mpPaymentId;
    }

    const { error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId);

    if (error) {
      console.error('Error updating transaction:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateTransactionStatus:', error);
    return false;
  }
}

// ============================================
// ORDER CREATION
// ============================================

/**
 * Crea órdenes de prueba (sin llamar a Shopify)
 * Útil para testing del flujo completo
 */
export async function createTestOrders(
  transactionId: number,
  cartItems: CartItem[]
): Promise<boolean> {
  try {
    // Agrupar items por tienda
    const itemsByStore: Record<string, CartItem[]> = {};

    cartItems.forEach((item) => {
      // Limpiar el prefijo "real-" si existe
      const cleanStoreDomain = item.storeId.replace(/^real-/, '');

      if (!itemsByStore[cleanStoreDomain]) {
        itemsByStore[cleanStoreDomain] = [];
      }
      itemsByStore[cleanStoreDomain].push(item);
    });

    // Crear órdenes para cada tienda
    const orderPromises = Object.entries(itemsByStore).map(
      async ([storeDomain, items]) => {
        const orderAmount = items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );

        return supabase.from('shopify_orders').insert({
          transaction_id: transactionId,
          store_domain: storeDomain,
          order_amount: orderAmount,
          order_items: items,
          status: 'created', // Simulamos que se creó exitosamente
          shopify_order_id: `test_${Date.now()}_${storeDomain}`,
          shopify_order_number: `#TEST-${Math.floor(1000 + Math.random() * 9000)}`,
          synced_at: new Date().toISOString(),
        });
      }
    );

    await Promise.all(orderPromises);
    return true;
  } catch (error) {
    console.error('Error creating test orders:', error);
    return false;
  }
}

/**
 * Obtiene las órdenes de una transacción
 */
export async function getTransactionOrders(transactionId: number) {
  try {
    const { data, error } = await supabase
      .from('shopify_orders')
      .select('*')
      .eq('transaction_id', transactionId);

    if (error) {
      console.error('Error fetching orders:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getTransactionOrders:', error);
    return null;
  }
}

/**
 * Obtiene el historial de órdenes de un usuario
 */
export async function getUserOrders(email: string) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        id,
        total_amount,
        status,
        created_at,
        cart_items,
        store_splits,
        shopify_orders (
          id,
          store_domain,
          order_amount,
          shopify_order_number,
          status
        )
      `)
      .eq('buyer_email', email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user orders:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserOrders:', error);
    return null;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calcula el split de montos por tienda
 */
export function calculateStoreSplits(
  cartItems: CartItem[]
): Record<string, number> {
  const splits: Record<string, number> = {};

  cartItems.forEach((item) => {
    const itemTotal = item.price * item.quantity;
    if (splits[item.storeId]) {
      splits[item.storeId] += itemTotal;
    } else {
      splits[item.storeId] = itemTotal;
    }
  });

  return splits;
}

/**
 * Agrupa items del carrito por tienda
 */
export function groupCartItemsByStore(
  cartItems: CartItem[]
): Record<string, CartItem[]> {
  const grouped: Record<string, CartItem[]> = {};

  cartItems.forEach((item) => {
    if (!grouped[item.storeId]) {
      grouped[item.storeId] = [];
    }
    grouped[item.storeId].push(item);
  });

  return grouped;
}

/**
 * Valida la información de envío
 */
export function validateShippingInfo(info: ShippingInfo): string | null {
  if (!info.fullName || info.fullName.trim().length < 3) {
    return 'El nombre debe tener al menos 3 caracteres';
  }

  if (!info.address || info.address.trim().length < 5) {
    return 'La dirección debe tener al menos 5 caracteres';
  }

  if (!info.city || info.city.trim().length < 2) {
    return 'La ciudad es requerida';
  }

  if (!info.phone || info.phone.trim().length < 8) {
    return 'El teléfono debe tener al menos 8 dígitos';
  }

  if (!info.email || !info.email.includes('@')) {
    return 'El email es inválido';
  }

  return null; // Válido
}
