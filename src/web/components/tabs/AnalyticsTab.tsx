/**
 * Analytics Tab Component (Dashboard Principal)
 *
 * Dashboard con métricas de la tienda, ventas, suscriptores y campañas
 * Con filtro de fechas interactivo estilo Shopify
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Package,
  ShoppingCart,
  Users,
  Loader2,
  RefreshCw,
  DollarSign,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  FlaskConical,
  Clock,
} from 'lucide-react';
import { supabaseWeb as supabase } from '../../../lib/supabaseWeb';
import type { Store } from '../../types';

interface AnalyticsTabProps {
  store: Store;
}

interface Order {
  id: number;
  store_domain: string;
  order_amount: number;
  shopify_order_id: string;
  shopify_order_number: string;
  status: string;
  created_at: string;
  transaction_id: number;
  buyer_name?: string;
  is_test?: boolean;
}

interface StoreStats {
  totalProducts: number;
  availableProducts: number;
  totalSubscribers: number;
  totalNotifications: number;
  // Period-specific stats
  ordersInPeriod: number;
  revenueInPeriod: number;
  // Comparison with previous period
  ordersChange: number; // percentage
  revenueChange: number; // percentage
  // All time
  totalOrders: number;
  totalRevenue: number;
  lastSync: string | null;
  recentOrders: Order[];
  recentCampaigns: any[];
}

type DateRangePreset = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

// Presets fijos (rangos específicos)
const DATE_PRESETS_FIXED: { id: DateRangePreset; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: 'last7days', label: 'Últimos 7 días' },
  { id: 'last30days', label: 'Últimos 30 días' },
  { id: 'thisMonth', label: 'Este mes' },
  { id: 'lastMonth', label: 'Mes anterior' },
];

// Nombres de meses en español
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const DAY_NAMES = ['dom.', 'lun.', 'mar.', 'miérc.', 'juev.', 'vier.', 'sáb.'];

function getDateRange(preset: DateRangePreset, customStart?: Date, customEnd?: Date): DateRange {
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
    case 'custom':
      return {
        start: customStart || today,
        end: customEnd || tomorrow,
        label: 'Personalizado',
      };
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

// Helper para generar días del calendario
function getCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = firstDay.getDay();

  const days: (Date | null)[] = [];

  // Días vacíos antes del primer día del mes
  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }

  // Días del mes
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  return days;
}

// Helper para comparar fechas (solo día)
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// Helper para verificar si una fecha está en el rango
function isInRange(date: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const dateTime = date.getTime();
  return dateTime >= start.getTime() && dateTime <= end.getTime();
}

// Helper para formatear fecha como "1 de noviembre de 2025"
function formatDateLong(date: Date): string {
  return `${date.getDate()} de ${MONTH_NAMES[date.getMonth()]} de ${date.getFullYear()}`;
}

export default function AnalyticsTab({ store }: AnalyticsTabProps) {
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('today');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Estado del calendario
  const [pickerTab, setPickerTab] = useState<'fixed' | 'continuous'>('fixed');
  const [calendarMonth1, setCalendarMonth1] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1); // Mes anterior
  });
  const [calendarMonth2, setCalendarMonth2] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1); // Mes actual
  });

  // Selección temporal mientras el usuario está eligiendo
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);

  // Fecha confirmada para custom range
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  const dateRange = useMemo(() => {
    if (selectedPreset === 'custom' && customStartDate && customEndDate) {
      return getDateRange('custom', customStartDate, customEndDate);
    }
    return getDateRange(selectedPreset);
  }, [selectedPreset, customStartDate, customEndDate]);

  useEffect(() => {
    loadStats();
  }, [store.domain, dateRange.start.toISOString(), dateRange.end.toISOString()]);

  async function loadStats() {
    setLoading(true);
    try {
      const prevPeriod = getPreviousPeriod(dateRange);

      // Load all data in parallel
      const [
        productsResult,
        subscribersResult,
        notificationsResult,
        ordersResult,
        prevOrdersResult,
        transactionsResult,
        syncLogsResult,
        recentCampaignsResult,
      ] = await Promise.all([
        // Products
        supabase
          .from('products')
          .select('id, available', { count: 'exact' })
          .eq('store_domain', store.domain),
        // Subscribers
        supabase
          .from('store_subscriptions')
          .select('id')
          .eq('store_domain', store.domain)
          .is('unsubscribed_at', null),
        // Notifications count
        supabase
          .from('notifications_sent')
          .select('id', { count: 'exact' })
          .eq('store_id', store.domain),
        // Orders in current period from shopify_orders
        supabase
          .from('shopify_orders')
          .select('*')
          .eq('store_domain', store.domain)
          .gte('created_at', dateRange.start.toISOString())
          .lt('created_at', dateRange.end.toISOString())
          .order('created_at', { ascending: false }),
        // Orders in previous period for comparison
        supabase
          .from('shopify_orders')
          .select('id, order_amount')
          .eq('store_domain', store.domain)
          .gte('created_at', prevPeriod.start.toISOString())
          .lt('created_at', prevPeriod.end.toISOString()),
        // Get transactions for buyer info
        supabase
          .from('transactions')
          .select('id, buyer_name, buyer_email, status')
          .order('created_at', { ascending: false })
          .limit(100),
        // Last sync
        supabase
          .from('sync_logs')
          .select('*')
          .eq('store_domain', store.domain)
          .order('started_at', { ascending: false })
          .limit(1),
        // Recent campaigns
        supabase
          .from('notifications_sent')
          .select('*')
          .eq('store_id', store.domain)
          .order('sent_at', { ascending: false })
          .limit(3),
      ]);

      // Also get all orders for total
      const { data: allOrders } = await supabase
        .from('shopify_orders')
        .select('id, order_amount')
        .eq('store_domain', store.domain);

      const products = productsResult.data || [];
      const availableCount = products.filter((p: any) => p.available).length;
      const currentOrders = ordersResult.data || [];
      const prevOrders = prevOrdersResult.data || [];

      // Build transactions map for buyer names
      const transactionsMap: Record<number, any> = {};
      (transactionsResult.data || []).forEach((t: any) => {
        transactionsMap[t.id] = t;
      });

      // Calculate current period metrics
      const revenueInPeriod = currentOrders.reduce(
        (sum: number, order: any) => sum + (order.order_amount || 0),
        0
      );

      // Calculate previous period metrics
      const prevRevenue = prevOrders.reduce(
        (sum: number, order: any) => sum + (order.order_amount || 0),
        0
      );

      // Calculate percentage changes
      const ordersChange = prevOrders.length > 0
        ? ((currentOrders.length - prevOrders.length) / prevOrders.length) * 100
        : currentOrders.length > 0 ? 100 : 0;

      const revenueChange = prevRevenue > 0
        ? ((revenueInPeriod - prevRevenue) / prevRevenue) * 100
        : revenueInPeriod > 0 ? 100 : 0;

      // Total all time
      const totalRevenue = (allOrders || []).reduce(
        (sum: number, order: any) => sum + (order.order_amount || 0),
        0
      );

      // Enrich orders with buyer info
      const enrichedOrders: Order[] = currentOrders.slice(0, 5).map((order: any) => {
        const transaction = transactionsMap[order.transaction_id] || {};
        return {
          ...order,
          buyer_name: transaction.buyer_name || 'Cliente',
          is_test: order.shopify_order_id?.startsWith('test_'),
        };
      });

      setStats({
        totalProducts: productsResult.count || 0,
        availableProducts: availableCount,
        totalSubscribers: subscribersResult.data?.length ?? 0,
        totalNotifications: notificationsResult.count || 0,
        ordersInPeriod: currentOrders.length,
        revenueInPeriod,
        ordersChange,
        revenueChange,
        totalOrders: allOrders?.length || 0,
        totalRevenue,
        lastSync: syncLogsResult.data?.[0]?.completed_at || null,
        recentOrders: enrichedOrders,
        recentCampaigns: recentCampaignsResult.data || [],
      });
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
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

  function formatDate(dateString: string | null) {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return date.toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatRelativeDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Hace menos de 1 hora';
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    return formatDate(dateString);
  }

  function formatDateShort(date: Date) {
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
    });
  }

  function handlePresetSelect(preset: DateRangePreset) {
    setSelectedPreset(preset);
    setShowDatePicker(false);
  }

  function handleCalendarDayClick(date: Date) {
    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      // Primera selección o reinicio
      setTempStartDate(date);
      setTempEndDate(null);
    } else {
      // Segunda selección
      if (date < tempStartDate) {
        setTempEndDate(tempStartDate);
        setTempStartDate(date);
      } else {
        setTempEndDate(date);
      }
    }
  }

  function handleApplyCustomRange() {
    if (tempStartDate && tempEndDate) {
      setCustomStartDate(tempStartDate);
      // Añadir 23:59:59 al final del día
      const endWithTime = new Date(tempEndDate);
      endWithTime.setHours(23, 59, 59, 999);
      setCustomEndDate(endWithTime);
      setSelectedPreset('custom');
      setShowDatePicker(false);
    }
  }

  function navigateCalendar(direction: 'prev' | 'next') {
    const offset = direction === 'prev' ? -1 : 1;
    setCalendarMonth1(new Date(calendarMonth1.getFullYear(), calendarMonth1.getMonth() + offset, 1));
    setCalendarMonth2(new Date(calendarMonth2.getFullYear(), calendarMonth2.getMonth() + offset, 1));
  }

  function openDatePicker() {
    // Inicializar temp dates con las fechas actuales si hay custom range
    if (selectedPreset === 'custom' && customStartDate && customEndDate) {
      setTempStartDate(customStartDate);
      setTempEndDate(customEndDate);
    } else {
      setTempStartDate(null);
      setTempEndDate(null);
    }
    setShowDatePicker(true);
  }

  // Renderizar un calendario de un mes
  function renderCalendarMonth(monthDate: Date) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const days = getCalendarDays(year, month);
    const today = new Date();

    return (
      <div className="flex-1">
        <div className="text-center font-medium text-gray-900 mb-3">
          {MONTH_NAMES[month]} {year}
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAY_NAMES.map((day) => (
            <div key={day} className="text-center text-xs text-gray-400 py-1">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="h-8" />;
            }

            const isToday = isSameDay(day, today);
            const isStart = tempStartDate && isSameDay(day, tempStartDate);
            const isEnd = tempEndDate && isSameDay(day, tempEndDate);
            const inRange = isInRange(day, tempStartDate, tempEndDate);
            const isFuture = day > today;

            return (
              <button
                key={day.toISOString()}
                onClick={() => !isFuture && handleCalendarDayClick(day)}
                disabled={isFuture}
                className={`h-8 text-sm rounded transition-colors relative
                  ${isFuture ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-purple-50'}
                  ${isStart || isEnd ? 'bg-gray-900 text-white hover:bg-gray-800' : ''}
                  ${inRange && !isStart && !isEnd ? 'bg-purple-100 text-purple-900' : ''}
                  ${!isStart && !isEnd && !inRange && !isFuture ? 'text-gray-700' : ''}
                `}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="animate-spin text-purple-600 mb-2" size={32} />
        <p className="text-gray-500">Cargando dashboard...</p>
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
      {/* Welcome Banner with Date Picker */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-6 text-white">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">
              Dashboard de {store.store_name || store.domain}
            </h2>
            <p className="text-purple-200 text-sm">
              Última sincronización: {formatDate(stats.lastSync)}
            </p>
          </div>

          {/* Date Range Selector */}
          <div className="relative">
            <button
              onClick={openDatePicker}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
            >
              <Calendar size={16} />
              <span>
                {selectedPreset === 'custom'
                  ? `${formatDateShort(dateRange.start)} - ${formatDateShort(dateRange.end)}`
                  : dateRange.label}
              </span>
              <ChevronDown size={16} />
            </button>

            {/* Date Picker Dropdown - Estilo Shopify */}
            {showDatePicker && (
              <div className="absolute right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden" style={{ width: '720px' }}>
                <div className="flex">
                  {/* Left Panel - Presets */}
                  <div className="w-48 border-r border-gray-200 bg-gray-50">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200">
                      <button
                        onClick={() => setPickerTab('fixed')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                          pickerTab === 'fixed'
                            ? 'text-gray-900 bg-white border-b-2 border-gray-900'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Fijos
                      </button>
                      <button
                        onClick={() => setPickerTab('continuous')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                          pickerTab === 'continuous'
                            ? 'text-gray-900 bg-white border-b-2 border-gray-900'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Continuos
                      </button>
                    </div>

                    {/* Preset List */}
                    <div className="py-2">
                      {DATE_PRESETS_FIXED.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handlePresetSelect(preset.id)}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                            selectedPreset === preset.id && !tempStartDate
                              ? 'bg-purple-50 text-purple-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right Panel - Calendar */}
                  <div className="flex-1 p-4">
                    {/* Date Range Inputs */}
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                      <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                        {tempStartDate ? formatDateLong(tempStartDate) : 'Fecha inicio'}
                      </div>
                      <span className="text-gray-400">→</span>
                      <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                        {tempEndDate ? formatDateLong(tempEndDate) : 'Fecha fin'}
                      </div>
                      <button className="p-2 hover:bg-gray-100 rounded-lg">
                        <Clock size={18} className="text-gray-400" />
                      </button>
                    </div>

                    {/* Calendar Navigation */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => navigateCalendar('prev')}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronLeft size={20} className="text-gray-600" />
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={() => navigateCalendar('next')}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronRight size={20} className="text-gray-600" />
                      </button>
                    </div>

                    {/* Two Month Calendar */}
                    <div className="flex gap-8">
                      {renderCalendarMonth(calendarMonth1)}
                      {renderCalendarMonth(calendarMonth2)}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleApplyCustomRange}
                    disabled={!tempStartDate || !tempEndDate}
                    className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
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
          <p className="text-2xl font-bold text-gray-900">{stats.ordersInPeriod}</p>
          <p className="text-sm text-gray-500 mt-1">Pedidos - {dateRange.label}</p>
          <p className="text-xs text-gray-400 mt-2">Total histórico: {stats.totalOrders}</p>
        </div>

        {/* Subscribers */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users size={20} className="text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalSubscribers}</p>
          <p className="text-sm text-gray-500 mt-1">Suscriptores activos</p>
          <p className="text-xs text-gray-400 mt-2">Reciben notificaciones push</p>
        </div>

        {/* Products */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Package size={20} className="text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.availableProducts}</p>
          <p className="text-sm text-gray-500 mt-1">Productos disponibles</p>
          <p className="text-xs text-gray-400 mt-2">De {stats.totalProducts} totales</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Pedidos Recientes</h3>
            <span className="text-xs text-gray-500">{stats.ordersInPeriod} en período</span>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.recentOrders.length === 0 ? (
              <div className="p-8 text-center">
                <ShoppingCart size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No hay pedidos en este período</p>
                <p className="text-gray-400 text-xs mt-1">
                  Prueba seleccionando un rango de fechas diferente
                </p>
              </div>
            ) : (
              stats.recentOrders.map((order) => (
                <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm">
                          {order.buyer_name}
                        </p>
                        {order.is_test && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                            <FlaskConical size={10} />
                            Prueba
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        #{order.shopify_order_number || `ORD-${order.id}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(order.order_amount || 0)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatRelativeDate(order.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Campaigns */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Campañas Push Recientes</h3>
            <span className="text-xs text-gray-500">{stats.totalNotifications} enviadas</span>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.recentCampaigns.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No hay campañas aún</p>
                <p className="text-gray-400 text-xs mt-1">
                  Envía tu primera notificación push
                </p>
              </div>
            ) : (
              stats.recentCampaigns.map((campaign) => (
                <div key={campaign.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {campaign.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {campaign.body}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-medium text-gray-900">
                        {campaign.total_sent || 0} enviados
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatRelativeDate(campaign.sent_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Product Availability Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Disponibilidad de Inventario</h3>
          <span className="text-sm text-gray-500">
            {stats.totalProducts > 0
              ? `${Math.round((stats.availableProducts / stats.totalProducts) * 100)}%`
              : '0%'}
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500"
            style={{
              width: `${
                stats.totalProducts > 0
                  ? (stats.availableProducts / stats.totalProducts) * 100
                  : 0
              }%`,
            }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {stats.availableProducts} de {stats.totalProducts} productos disponibles para venta
        </p>
      </div>
    </div>
  );
}
