/**
 * MercadoPago Service
 * Integración con MercadoPago para procesamiento de pagos
 */

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { CartItem } from '../types';

// Tipos
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
  external_reference?: string; // Para identificar la transacción
  notification_url?: string;
  metadata?: Record<string, any>;
}

export interface MercadoPagoResponse {
  success: boolean;
  preferenceId?: string;
  initPoint?: string;
  error?: string;
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
