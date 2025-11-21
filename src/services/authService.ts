/**
 * Authentication Service
 *
 * Maneja toda la lógica de autenticación con Supabase:
 * - Sign Up / Sign In / Sign Out
 * - Gestión de sesiones
 * - Creación automática de user_profile
 * - Manejo de errores centralizado
 *
 * @module authService
 */

import { supabase } from '../lib/supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';

// =====================================================
// TYPES
// =====================================================

export interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  email: string;
  total_orders: number;
  total_spent: number;
  created_at: string;
  last_active_at: string;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  profile?: UserProfile;
  session?: Session;
  error?: string;
}

// =====================================================
// SIGN UP
// =====================================================

/**
 * Registrar nuevo usuario
 *
 * 1. Crea usuario en auth.users (Supabase Auth)
 * 2. Crea perfil en user_profiles (nuestra tabla)
 * 3. Retorna usuario + perfil
 *
 * @param data - Datos de registro
 * @returns AuthResponse con usuario y perfil
 */
export async function signUp(data: SignUpData): Promise<AuthResponse> {
  try {
    console.log('📝 [AuthService] Iniciando registro:', data.email);

    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
        },
      },
    });

    if (authError) {
      console.error('❌ [AuthService] Error en auth.signUp:', authError);
      return {
        success: false,
        error: getErrorMessage(authError),
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'No se pudo crear el usuario',
      };
    }

    console.log('✅ [AuthService] Usuario creado en auth.users:', authData.user.id);

    // 2. IMPORTANTE: Verificar si signUp retornó una sesión
    console.log('🔍 [AuthService] Verificando sesión de signUp...');
    console.log('📦 [AuthService] authData.session presente:', !!authData.session);

    // Si signUp() NO retornó sesión, intentar establecerla manualmente
    if (!authData.session) {
      console.log('⚠️  [AuthService] signUp no retornó sesión. Intentando signIn...');

      // Hacer signIn explícito para establecer sesión
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (signInError || !signInData.session) {
        console.error('❌ [AuthService] Error estableciendo sesión:', signInError);
        return {
          success: false,
          error: 'Usuario creado pero no se pudo establecer sesión',
        };
      }

      console.log('✅ [AuthService] Sesión establecida via signIn');
      console.log('🔑 [AuthService] Token JWT presente:', !!signInData.session.access_token);
    } else {
      console.log('✅ [AuthService] Sesión ya presente de signUp');
      console.log('🔑 [AuthService] Token JWT presente:', !!authData.session.access_token);
    }

    // 3. Ahora sí, crear perfil en user_profiles con sesión activa
    console.log('📝 [AuthService] Creando perfil en user_profiles...');
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        full_name: data.fullName,
        phone: data.phone || null,
        // email NO se guarda en user_profiles, está en auth.users
      })
      .select()
      .single();

    if (profileError) {
      console.error('❌ [AuthService] Error creando perfil:', profileError);
      return {
        success: false,
        error: `Usuario creado pero falló crear perfil: ${profileError.message}`,
      };
    }

    console.log('✅ [AuthService] Perfil creado exitosamente:', profileData.id);

    // 3. Construir perfil completo
    const profile: UserProfile = {
      ...profileData,
      email: authData.user.email || data.email,
    };

    return {
      success: true,
      user: authData.user,
      profile,
      session: authData.session || undefined,
    };
  } catch (error: any) {
    console.error('❌ [AuthService] Error inesperado en signUp:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al registrar',
    };
  }
}

// =====================================================
// SIGN IN
// =====================================================

/**
 * Iniciar sesión
 *
 * 1. Autentica con Supabase Auth
 * 2. Obtiene perfil del usuario
 * 3. Actualiza last_active_at
 *
 * @param data - Credenciales de login
 * @returns AuthResponse con usuario y perfil
 */
export async function signIn(data: SignInData): Promise<AuthResponse> {
  try {
    console.log('🔐 [AuthService] Iniciando login:', data.email);

    // 1. Autenticar con Supabase
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

    if (authError) {
      console.error('❌ [AuthService] Error en signIn:', authError);
      return {
        success: false,
        error: getErrorMessage(authError),
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'No se pudo iniciar sesión',
      };
    }

    console.log('✅ [AuthService] Login exitoso:', authData.user.id);

    // 2. Obtener perfil del usuario
    const profile = await getUserProfile(authData.user.id);

    // 3. Actualizar last_active_at
    await updateLastActive(authData.user.id);

    return {
      success: true,
      user: authData.user,
      profile,
      session: authData.session,
    };
  } catch (error: any) {
    console.error('❌ [AuthService] Error inesperado en signIn:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al iniciar sesión',
    };
  }
}

// =====================================================
// SIGN OUT
// =====================================================

/**
 * Cerrar sesión
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🚪 [AuthService] Cerrando sesión');

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('❌ [AuthService] Error en signOut:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log('✅ [AuthService] Sesión cerrada');

    return { success: true };
  } catch (error: any) {
    console.error('❌ [AuthService] Error inesperado en signOut:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al cerrar sesión',
    };
  }
}

// =====================================================
// GET USER PROFILE
// =====================================================

/**
 * Obtener perfil completo del usuario
 * Incluye email de auth.users
 */
export async function getUserProfile(
  userId: string
): Promise<UserProfile | undefined> {
  try {
    console.log('👤 [AuthService] Obteniendo perfil:', userId);

    // Obtener perfil
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('❌ [AuthService] Error obteniendo perfil:', profileError);
      return undefined;
    }

    // Obtener email de auth.users
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error('❌ [AuthService] No se pudo obtener usuario de auth');
      return undefined;
    }

    const profile: UserProfile = {
      ...profileData,
      email: user.email || '',
    };

    console.log('✅ [AuthService] Perfil obtenido:', profile.full_name);

    return profile;
  } catch (error: any) {
    console.error('❌ [AuthService] Error inesperado obteniendo perfil:', error);
    return undefined;
  }
}

// =====================================================
// UPDATE PROFILE
// =====================================================

/**
 * Actualizar perfil del usuario
 */
export async function updateProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, 'id' | 'email' | 'created_at'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('📝 [AuthService] Actualizando perfil:', userId);

    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error('❌ [AuthService] Error actualizando perfil:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log('✅ [AuthService] Perfil actualizado');

    return { success: true };
  } catch (error: any) {
    console.error('❌ [AuthService] Error inesperado actualizando perfil:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al actualizar perfil',
    };
  }
}

// =====================================================
// HELPER: UPDATE LAST ACTIVE
// =====================================================

async function updateLastActive(userId: string): Promise<void> {
  try {
    await supabase
      .from('user_profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId);
  } catch (error) {
    console.warn('⚠️  [AuthService] No se pudo actualizar last_active_at:', error);
    // Non-critical error, no afecta el flujo
  }
}

// =====================================================
// HELPER: ERROR MESSAGES
// =====================================================

/**
 * Convierte errores de Supabase a mensajes user-friendly en español
 */
function getErrorMessage(error: AuthError): string {
  // Errores comunes de Supabase Auth
  switch (error.message) {
    case 'Invalid login credentials':
      return 'Email o contraseña incorrectos';
    case 'User already registered':
      return 'Este email ya está registrado';
    case 'Email not confirmed':
      return 'Debes confirmar tu email antes de iniciar sesión';
    case 'Password should be at least 6 characters':
      return 'La contraseña debe tener al menos 6 caracteres';
    case 'Unable to validate email address: invalid format':
      return 'Formato de email inválido';
    default:
      return error.message || 'Error de autenticación';
  }
}

// =====================================================
// SESSION MANAGEMENT
// =====================================================

/**
 * Obtener sesión actual
 */
export async function getCurrentSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Obtener usuario actual
 */
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Verificar si hay sesión activa
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession();
  return !!session;
}

// =====================================================
// PASSWORD RESET
// =====================================================

/**
 * Solicitar reset de contraseña
 */
export async function resetPassword(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🔑 [AuthService] Solicitando reset de contraseña:', email);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'shopunite://reset-password', // Deep link de la app
    });

    if (error) {
      console.error('❌ [AuthService] Error en resetPassword:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log('✅ [AuthService] Email de reset enviado');

    return { success: true };
  } catch (error: any) {
    console.error('❌ [AuthService] Error inesperado en resetPassword:', error);
    return {
      success: false,
      error: error.message || 'Error al solicitar reset de contraseña',
    };
  }
}

/**
 * Actualizar contraseña
 */
export async function updatePassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🔑 [AuthService] Actualizando contraseña');

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('❌ [AuthService] Error actualizando contraseña:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log('✅ [AuthService] Contraseña actualizada');

    return { success: true };
  } catch (error: any) {
    console.error('❌ [AuthService] Error inesperado actualizando contraseña:', error);
    return {
      success: false,
      error: error.message || 'Error al actualizar contraseña',
    };
  }
}
