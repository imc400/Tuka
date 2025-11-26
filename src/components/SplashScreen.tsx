/**
 * Splash Screen
 *
 * Pantalla de carga mientras se inicializa la app
 * y se verifica el estado de autenticación
 */

import React from 'react';
import { View, Text, ActivityIndicator, SafeAreaView, StatusBar, Image } from 'react-native';

export function SplashScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View className="flex-1 justify-center items-center">
        {/* Isotipo Grumo */}
        <Image
          source={require('../../assets/grumo-isotipo-trimmed.png')}
          style={{ width: 80, height: 80, marginBottom: 16 }}
          resizeMode="contain"
        />

        {/* Logo Grumo Negro */}
        <Image
          source={require('../../assets/grumo-logo-negro-trimmed.png')}
          style={{ width: 150, height: 40, marginBottom: 24 }}
          resizeMode="contain"
        />

        <Text className="text-base text-gray-400 mb-10">
          Cargando...
        </Text>

        <ActivityIndicator size="large" color="#9333EA" />
      </View>

      {/* Footer */}
      <View className="pb-8">
        <Text className="text-gray-300 text-xs text-center">
          Versión 1.0.0
        </Text>
      </View>
    </SafeAreaView>
  );
}
