/**
 * Web Auth Context
 *
 * Authentication context for Grumo dashboard
 * Handles login state, user roles, and store access
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  signOut: () => Promise<void>;
  refreshAdminUser: () => Promise<void>;
}

const WebAuthContext = createContext<WebAuthContextType | undefined>(undefined);

export function WebAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const isSuperAdmin = adminUser?.role === 'super_admin' || adminUser?.email === SUPER_ADMIN_EMAIL;

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!isMounted) return;

        console.log('[WebAuth] Initial session:', session?.user?.email || 'none');
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await loadAdminUser(session.user.id);
        }
      } catch (err) {
        console.error('[WebAuth] Init error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    }

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return;

        console.log('[WebAuth] Auth state changed:', event);

        // Ignore TOKEN_REFRESHED and INITIAL_SESSION events
        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          return;
        }

        // For SIGNED_IN, update state
        if (event === 'SIGNED_IN' && newSession?.user) {
          console.log('[WebAuth] Processing SIGNED_IN for:', newSession.user.email);
          setSession(newSession);
          setUser(newSession.user);
          await loadAdminUser(newSession.user.id);
          if (isMounted) {
            setLoading(false);
          }
        }

        // For SIGNED_OUT, clear state
        if (event === 'SIGNED_OUT') {
          console.log('[WebAuth] Processing SIGNED_OUT');
          setSession(null);
          setUser(null);
          setAdminUser(null);
          if (isMounted) {
            setLoading(false);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadAdminUser(userId: string) {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // User might not have admin access yet
        console.log('[WebAuth] No admin user found:', error.message);
        setAdminUser(null);
      } else {
        setAdminUser(data);

        // Update last login
        await supabase
          .from('admin_users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('user_id', userId);
      }
    } catch (err) {
      console.error('[WebAuth] Error loading admin user:', err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshAdminUser() {
    if (user) {
      await loadAdminUser(user.id);
    }
  }

  function canAccessStore(storeDomain: string): boolean {
    if (!adminUser || !adminUser.is_active) return false;
    if (isSuperAdmin) return true;
    return adminUser.assigned_stores.includes(storeDomain);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setAdminUser(null);
    setSession(null);
  }

  return (
    <WebAuthContext.Provider
      value={{
        user,
        adminUser,
        session,
        loading,
        isSuperAdmin,
        canAccessStore,
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
