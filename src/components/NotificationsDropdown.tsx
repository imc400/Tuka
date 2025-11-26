/**
 * Notifications Dropdown Component
 *
 * Menú desplegable que muestra las notificaciones push recibidas
 * Con soporte para deep links a productos/tiendas
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Bell, X, Store, Package, ChevronRight } from 'lucide-react-native';
import {
  getUserNotifications,
  type UserNotification,
} from '../services/pushNotificationService';
import { useAuth } from '../contexts/AuthContext';

interface NotificationsDropdownProps {
  onNavigateToStore?: (storeId: string) => void;
  onNavigateToProduct?: (productId: string, storeId: string) => void;
}

export function NotificationsDropdown({
  onNavigateToStore,
  onNavigateToProduct,
}: NotificationsDropdownProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Cargar notificaciones cuando se abre el dropdown
  useEffect(() => {
    if (isOpen && user) {
      loadNotifications();
    }
  }, [isOpen, user]);

  async function loadNotifications() {
    if (!user) return;

    setIsLoading(true);
    const { notifications: notifs } = await getUserNotifications(user.id);
    setNotifications(notifs);
    setIsLoading(false);
  }

  function handleNotificationPress(notification: UserNotification) {
    setIsOpen(false);

    // Manejar deep links
    if (notification.data?.productId && onNavigateToProduct) {
      onNavigateToProduct(notification.data.productId, notification.data.storeId || notification.store_id);
    } else if (notification.data?.storeId && onNavigateToStore) {
      onNavigateToStore(notification.data.storeId);
    } else if (notification.store_id && onNavigateToStore) {
      onNavigateToStore(notification.store_id);
    }
  }

  function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Hace ${diffInHours}h`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `Hace ${diffInDays}d`;

    return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  }

  return (
    <>
      {/* Bell Icon Button */}
      <TouchableOpacity
        onPress={() => setIsOpen(true)}
        className="bg-gray-100 p-2.5 rounded-full relative"
      >
        <Bell color="#374151" size={22} />
        {notifications.length > 0 && (
          <View className="absolute -top-1 -right-1 w-5 h-5 bg-purple-600 rounded-full items-center justify-center">
            <Text className="text-white text-xs font-bold">
              {notifications.length > 9 ? '9+' : notifications.length}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Modal Dropdown */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/50"
          onPress={() => setIsOpen(false)}
        >
          <View className="mt-24 mx-4">
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View className="bg-white rounded-2xl shadow-2xl overflow-hidden max-h-96">
                {/* Header */}
                <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
                  <Text className="text-lg font-bold text-gray-900">
                    Notificaciones
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIsOpen(false)}
                    className="p-1"
                  >
                    <X size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Content */}
                <ScrollView className="max-h-80">
                  {isLoading ? (
                    <View className="py-8 items-center">
                      <ActivityIndicator size="small" color="#9333EA" />
                      <Text className="text-gray-500 mt-2">Cargando...</Text>
                    </View>
                  ) : notifications.length === 0 ? (
                    <View className="py-8 px-4 items-center">
                      <Bell size={40} color="#D1D5DB" />
                      <Text className="text-gray-500 mt-3 text-center">
                        No tienes notificaciones
                      </Text>
                      <Text className="text-gray-400 text-sm mt-1 text-center">
                        Suscríbete a tiendas para recibir ofertas
                      </Text>
                    </View>
                  ) : (
                    <View>
                      {notifications.map((notification) => (
                        <TouchableOpacity
                          key={notification.id}
                          onPress={() => handleNotificationPress(notification)}
                          className="px-4 py-3 border-b border-gray-50 active:bg-gray-50"
                        >
                          <View className="flex-row items-start gap-3">
                            {/* Icon */}
                            <View className="bg-purple-100 p-2 rounded-full mt-0.5">
                              {notification.data?.productId ? (
                                <Package size={16} color="#9333EA" />
                              ) : (
                                <Store size={16} color="#9333EA" />
                              )}
                            </View>

                            {/* Content */}
                            <View className="flex-1">
                              <View className="flex-row items-center justify-between mb-1">
                                <Text className="text-xs text-purple-600 font-medium">
                                  {notification.store_name}
                                </Text>
                                <Text className="text-xs text-gray-400">
                                  {formatTimeAgo(notification.sent_at)}
                                </Text>
                              </View>
                              <Text className="text-sm font-semibold text-gray-900 mb-0.5">
                                {notification.title}
                              </Text>
                              <Text className="text-sm text-gray-600" numberOfLines={2}>
                                {notification.body}
                              </Text>
                            </View>

                            {/* Arrow */}
                            <ChevronRight size={16} color="#D1D5DB" className="mt-1" />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
