/**
 * ShippingSection Component
 * Sección completa de cálculo y selección de envíos para checkout
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Alert } from 'react-native';
import type { CartItem } from '../types';
import {
  calculateShippingRates,
  groupCartItemsByStore,
  calculateTotalShipping,
  formatAddressForShopify,
  type ShippingRatesByStore,
  type SelectedShippingRates,
} from '../services/shippingService';
import { ShippingMethodSelector } from './ShippingMethodSelector';

interface Props {
  cartItems: CartItem[];
  shippingAddress: {
    address: string;
    city: string;
    region: string;
    zipCode: string;
  };
  onShippingCalculated?: (selectedRates: SelectedShippingRates, total: number) => void;
  autoCalculate?: boolean; // Si true, calcula automáticamente cuando hay dirección completa
}

export function ShippingSection({
  cartItems,
  shippingAddress,
  onShippingCalculated,
  autoCalculate = true,
}: Props) {
  const [shippingRates, setShippingRates] = useState<ShippingRatesByStore>({});
  const [selectedRates, setSelectedRates] = useState<SelectedShippingRates>({});
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Agrupar items por tienda
  const storeGroups = groupCartItemsByStore(cartItems);

  // Verificar si la dirección está completa
  const isAddressComplete = () => {
    return (
      shippingAddress.address?.trim().length > 0 &&
      shippingAddress.city?.trim().length > 0 &&
      shippingAddress.region?.trim().length > 0 &&
      shippingAddress.zipCode?.trim().length > 0
    );
  };

  // Auto-calcular cuando la dirección está completa
  useEffect(() => {
    if (autoCalculate && isAddressComplete() && cartItems.length > 0) {
      handleCalculateShipping();
    }
  }, [
    shippingAddress.address,
    shippingAddress.city,
    shippingAddress.region,
    shippingAddress.zipCode,
    cartItems.length,
  ]);

  // Notificar cambios en shipping seleccionado
  useEffect(() => {
    const total = calculateTotalShipping(selectedRates);
    onShippingCalculated?.(selectedRates, total);
  }, [selectedRates]);

  const handleCalculateShipping = async () => {
    if (!isAddressComplete()) {
      Alert.alert(
        'Dirección incompleta',
        'Por favor completa la dirección de envío antes de calcular los costos'
      );
      return;
    }

    setCalculating(true);
    setError(null);

    try {
      const formattedAddress = formatAddressForShopify(shippingAddress);
      console.log('[ShippingSection] Calculating shipping with address:', formattedAddress);
      console.log('[ShippingSection] Cart items:', cartItems.length);

      const result = await calculateShippingRates(cartItems, formattedAddress);

      console.log('[ShippingSection] Shipping calculation result:', JSON.stringify(result, null, 2));

      if (result.success && result.shippingRates) {
        setShippingRates(result.shippingRates);

        // Auto-seleccionar la opción más barata por cada tienda
        const autoSelected: SelectedShippingRates = {};
        Object.entries(result.shippingRates).forEach(([domain, rates]) => {
          if (rates.length > 0) {
            // Encontrar el método más barato
            const cheapest = rates.reduce((min, rate) =>
              rate.price < min.price ? rate : min
            );
            autoSelected[domain] = {
              rate_id: cheapest.id,
              title: cheapest.title,
              price: cheapest.price,
              code: cheapest.code,
            };
          }
        });
        setSelectedRates(autoSelected);

        // Mostrar errores si hubo para alguna tienda
        if (result.errors && Object.keys(result.errors).length > 0) {
          console.warn('Errores calculando shipping:', result.errors);
        }
      } else {
        setError(result.error || 'Error calculando envíos');
        Alert.alert(
          'Error al calcular envíos',
          result.error || 'No se pudieron calcular los costos de envío. Por favor intenta de nuevo.'
        );
      }
    } catch (err: any) {
      console.error('Error calculating shipping:', err);
      setError(err.message || 'Error desconocido');
      Alert.alert(
        'Error',
        'Ocurrió un error al calcular los envíos. Por favor verifica tu conexión.'
      );
    } finally {
      setCalculating(false);
    }
  };

  // Si no hay dirección completa, mostrar mensaje
  if (!isAddressComplete()) {
    return (
      <View className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <Text className="text-sm text-blue-700">
          💡 Completa tu dirección de envío para ver las opciones de envío disponibles
        </Text>
      </View>
    );
  }

  // Si está calculando, mostrar todos los stores en loading
  if (calculating) {
    return (
      <View className="mt-4">
        <Text className="text-lg font-bold mb-3">Métodos de Envío</Text>
        {Object.entries(storeGroups).map(([domain, group]) => (
          <ShippingMethodSelector
            key={domain}
            storeDomain={domain}
            storeName={group.storeName}
            rates={[]}
            loading={true}
          />
        ))}
      </View>
    );
  }

  // Si hubo error y no hay rates
  if (error && Object.keys(shippingRates).length === 0) {
    return (
      <View className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
        <Text className="text-sm font-semibold text-red-700 mb-1">
          Error al calcular envíos
        </Text>
        <Text className="text-sm text-red-600">{error}</Text>
      </View>
    );
  }

  // Mostrar selectores por tienda
  return (
    <View className="mt-4">
      <Text className="text-lg font-bold mb-3">Métodos de Envío</Text>

      {Object.entries(storeGroups).map(([domain, group]) => {
        const rates = shippingRates[domain] || [];
        const selectedRate = selectedRates[domain];

        return (
          <ShippingMethodSelector
            key={domain}
            storeDomain={domain}
            storeName={group.storeName}
            rates={rates}
            selectedRate={selectedRate}
            onSelect={(rate) => {
              setSelectedRates((prev) => ({
                ...prev,
                [domain]: rate,
              }));
            }}
          />
        );
      })}

      {/* Total de envíos */}
      {Object.keys(selectedRates).length > 0 && (
        <View className="mt-2 p-3 bg-gray-50 rounded-lg">
          <View className="flex-row justify-between items-center">
            <Text className="text-base font-medium text-gray-700">
              Total Envíos:
            </Text>
            <Text className="text-lg font-bold text-gray-900">
              ${calculateTotalShipping(selectedRates).toLocaleString('es-CL')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
