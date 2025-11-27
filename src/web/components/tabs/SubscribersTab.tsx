/**
 * Subscribers Tab Component
 *
 * Lista de suscriptores de la tienda con información detallada
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Loader2,
  RefreshCw,
  Smartphone,
  Mail,
  ShoppingCart,
  Bell,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  Apple,
  Chrome,
} from 'lucide-react';
import { supabaseWeb as supabase } from '../../../lib/supabaseWeb';
import type { Store } from '../../types';

interface SubscribersTabProps {
  store: Store;
}

interface Subscriber {
  id: string;
  user_id: string;
  subscribed_at: string;
  // User info
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  auth_provider: string | null;
  // Device info
  device_os: string | null;
  push_token_active: boolean;
  // Stats
  total_orders: number;
  total_spent: number;
  notifications_received: number;
  last_notification_at: string | null;
  last_order_at: string | null;
}

export default function SubscribersTab({ store }: SubscribersTabProps) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'subscribed_at' | 'total_orders' | 'total_spent'>('subscribed_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadSubscribers();
  }, [store.domain]);

  async function loadSubscribers() {
    setLoading(true);
    try {
      // 1. Get subscribers with email using RPC (includes auth.users email)
      const { data: subscribersData, error: subError } = await supabase
        .rpc('get_store_subscribers_with_email', { p_store_domain: store.domain });

      if (subError) {
        console.error('Error loading subscribers via RPC:', subError);
        // Fallback to direct query without email
        await loadSubscribersFallback();
        return;
      }

      if (!subscribersData || subscribersData.length === 0) {
        setSubscribers([]);
        setLoading(false);
        return;
      }

      const userIds = subscribersData.map((s: any) => s.user_id);

      // 2. Get orders for this store by these users
      // Query both orders table (webhooks) and shopify_orders (test orders via transactions)
      const [ordersRes, shopifyOrdersRes] = await Promise.all([
        supabase
          .from('orders')
          .select('user_id, total_price, created_at')
          .eq('store_domain', store.domain)
          .in('user_id', userIds),
        supabase
          .from('transactions')
          .select('user_id, shopify_orders!inner(order_amount, store_domain, created_at)')
          .eq('shopify_orders.store_domain', store.domain)
          .in('user_id', userIds)
          .eq('status', 'approved'),
      ]);

      // Combine orders from both sources
      const orders = ordersRes.data || [];
      const testOrders = (shopifyOrdersRes.data || []).flatMap((t: any) =>
        (t.shopify_orders || []).map((so: any) => ({
          user_id: t.user_id,
          total_price: so.order_amount,
          created_at: so.created_at,
        }))
      );
      const allOrders = [...orders, ...testOrders];

      // 3. Get notifications sent to this store (to count per user from recipients array)
      const { data: notificationsSent, error: notifError } = await supabase
        .from('notifications_sent')
        .select('id, recipients, created_at')
        .eq('store_id', store.domain)
        .order('created_at', { ascending: false });

      // Map data to subscribers
      const subscriberList: Subscriber[] = subscribersData.map((sub: any) => {
        const userOrders = allOrders.filter((o) => o.user_id === sub.user_id);

        // Count notifications received by this user (check recipients array)
        let notificationsReceived = 0;
        let lastNotificationAt: string | null = null;

        if (notificationsSent) {
          for (const notif of notificationsSent) {
            const recipients = notif.recipients || [];
            const wasRecipient = recipients.some((r: any) => r.user_id === sub.user_id);
            if (wasRecipient) {
              notificationsReceived++;
              if (!lastNotificationAt) {
                lastNotificationAt = notif.created_at;
              }
            }
          }
        }

        const totalSpent = userOrders.reduce(
          (sum, o) => sum + (parseFloat(o.total_price) || 0),
          0
        );
        const lastOrder = userOrders.length > 0
          ? userOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          : null;

        return {
          id: sub.subscription_id,
          user_id: sub.user_id,
          subscribed_at: sub.subscribed_at,
          email: sub.email || null,
          full_name: sub.full_name || null,
          avatar_url: sub.avatar_url || null,
          auth_provider: null, // Could be added to RPC if needed
          device_os: sub.platform || null,
          push_token_active: sub.push_token_active || false,
          total_orders: userOrders.length,
          total_spent: totalSpent,
          notifications_received: notificationsReceived,
          last_notification_at: lastNotificationAt,
          last_order_at: lastOrder?.created_at || null,
        };
      });

      setSubscribers(subscriberList);
    } catch (error) {
      console.error('Error loading subscribers:', error);
    } finally {
      setLoading(false);
    }
  }

  // Fallback method if RPC is not available
  async function loadSubscribersFallback() {
    try {
      const { data: subscriptions, error } = await supabase
        .from('store_subscriptions')
        .select('id, user_id, subscribed_at')
        .eq('store_domain', store.domain)
        .is('unsubscribed_at', null);

      if (error || !subscriptions || subscriptions.length === 0) {
        setSubscribers([]);
        setLoading(false);
        return;
      }

      const userIds = subscriptions.map((s) => s.user_id);

      const [profilesRes, tokensRes, ordersRes] = await Promise.all([
        supabase.from('user_profiles').select('id, full_name, avatar_url').in('id', userIds),
        supabase.from('user_push_tokens').select('user_id, platform, is_active').in('user_id', userIds),
        supabase.from('orders').select('user_id, total_price, created_at').eq('store_domain', store.domain).in('user_id', userIds),
      ]);

      const subscriberList: Subscriber[] = subscriptions.map((sub) => {
        const profile = profilesRes.data?.find((p) => p.id === sub.user_id);
        const token = tokensRes.data?.find((t) => t.user_id === sub.user_id);
        const userOrders = ordersRes.data?.filter((o) => o.user_id === sub.user_id) || [];

        return {
          id: sub.id,
          user_id: sub.user_id,
          subscribed_at: sub.subscribed_at,
          email: null,
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
          auth_provider: null,
          device_os: token?.platform || null,
          push_token_active: token?.is_active || false,
          total_orders: userOrders.length,
          total_spent: userOrders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0),
          notifications_received: 0,
          last_notification_at: null,
          last_order_at: userOrders.length > 0 ? userOrders[0].created_at : null,
        };
      });

      setSubscribers(subscriberList);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function getDeviceIcon(os: string | null) {
    if (!os) return <Smartphone size={16} className="text-gray-400" />;
    if (os.toLowerCase() === 'ios') return <Apple size={16} className="text-gray-700" />;
    if (os.toLowerCase() === 'android') return <Smartphone size={16} className="text-green-600" />;
    return <Chrome size={16} className="text-blue-500" />;
  }

  function getAuthProviderLabel(provider: string | null) {
    if (!provider) return 'Email';
    if (provider.includes('google')) return 'Google';
    if (provider.includes('apple')) return 'Apple';
    return provider;
  }

  // Filter and sort
  const filteredSubscribers = subscribers
    .filter((sub) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        sub.email?.toLowerCase().includes(query) ||
        sub.full_name?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'subscribed_at') {
        comparison = new Date(a.subscribed_at).getTime() - new Date(b.subscribed_at).getTime();
      } else if (sortBy === 'total_orders') {
        comparison = a.total_orders - b.total_orders;
      } else if (sortBy === 'total_spent') {
        comparison = a.total_spent - b.total_spent;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="animate-spin text-purple-600 mb-2" size={32} />
        <p className="text-gray-500">Cargando suscriptores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Suscriptores</h2>
          <p className="text-sm text-gray-500">{subscribers.length} suscriptores activos</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por email o nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none w-64"
            />
          </div>
          <button
            onClick={loadSubscribers}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Table */}
      {filteredSubscribers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No hay suscriptores aún</p>
          <p className="text-gray-400 text-sm mt-1">
            Los usuarios que se suscriban a esta tienda aparecerán aquí
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Suscriptor
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Dispositivo
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Auth
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleSort('subscribed_at')}
                  >
                    <div className="flex items-center gap-1">
                      Suscrito
                      {sortBy === 'subscribed_at' && (
                        sortOrder === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleSort('total_orders')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Pedidos
                      {sortBy === 'total_orders' && (
                        sortOrder === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                      )}
                    </div>
                  </th>
                  <th
                    className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleSort('total_spent')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total Gastado
                      {sortBy === 'total_spent' && (
                        sortOrder === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />
                      )}
                    </div>
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Notif.
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Última Notif.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSubscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                    {/* Subscriber Info */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Status indicator - green if push active, red if not */}
                        <div
                          className={`w-3 h-3 rounded-full flex-shrink-0 ${
                            sub.push_token_active ? 'bg-green-500' : 'bg-red-400'
                          }`}
                          title={sub.push_token_active ? 'Push activo' : 'Push inactivo'}
                        />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {sub.full_name || 'Sin nombre'}
                          </p>
                          <p className="text-xs text-gray-500">{sub.email || 'Sin email'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Device */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(sub.device_os)}
                        <span className="text-sm text-gray-600 capitalize">
                          {sub.device_os || '-'}
                        </span>
                      </div>
                    </td>

                    {/* Auth Provider */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {getAuthProviderLabel(sub.auth_provider)}
                      </span>
                    </td>

                    {/* Subscribed Date */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {formatDate(sub.subscribed_at)}
                      </span>
                    </td>

                    {/* Orders */}
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-medium ${sub.total_orders > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {sub.total_orders}
                      </span>
                    </td>

                    {/* Total Spent */}
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${sub.total_spent > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                        {sub.total_spent > 0 ? formatCurrency(sub.total_spent) : '-'}
                      </span>
                    </td>

                    {/* Notifications Received */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-gray-600">
                        {sub.notifications_received}
                      </span>
                    </td>

                    {/* Last Notification */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500">
                        {formatDate(sub.last_notification_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Suscriptores</p>
          <p className="text-2xl font-bold text-gray-900">{subscribers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Con Compras</p>
          <p className="text-2xl font-bold text-green-600">
            {subscribers.filter((s) => s.total_orders > 0).length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">iOS</p>
          <p className="text-2xl font-bold text-gray-900">
            {subscribers.filter((s) => s.device_os?.toLowerCase() === 'ios').length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Android</p>
          <p className="text-2xl font-bold text-gray-900">
            {subscribers.filter((s) => s.device_os?.toLowerCase() === 'android').length}
          </p>
        </div>
      </div>
    </div>
  );
}
