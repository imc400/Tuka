/**
 * Cart Service
 *
 * Maneja el carrito de compras persistente en Supabase
 */

import { supabase } from '../lib/supabase';
import { CartItem, Product, ProductVariant } from '../types';

// =====================================================
// TYPES
// =====================================================

interface DBCartItem {
  id: number;
  user_id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  product_image_url: string | null;
  quantity: number;
  store_id: string;
  store_name: string;
  variant_id: string | null;
  variant_title: string | null;
  variant_price: number | null;
  variant_available: boolean;
  created_at: string;
  updated_at: string;
}

// =====================================================
// GET CART
// =====================================================

/**
 * Obtener carrito del usuario desde la DB
 */
export async function getCart(userId: string): Promise<{ cart: CartItem[]; error?: string }> {
  try {
    console.log('[CartService] Loading cart for user:', userId);

    const { data, error } = await supabase
      .from('cart_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[CartService] Error loading cart:', error);
      return { cart: [], error: error.message };
    }

    // Convertir de DB format a CartItem format
    const cart: CartItem[] = (data || []).map((item: DBCartItem) => ({
      id: item.product_id,
      name: item.product_name,
      price: item.product_price,
      imagePrompt: '', // No usado para productos reales
      images: item.product_image_url ? [item.product_image_url] : undefined,
      storeName: item.store_name,
      storeId: item.store_id,
      quantity: item.quantity,
      selectedVariant: item.variant_id ? {
        id: item.variant_id,
        title: item.variant_title || 'Default Title',
        price: item.variant_price || item.product_price,
        available: item.variant_available,
      } : undefined,
    }));

    console.log('[CartService] Cart loaded:', cart.length, 'items');
    return { cart };
  } catch (error: any) {
    console.error('[CartService] Exception loading cart:', error);
    return { cart: [], error: error.message || 'Error loading cart' };
  }
}

// =====================================================
// ADD TO CART
// =====================================================

/**
 * Agregar producto al carrito (o actualizar cantidad si ya existe)
 */
export async function addToCart(
  userId: string,
  product: Product,
  storeName: string,
  storeId: string,
  variant?: ProductVariant | null
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[CartService] Adding to cart:', product.name);

    const cartItem = {
      user_id: userId,
      product_id: product.id,
      product_name: product.name,
      product_price: variant?.price || product.price,
      product_image_url: product.images?.[0] || null,
      quantity: 1,
      store_id: storeId,
      store_name: storeName,
      variant_id: variant?.id || null,
      variant_title: variant?.title || null,
      variant_price: variant?.price || null,
      variant_available: variant?.available ?? true,
    };

    // Usar upsert para incrementar cantidad si ya existe
    const { data: existing } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('product_id', product.id)
      .eq('variant_id', variant?.id || null)
      .single();

    if (existing) {
      // Producto ya existe, incrementar cantidad
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: existing.quantity + 1 })
        .eq('id', existing.id);

      if (error) {
        console.error('[CartService] Error updating quantity:', error);
        return { success: false, error: error.message };
      }

      console.log('[CartService] Quantity updated');
    } else {
      // Producto nuevo, insertarlo
      const { error } = await supabase
        .from('cart_items')
        .insert(cartItem);

      if (error) {
        console.error('[CartService] Error inserting item:', error);
        return { success: false, error: error.message };
      }

      console.log('[CartService] Item added');
    }

    return { success: true };
  } catch (error: any) {
    console.error('[CartService] Exception adding to cart:', error);
    return { success: false, error: error.message || 'Error adding to cart' };
  }
}

// =====================================================
// UPDATE QUANTITY
// =====================================================

/**
 * Actualizar cantidad de un producto en el carrito
 */
export async function updateCartItemQuantity(
  userId: string,
  productId: string,
  variantId: string | null,
  newQuantity: number
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[CartService] Updating quantity:', productId, newQuantity);

    if (newQuantity <= 0) {
      // Si cantidad es 0 o negativa, eliminar el item
      return await removeFromCart(userId, productId, variantId);
    }

    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: newQuantity })
      .eq('user_id', userId)
      .eq('product_id', productId)
      .eq('variant_id', variantId);

    if (error) {
      console.error('[CartService] Error updating quantity:', error);
      return { success: false, error: error.message };
    }

    console.log('[CartService] Quantity updated');
    return { success: true };
  } catch (error: any) {
    console.error('[CartService] Exception updating quantity:', error);
    return { success: false, error: error.message || 'Error updating quantity' };
  }
}

// =====================================================
// REMOVE FROM CART
// =====================================================

/**
 * Eliminar producto del carrito
 */
export async function removeFromCart(
  userId: string,
  productId: string,
  variantId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[CartService] Removing from cart:', productId);

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId)
      .eq('variant_id', variantId);

    if (error) {
      console.error('[CartService] Error removing item:', error);
      return { success: false, error: error.message };
    }

    console.log('[CartService] Item removed');
    return { success: true };
  } catch (error: any) {
    console.error('[CartService] Exception removing from cart:', error);
    return { success: false, error: error.message || 'Error removing from cart' };
  }
}

// =====================================================
// CLEAR CART
// =====================================================

/**
 * Vaciar todo el carrito del usuario
 */
export async function clearCart(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[CartService] Clearing cart for user:', userId);

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[CartService] Error clearing cart:', error);
      return { success: false, error: error.message };
    }

    console.log('[CartService] Cart cleared');
    return { success: true };
  } catch (error: any) {
    console.error('[CartService] Exception clearing cart:', error);
    return { success: false, error: error.message || 'Error clearing cart' };
  }
}

// =====================================================
// GET CART COUNT
// =====================================================

/**
 * Obtener cantidad total de items en el carrito (suma de quantities)
 */
export async function getCartCount(userId: string): Promise<{ count: number; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('cart_items')
      .select('quantity')
      .eq('user_id', userId);

    if (error) {
      console.error('[CartService] Error getting cart count:', error);
      return { count: 0, error: error.message };
    }

    const count = (data || []).reduce((sum, item) => sum + item.quantity, 0);
    return { count };
  } catch (error: any) {
    console.error('[CartService] Exception getting cart count:', error);
    return { count: 0, error: error.message || 'Error getting cart count' };
  }
}
