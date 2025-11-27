/**
 * Grumo Admin Dashboard - Web Version
 *
 * Dashboard de Super Admin para gestionar el marketplace:
 * - Métricas globales agregadas de todas las tiendas
 * - Gestión de tiendas (agregar/editar/eliminar)
 * - Notificaciones push masivas y segmentadas
 * - Acceso a dashboards individuales de cada tienda
 *
 * @version 4.0.0
 */

import React, { useState } from 'react';
import './index.css';

// Componentes modulares
import { SuperAdminDashboard, StoreDashboard } from './src/web/components';
import type { Store, DashboardView } from './src/web/types';

const AdminApp = () => {
  // View state
  const [view, setView] = useState<DashboardView>('stores');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  const handleOpenStoreDashboard = (store: Store) => {
    setSelectedStore(store);
    setView('store-detail');
  };

  const handleBackToAdmin = () => {
    setSelectedStore(null);
    setView('stores');
  };

  // Render Store Detail View (Owner Dashboard)
  if (view === 'store-detail' && selectedStore) {
    return (
      <StoreDashboard
        store={selectedStore}
        onBack={handleBackToAdmin}
        onStoreUpdated={() => {
          // Store will be refreshed when returning to admin
        }}
      />
    );
  }

  // Render Super Admin Dashboard
  return (
    <SuperAdminDashboard onOpenStoreDashboard={handleOpenStoreDashboard} />
  );
};

export default AdminApp;
