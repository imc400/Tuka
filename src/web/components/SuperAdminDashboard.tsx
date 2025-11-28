/**
 * Super Admin Dashboard Component
 *
 * Dashboard para el administrador principal de Grumo:
 * - Métricas globales agregadas de todas las tiendas
 * - Gestión de tiendas (agregar/editar)
 * - Notificaciones masivas segmentadas
 * - Acceso a dashboards individuales de cada tienda
 */

import React, { useState, useEffect } from 'react';
import {
  Home,
  Store,
  Bell,
  Settings,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  Users,
  ShoppingCart,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Loader2,
  LogOut,
} from 'lucide-react';
import { supabaseWeb as supabase } from '../../lib/supabaseWeb';
import type { Store as StoreType } from '../types';

// Tabs
import GlobalAnalyticsTab from './tabs/admin/GlobalAnalyticsTab';
import StoresManagementTab from './tabs/admin/StoresManagementTab';
import MassNotificationsTab from './tabs/admin/MassNotificationsTab';
import UsersManagementTab from './tabs/admin/UsersManagementTab';

type AdminTabType = 'dashboard' | 'stores' | 'users' | 'notifications' | 'settings';

interface SuperAdminDashboardProps {
  onOpenStoreDashboard: (store: StoreType) => void;
  onSignOut: () => void;
}

// Menu sections for sidebar
const MENU_SECTIONS = [
  {
    title: 'Principal',
    items: [
      { id: 'dashboard' as AdminTabType, label: 'Dashboard', icon: Home, description: 'Métricas globales' },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { id: 'stores' as AdminTabType, label: 'Tiendas', icon: Store, description: 'Administrar tiendas' },
      { id: 'users' as AdminTabType, label: 'Usuarios', icon: Users, description: 'Gestionar accesos' },
      { id: 'notifications' as AdminTabType, label: 'Notificaciones', icon: Bell, description: 'Push masivo' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { id: 'settings' as AdminTabType, label: 'Configuración', icon: Settings, description: 'Ajustes del sistema' },
    ],
  },
];

export default function SuperAdminDashboard({ onOpenStoreDashboard, onSignOut }: SuperAdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTabType>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStores();
  }, []);

  async function fetchStores() {
    setLoading(true);
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setStores(data);
    setLoading(false);
  }

  function renderTabContent() {
    switch (activeTab) {
      case 'dashboard':
        return (
          <GlobalAnalyticsTab
            stores={stores}
            onOpenStoreDashboard={onOpenStoreDashboard}
            onRefresh={fetchStores}
          />
        );
      case 'stores':
        return (
          <StoresManagementTab
            stores={stores}
            onStoresUpdated={fetchStores}
            onOpenStoreDashboard={onOpenStoreDashboard}
          />
        );
      case 'notifications':
        return <MassNotificationsTab stores={stores} />;
      case 'users':
        return <UsersManagementTab stores={stores} />;
      case 'settings':
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Settings size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Configuración del Sistema</h3>
            <p className="text-gray-500">Próximamente: Gestión de accesos, configuración global, etc.</p>
          </div>
        );
      default:
        return null;
    }
  }

  // Get current tab info for header
  const currentTab = MENU_SECTIONS.flatMap(s => s.items).find(item => item.id === activeTab);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Grumo Logo */}
        <div className={`p-4 border-b border-gray-200 ${sidebarCollapsed ? 'px-2' : ''}`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start'} mb-2`}>
            <img
              src={sidebarCollapsed ? '/grumo-isotipo-trimmed.png' : '/grumo-header-logo.png'}
              alt="Grumo"
              className={sidebarCollapsed ? 'h-8 w-8 object-contain' : 'h-7 object-contain'}
            />
          </div>
          {!sidebarCollapsed && (
            <p className="text-xs text-gray-400 font-medium">Panel de Administración</p>
          )}
        </div>

        {/* Quick Stats in Sidebar */}
        {!sidebarCollapsed && (
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{stores.length}</p>
                <p className="text-xs text-gray-500">Tiendas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {stores.filter(s => !s.is_hidden).length}
                </p>
                <p className="text-xs text-gray-500">Activas</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {MENU_SECTIONS.map((section, idx) => (
            <div key={idx} className="mb-6">
              {!sidebarCollapsed && (
                <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {section.title}
                </h3>
              )}
              <ul className="space-y-1 px-2">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                          isActive
                            ? 'bg-purple-50 text-purple-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        } ${sidebarCollapsed ? 'justify-center' : ''}`}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <Icon
                          size={20}
                          className={isActive ? 'text-purple-600' : 'text-gray-400'}
                        />
                        {!sidebarCollapsed && (
                          <span className="text-sm">{item.label}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight
              size={18}
              className={`transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`}
            />
            {!sidebarCollapsed && <span className="text-sm">Colapsar</span>}
          </button>
          <button
            onClick={onSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            {!sidebarCollapsed && <span className="text-sm">Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {currentTab?.label || 'Dashboard'}
              </h1>
              {currentTab?.description && (
                <p className="text-sm text-gray-500 mt-0.5">{currentTab.description}</p>
              )}
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-4">
              <button
                onClick={fetchStores}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Actualizar
              </button>
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {loading && stores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="animate-spin text-purple-600 mb-2" size={32} />
              <p className="text-gray-500">Cargando datos...</p>
            </div>
          ) : (
            renderTabContent()
          )}
        </div>
      </main>
    </div>
  );
}
