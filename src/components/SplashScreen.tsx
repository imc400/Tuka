/**
 * Splash Screen
 *
 * Pantalla de carga mientras se inicializa la app
 * y se verifica el estado de autenticación
 */

import React from 'react';
import { View, Text, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native';
import { ShoppingBag } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function SplashScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="light-content" />

      {/* Gradient Background */}
      <LinearGradient
        colors={['#4F46E5', '#7C3AED']}
        className="absolute inset-0"
      />

      <View className="flex-1 justify-center items-center">
        {/* Logo animado */}
        <View className="bg-white/20 p-8 rounded-3xl mb-8">
          <ShoppingBag size={80} color="white" strokeWidth={2} />
        </View>

        <Text className="text-5xl font-bold text-white mb-3">
          ShopUnite
        </Text>

        <Text className="text-lg text-white/80 mb-12">
          Cargando...
        </Text>

        <ActivityIndicator size="large" color="white" />
      </View>

      {/* Footer */}
      <View className="pb-8">
        <Text className="text-white/60 text-xs text-center">
          Versión 1.0.0
        </Text>
      </View>
    </SafeAreaView>
  );
}
