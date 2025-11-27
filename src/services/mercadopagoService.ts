/**
 * MercadoPago Service
 * Integración con MercadoPago para procesamiento de pagos
 *
 * MODELO: Multi-Payment Marketplace
 * - Cada tienda recibe su pago directo
 * - Grumo cobra comisión via application_fee
 * - Cliente hace N pagos (1 por tienda) en un solo flujo UX
 */

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { CartItem } from '../types';

// Tipos para el modelo original (deprecated)
export interface MercadoPagoPreference {
  items: Array<{
    id?: string;
    title: string;
    description?: string;
    category_id?: string;
    quantity: number;
    unit_price: number;
    currency_id: string;
  }>;
  payer?: {
    name?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: {
      number: string;
    };
  };
  statement_descriptor?: string;
  back_urls?: {
    success: string;
    failure: string;
    pending: string;
  };
  auto_return?: 'approved' | 'all';
  external_reference?: string;
  notification_url?: string;
  metadata?: Record<string, any>;
}

export interface MercadoPagoResponse {
  success: boolean;
  preferenceId?: string;
  initPoint?: string;
  error?: string;
}

// ============================================
// TIPOS PARA MULTI-PAYMENT
// ============================================

export interface StorePaymentPreference {
  storeDomain: string;
  storeName: string;
  preferenceId: string;
  initPoint: string;
  amount: number;
  applicationFee: number;
  items: CartItem[];
}

export interface MultiPaymentResponse {
  success: boolean;
  mode: 'multi';
  totalPayments: number;
  preferences: StorePaymentPreference[];
  errors?: Array<{ store: string; error: string }>;
}

export interface MultiPaymentResult {
  success: boolean;
  completedPayments: number;
  totalPayments: number;
  failedStores: string[];
  results: Array<{
    storeDomain: string;
    status: 'success' | 'cancelled' | 'pending';
  }>;
}

/**
 * Crea una preferencia de pago en MercadoPago
 * Esta función llama a tu backend (Edge Function) que tiene el Access Token
 */
export async function createMercadoPagoPreference(
  cartItems: CartItem[],
  buyerInfo: {
    name: string;
    email: string;
    phone: string;
  },
  transactionId: number,
  isTest: boolean = false
): Promise<MercadoPagoResponse> {
  try {
    // URL de tu Edge Function
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const backendUrl = supabaseUrl.replace('/rest/v1', '').replace(/\/$/, '');

    const endpoint = `${backendUrl}/functions/v1/create-mp-preference`;

    // Agrupar items por tienda para el título
    const storesCount = new Set(cartItems.map((item) => item.storeId)).size;
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    // Crear item único con el total
    const totalAmount = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Generar back URLs - usar HTTPS en producción
    const baseUrl = 'https://shopunite.cl'; // Placeholder - MercadoPago requiere HTTPS

    const preference: MercadoPagoPreference = {
      items: cartItems.map((item) => ({
        id: item.id, // ID único del producto para antifraude
        title: item.name,
        description: item.name, // Descripción para antifraude
        category_id: 'marketplace', // Categoría para antifraude
        quantity: item.quantity,
        unit_price: item.price,
        currency_id: 'CLP',
      })),
      payer: {
        name: buyerInfo.name,
        email: buyerInfo.email,
        first_name: buyerInfo.name.split(' ')[0],
        last_name: buyerInfo.name.split(' ').slice(1).join(' ') || buyerInfo.name.split(' ')[0],
        phone: {
          number: buyerInfo.phone,
        },
      },
      statement_descriptor: 'ShopUnite', // Aparece en resumen de tarjeta
      back_urls: {
        success: `${baseUrl}/payment/success`,
        failure: `${baseUrl}/payment/failure`,
        pending: `${baseUrl}/payment/pending`,
      },
      auto_return: 'approved',
      external_reference: transactionId.toString(),
      notification_url: `${backendUrl}/functions/v1/mp-webhook`,
      metadata: {
        transaction_id: transactionId,
        is_test: isTest,
        stores_count: storesCount,
        items_count: totalItems,
      },
    };

    // Llamar al backend
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(preference),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Error al crear preferencia de pago',
      };
    }

    const data = await response.json();

    return {
      success: true,
      preferenceId: data.id,
      initPoint: data.init_point,
    };
  } catch (error) {
    console.error('Error creating MercadoPago preference:', error);
    return {
      success: false,
      error: 'Error de conexión con el servidor de pagos',
    };
  }
}

/**
 * Abre el checkout de MercadoPago en el navegador
 */
export async function openMercadoPagoCheckout(
  initPoint: string
): Promise<{ success: boolean; paymentStatus?: string }> {
  try {
    const result = await WebBrowser.openBrowserAsync(initPoint, {
      dismissButtonStyle: 'close',
      readerMode: false,
      enableBarCollapsing: false,
    });

    // El usuario completó el pago o cerró el navegador
    if (result.type === 'cancel') {
      return { success: false, paymentStatus: 'cancelled' };
    }

    // En este punto, el usuario volvió a la app
    // El webhook de MercadoPago ya habrá notificado el resultado
    return { success: true, paymentStatus: 'pending' };
  } catch (error) {
    console.error('Error opening MercadoPago checkout:', error);
    return { success: false };
  }
}

/**
 * Verifica el estado de un pago
 */
export async function checkPaymentStatus(
  transactionId: number
): Promise<{
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  mpPaymentId?: string;
}> {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const backendUrl = supabaseUrl.replace('/rest/v1', '').replace(/\/$/, '');

    const response = await fetch(
      `${backendUrl}/functions/v1/check-payment-status?transaction_id=${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return { status: 'pending' };
    }

    const data = await response.json();
    return {
      status: data.status,
      mpPaymentId: data.mp_payment_id,
    };
  } catch (error) {
    console.error('Error checking payment status:', error);
    return { status: 'pending' };
  }
}

/**
 * Cancela una preferencia/pago pendiente
 */
export async function cancelPayment(transactionId: number): Promise<boolean> {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const backendUrl = supabaseUrl.replace('/rest/v1', '').replace(/\/$/, '');

    const response = await fetch(`${backendUrl}/functions/v1/cancel-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ transaction_id: transactionId }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error cancelling payment:', error);
    return false;
  }
}

// ============================================
// FUNCIONES MULTI-PAYMENT (NUEVO MODELO)
// ============================================

/**
 * Crea múltiples preferencias de pago (1 por tienda)
 * Este es el nuevo modelo donde cada tienda recibe su pago directo
 */
export async function createMultiPaymentPreferences(
  cartItems: CartItem[],
  buyerInfo: {
    name: string;
    email: string;
    phone: string;
  },
  transactionId: number,
  shippingCosts: Record<string, { price: number; title: string }>
): Promise<MultiPaymentResponse | null> {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const backendUrl = supabaseUrl.replace('/rest/v1', '').replace(/\/$/, '');

    const endpoint = `${backendUrl}/functions/v1/create-multi-payment`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        transactionId,
        cartItems,
        buyerInfo,
        shippingCosts,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error creating multi-payment:', errorData);
      return null;
    }

    const data: MultiPaymentResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error in createMultiPaymentPreferences:', error);
    return null;
  }
}

/**
 * Procesa todos los pagos secuencialmente
 * Abre el checkout de MP para cada tienda
 *
 * @param preferences Lista de preferencias por tienda
 * @param onProgress Callback para actualizar UI (ej: "Pago 1 de 3")
 * @returns Resultado del proceso multi-payment
 */
export async function processMultiPayments(
  preferences: StorePaymentPreference[],
  onProgress?: (current: number, total: number, storeName: string) => void
): Promise<MultiPaymentResult> {
  const results: MultiPaymentResult['results'] = [];
  const failedStores: string[] = [];

  for (let i = 0; i < preferences.length; i++) {
    const pref = preferences[i];

    // Notificar progreso
    if (onProgress) {
      onProgress(i + 1, preferences.length, pref.storeName);
    }

    try {
      // Abrir checkout de MP para esta tienda
      const result = await WebBrowser.openBrowserAsync(pref.initPoint, {
        dismissButtonStyle: 'close',
        readerMode: false,
        enableBarCollapsing: false,
      });

      if (result.type === 'cancel') {
        // Usuario canceló este pago
        results.push({
          storeDomain: pref.storeDomain,
          status: 'cancelled',
        });
        failedStores.push(pref.storeDomain);
      } else {
        // Usuario completó (el estado real lo confirma el webhook)
        results.push({
          storeDomain: pref.storeDomain,
          status: 'pending',
        });
      }
    } catch (error) {
      console.error(`Error processing payment for ${pref.storeDomain}:`, error);
      results.push({
        storeDomain: pref.storeDomain,
        status: 'cancelled',
      });
      failedStores.push(pref.storeDomain);
    }
  }

  const completedPayments = results.filter(r => r.status !== 'cancelled').length;

  return {
    success: completedPayments === preferences.length,
    completedPayments,
    totalPayments: preferences.length,
    failedStores,
    results,
  };
}

/**
 * Verifica el estado de todos los pagos de una transacción multi-payment
 */
export async function checkMultiPaymentStatus(
  transactionId: number
): Promise<{
  status: 'pending' | 'approved' | 'partial' | 'rejected';
  completedPayments: number;
  totalPayments: number;
  stores: Array<{
    domain: string;
    status: string;
    amount: number;
  }>;
}> {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const backendUrl = supabaseUrl.replace('/rest/v1', '').replace(/\/$/, '');

    const response = await fetch(
      `${backendUrl}/functions/v1/check-multi-payment-status?transaction_id=${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return {
        status: 'pending',
        completedPayments: 0,
        totalPayments: 0,
        stores: [],
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking multi-payment status:', error);
    return {
      status: 'pending',
      completedPayments: 0,
      totalPayments: 0,
      stores: [],
    };
  }
}

/**
 * Determina si se debe usar multi-payment o single-payment
 * Multi-payment se usa cuando hay items de múltiples tiendas
 */
export function shouldUseMultiPayment(cartItems: CartItem[]): boolean {
  const uniqueStores = new Set(
    cartItems.map((item) => item.storeId.replace(/^real-/, ''))
  );
  return uniqueStores.size > 1;
}

/**
 * Obtiene el resumen de pagos por tienda del carrito
 */
export function getPaymentSummaryByStore(
  cartItems: CartItem[],
  shippingCosts: Record<string, { price: number; title: string }>
): Array<{
  storeId: string;
  storeName: string;
  itemsTotal: number;
  shippingCost: number;
  total: number;
  itemCount: number;
}> {
  const storeMap = new Map<string, {
    storeId: string;
    storeName: string;
    itemsTotal: number;
    itemCount: number;
  }>();

  cartItems.forEach((item) => {
    const storeId = item.storeId.replace(/^real-/, '');
    const existing = storeMap.get(storeId);

    if (existing) {
      existing.itemsTotal += item.price * item.quantity;
      existing.itemCount += item.quantity;
    } else {
      storeMap.set(storeId, {
        storeId,
        storeName: item.storeName || storeId,
        itemsTotal: item.price * item.quantity,
        itemCount: item.quantity,
      });
    }
  });

  return Array.from(storeMap.values()).map((store) => ({
    ...store,
    shippingCost: shippingCosts[store.storeId]?.price || 0,
    total: store.itemsTotal + (shippingCosts[store.storeId]?.price || 0),
  }));
}
