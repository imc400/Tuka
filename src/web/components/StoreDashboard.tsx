/**
 * Store Dashboard Component
 *
 * Dashboard individual para cada tienda - Estilo SaaS moderno con sidebar
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BarChart3,
  ShoppingCart,
  Settings,
  ExternalLink,
  Truck,
  Layers,
  Home,
  Users,
  TrendingUp,
  ChevronRight,
  Wallet,
  LogOut,
} from 'lucide-react';
import { useWebAuth } from '../context/WebAuthContext';
import type { Store, StoreTabType } from '../types';
import NotificationsTab from './tabs/NotificationsTab';
import AnalyticsTab from './tabs/AnalyticsTab';
import SalesTab from './tabs/SalesTab';
import ShippingTab from './tabs/ShippingTab';
import CollectionsTab from './tabs/CollectionsTab';
import SettingsTab from './tabs/SettingsTab';
import SubscribersTab from './tabs/SubscribersTab';
import PaymentsTab from './tabs/PaymentsTab';

interface StoreDashboardProps {
  store: Store;
  onBack: () => void;
  onStoreUpdated: () => void;
}

// Reorganized tabs with sections
const MENU_SECTIONS = [
  {
    title: 'Principal',
    items: [
      { id: 'analytics' as StoreTabType, label: 'Dashboard', icon: Home, description: 'Resumen general' },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { id: 'notifications' as StoreTabType, label: 'Campañas Push', icon: Bell, description: 'Notificaciones y campañas' },
      { id: 'subscribers' as StoreTabType, label: 'Suscriptores', icon: Users, description: 'Lista de suscriptores' },
    ],
  },
  {
    title: 'Ventas',
    items: [
      { id: 'sales' as StoreTabType, label: 'Pedidos', icon: ShoppingCart, description: 'Historial de ventas' },
      { id: 'payments' as StoreTabType, label: 'Pagos', icon: Wallet, description: 'Balance y transferencias' },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { id: 'shipping' as StoreTabType, label: 'Envíos', icon: Truck, description: 'Zonas y tarifas' },
      { id: 'collections' as StoreTabType, label: 'Colecciones', icon: Layers, description: 'Organizar productos' },
      { id: 'settings' as StoreTabType, label: 'Tienda', icon: Settings, description: 'Datos de la tienda' },
    ],
  },
];

export default function StoreDashboard({ store, onBack, onStoreUpdated }: StoreDashboardProps) {
  const { isSuperAdmin, signOut, adminUser } = useWebAuth();
  const [activeTab, setActiveTab] = useState<StoreTabType>('analytics');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  function renderTabContent() {
    switch (activeTab) {
      case 'notifications':
        return <NotificationsTab store={store} />;
      case 'analytics':
        return <AnalyticsTab store={store} />;
      case 'sales':
        return <SalesTab store={store} />;
      case 'shipping':
        return <ShippingTab store={store} />;
      case 'collections':
        return <CollectionsTab store={store} />;
      case 'settings':
        return <SettingsTab store={store} onStoreUpdated={onStoreUpdated} />;
      case 'subscribers':
        return <SubscribersTab store={store} />;
      case 'payments':
        return <PaymentsTab store={store} />;
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
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start'} mb-4`}>
            <img
              src={sidebarCollapsed ? '/grumo-isotipo-trimmed.png' : '/grumo-header-logo.png'}
              alt="Grumo"
              className={sidebarCollapsed ? 'h-8 w-8 object-contain' : 'h-7 object-contain'}
            />
          </div>
          {/* Solo mostrar "Volver a tiendas" para super admin */}
          {isSuperAdmin && (
            <button
              onClick={onBack}
              className={`flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm transition-colors ${sidebarCollapsed ? 'justify-center w-full' : ''}`}
            >
              <ArrowLeft size={16} />
              {!sidebarCollapsed && <span>Volver a tiendas</span>}
            </button>
          )}
        </div>

        {/* Store Info */}
        <div className={`p-4 border-b border-gray-200 ${sidebarCollapsed ? 'px-2' : ''}`}>
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            {store.logo_url ? (
              <img
                src={store.logo_url}
                alt=""
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ backgroundColor: store.theme_color || '#6B7280' }}
              >
                {(store.store_name || store.domain).substring(0, 2).toUpperCase()}
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-gray-900 truncate text-sm">
                  {store.store_name || store.domain}
                </h2>
                <a
                  href={`https://${store.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <span className="truncate">{store.domain}</span>
                  <ExternalLink size={10} />
                </a>
              </div>
            )}
          </div>
        </div>

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
          {/* User info and logout */}
          {!sidebarCollapsed && adminUser && (
            <div className="px-3 py-2 text-xs text-gray-500 truncate">
              {adminUser.email}
            </div>
          )}
          <button
            onClick={signOut}
            className={`w-full flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
            title={sidebarCollapsed ? 'Cerrar sesión' : undefined}
          >
            <LogOut size={18} />
            {!sidebarCollapsed && <span className="text-sm">Cerrar sesión</span>}
          </button>
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

            {/* Quick Stats in Header */}
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-gray-500">Suscriptores</p>
                <p className="text-lg font-semibold text-gray-900">-</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Pedidos (30d)</p>
                <p className="text-lg font-semibold text-gray-900">-</p>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: store.theme_color || '#6B7280' }}
                title="Color de marca"
              />
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
}
