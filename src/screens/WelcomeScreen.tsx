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
  StatusBar,
  ScrollView,
} from 'react-native';
import { Store, CreditCard, Tag } from 'lucide-react-native';

interface WelcomeScreenProps {
  onLogin: () => void;
  onSignUp: () => void;
  onBrowse?: () => void; // Opcional: explorar sin cuenta
}

export default function WelcomeScreen({ onLogin, onSignUp, onBrowse }: WelcomeScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header con Logo */}
        <View className="items-center mt-6 mb-6">
          {/* Isotipo Grumo */}
          <Image
            source={require('../../assets/grumo-isotipo-trimmed.png')}
            style={{ width: 70, height: 70, marginBottom: 12 }}
            resizeMode="contain"
          />

          {/* Logo Grumo Negro */}
          <Image
            source={require('../../assets/grumo-logo-negro-trimmed.png')}
            style={{ width: 180, height: 48, marginBottom: 12 }}
            resizeMode="contain"
          />

          <Text className="text-base text-gray-600 text-center px-4 leading-5">
            Todas tus tiendas favoritas{'\n'}en un solo lugar
          </Text>
        </View>

        {/* Features Cards - Flotando con sombra */}
        <View className="gap-2 mb-5">
          <FeatureCard
            icon={<Store size={22} color="#9333EA" />}
            title="Un solo carrito"
            description="Compra en múltiples tiendas sin complicaciones"
          />
          <FeatureCard
            icon={<CreditCard size={22} color="#9333EA" />}
            title="Pago único"
            description="Una sola transacción para todas tus compras"
          />
          <FeatureCard
            icon={<Tag size={22} color="#9333EA" />}
            title="Ofertas especiales"
            description="Suscríbete a tus tiendas favoritas y obtén increíbles sorpresas"
          />
        </View>

        {/* Action Buttons */}
        <View className="gap-3 mb-4">
          <TouchableOpacity
            onPress={onSignUp}
            className="bg-purple-600 py-4 rounded-2xl active:scale-95"
            style={{
              shadowColor: '#9333EA',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Text className="text-white font-bold text-center text-lg">
              Crear cuenta gratis
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onLogin}
            className="bg-white py-4 rounded-2xl border-2 border-gray-200 active:scale-95"
          >
            <Text className="text-gray-700 font-bold text-center text-lg">
              Ya tengo cuenta
            </Text>
          </TouchableOpacity>

          {onBrowse && (
            <TouchableOpacity
              onPress={onBrowse}
              className="py-3 active:opacity-70"
            >
              <Text className="text-gray-500 text-center font-medium">
                Explorar sin cuenta →
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Footer */}
        <View className="items-center pb-2 mt-auto">
          <Text className="text-gray-400 text-xs text-center px-8">
            Al continuar, aceptas nuestros{' '}
            <Text className="font-semibold text-gray-500">Términos de Servicio</Text>
            {' '}y{' '}
            <Text className="font-semibold text-gray-500">Política de Privacidad</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Feature Card Component - Flotando con sombra
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
    <View
      className="bg-white p-3 rounded-xl flex-row items-center gap-2.5"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <View className="bg-purple-50 p-2 rounded-lg">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-gray-900 font-bold text-sm mb-0.5">
          {title}
        </Text>
        <Text className="text-gray-500 text-xs leading-4">
          {description}
        </Text>
      </View>
    </View>
  );
}
