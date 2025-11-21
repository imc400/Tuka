/**
 * Sign Up Screen
 *
 * Pantalla de registro con:
 * - Nombre completo, email, teléfono, contraseña
 * - Validación completa de formularios
 * - Creación de perfil automática
 * - Manejo de errores
 *
 * @module SignUpScreen
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

interface SignUpScreenProps {
  onNavigate: (state: ViewState) => void;
}

export default function SignUpScreen({ onNavigate }: SignUpScreenProps) {
  const { signUp, isLoading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  // =====================================================
  // VALIDATION
  // =====================================================

  function validateForm(): boolean {
    const newErrors: typeof errors = {};

    // Full Name validation
    if (!fullName.trim()) {
      newErrors.fullName = 'El nombre es requerido';
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = 'El nombre debe tener al menos 2 caracteres';
    }

    // Email validation
    if (!email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Email inválido';
    }

    // Phone validation (opcional pero si se proporciona, validar)
    if (phone.trim() && !/^\+?[0-9]{8,15}$/.test(phone.trim())) {
      newErrors.phone = 'Teléfono inválido (8-15 dígitos)';
    }

    // Password validation
    if (!password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    // Confirm Password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirma tu contraseña';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // =====================================================
  // SUBMIT
  // =====================================================

  async function handleSignUp() {
    // Limpiar errores previos
    setErrors({});

    // Validar formulario
    if (!validateForm()) {
      return;
    }

    // Intentar registro
    const result = await signUp({
      email: email.trim().toLowerCase(),
      password,
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
    });

    if (!result.success) {
      Alert.alert('Error', result.error || 'No se pudo completar el registro');
    } else {
      // Registro exitoso
      Alert.alert(
        '¡Registro exitoso!',
        'Tu cuenta ha sido creada correctamente',
        [
          {
            text: 'Continuar',
            onPress: () => onNavigate(ViewState.HOME),
          },
        ]
      );
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
        contentContainerClassName="flex-grow justify-center px-6 py-10"
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <View className="mb-8">
          <TouchableOpacity
            onPress={() => onNavigate(ViewState.LOGIN)}
            className="mb-4"
            disabled={isLoading}
          >
            <Text className="text-blue-600 text-base">← Volver</Text>
          </TouchableOpacity>

          <Text className="text-4xl font-bold text-gray-900 mb-2">
            Crear cuenta
          </Text>
          <Text className="text-lg text-gray-600">
            Completa tus datos para registrarte
          </Text>
        </View>

        {/* FORM */}
        <View className="space-y-4">
          {/* Full Name Input */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Nombre completo *
            </Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Juan Pérez"
              autoCapitalize="words"
              autoComplete="name"
              className={`w-full px-4 py-3 border rounded-xl ${
                errors.fullName ? 'border-red-500' : 'border-gray-300'
              } bg-gray-50`}
              editable={!isLoading}
            />
            {errors.fullName && (
              <Text className="text-red-500 text-xs mt-1">
                {errors.fullName}
              </Text>
            )}
          </View>

          {/* Email Input */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Email *
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

          {/* Phone Input (Opcional) */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Teléfono <Text className="text-gray-400">(opcional)</Text>
            </Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+56912345678"
              keyboardType="phone-pad"
              autoComplete="tel"
              className={`w-full px-4 py-3 border rounded-xl ${
                errors.phone ? 'border-red-500' : 'border-gray-300'
              } bg-gray-50`}
              editable={!isLoading}
            />
            {errors.phone && (
              <Text className="text-red-500 text-xs mt-1">{errors.phone}</Text>
            )}
          </View>

          {/* Password Input */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Contraseña *
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
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

          {/* Confirm Password Input */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Confirmar contraseña *
            </Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repite tu contraseña"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              className={`w-full px-4 py-3 border rounded-xl ${
                errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
              } bg-gray-50`}
              editable={!isLoading}
            />
            {errors.confirmPassword && (
              <Text className="text-red-500 text-xs mt-1">
                {errors.confirmPassword}
              </Text>
            )}
          </View>

          {/* Terms & Conditions */}
          <View className="mt-4">
            <Text className="text-xs text-gray-500 text-center">
              Al registrarte, aceptas nuestros{' '}
              <Text className="text-blue-600">Términos y Condiciones</Text> y{' '}
              <Text className="text-blue-600">Política de Privacidad</Text>
            </Text>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            onPress={handleSignUp}
            disabled={isLoading}
            className={`w-full py-4 rounded-xl mt-6 ${
              isLoading ? 'bg-gray-400' : 'bg-blue-600'
            }`}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center text-lg font-semibold">
                Crear Cuenta
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* LOGIN LINK */}
        <View className="flex-row justify-center items-center mt-8">
          <Text className="text-gray-600 text-base">¿Ya tienes cuenta? </Text>
          <TouchableOpacity
            onPress={() => onNavigate(ViewState.LOGIN)}
            disabled={isLoading}
          >
            <Text className="text-blue-600 text-base font-semibold">
              Inicia sesión
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
