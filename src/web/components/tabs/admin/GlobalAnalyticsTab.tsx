/**
 * Global Analytics Tab - Super Admin Dashboard
 *
 * Métricas agregadas de todas las tiendas:
 * - Ingresos totales, pedidos totales, suscriptores totales
 * - Comparación por período
 * - Top tiendas por ventas
 * - Desglose por tienda
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  ShoppingCart,
  Users,
  DollarSign,
  Store,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCw,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Package,
  Bell,
  Eye,
  EyeOff,
} from 'lucide-react';
import { supabaseWeb as supabase } from '../../../../lib/supabaseWeb';
import type { Store as StoreType } from '../../../types';

interface GlobalAnalyticsTabProps {
  stores: StoreType[];
  onOpenStoreDashboard: (store: StoreType) => void;
  onRefresh: () => void;
}

interface GlobalStats {
  totalRevenue: number;
  revenueInPeriod: number;
  revenueChange: number;
  totalOrders: number;
  ordersInPeriod: number;
  ordersChange: number;
  totalSubscribers: number;
  totalProducts: number;
  totalNotifications: number;
  // Grumo earnings (application_fee from approved payments)
  grumoEarningsInPeriod: number;
  grumoEarningsTotal: number;
  grumoEarningsChange: number;
  // Per-store breakdown
  storeStats: StoreStats[];
}

interface StoreStats {
  store: StoreType;
  revenue: number;
  revenueInPeriod: number;
  orders: number;
  ordersInPeriod: number;
  subscribers: number;
  products: number;
}

type DateRangePreset = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth';

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

const DATE_PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: 'last7days', label: 'Últimos 7 días' },
  { id: 'last30days', label: 'Últimos 30 días' },
  { id: 'thisMonth', label: 'Este mes' },
  { id: 'lastMonth', label: 'Mes anterior' },
];

function getDateRange(preset: DateRangePreset): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  switch (preset) {
    case 'today':
      return { start: today, end: tomorrow, label: 'Hoy' };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: today, label: 'Ayer' };
    }
    case 'last7days': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { start: weekAgo, end: tomorrow, label: 'Últimos 7 días' };
    }
    case 'last30days': {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return { start: monthAgo, end: tomorrow, label: 'Últimos 30 días' };
    }
    case 'thisMonth': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: monthStart, end: tomorrow, label: 'Este mes' };
    }
    case 'lastMonth': {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: lastMonthStart, end: lastMonthEnd, label: 'Mes anterior' };
    }
    default:
      return { start: today, end: tomorrow, label: 'Hoy' };
  }
}

function getPreviousPeriod(range: DateRange): DateRange {
  const duration = range.end.getTime() - range.start.getTime();
  const prevEnd = new Date(range.start);
  const prevStart = new Date(prevEnd.getTime() - duration);
  return { start: prevStart, end: prevEnd, label: 'Período anterior' };
}

export default function GlobalAnalyticsTab({ stores, onOpenStoreDashboard, onRefresh }: GlobalAnalyticsTabProps) {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('last30days');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const dateRange = useMemo(() => getDateRange(selectedPreset), [selectedPreset]);

  useEffect(() => {
    if (stores.length > 0) {
      loadGlobalStats();
    }
  }, [stores, dateRange.start.toISOString()]);

  async function loadGlobalStats() {
    setLoading(true);
    try {
      const prevPeriod = getPreviousPeriod(dateRange);
      const storeDomainsArr = stores.map(s => s.domain);

      // Parallel queries for all stores
      const [
        ordersCurrentResult,
        ordersPrevResult,
        allOrdersResult,
        subscribersResult,
        notificationsResult,
        // Grumo earnings queries
        grumoEarningsCurrentResult,
        grumoEarningsPrevResult,
        grumoEarningsTotalResult,
      ] = await Promise.all([
        // Orders in current period
        supabase
          .from('shopify_orders')
          .select('id, order_amount, store_domain')
          .in('store_domain', storeDomainsArr)
          .gte('created_at', dateRange.start.toISOString())
          .lt('created_at', dateRange.end.toISOString()),
        // Orders in previous period
        supabase
          .from('shopify_orders')
          .select('id, order_amount, store_domain')
          .in('store_domain', storeDomainsArr)
          .gte('created_at', prevPeriod.start.toISOString())
          .lt('created_at', prevPeriod.end.toISOString()),
        // All orders (for total)
        supabase
          .from('shopify_orders')
          .select('id, order_amount, store_domain')
          .in('store_domain', storeDomainsArr),
        // Subscribers
        supabase
          .from('store_subscriptions')
          .select('id, store_domain')
          .in('store_domain', storeDomainsArr)
          .is('unsubscribed_at', null),
        // Notifications
        supabase
          .from('notifications_sent')
          .select('id, store_id')
          .in('store_id', storeDomainsArr),
        // Grumo earnings in current period (approved payments only)
        supabase
          .from('store_payments_v2')
          .select('application_fee, paid_at')
          .eq('status', 'approved')
          .gte('paid_at', dateRange.start.toISOString())
          .lt('paid_at', dateRange.end.toISOString()),
        // Grumo earnings in previous period
        supabase
          .from('store_payments_v2')
          .select('application_fee, paid_at')
          .eq('status', 'approved')
          .gte('paid_at', prevPeriod.start.toISOString())
          .lt('paid_at', prevPeriod.end.toISOString()),
        // Grumo earnings total (all time)
        supabase
          .from('store_payments_v2')
          .select('application_fee')
          .eq('status', 'approved'),
      ]);

      // Get product counts per store (separate queries to avoid 1000 row limit)
      const productCountsPromises = storeDomainsArr.map(async (domain) => {
        const { count } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('store_domain', domain);
        return { domain, count: count || 0 };
      });
      const productCounts = await Promise.all(productCountsPromises);

      const currentOrders = ordersCurrentResult.data || [];
      const prevOrders = ordersPrevResult.data || [];
      const allOrders = allOrdersResult.data || [];
      const subscribers = subscribersResult.data || [];
      const notifications = notificationsResult.data || [];
      const grumoEarningsCurrent = grumoEarningsCurrentResult.data || [];
      const grumoEarningsPrev = grumoEarningsPrevResult.data || [];
      const grumoEarningsAll = grumoEarningsTotalResult.data || [];

      // Build product counts map
      const productCountsMap: Record<string, number> = {};
      productCounts.forEach(pc => {
        productCountsMap[pc.domain] = pc.count;
      });
      const totalProductsCount = productCounts.reduce((sum, pc) => sum + pc.count, 0);

      // Calculate global stats
      const revenueInPeriod = currentOrders.reduce((sum, o) => sum + (o.order_amount || 0), 0);
      const prevRevenue = prevOrders.reduce((sum, o) => sum + (o.order_amount || 0), 0);
      const totalRevenue = allOrders.reduce((sum, o) => sum + (o.order_amount || 0), 0);

      const revenueChange = prevRevenue > 0
        ? ((revenueInPeriod - prevRevenue) / prevRevenue) * 100
        : revenueInPeriod > 0 ? 100 : 0;

      const ordersChange = prevOrders.length > 0
        ? ((currentOrders.length - prevOrders.length) / prevOrders.length) * 100
        : currentOrders.length > 0 ? 100 : 0;

      // Calculate Grumo earnings
      const grumoEarningsInPeriod = grumoEarningsCurrent.reduce((sum, p) => sum + (p.application_fee || 0), 0);
      const grumoEarningsPrevPeriod = grumoEarningsPrev.reduce((sum, p) => sum + (p.application_fee || 0), 0);
      const grumoEarningsTotal = grumoEarningsAll.reduce((sum, p) => sum + (p.application_fee || 0), 0);
      const grumoEarningsChange = grumoEarningsPrevPeriod > 0
        ? ((grumoEarningsInPeriod - grumoEarningsPrevPeriod) / grumoEarningsPrevPeriod) * 100
        : grumoEarningsInPeriod > 0 ? 100 : 0;

      // Per-store breakdown
      const storeStatsMap: Record<string, StoreStats> = {};
      stores.forEach(store => {
        storeStatsMap[store.domain] = {
          store,
          revenue: 0,
          revenueInPeriod: 0,
          orders: 0,
          ordersInPeriod: 0,
          subscribers: 0,
          products: 0,
        };
      });

      // Aggregate by store
      allOrders.forEach(order => {
        if (storeStatsMap[order.store_domain]) {
          storeStatsMap[order.store_domain].revenue += order.order_amount || 0;
          storeStatsMap[order.store_domain].orders += 1;
        }
      });

      currentOrders.forEach(order => {
        if (storeStatsMap[order.store_domain]) {
          storeStatsMap[order.store_domain].revenueInPeriod += order.order_amount || 0;
          storeStatsMap[order.store_domain].ordersInPeriod += 1;
        }
      });

      subscribers.forEach(sub => {
        if (storeStatsMap[sub.store_domain]) {
          storeStatsMap[sub.store_domain].subscribers += 1;
        }
      });

      // Assign product counts from the accurate count queries
      Object.keys(productCountsMap).forEach(domain => {
        if (storeStatsMap[domain]) {
          storeStatsMap[domain].products = productCountsMap[domain];
        }
      });

      // Sort by revenue in period (descending)
      const storeStatsArr = Object.values(storeStatsMap).sort(
        (a, b) => b.revenueInPeriod - a.revenueInPeriod
      );

      setStats({
        totalRevenue,
        revenueInPeriod,
        revenueChange,
        totalOrders: allOrders.length,
        ordersInPeriod: currentOrders.length,
        ordersChange,
        totalSubscribers: subscribers.length,
        totalProducts: totalProductsCount,
        totalNotifications: notifications.length,
        grumoEarningsInPeriod,
        grumoEarningsTotal,
        grumoEarningsChange,
        storeStats: storeStatsArr,
      });
    } catch (error) {
      console.error('Error loading global stats:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function formatNumber(num: number) {
    return new Intl.NumberFormat('es-CL').format(num);
  }

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="animate-spin text-purple-600 mb-2" size={32} />
        <p className="text-gray-500">Cargando métricas globales...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600">Error al cargar estadísticas</p>
        <button
          onClick={loadGlobalStats}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner with Date Picker */}
      <div className="bg-gradient-to-r from-gray-900 via-purple-900 to-gray-900 rounded-2xl p-6 text-white">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">Panel de Control Global</h2>
            <p className="text-gray-300 text-sm">
              Métricas agregadas de {stores.length} tienda{stores.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Date Range Selector */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
            >
              <Calendar size={16} />
              <span>{dateRange.label}</span>
              <ChevronDown size={16} />
            </button>

            {showDatePicker && (
              <div className="absolute right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 py-2 min-w-[180px]">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedPreset(preset.id);
                      setShowDatePicker(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      selectedPreset === preset.id
                        ? 'bg-purple-50 text-purple-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => { onRefresh(); loadGlobalStats(); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Grumo Earnings Card - Highlighted */}
      <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <img src="/grumo-isotipo-trimmed.png" alt="Grumo" className="w-8 h-8" />
            </div>
            <div>
              <p className="text-purple-200 text-sm font-medium">Ingresos Grumo</p>
              <p className="text-3xl font-bold">{formatCurrency(stats.grumoEarningsInPeriod)}</p>
              <p className="text-purple-200 text-xs mt-1">
                Total histórico: {formatCurrency(stats.grumoEarningsTotal)}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {stats.grumoEarningsChange !== 0 && (
              <span className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-full ${
                stats.grumoEarningsChange > 0
                  ? 'bg-green-500/30 text-green-100'
                  : 'bg-red-500/30 text-red-100'
              }`}>
                {stats.grumoEarningsChange > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(stats.grumoEarningsChange).toFixed(0)}% vs período anterior
              </span>
            )}
            <p className="text-purple-200 text-xs">{dateRange.label}</p>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-green-600" />
            </div>
            {stats.revenueChange !== 0 && (
              <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                stats.revenueChange > 0
                  ? 'text-green-600 bg-green-50'
                  : 'text-red-600 bg-red-50'
              }`}>
                {stats.revenueChange > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(stats.revenueChange).toFixed(0)}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.revenueInPeriod)}</p>
          <p className="text-sm text-gray-500 mt-1">Ingresos - {dateRange.label}</p>
          <p className="text-xs text-gray-400 mt-2">Total histórico: {formatCurrency(stats.totalRevenue)}</p>
        </div>

        {/* Orders */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <ShoppingCart size={20} className="text-blue-600" />
            </div>
            {stats.ordersChange !== 0 && (
              <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                stats.ordersChange > 0
                  ? 'text-green-600 bg-green-50'
                  : 'text-red-600 bg-red-50'
              }`}>
                {stats.ordersChange > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(stats.ordersChange).toFixed(0)}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.ordersInPeriod)}</p>
          <p className="text-sm text-gray-500 mt-1">Pedidos - {dateRange.label}</p>
          <p className="text-xs text-gray-400 mt-2">Total histórico: {formatNumber(stats.totalOrders)}</p>
        </div>

        {/* Subscribers */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users size={20} className="text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalSubscribers)}</p>
          <p className="text-sm text-gray-500 mt-1">Suscriptores totales</p>
          <p className="text-xs text-gray-400 mt-2">Reciben notificaciones push</p>
        </div>

        {/* Stores */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Store size={20} className="text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stores.length}</p>
          <p className="text-sm text-gray-500 mt-1">Tiendas registradas</p>
          <p className="text-xs text-gray-400 mt-2">
            {stores.filter(s => !s.is_hidden).length} visibles en app
          </p>
        </div>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
            <Bell size={20} className="text-pink-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{formatNumber(stats.totalNotifications)}</p>
            <p className="text-sm text-gray-500">Notificaciones enviadas</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Package size={20} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{formatNumber(stats.totalProducts)}</p>
            <p className="text-sm text-gray-500">Productos totales</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
            <TrendingUp size={20} className="text-teal-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">
              {stats.ordersInPeriod > 0
                ? formatCurrency(stats.revenueInPeriod / stats.ordersInPeriod)
                : formatCurrency(0)}
            </p>
            <p className="text-sm text-gray-500">Ticket promedio</p>
          </div>
        </div>
      </div>

      {/* Stores Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Rendimiento por Tienda</h3>
          <span className="text-xs text-gray-500">{dateRange.label}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tienda
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Ingresos (período)
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Pedidos
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Suscriptores
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Productos
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.storeStats.map((storeStat, idx) => (
                <tr key={storeStat.store.domain} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {storeStat.store.logo_url ? (
                        <img
                          src={storeStat.store.logo_url}
                          alt=""
                          className="w-8 h-8 rounded-lg object-cover"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                          style={{ backgroundColor: storeStat.store.theme_color || '#6B7280' }}
                        >
                          {(storeStat.store.store_name || storeStat.store.domain).substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {storeStat.store.store_name || storeStat.store.domain}
                        </p>
                        <p className="text-xs text-gray-500">{storeStat.store.domain}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(storeStat.revenueInPeriod)}</p>
                    <p className="text-xs text-gray-400">Total: {formatCurrency(storeStat.revenue)}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-gray-900">{storeStat.ordersInPeriod}</p>
                    <p className="text-xs text-gray-400">Total: {storeStat.orders}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {storeStat.subscribers}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {storeStat.products}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {storeStat.store.is_hidden ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                        <EyeOff size={12} />
                        Oculta
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                        <Eye size={12} />
                        Visible
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onOpenStoreDashboard(storeStat.store)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
                    >
                      Administrar
                      <ExternalLink size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {stats.storeStats.length === 0 && (
          <div className="p-8 text-center">
            <Store size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No hay tiendas registradas</p>
          </div>
        )}
      </div>

      {/* Revenue Distribution Chart (Visual) */}
      {stats.storeStats.length > 0 && stats.revenueInPeriod > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Distribución de Ingresos</h3>
          <div className="space-y-3">
            {stats.storeStats.slice(0, 5).map((storeStat) => {
              const percentage = (storeStat.revenueInPeriod / stats.revenueInPeriod) * 100;
              return (
                <div key={storeStat.store.domain}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">
                      {storeStat.store.store_name || storeStat.store.domain}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: storeStat.store.theme_color || '#9333EA',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
