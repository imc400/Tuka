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
 * Filtra automáticamente productos de tiendas ocultas
 */
export async function getCart(userId: string): Promise<{ cart: CartItem[]; error?: string }> {
  try {
    console.log('[CartService] Loading cart for user:', userId);

    // 1. Get visible stores (not hidden)
    const { data: visibleStores, error: storesError } = await supabase
      .from('stores')
      .select('domain')
      .or('is_hidden.is.null,is_hidden.eq.false');

    if (storesError) {
      console.error('[CartService] Error loading visible stores:', storesError);
      return { cart: [], error: storesError.message };
    }

    // Create set of visible store IDs (format: "real-domain.myshopify.com")
    const visibleStoreIds = new Set(
      (visibleStores || []).map((s: { domain: string }) => `real-${s.domain}`)
    );

    console.log('[CartService] Visible stores:', visibleStoreIds.size);

    // 2. Get cart items
    const { data, error } = await supabase
      .from('cart_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[CartService] Error loading cart:', error);
      return { cart: [], error: error.message };
    }

    // 3. Filter out items from hidden stores and convert to CartItem format
    const cart: CartItem[] = (data || [])
      .filter((item: DBCartItem) => visibleStoreIds.has(item.store_id))
      .map((item: DBCartItem) => ({
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

    const filteredCount = (data?.length || 0) - cart.length;
    if (filteredCount > 0) {
      console.log(`[CartService] Filtered out ${filteredCount} items from hidden stores`);
    }

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
 * Solo cuenta productos de tiendas visibles
 */
export async function getCartCount(userId: string): Promise<{ count: number; error?: string }> {
  try {
    // 1. Get visible stores
    const { data: visibleStores, error: storesError } = await supabase
      .from('stores')
      .select('domain')
      .or('is_hidden.is.null,is_hidden.eq.false');

    if (storesError) {
      console.error('[CartService] Error loading visible stores:', storesError);
      return { count: 0, error: storesError.message };
    }

    const visibleStoreIds = new Set(
      (visibleStores || []).map((s: { domain: string }) => `real-${s.domain}`)
    );

    // 2. Get cart items
    const { data, error } = await supabase
      .from('cart_items')
      .select('quantity, store_id')
      .eq('user_id', userId);

    if (error) {
      console.error('[CartService] Error getting cart count:', error);
      return { count: 0, error: error.message };
    }

    // 3. Only count items from visible stores
    const count = (data || [])
      .filter((item: { store_id: string }) => visibleStoreIds.has(item.store_id))
      .reduce((sum, item) => sum + item.quantity, 0);

    return { count };
  } catch (error: any) {
    console.error('[CartService] Exception getting cart count:', error);
    return { count: 0, error: error.message || 'Error getting cart count' };
  }
}
