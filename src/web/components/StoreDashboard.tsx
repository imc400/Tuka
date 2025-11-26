/**
 * Store Dashboard Component
 *
 * Dashboard individual para cada tienda con navegación por tabs
 */

import React, { useState } from 'react';
import { ArrowLeft, Bell, BarChart3, ShoppingCart, Settings, ExternalLink, Truck, Layers } from 'lucide-react';
import type { Store, StoreTabType } from '../types';
import NotificationsTab from './tabs/NotificationsTab';
import AnalyticsTab from './tabs/AnalyticsTab';
import SalesTab from './tabs/SalesTab';
import ShippingTab from './tabs/ShippingTab';
import CollectionsTab from './tabs/CollectionsTab';
import SettingsTab from './tabs/SettingsTab';

interface StoreDashboardProps {
  store: Store;
  onBack: () => void;
  onStoreUpdated: () => void;
}

const TABS: { id: StoreTabType; label: string; icon: any }[] = [
  { id: 'notifications', label: 'Notificaciones', icon: Bell },
  { id: 'analytics', label: 'Estadísticas', icon: BarChart3 },
  { id: 'sales', label: 'Ventas', icon: ShoppingCart },
  { id: 'shipping', label: 'Envíos', icon: Truck },
  { id: 'collections', label: 'Colecciones', icon: Layers },
  { id: 'settings', label: 'Configuración', icon: Settings },
];

export default function StoreDashboard({ store, onBack, onStoreUpdated }: StoreDashboardProps) {
  const [activeTab, setActiveTab] = useState<StoreTabType>('notifications');

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
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - Grumo Dark */}
      <div className="bg-grumo-dark text-white p-6">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Volver a tiendas</span>
          </button>

          {/* Store Info */}
          <div className="flex items-center gap-4">
            {store.logo_url ? (
              <img
                src={store.logo_url}
                alt=""
                className="w-16 h-16 rounded-xl object-cover border-2 border-white/30"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center text-2xl font-bold">
                {(store.store_name || store.domain).substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{store.store_name || store.domain}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-white/70 text-sm">{store.domain}</span>
                <a
                  href={`https://${store.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex gap-1 mt-6 overflow-x-auto pb-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-white text-gray-900 shadow-lg'
                      : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">{renderTabContent()}</div>
    </div>
  );
}

// Helper function to darken/lighten colors
function adjustColor(color: string, amount: number): string {
  const clamp = (val: number) => Math.min(255, Math.max(0, val));

  // Remove # if present
  const hex = color.replace('#', '');

  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Adjust
  const newR = clamp(r + amount);
  const newG = clamp(g + amount);
  const newB = clamp(b + amount);

  // Return new hex
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB
    .toString(16)
    .padStart(2, '0')}`;
}
