/**
 * Web Auth Context
 *
 * Authentication context for Grumo dashboard
 * Handles login state, user roles, and store access
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabaseWeb as supabase } from '../../lib/supabaseWeb';
import type { User, Session } from '@supabase/supabase-js';

// Super Admin email
const SUPER_ADMIN_EMAIL = 'hola@grumo.app';

export interface AdminUser {
  id: number;
  user_id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'store_owner';
  is_active: boolean;
  assigned_stores: string[];
  last_login_at: string | null;
  created_at: string;
}

interface WebAuthContextType {
  user: User | null;
  adminUser: AdminUser | null;
  session: Session | null;
  loading: boolean;
  isSuperAdmin: boolean;
  canAccessStore: (storeDomain: string) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshAdminUser: () => Promise<void>;
}

const WebAuthContext = createContext<WebAuthContextType | undefined>(undefined);

export function WebAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = adminUser?.role === 'super_admin' || adminUser?.email === SUPER_ADMIN_EMAIL;

  // Load admin user data
  const loadAdminUser = useCallback(async (userId: string): Promise<AdminUser | null> => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.log('[WebAuth] No admin user found:', error.message);
        return null;
      }

      // Update last login (fire and forget)
      supabase
        .from('admin_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('user_id', userId)
        .then(() => {});

      return data;
    } catch (err) {
      console.error('[WebAuth] Error loading admin user:', err);
      return null;
    }
  }, []);

  // Initialize auth on mount
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      console.log('[WebAuth] Initializing...');

      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (!isMounted) return;

        console.log('[WebAuth] Initial session:', currentSession?.user?.email || 'none');

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          const admin = await loadAdminUser(currentSession.user.id);
          if (isMounted) {
            setAdminUser(admin);
          }
        }
      } catch (err) {
        console.error('[WebAuth] Init error:', err);
      } finally {
        if (isMounted) {
          console.log('[WebAuth] Init complete, setting loading=false');
          setLoading(false);
        }
      }
    }

    initAuth();

    // Listen for auth changes (only for external changes like token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('[WebAuth] Auth event:', event);

        // Only handle sign out from other tabs
        if (event === 'SIGNED_OUT' && isMounted) {
          setSession(null);
          setUser(null);
          setAdminUser(null);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadAdminUser]);

  // Sign in function - handles everything in one place
  const signIn = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (authError) {
        setLoading(false);
        if (authError.message.includes('Invalid login credentials')) {
          return { error: 'Email o contraseña incorrectos' };
        }
        if (authError.message.includes('Email not confirmed')) {
          return { error: 'Por favor confirma tu email antes de iniciar sesión' };
        }
        return { error: authError.message };
      }

      if (!data.user) {
        setLoading(false);
        return { error: 'Error al iniciar sesión' };
      }

      // Load admin user
      const admin = await loadAdminUser(data.user.id);

      if (!admin) {
        await supabase.auth.signOut();
        setLoading(false);
        return { error: 'No tienes acceso al dashboard. Si quieres administrar una tienda, crea una cuenta usando "Regístrate".' };
      }

      if (!admin.is_active) {
        await supabase.auth.signOut();
        setLoading(false);
        return { error: 'Tu cuenta está pendiente de aprobación. Te notificaremos cuando tengas acceso. Para consultas: hola@grumo.app' };
      }

      // Success! Update state
      setSession(data.session);
      setUser(data.user);
      setAdminUser(admin);
      setLoading(false);

      return { error: null };
    } catch (err) {
      console.error('[WebAuth] Sign in error:', err);
      setLoading(false);
      return { error: 'Error al iniciar sesión' };
    }
  }, [loadAdminUser]);

  // Sign out function
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAdminUser(null);
    setSession(null);
  }, []);

  // Refresh admin user data
  const refreshAdminUser = useCallback(async () => {
    if (user) {
      const admin = await loadAdminUser(user.id);
      setAdminUser(admin);
    }
  }, [user, loadAdminUser]);

  // Check if user can access a store
  const canAccessStore = useCallback((storeDomain: string): boolean => {
    if (!adminUser || !adminUser.is_active) return false;
    if (isSuperAdmin) return true;
    return adminUser.assigned_stores.includes(storeDomain);
  }, [adminUser, isSuperAdmin]);

  return (
    <WebAuthContext.Provider
      value={{
        user,
        adminUser,
        session,
        loading,
        isSuperAdmin,
        canAccessStore,
        signIn,
        signOut,
        refreshAdminUser,
      }}
    >
      {children}
    </WebAuthContext.Provider>
  );
}

export function useWebAuth() {
  const context = useContext(WebAuthContext);
  if (context === undefined) {
    throw new Error('useWebAuth must be used within a WebAuthProvider');
  }
  return context;
}
