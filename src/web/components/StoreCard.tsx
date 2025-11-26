/**
 * Store Card Component
 *
 * Muestra la información de una tienda en el listado principal
 */

import React from 'react';
import { ExternalLink, RefreshCw, Edit2, Trash2, LayoutDashboard } from 'lucide-react';
import type { Store } from '../types';

interface StoreCardProps {
  store: Store;
  isEditing: boolean;
  isSyncing: boolean;
  onOpenDashboard: (store: Store) => void;
  onSync: (store: Store) => void;
  onEdit: (store: Store) => void;
  onDelete: (id: number) => void;
}

export default function StoreCard({
  store,
  isEditing,
  isSyncing,
  onOpenDashboard,
  onSync,
  onEdit,
  onDelete,
}: StoreCardProps) {
  return (
    <div
      className={`bg-white rounded-xl p-5 shadow-sm border-2 ${
        isEditing ? 'border-amber-400' : 'border-gray-200'
      } flex flex-col sm:flex-row gap-6 items-start sm:items-center hover:shadow-md transition-all`}
    >
      {/* Preview Logo/Banner/Color */}
      <div className="flex gap-3 flex-shrink-0">
        <div
          className="w-16 h-16 rounded-lg shadow-inner flex items-center justify-center text-white font-bold text-xl"
          style={{ backgroundColor: store.theme_color || '#000000' }}
        >
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt=""
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            (store.store_name || store.domain || 'SH').substring(0, 2).toUpperCase()
          )}
        </div>
        {store.banner_url && (
          <div className="w-24 h-16 rounded-lg overflow-hidden border border-gray-200">
            <img
              src={store.banner_url}
              alt="Banner"
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-lg text-gray-900 truncate">
            {store.store_name || store.domain}
          </h3>
          <a
            href={`https://${store.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-900"
          >
            <ExternalLink size={14} />
          </a>
        </div>
        <p className="text-sm text-gray-500 mb-2 line-clamp-2">
          {store.description || 'Sin descripción personalizada'}
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
            ID: {store.id}
          </span>
          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded truncate max-w-[200px]">
            {store.domain}
          </span>
          <span
            className={`px-2 py-1 rounded font-semibold ${
              store.access_token
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {store.access_token ? 'Storefront API' : 'Sin Storefront'}
          </span>
          <span
            className={`px-2 py-1 rounded font-semibold ${
              store.admin_api_token
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {store.admin_api_token ? 'Admin API' : 'Falta Admin API'}
          </span>
        </div>
      </div>

      <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
        <button
          onClick={() => onOpenDashboard(store)}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-grumo-dark text-white rounded-lg hover:bg-black transition-colors text-sm font-medium"
        >
          <LayoutDashboard size={16} /> Dashboard
        </button>
        <button
          onClick={() => onSync(store)}
          disabled={isSyncing}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
        </button>
        <button
          onClick={() => onEdit(store)}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
        >
          <Edit2 size={16} /> Editar
        </button>
        <button
          onClick={() => onDelete(store.id)}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
        >
          <Trash2 size={16} /> Eliminar
        </button>
      </div>
    </div>
  );
}
