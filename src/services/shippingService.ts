/**
 * Shipping Service
 * Calcula y gestiona tarifas de envío desde Shopify
 */

import { supabase } from '../lib/supabase';
import { CartItem } from '../types';

export interface ShippingRate {
  id: string;
  title: string;
  price: number;
  code: string;
  source: string;
}

export interface ShippingRatesByStore {
  [storeDomain: string]: ShippingRate[];
}

export interface SelectedShippingRate {
  rate_id: string;
  title: string;
  price: number;
  code: string;
}

export interface SelectedShippingRates {
  [storeDomain: string]: SelectedShippingRate;
}

/**
 * Calcula tarifas de envío para los items del carrito
 * Llama a la Edge Function que consulta Shopify Admin API
 */
export async function calculateShippingRates(
  cartItems: CartItem[],
  shippingAddress: {
    address1: string;
    city: string;
    province: string;
    zip: string;
    country_code?: string;
  }
): Promise<{
  success: boolean;
  shippingRates?: ShippingRatesByStore;
  errors?: Record<string, string>;
  error?: string;
}> {
  try {
    // Asegurar que tenemos country_code
    const fullAddress = {
      ...shippingAddress,
      country_code: shippingAddress.country_code || 'CL',
    };

    console.log('[ShippingService] Calling Edge Function with:', {
      itemsCount: cartItems.length,
      address: fullAddress,
    });

    const { data, error } = await supabase.functions.invoke('calculate-shipping', {
      body: {
        cartItems,
        shippingAddress: fullAddress,
      },
    });

    console.log('[ShippingService] Edge Function response:', { data, error });

    if (error) {
      console.error('[ShippingService] Error calculating shipping:', error);
      return {
        success: false,
        error: error.message || 'Error al calcular envíos',
      };
    }

    return {
      success: data.success,
      shippingRates: data.shippingRates,
      errors: data.errors,
    };
  } catch (error: any) {
    console.error('Error in calculateShippingRates:', error);
    return {
      success: false,
      error: error.message || 'Error de conexión',
    };
  }
}

/**
 * Calcula el total de envíos seleccionados
 */
export function calculateTotalShipping(
  selectedRates: SelectedShippingRates
): number {
  return Object.values(selectedRates).reduce((sum, rate) => sum + rate.price, 0);
}

/**
 * Agrupa items del carrito por tienda para mostrar envíos por separado
 */
export function groupCartItemsByStore(
  cartItems: CartItem[]
): Record<string, { items: CartItem[]; subtotal: number; storeName: string }> {
  const grouped: Record<string, { items: CartItem[]; subtotal: number; storeName: string }> = {};

  cartItems.forEach((item) => {
    const domain = item.storeId.replace(/^real-/, '');

    if (!grouped[domain]) {
      grouped[domain] = {
        items: [],
        subtotal: 0,
        storeName: item.storeName || domain,
      };
    }

    grouped[domain].items.push(item);
    grouped[domain].subtotal += item.price * item.quantity;
  });

  return grouped;
}

/**
 * Valida que se hayan seleccionado métodos de envío para todas las tiendas
 */
export function validateShippingSelection(
  cartItems: CartItem[],
  selectedRates: SelectedShippingRates
): { valid: boolean; missingStores?: string[] } {
  const storeDomainsInCart = [...new Set(
    cartItems.map((item) => item.storeId.replace(/^real-/, ''))
  )];

  const missingStores = storeDomainsInCart.filter(
    (domain) => !selectedRates[domain]
  );

  return {
    valid: missingStores.length === 0,
    missingStores: missingStores.length > 0 ? missingStores : undefined,
  };
}

/**
 * Formatea dirección para enviar a Shopify
 */
export function formatAddressForShopify(address: {
  address: string;
  city: string;
  region: string;
  zipCode: string;
}): {
  address1: string;
  city: string;
  province: string;
  zip: string;
  country_code: string;
} {
  return {
    address1: address.address,
    city: address.city,
    province: address.region,
    zip: address.zipCode,
    country_code: 'CL',
  };
}
