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
  Image,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { ViewState } from '../types';
import { signInWithGoogle } from '../services/authService';

interface LoginScreenProps {
  onNavigate: (state: ViewState) => void;
}

export default function LoginScreen({ onNavigate }: LoginScreenProps) {
  const { signIn, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

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
  // GOOGLE SIGN IN
  // =====================================================

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();

      if (!result.success) {
        Alert.alert('Error', result.error || 'No se pudo iniciar sesión con Google');
      } else {
        // Login exitoso → el AuthContext detectará el cambio de sesión automáticamente
        console.log('✅ Google Sign In exitoso');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error inesperado con Google Sign In');
    } finally {
      setIsGoogleLoading(false);
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

        {/* GOOGLE SIGN IN BUTTON */}
        <TouchableOpacity
          onPress={handleGoogleSignIn}
          disabled={isLoading || isGoogleLoading}
          className="flex-row items-center justify-center bg-white border border-gray-300 py-3 rounded-xl mb-6 shadow-sm"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
          }}
        >
          {isGoogleLoading ? (
            <ActivityIndicator size="small" color="#4285F4" />
          ) : (
            <>
              <View className="w-5 h-5 mr-3">
                <Text style={{ fontSize: 20 }}>G</Text>
              </View>
              <Text className="font-semibold text-gray-700 text-base">
                Continuar con Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* DIVIDER */}
        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-gray-300" />
          <Text className="mx-4 text-gray-500 text-sm">o continúa con email</Text>
          <View className="flex-1 h-px bg-gray-300" />
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
