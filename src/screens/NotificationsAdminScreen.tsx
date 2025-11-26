import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { ChevronLeft, Bell, Send, Users, Clock, CheckCircle } from 'lucide-react-native';
import {
  sendNotificationToStoreSubscribers,
  getNotificationHistory,
  type SendNotificationParams,
} from '../services/pushNotificationService';
import { supabase } from '../lib/supabase';

interface NotificationsAdminScreenProps {
  storeId: string;
  storeName: string;
  onBack: () => void;
}

interface NotificationHistoryItem {
  id: number;
  title: string;
  body: string;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  created_at: string;
}

export default function NotificationsAdminScreen({
  storeId,
  storeName,
  onBack,
}: NotificationsAdminScreenProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [productId, setProductId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    loadSubscriberCount();
    loadHistory();
  }, []);

  const loadSubscriberCount = async () => {
    try {
      const { data, error } = await supabase.rpc('get_store_subscribers', {
        store_domain: storeId,
      });

      if (!error && data) {
        setSubscriberCount(data.length);
      }
    } catch (error) {
      console.error('Error loading subscriber count:', error);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    const { notifications, error } = await getNotificationHistory(storeId, 10);

    if (!error) {
      setHistory(notifications);
    }
    setIsLoadingHistory(false);
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Error', 'Por favor completa el título y el mensaje');
      return;
    }

    if (subscriberCount === 0) {
      Alert.alert('Sin suscriptores', 'Esta tienda no tiene suscriptores aún');
      return;
    }

    Alert.alert(
      'Confirmar Envío',
      `¿Enviar notificación a ${subscriberCount} suscriptores?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          style: 'default',
          onPress: async () => {
            setIsSending(true);

            const params: SendNotificationParams = {
              storeId,
              storeName,
              title: title.trim(),
              body: body.trim(),
              data: productId.trim()
                ? {
                    productId: productId.trim(),
                    storeId,
                    type: 'product' as const,
                  }
                : undefined,
            };

            const result = await sendNotificationToStoreSubscribers(params);

            setIsSending(false);

            if (result.success) {
              Alert.alert(
                '✅ Enviado',
                `Notificación enviada a ${result.sentCount} usuarios`
              );
              setTitle('');
              setBody('');
              setProductId('');
              loadHistory(); // Recargar historial
            } else {
              Alert.alert('Error', result.error || 'No se pudo enviar la notificación');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `Hace ${minutes}m`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days}d`;
    return date.toLocaleDateString('es-CL');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 h-14 bg-white border-b border-gray-100">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={onBack} className="p-1 rounded-full bg-gray-50">
            <ChevronLeft size={24} color="#4B5563" />
          </TouchableOpacity>
          <View>
            <Text className="font-bold text-lg text-gray-900" numberOfLines={1}>
              Notificaciones
            </Text>
            <Text className="text-xs text-gray-500">{storeName}</Text>
          </View>
        </View>
        <View className="bg-purple-100 px-3 py-1.5 rounded-full flex-row items-center gap-1">
          <Users size={14} color="#9333EA" />
          <Text className="text-purple-600 text-xs font-bold">{subscriberCount}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Send Notification Card */}
        <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Bell size={20} color="#9333EA" />
            <Text className="font-bold text-lg text-gray-900">Enviar Notificación</Text>
          </View>

          <View className="gap-4">
            <View>
              <Text className="text-xs font-medium text-gray-500 mb-1.5">Título</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Ej: ¡Nueva colección disponible!"
                className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-900"
                maxLength={50}
              />
              <Text className="text-xs text-gray-400 mt-1">{title.length}/50</Text>
            </View>

            <View>
              <Text className="text-xs font-medium text-gray-500 mb-1.5">Mensaje</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Ej: Descubre nuestros nuevos productos con 20% de descuento"
                className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-900"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={150}
              />
              <Text className="text-xs text-gray-400 mt-1">{body.length}/150</Text>
            </View>

            <View>
              <Text className="text-xs font-medium text-gray-500 mb-1.5">
                ID del Producto (opcional)
              </Text>
              <TextInput
                value={productId}
                onChangeText={setProductId}
                placeholder="Ej: gid://shopify/Product/123456"
                className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-900"
              />
              <Text className="text-xs text-gray-400 mt-1">
                Dejalo vacío si no quieres link a producto
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleSend}
              disabled={isSending || !title.trim() || !body.trim()}
              className={`py-4 rounded-xl flex-row items-center justify-center gap-2 ${
                isSending || !title.trim() || !body.trim()
                  ? 'bg-gray-300'
                  : 'bg-purple-600'
              }`}
            >
              {isSending ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Send size={20} color="white" />
                  <Text className="text-white font-bold text-base">
                    Enviar a {subscriberCount} suscriptores
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* History */}
        <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <View className="flex-row items-center gap-2 mb-4">
            <Clock size={20} color="#9333EA" />
            <Text className="font-bold text-lg text-gray-900">Historial</Text>
          </View>

          {isLoadingHistory ? (
            <View className="py-8 items-center">
              <ActivityIndicator color="#9333EA" />
            </View>
          ) : history.length === 0 ? (
            <View className="py-8 items-center">
              <Text className="text-gray-400 text-sm">No hay notificaciones enviadas</Text>
            </View>
          ) : (
            <View className="gap-3">
              {history.map((item) => (
                <View
                  key={item.id}
                  className="border border-gray-100 rounded-xl p-4 bg-gray-50"
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <Text className="font-bold text-gray-900 flex-1" numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text className="text-xs text-gray-500 ml-2">
                      {formatDate(item.created_at)}
                    </Text>
                  </View>

                  <Text className="text-sm text-gray-600 mb-3" numberOfLines={2}>
                    {item.body}
                  </Text>

                  <View className="flex-row gap-4">
                    <View className="flex-row items-center gap-1">
                      <Users size={14} color="#6B7280" />
                      <Text className="text-xs text-gray-500">{item.total_sent} enviados</Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <CheckCircle size={14} color="#10B981" />
                      <Text className="text-xs text-gray-500">
                        {item.total_opened} abiertos
                      </Text>
                    </View>
                  </View>

                  {item.total_sent > 0 && (
                    <View className="mt-2 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <View
                        className="bg-purple-600 h-full rounded-full"
                        style={{
                          width: `${(item.total_opened / item.total_sent) * 100}%`,
                        }}
                      />
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
