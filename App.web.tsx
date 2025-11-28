/**
 * Grumo Web Application
 *
 * Main entry point for the web version:
 * - Landing Page: grumo.app (/)
 * - Admin Dashboard: grumo.app/admin (/admin)
 *
 * @version 6.0.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

// Landing Page
import { LandingPage } from './src/web/landing';

// Auth
import { WebAuthProvider, useWebAuth } from './src/web/context/WebAuthContext';
import LoginPage from './src/web/components/LoginPage';

// Dashboards
import { SuperAdminDashboard, StoreDashboard } from './src/web/components';
import type { Store, DashboardView } from './src/web/types';
import { supabaseWeb as supabase } from './src/lib/supabaseWeb';
import { Loader2 } from 'lucide-react';

// Admin Dashboard with Auth
const AdminDashboard = () => {
  const { user, adminUser, loading, isSuperAdmin, signOut } = useWebAuth();
  const [view, setView] = useState<DashboardView>('stores');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [assignedStores, setAssignedStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);

  // Load assigned stores for store owners
  useEffect(() => {
    if (adminUser && !isSuperAdmin && adminUser.assigned_stores.length > 0) {
      loadAssignedStores();
    }
  }, [adminUser, isSuperAdmin]);

  async function loadAssignedStores() {
    if (!adminUser) return;
    setLoadingStores(true);

    const { data } = await supabase
      .from('stores')
      .select('*')
      .in('domain', adminUser.assigned_stores);

    if (data) setAssignedStores(data);
    setLoadingStores(false);
  }

  const handleOpenStoreDashboard = (store: Store) => {
    setSelectedStore(store);
    setView('store-detail');
  };

  const handleBackToAdmin = () => {
    setSelectedStore(null);
    setView('stores');
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-purple-600 mx-auto mb-4" size={40} />
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user || !adminUser) {
    return <LoginPage onAuthSuccess={() => window.location.reload()} />;
  }

  // Not active (pending approval)
  if (!adminUser.is_active) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Cuenta pendiente de aprobación</h2>
          <p className="text-gray-500 mb-6">
            Tu cuenta ha sido creada pero está pendiente de aprobación por el administrador.
            Te notificaremos cuando tengas acceso.
          </p>
          <button
            onClick={handleSignOut}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  // Store Owner with no stores assigned
  if (!isSuperAdmin && adminUser.assigned_stores.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sin tiendas asignadas</h2>
          <p className="text-gray-500 mb-6">
            Tu cuenta está activa pero aún no tienes tiendas asignadas.
            Contacta al administrador para que te asigne una tienda.
          </p>
          <button
            onClick={handleSignOut}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  // Store Owner - Show their store dashboard directly
  if (!isSuperAdmin) {
    // If only one store, show it directly
    if (assignedStores.length === 1) {
      return (
        <StoreDashboard
          store={assignedStores[0]}
          onBack={handleSignOut}
          onStoreUpdated={loadAssignedStores}
        />
      );
    }

    // Multiple stores - show selector
    if (loadingStores) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="animate-spin text-purple-600" size={40} />
        </div>
      );
    }

    if (selectedStore) {
      return (
        <StoreDashboard
          store={selectedStore}
          onBack={handleBackToAdmin}
          onStoreUpdated={loadAssignedStores}
        />
      );
    }

    // Show store selector for owners with multiple stores
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mis Tiendas</h1>
              <p className="text-gray-500">Selecciona una tienda para administrar</p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Cerrar sesión
            </button>
          </div>

          <div className="grid gap-4">
            {assignedStores.map((store) => (
              <button
                key={store.id}
                onClick={() => handleOpenStoreDashboard(store)}
                className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:border-purple-300 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-4">
                  {store.logo_url ? (
                    <img src={store.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: store.theme_color || '#9333EA' }}
                    >
                      {(store.store_name || store.domain).substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">{store.store_name || store.domain}</h3>
                    <p className="text-sm text-gray-500">{store.domain}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Super Admin - Show store detail if selected
  if (view === 'store-detail' && selectedStore) {
    return (
      <StoreDashboard
        store={selectedStore}
        onBack={handleBackToAdmin}
        onStoreUpdated={() => {}}
      />
    );
  }

  // Super Admin - Show full dashboard
  return (
    <SuperAdminDashboard
      onOpenStoreDashboard={handleOpenStoreDashboard}
      onSignOut={handleSignOut}
    />
  );
};

// Admin Route with Auth Provider
const AdminRoute = () => {
  return (
    <WebAuthProvider>
      <AdminDashboard />
    </WebAuthProvider>
  );
};

// Main App with Router
const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Admin Dashboard */}
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="/admin/*" element={<AdminRoute />} />

        {/* Legacy redirect: /dashboard -> /admin */}
        <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
        <Route path="/dashboard/*" element={<Navigate to="/admin" replace />} />

        {/* Catch all - redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
