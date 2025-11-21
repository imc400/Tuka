/**
 * Login Screen
 *
 * Pantalla de inicio de sesión con:
 * - Email y contraseña
 * - Validación de formularios
 * - Manejo de errores
 * - Link a registro y recuperación de contraseña
 *
 * @module LoginScreen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { ViewState } from '../types';

interface LoginScreenProps {
  onNavigate: (state: ViewState) => void;
}

export default function LoginScreen({ onNavigate }: LoginScreenProps) {
  const { signIn, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // =====================================================
  // VALIDATION
  // =====================================================

  function validateForm(): boolean {
    const newErrors: { email?: string; password?: string } = {};

    // Email validation
    if (!email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Email inválido';
    }

    // Password validation
    if (!password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // =====================================================
  // SUBMIT
  // =====================================================

  async function handleLogin() {
    // Limpiar errores previos
    setErrors({});

    // Validar formulario
    if (!validateForm()) {
      return;
    }

    // Intentar login
    const result = await signIn({
      email: email.trim().toLowerCase(),
      password,
    });

    if (!result.success) {
      Alert.alert('Error', result.error || 'No se pudo iniciar sesión');
    } else {
      // Login exitoso → el AuthContext maneja la navegación via state change
      console.log('✅ Login exitoso, navegando al HOME');
      onNavigate(ViewState.HOME);
    }
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <View className="mb-10">
          <Text className="text-4xl font-bold text-gray-900 mb-2">
            Bienvenido
          </Text>
          <Text className="text-lg text-gray-600">
            Inicia sesión para continuar
          </Text>
        </View>

        {/* FORM */}
        <View className="space-y-4">
          {/* Email Input */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              className={`w-full px-4 py-3 border rounded-xl ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              } bg-gray-50`}
              editable={!isLoading}
            />
            {errors.email && (
              <Text className="text-red-500 text-xs mt-1">{errors.email}</Text>
            )}
          </View>

          {/* Password Input */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              className={`w-full px-4 py-3 border rounded-xl ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              } bg-gray-50`}
              editable={!isLoading}
            />
            {errors.password && (
              <Text className="text-red-500 text-xs mt-1">
                {errors.password}
              </Text>
            )}
          </View>

          {/* Forgot Password Link */}
          <TouchableOpacity
            onPress={() => {
              // TODO: Implementar pantalla de recuperación de contraseña
              Alert.alert(
                'Recuperar contraseña',
                'Esta funcionalidad se implementará próximamente'
              );
            }}
            disabled={isLoading}
            className="self-end"
          >
            <Text className="text-blue-600 text-sm font-medium">
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoading}
            className={`w-full py-4 rounded-xl mt-6 ${
              isLoading ? 'bg-gray-400' : 'bg-blue-600'
            }`}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center text-lg font-semibold">
                Iniciar Sesión
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* SIGN UP LINK */}
        <View className="flex-row justify-center items-center mt-8">
          <Text className="text-gray-600 text-base">
            ¿No tienes cuenta?{' '}
          </Text>
          <TouchableOpacity
            onPress={() => onNavigate(ViewState.SIGNUP)}
            disabled={isLoading}
          >
            <Text className="text-blue-600 text-base font-semibold">
              Regístrate
            </Text>
          </TouchableOpacity>
        </View>

        {/* GUEST MODE (Opcional - permite navegar sin cuenta) */}
        <TouchableOpacity
          onPress={() => onNavigate(ViewState.HOME)}
          disabled={isLoading}
          className="mt-6"
        >
          <Text className="text-gray-500 text-center text-sm">
            Continuar sin cuenta
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
