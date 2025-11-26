/**
 * Order Detail Screen
 *
 * Pantalla que muestra el detalle completo de un pedido
 * con productos agrupados por tienda y opción de repetir pedido
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { ChevronLeft, Package, Calendar, Store, RefreshCw } from 'lucide-react-native';
import {
  getOrderDetails,
  formatOrderDate,
  formatPrice,
  getStatusColor,
  getStatusText,
  getStoreNamesMap,
  getStoreName,
  type OrderDetails,
  type LineItem,
  type UserOrder,
} from '../services/ordersService';
import { CartItem } from '../types';

interface OrderDetailScreenProps {
  order: UserOrder;
  onBack: () => void;
  onRepeatOrder: (items: CartItem[]) => void;
}

export default function OrderDetailScreen({
  order,
  onBack,
  onRepeatOrder,
}: OrderDetailScreenProps) {
  const [orderDetails, setOrderDetails] = useState<OrderDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storeNamesMap, setStoreNamesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    loadOrderDetails();
  }, [order.transaction_id]);

  async function loadOrderDetails() {
    setIsLoading(true);
    setError(null);

    // Cargar nombres de tiendas y detalles en paralelo
    const [storeNames, { details, error: fetchError }] = await Promise.all([
      getStoreNamesMap(),
      getOrderDetails(order.transaction_id),
    ]);

    setStoreNamesMap(storeNames);

    if (fetchError) {
      setError(fetchError);
    } else {
      console.log('📦 [OrderDetailScreen] Raw details:', JSON.stringify(details, null, 2));

      // Convertir order_items a line_items en el formato esperado
      const parsedDetails = details.map((detail: any) => {
        console.log('🔍 [OrderDetailScreen] order_items:', detail.order_items);

        let parsedLineItems: LineItem[] = [];

        // order_items viene como array del backend
        if (Array.isArray(detail.order_items)) {
          parsedLineItems = detail.order_items.map((item: any, index: number) => ({
            id: index,
            title: item.name || item.title || 'Producto',
            quantity: item.quantity || 1,
            price: (item.price || item.selectedVariant?.price || 0).toString(),
            product_id: parseInt(item.id?.replace('gid://shopify/Product/', '') || '0'),
            variant_id: item.selectedVariant?.id ?
              parseInt(item.selectedVariant.id.replace('gid://shopify/ProductVariant/', '')) : null,
            variant_title: item.selectedVariant?.title || null,
            image_url: item.images?.[0] || null,
          }));
          console.log('✅ [OrderDetailScreen] Converted to line_items:', parsedLineItems.length);
        }

        return {
          ...detail,
          line_items: parsedLineItems,
        };
      });

      console.log('📦 [OrderDetailScreen] Parsed details:', JSON.stringify(parsedDetails, null, 2));
      setOrderDetails(parsedDetails);
    }

    setIsLoading(false);
  }

  function handleRepeatOrder() {
    // Convertir line_items a CartItems
    const cartItems: CartItem[] = [];

    orderDetails.forEach((orderDetail) => {
      orderDetail.line_items.forEach((item) => {
        // Crear el CartItem con todos los campos requeridos de Product
        const cartItem: CartItem = {
          id: `gid://shopify/Product/${item.product_id}`,
          name: item.title,
          description: item.title, // Usamos el título como descripción
          price: parseFloat(item.price),
          imagePrompt: '', // No se usa para productos reales de Shopify
          images: item.image_url ? [item.image_url] : [],
          variants: item.variant_id ? [{
            id: `gid://shopify/ProductVariant/${item.variant_id}`,
            title: item.variant_title || 'Default Title',
            price: parseFloat(item.price),
            available: true,
          }] : undefined,
          storeName: orderDetail.store_domain.replace('.myshopify.com', ''),
          storeId: orderDetail.store_domain,
          quantity: item.quantity,
          selectedVariant: item.variant_id ? {
            id: `gid://shopify/ProductVariant/${item.variant_id}`,
            title: item.variant_title || 'Default Title',
            price: parseFloat(item.price),
            available: true,
          } : undefined,
        };
        cartItems.push(cartItem);
      });
    });

    if (cartItems.length === 0) {
      Alert.alert('Error', 'No se pudieron obtener los productos del pedido');
      return;
    }

    Alert.alert(
      'Repetir Pedido',
      `Se agregarán ${cartItems.length} productos al carrito. ¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: () => onRepeatOrder(cartItems),
        },
      ]
    );
  }

  const statusColor = getStatusColor(order.status);
  const statusText = getStatusText(order.status);

  // Agrupar por tienda (no se usa actualmente, pero lo dejamos por si acaso)
  const ordersByStore = orderDetails.reduce((acc, detail) => {
    if (!acc[detail.store_domain]) {
      acc[detail.store_domain] = [];
    }
    acc[detail.store_domain].push(detail);
    return acc; // Retornar el acumulador, no un objeto vacío
  }, {} as Record<string, OrderDetails[]>);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-5 pt-12 pb-4 border-b border-gray-100">
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity
            onPress={onBack}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
          >
            <ChevronLeft size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Detalle del Pedido</Text>
          <View className="w-10" />
        </View>

        {/* Info Header */}
        <View className="bg-gray-50 rounded-xl p-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-sm text-gray-600">Pedido #{order.transaction_id}</Text>
            <View
              className="px-3 py-1 rounded-full"
              style={{ backgroundColor: statusColor + '20' }}
            >
              <Text className="text-xs font-semibold" style={{ color: statusColor }}>
                {statusText}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2 mb-2">
            <Calendar size={14} color="#6B7280" />
            <Text className="text-sm text-gray-600">
              {formatOrderDate(order.created_at)}
            </Text>
          </View>
          <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-gray-200">
            <Text className="text-sm text-gray-600">Total</Text>
            <Text className="text-2xl font-bold text-gray-900">
              {formatPrice(order.total_amount)}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-gray-500 mt-4">Cargando detalle...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-5">
          <Package size={48} color="#EF4444" />
          <Text className="text-lg font-semibold text-gray-900 mt-4">
            Error al cargar detalle
          </Text>
          <Text className="text-gray-500 mt-2 text-center">{error}</Text>
          <TouchableOpacity
            onPress={loadOrderDetails}
            className="mt-6 bg-blue-600 px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-semibold">Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView className="flex-1">
          <View className="p-5">
            {/* Productos agrupados por tienda */}
            {orderDetails.map((detail, index) => (
              <StoreOrderSection key={detail.id} detail={detail} storeNamesMap={storeNamesMap} isFirst={index === 0} />
            ))}

            {/* Botón Repetir Pedido */}
            <TouchableOpacity
              onPress={handleRepeatOrder}
              className="bg-blue-600 p-4 rounded-xl flex-row items-center justify-center gap-3 mt-4"
            >
              <RefreshCw size={20} color="#FFFFFF" />
              <Text className="text-white font-bold text-base">
                Repetir Pedido
              </Text>
            </TouchableOpacity>

            <Text className="text-xs text-gray-400 text-center mt-3 mb-6">
              Se agregarán todos los productos al carrito
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// =====================================================
// STORE ORDER SECTION COMPONENT
// =====================================================

interface StoreOrderSectionProps {
  detail: OrderDetails;
  storeNamesMap: Record<string, string>;
  isFirst: boolean;
}

function StoreOrderSection({ detail, storeNamesMap, isFirst }: StoreOrderSectionProps) {
  // Usar el nombre configurado de la tienda
  const storeName = getStoreName(detail.store_domain, storeNamesMap);

  // Calcular subtotal basado en los line_items
  const subtotal = detail.line_items.reduce((sum, item) => {
    const itemTotal = parseFloat(item.price) * item.quantity;
    return sum + itemTotal;
  }, 0);

  return (
    <View className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 ${isFirst ? '' : 'mt-4'}`}>
      {/* Store Header */}
      <View className="flex-row items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        <Store size={18} color="#3B82F6" />
        <Text className="text-base font-bold text-gray-900 flex-1">{storeName}</Text>
        <Text className="text-sm text-gray-500">
          {detail.line_items?.length || 0} {detail.line_items?.length === 1 ? 'producto' : 'productos'}
        </Text>
      </View>

      {/* Products */}
      <View className="gap-3">
        {detail.line_items && detail.line_items.length > 0 ? (
          detail.line_items.map((item, idx) => (
            <ProductItem key={`${item.id || idx}`} item={item} />
          ))
        ) : (
          <Text className="text-sm text-gray-500">No hay productos disponibles</Text>
        )}
      </View>

      {/* Subtotal */}
      <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-gray-100">
        <Text className="text-sm font-medium text-gray-600">Subtotal {storeName}</Text>
        <Text className="text-lg font-bold text-gray-900">
          {formatPrice(subtotal)}
        </Text>
      </View>
    </View>
  );
}

// =====================================================
// PRODUCT ITEM COMPONENT
// =====================================================

interface ProductItemProps {
  item: LineItem;
}

function ProductItem({ item }: ProductItemProps) {
  return (
    <View className="flex-row gap-3">
      {/* Image */}
      {item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          className="w-16 h-16 rounded-lg bg-gray-100"
          resizeMode="cover"
        />
      ) : (
        <View className="w-16 h-16 rounded-lg bg-gray-100 items-center justify-center">
          <Package size={24} color="#D1D5DB" />
        </View>
      )}

      {/* Info */}
      <View className="flex-1">
        <Text className="text-sm font-medium text-gray-900 mb-1" numberOfLines={2}>
          {item.title}
        </Text>
        {item.variant_title && (
          <Text className="text-xs text-gray-500 mb-1">{item.variant_title}</Text>
        )}
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-gray-600">Cantidad: {item.quantity}</Text>
          <Text className="text-sm font-bold text-gray-900">
            {formatPrice(parseFloat(item.price) * item.quantity)}
          </Text>
        </View>
      </View>
    </View>
  );
}
