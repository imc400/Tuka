/**
 * Analytics Tab Component
 *
 * Muestra estadísticas y métricas de la tienda
 */

import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Package, ShoppingCart, Users, Eye, Loader2, RefreshCw } from 'lucide-react';
import { supabaseWeb as supabase } from '../../../lib/supabaseWeb';
import type { Store } from '../../types';

interface AnalyticsTabProps {
  store: Store;
}

interface StoreStats {
  totalProducts: number;
  availableProducts: number;
  totalSubscribers: number;
  totalNotifications: number;
  totalOrders: number;
  lastSync: string | null;
}

export default function AnalyticsTab({ store }: AnalyticsTabProps) {
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, [store.domain]);

  async function loadStats() {
    setLoading(true);
    try {
      // Cargar estadísticas en paralelo
      const [
        productsResult,
        subscribersResult,
        notificationsResult,
        ordersResult,
        syncLogsResult,
      ] = await Promise.all([
        supabase
          .from('products')
          .select('id, available', { count: 'exact' })
          .eq('store_domain', store.domain),
        supabase.rpc('get_store_subscribers', { store_domain: store.domain }),
        supabase
          .from('notifications_sent')
          .select('id', { count: 'exact' })
          .eq('store_id', store.domain),
        supabase
          .from('orders')
          .select('id', { count: 'exact' })
          .eq('store_domain', store.domain),
        supabase
          .from('sync_logs')
          .select('*')
          .eq('store_domain', store.domain)
          .order('started_at', { ascending: false })
          .limit(5),
      ]);

      const products = productsResult.data || [];
      const availableCount = products.filter((p: any) => p.available).length;

      setStats({
        totalProducts: productsResult.count || 0,
        availableProducts: availableCount,
        totalSubscribers: subscribersResult.data?.length || 0,
        totalNotifications: notificationsResult.count || 0,
        totalOrders: ordersResult.count || 0,
        lastSync: syncLogsResult.data?.[0]?.completed_at || null,
      });

      setSyncLogs(syncLogsResult.data || []);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return date.toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="animate-spin text-purple-600 mb-2" size={32} />
        <p className="text-gray-500">Cargando estadísticas...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600">Error al cargar estadísticas</p>
        <button
          onClick={loadStats}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
          <BarChart3 size={20} className="text-purple-600" />
          Estadísticas de la Tienda
        </h3>
        <button
          onClick={loadStats}
          className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 text-purple-100 text-sm mb-2">
            <Package size={18} />
            <span>Productos</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalProducts}</p>
          <p className="text-xs text-purple-200 mt-1">
            {stats.availableProducts} disponibles
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 text-purple-100 text-sm mb-2">
            <Users size={18} />
            <span>Suscriptores</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalSubscribers}</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 text-green-100 text-sm mb-2">
            <ShoppingCart size={18} />
            <span>Pedidos</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalOrders}</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 text-amber-100 text-sm mb-2">
            <TrendingUp size={18} />
            <span>Notificaciones</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalNotifications}</p>
        </div>

        <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 text-gray-300 text-sm mb-2">
            <RefreshCw size={18} />
            <span>Última sync</span>
          </div>
          <p className="text-sm font-medium">{formatDate(stats.lastSync)}</p>
        </div>
      </div>

      {/* Product Availability Chart */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h4 className="font-bold text-gray-900 mb-4">Disponibilidad de Productos</h4>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{
                  width: `${
                    stats.totalProducts > 0
                      ? (stats.availableProducts / stats.totalProducts) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-bold text-green-600">{stats.availableProducts}</span> /{' '}
            {stats.totalProducts} disponibles
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {stats.totalProducts > 0
            ? `${Math.round((stats.availableProducts / stats.totalProducts) * 100)}% de productos disponibles para venta`
            : 'No hay productos sincronizados'}
        </p>
      </div>

      {/* Sync History */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h4 className="font-bold text-gray-900 mb-4">Historial de Sincronizaciones</h4>
        {syncLogs.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay sincronizaciones registradas</p>
        ) : (
          <div className="space-y-3">
            {syncLogs.map((log) => (
              <div
                key={log.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  log.status === 'success'
                    ? 'bg-green-50'
                    : log.status === 'in_progress'
                    ? 'bg-blue-50'
                    : 'bg-red-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      log.status === 'success'
                        ? 'bg-green-500'
                        : log.status === 'in_progress'
                        ? 'bg-blue-500 animate-pulse'
                        : 'bg-red-500'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {log.status === 'success'
                        ? 'Sincronización exitosa'
                        : log.status === 'in_progress'
                        ? 'Sincronizando...'
                        : 'Error en sincronización'}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(log.started_at)}</p>
                  </div>
                </div>
                <div className="text-right text-xs">
                  {log.products_synced && (
                    <p className="text-gray-600">{log.products_synced} productos</p>
                  )}
                  {log.duration_seconds && (
                    <p className="text-gray-400">{log.duration_seconds}s</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
