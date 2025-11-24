/**
 * Sign Up Screen
 *
 * Pantalla de registro con:
 * - Nombre completo, email, teléfono, contraseña
 * - Google Sign In
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
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { ViewState } from '../types';
import { signInWithGoogle } from '../services/authService';
import Svg, { Path } from 'react-native-svg';

// Google Logo Component
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

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
  // GOOGLE SIGN IN
  // =====================================================

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();

      if (!result.success) {
        Alert.alert('Error', result.error || 'No se pudo registrar con Google');
      } else {
        // Registro exitoso → el AuthContext detectará el cambio de sesión automáticamente
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
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow px-6 py-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER */}
          <View className="mb-6">
            <TouchableOpacity
              onPress={() => onNavigate(ViewState.WELCOME)}
              className="mb-4"
              disabled={isLoading}
            >
              <Text className="text-indigo-600 text-base font-medium">← Volver</Text>
            </TouchableOpacity>

            <Text className="text-3xl font-bold text-gray-900 mb-2">
              Crear cuenta
            </Text>
            <Text className="text-base text-gray-600">
              Regístrate para comenzar
            </Text>
          </View>

          {/* GOOGLE SIGN IN BUTTON */}
          <TouchableOpacity
            onPress={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
            className="flex-row items-center justify-center bg-white border border-gray-300 py-4 rounded-2xl mb-5"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            {isGoogleLoading ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <>
                <View className="mr-3">
                  <GoogleLogo size={22} />
                </View>
                <Text className="font-semibold text-gray-700 text-base">
                  Registrarse con Google
                </Text>
              </>
            )}
          </TouchableOpacity>

        {/* DIVIDER */}
        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-gray-300" />
          <Text className="mx-4 text-gray-500 text-sm">o regístrate con email</Text>
          <View className="flex-1 h-px bg-gray-300" />
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
            <Text className="text-xs text-gray-500 text-center leading-5">
              Al registrarte, aceptas nuestros{' '}
              <Text className="text-indigo-600 font-medium">Términos y Condiciones</Text> y{' '}
              <Text className="text-indigo-600 font-medium">Política de Privacidad</Text>
            </Text>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            onPress={handleSignUp}
            disabled={isLoading}
            className={`w-full py-4 rounded-2xl mt-4 ${
              isLoading ? 'bg-gray-400' : 'bg-indigo-600'
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
        <View className="flex-row justify-center items-center mt-6 mb-4">
          <Text className="text-gray-600 text-base">¿Ya tienes cuenta? </Text>
          <TouchableOpacity
            onPress={() => onNavigate(ViewState.LOGIN)}
            disabled={isLoading}
          >
            <Text className="text-indigo-600 text-base font-semibold">
              Inicia sesión
            </Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
