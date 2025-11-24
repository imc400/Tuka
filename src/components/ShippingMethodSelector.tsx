/**
 * ShippingMethodSelector Component
 * Muestra y permite seleccionar métodos de envío por tienda
 */

import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import type { ShippingRate, SelectedShippingRate } from '../services/shippingService';

interface Props {
  storeDomain: string;
  storeName: string;
  rates: ShippingRate[];
  selectedRate?: SelectedShippingRate;
  onSelect: (rate: SelectedShippingRate) => void;
  loading?: boolean;
}

export function ShippingMethodSelector({
  storeDomain,
  storeName,
  rates,
  selectedRate,
  onSelect,
  loading = false,
}: Props) {
  if (loading) {
    return (
      <View className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
        <Text className="font-semibold text-base mb-3">
          Envío para {storeName}
        </Text>
        <View className="flex-row items-center justify-center py-4">
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text className="ml-2 text-gray-500">Calculando opciones...</Text>
        </View>
      </View>
    );
  }

  if (!rates || rates.length === 0) {
    return (
      <View className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <Text className="font-semibold text-base mb-2">
          Envío para {storeName}
        </Text>
        <Text className="text-sm text-yellow-700">
          No hay métodos de envío configurados para esta tienda
        </Text>
      </View>
    );
  }

  return (
    <View className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
      <Text className="font-semibold text-base mb-3">
        Envío para {storeName}
      </Text>

      {rates.map((rate) => {
        const isSelected = selectedRate?.rate_id === rate.id;

        return (
          <Pressable
            key={rate.id}
            onPress={() =>
              onSelect({
                rate_id: rate.id,
                title: rate.title,
                price: rate.price,
                code: rate.code,
              })
            }
            className={`flex-row items-center py-3 px-2 rounded-lg mb-2 ${
              isSelected ? 'bg-blue-50 border border-blue-300' : 'bg-gray-50'
            }`}
          >
            {/* Radio button */}
            <View
              className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                isSelected ? 'border-blue-500' : 'border-gray-400'
              }`}
            >
              {isSelected && (
                <View className="w-3 h-3 rounded-full bg-blue-500" />
              )}
            </View>

            {/* Title */}
            <Text
              className={`flex-1 ${
                isSelected ? 'font-semibold text-blue-900' : 'text-gray-700'
              }`}
            >
              {rate.title}
            </Text>

            {/* Price */}
            <Text
              className={`font-bold ${
                isSelected ? 'text-blue-600' : 'text-gray-900'
              }`}
            >
              {rate.price === 0
                ? 'Gratis'
                : `$${rate.price.toLocaleString('es-CL')}`}
            </Text>
          </Pressable>
        );
      })}

      {/* Source indicator (opcional, para debugging) */}
      {rates.length > 0 && rates[0].source && (
        <Text className="text-xs text-gray-400 mt-2">
          Tarifas desde: {rates[0].source === 'shopify' ? 'Shopify' : 'App de terceros'}
        </Text>
      )}
    </View>
  );
}
