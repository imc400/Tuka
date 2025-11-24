/**
 * Welcome Screen
 *
 * Pantalla de bienvenida para nuevos usuarios
 * Primera pantalla que ven usuarios no autenticados
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { ShoppingBag, Store, Heart, Zap, Package, CreditCard } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface WelcomeScreenProps {
  onLogin: () => void;
  onSignUp: () => void;
  onBrowse?: () => void; // Opcional: explorar sin cuenta
}

export default function WelcomeScreen({ onLogin, onSignUp, onBrowse }: WelcomeScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="light-content" />

      {/* Gradient Background */}
      <LinearGradient
        colors={['#4F46E5', '#7C3AED']}
        className="absolute inset-0"
      />

      <View className="flex-1 justify-between p-6">

        {/* Header con Logo */}
        <View className="items-center mt-12">
          <View className="bg-white/20 p-6 rounded-3xl mb-6 backdrop-blur-xl">
            <ShoppingBag size={72} color="white" strokeWidth={2} />
          </View>

          <Text className="text-5xl font-bold text-white text-center mb-3">
            ShopUnite
          </Text>

          <Text className="text-xl text-white/90 text-center px-4 leading-7">
            Todas tus tiendas favoritas{'\n'}en un solo lugar
          </Text>
        </View>

        {/* Features Cards */}
        <View className="space-y-4 my-8">
          <FeatureCard
            icon={<Store size={28} color="#4F46E5" />}
            title="Un solo carrito"
            description="Compra en múltiples tiendas sin complicaciones"
          />
          <FeatureCard
            icon={<CreditCard size={28} color="#4F46E5" />}
            title="Pago único"
            description="Una sola transacción para todas tus compras"
          />
          <FeatureCard
            icon={<Package size={28} color="#4F46E5" />}
            title="Seguimiento real"
            description="Rastrea todos tus pedidos en tiempo real"
          />
        </View>

        {/* Action Buttons */}
        <View className="space-y-3 mb-6">
          <TouchableOpacity
            onPress={onSignUp}
            className="bg-white py-4 rounded-2xl shadow-lg active:scale-95"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Text className="text-indigo-600 font-bold text-center text-lg">
              Crear cuenta gratis
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onLogin}
            className="bg-white/20 backdrop-blur py-4 rounded-2xl border-2 border-white/50 active:scale-95"
          >
            <Text className="text-white font-bold text-center text-lg">
              Ya tengo cuenta
            </Text>
          </TouchableOpacity>

          {onBrowse && (
            <TouchableOpacity
              onPress={onBrowse}
              className="py-3 active:opacity-70"
            >
              <Text className="text-white/80 text-center font-medium">
                Explorar sin cuenta →
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Footer */}
        <View className="items-center pb-4">
          <View className="flex-row items-center space-x-2 mb-3">
            <View className="w-2 h-2 bg-white/60 rounded-full" />
            <View className="w-2 h-2 bg-white rounded-full" />
            <View className="w-2 h-2 bg-white/60 rounded-full" />
          </View>
          <Text className="text-white/70 text-xs text-center px-8">
            Al continuar, aceptas nuestros{' '}
            <Text className="font-semibold">Términos de Servicio</Text>
            {' '}y{' '}
            <Text className="font-semibold">Política de Privacidad</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// Feature Card Component
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <View className="bg-white/95 backdrop-blur-xl p-5 rounded-2xl flex-row items-center space-x-4 shadow-lg">
      <View className="bg-indigo-50 p-3 rounded-xl">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-gray-900 font-bold text-base mb-1">
          {title}
        </Text>
        <Text className="text-gray-600 text-sm leading-5">
          {description}
        </Text>
      </View>
    </View>
  );
}
