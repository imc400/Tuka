/**
 * Authentication Context
 *
 * Provee estado global de autenticación a toda la app:
 * - Usuario actual
 * - Perfil del usuario
 * - Estado de carga
 * - Funciones de login/logout/signup
 *
 * @module AuthContext
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as authService from '../services/authService';
import type { UserProfile, SignUpData, SignInData } from '../services/authService';

// =====================================================
// TYPES
// =====================================================

interface AuthContextType {
  // Estado
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Acciones
  signUp: (data: SignUpData) => Promise<{ success: boolean; error?: string }>;
  signIn: (data: SignInData) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// =====================================================
// CONTEXT
// =====================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// =====================================================
// PROVIDER
// =====================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // =====================================================
  // INITIALIZE: Cargar sesión al montar
  // =====================================================

  useEffect(() => {
    console.log('🔐 [AuthContext] Inicializando...');

    // 1. Obtener sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📊 [AuthContext] Sesión inicial:', session?.user?.id || 'ninguna');
      setSession(session);
      setUser(session?.user ?? null);

      // Si hay usuario, cargar su perfil
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // 2. Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('🔄 [AuthContext] Auth state changed:', _event, session?.user?.id);

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Usuario logueado → cargar perfil
        await loadUserProfile(session.user.id);
      } else {
        // Usuario deslogueado → limpiar perfil
        setProfile(null);
        setIsLoading(false);
      }
    });

    // Cleanup
    return () => {
      console.log('🧹 [AuthContext] Limpiando suscripción');
      subscription.unsubscribe();
    };
  }, []);

  // =====================================================
  // HELPER: Cargar perfil del usuario
  // =====================================================

  async function loadUserProfile(userId: string, retryCount = 0) {
    try {
      console.log('👤 [AuthContext] Cargando perfil:', userId, retryCount > 0 ? `(intento ${retryCount + 1})` : '');

      const userProfile = await authService.getUserProfile(userId);

      if (userProfile) {
        console.log('✅ [AuthContext] Perfil cargado:', userProfile.full_name);
        setProfile(userProfile);
      } else {
        // Para OAuth (Google), el perfil puede estar siendo creado en paralelo
        // Re-intentar hasta 3 veces con delay
        if (retryCount < 3) {
          console.log('⏳ [AuthContext] Perfil no encontrado, re-intentando en 1s...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          return loadUserProfile(userId, retryCount + 1);
        } else {
          console.warn('⚠️  [AuthContext] No se encontró perfil después de 3 intentos:', userId);
          setProfile(null);
        }
      }
    } catch (error) {
      console.error('❌ [AuthContext] Error cargando perfil:', error);
      // También re-intentar en caso de error (puede ser race condition)
      if (retryCount < 3) {
        console.log('⏳ [AuthContext] Error, re-intentando en 1s...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return loadUserProfile(userId, retryCount + 1);
      }
      setProfile(null);
    } finally {
      if (retryCount >= 3 || (await authService.getUserProfile(userId))) {
        setIsLoading(false);
      }
    }
  }

  // =====================================================
  // ACTIONS
  // =====================================================

  /**
   * Registrar nuevo usuario
   */
  const handleSignUp = async (
    data: SignUpData
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    try {
      const result = await authService.signUp(data);

      if (result.success) {
        console.log('✅ [AuthContext] Registro exitoso');

        // Establecer inmediatamente el perfil del resultado de signUp
        if (result.profile) {
          console.log('📝 [AuthContext] Estableciendo perfil inmediatamente:', result.profile.full_name);
          setProfile(result.profile);
          setUser(result.user || null);
          setSession(result.session || null);
        }

        // El estado también se actualizará via onAuthStateChange (como backup)
      } else {
        console.error('❌ [AuthContext] Error en registro:', result.error);
      }

      return result;
    } catch (error: any) {
      console.error('❌ [AuthContext] Error inesperado en signUp:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido',
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Iniciar sesión
   */
  const handleSignIn = async (
    data: SignInData
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    try {
      const result = await authService.signIn(data);

      if (result.success) {
        console.log('✅ [AuthContext] Login exitoso');
        // El estado se actualizará automáticamente via onAuthStateChange
      } else {
        console.error('❌ [AuthContext] Error en login:', result.error);
      }

      return result;
    } catch (error: any) {
      console.error('❌ [AuthContext] Error inesperado en signIn:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido',
      };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Cerrar sesión
   */
  const handleSignOut = async () => {
    setIsLoading(true);

    try {
      await authService.signOut();
      console.log('✅ [AuthContext] Sesión cerrada');
      // El estado se actualizará automáticamente via onAuthStateChange
    } catch (error) {
      console.error('❌ [AuthContext] Error cerrando sesión:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refrescar perfil del usuario (útil después de actualizaciones)
   */
  const handleRefreshProfile = async () => {
    if (user) {
      await loadUserProfile(user.id);
    }
  };

  // =====================================================
  // COMPUTED VALUES
  // =====================================================

  const isAuthenticated = !!user && !!session;

  // =====================================================
  // CONTEXT VALUE
  // =====================================================

  const value: AuthContextType = {
    // Estado
    user,
    profile,
    session,
    isLoading,
    isAuthenticated,

    // Acciones
    signUp: handleSignUp,
    signIn: handleSignIn,
    signOut: handleSignOut,
    refreshProfile: handleRefreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =====================================================
// HOOK
// =====================================================

/**
 * Hook para acceder al contexto de autenticación
 *
 * @throws Error si se usa fuera del AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }

  return context;
}

// =====================================================
// EXPORTS
// =====================================================

export default AuthContext;
