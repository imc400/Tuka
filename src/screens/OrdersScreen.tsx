/**
 * Orders Screen
 *
 * Pantalla que muestra el historial de pedidos del usuario
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { ChevronLeft, Package, Calendar, Store } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import {
  getUserOrders,
  formatOrderDate,
  formatPrice,
  getStatusColor,
  getStatusText,
  getStoreNamesMap,
  getStoreName,
  type UserOrder,
} from '../services/ordersService';

interface OrdersScreenProps {
  onBack: () => void;
  onSelectOrder: (order: UserOrder) => void;
}

export default function OrdersScreen({ onBack, onSelectOrder }: OrdersScreenProps) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storeNamesMap, setStoreNamesMap] = useState<Record<string, string>>({});

  // Cargar pedidos al montar
  useEffect(() => {
    loadOrders();
  }, [user]);

  async function loadOrders() {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Cargar nombres de tiendas y pedidos en paralelo
    const [storeNames, { orders: fetchedOrders, error: fetchError }] = await Promise.all([
      getStoreNamesMap(),
      getUserOrders(user.id),
    ]);

    setStoreNamesMap(storeNames);

    if (fetchError) {
      setError(fetchError);
    } else {
      setOrders(fetchedOrders);
    }

    setIsLoading(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-5 pt-12 pb-4 border-b border-gray-100">
        <View className="flex-row items-center justify-between mb-2">
          <TouchableOpacity
            onPress={onBack}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
          >
            <ChevronLeft size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Mis Pedidos</Text>
          <View className="w-10" />
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {isLoading ? (
          /* Loading State */
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="text-gray-500 mt-4">Cargando pedidos...</Text>
          </View>
        ) : error ? (
          /* Error State */
          <View className="flex-1 items-center justify-center py-20 px-5">
            <Package size={48} color="#EF4444" />
            <Text className="text-lg font-semibold text-gray-900 mt-4">
              Error al cargar pedidos
            </Text>
            <Text className="text-gray-500 mt-2 text-center">{error}</Text>
            <TouchableOpacity
              onPress={loadOrders}
              className="mt-6 bg-blue-600 px-6 py-3 rounded-xl"
            >
              <Text className="text-white font-semibold">Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : orders.length === 0 ? (
          /* Empty State */
          <View className="flex-1 items-center justify-center py-20 px-5">
            <Package size={64} color="#D1D5DB" />
            <Text className="text-xl font-bold text-gray-900 mt-6">
              No hay pedidos aún
            </Text>
            <Text className="text-gray-500 mt-2 text-center">
              Tus pedidos aparecerán aquí después de realizar tu primera compra
            </Text>
            <TouchableOpacity
              onPress={onBack}
              className="mt-6 bg-blue-600 px-6 py-3 rounded-xl"
            >
              <Text className="text-white font-semibold">Explorar productos</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Orders List */
          <View className="p-5 gap-4">
            {orders.map((order) => (
              <OrderCard
                key={order.transaction_id}
                order={order}
                storeNamesMap={storeNamesMap}
                onPress={() => onSelectOrder(order)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// =====================================================
// ORDER CARD COMPONENT
// =====================================================

interface OrderCardProps {
  order: UserOrder;
  storeNamesMap: Record<string, string>;
  onPress: () => void;
}

function OrderCard({ order, storeNamesMap, onPress }: OrderCardProps) {
  const statusColor = getStatusColor(order.status);
  const statusText = getStatusText(order.status);

  // Obtener nombres de tiendas usando el mapeo
  const storeNames = order.stores.map(domain => getStoreName(domain, storeNamesMap));

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
    >
      {/* Header con fecha y status */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Calendar size={16} color="#6B7280" />
          <Text className="text-sm text-gray-600">
            {formatOrderDate(order.created_at)}
          </Text>
        </View>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: statusColor + '20' }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: statusColor }}
          >
            {statusText}
          </Text>
        </View>
      </View>

      {/* ID de Transacción */}
      <Text className="text-xs text-gray-400 mb-3">
        Pedido #{order.transaction_id}
      </Text>

      {/* Tiendas */}
      <View className="flex-row items-center gap-2 mb-3">
        <Store size={16} color="#6B7280" />
        <Text className="text-sm text-gray-700 flex-1">
          {storeNames.length === 1
            ? storeNames[0]
            : `${storeNames.length} tiendas`}
        </Text>
      </View>

      {/* Footer con total y productos */}
      <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
        <View>
          <Text className="text-xs text-gray-500">Total</Text>
          <Text className="text-lg font-bold text-gray-900">
            {formatPrice(order.total_amount)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs text-gray-500">
            {order.orders_count} {order.orders_count === 1 ? 'producto' : 'productos'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
