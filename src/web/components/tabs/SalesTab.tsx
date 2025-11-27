/**
 * Sales Tab Component
 *
 * Muestra los pedidos de la tienda (reales y de prueba)
 * con información del comprador
 */

import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Loader2,
  RefreshCw,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  DollarSign,
  User,
  Mail,
  ExternalLink,
  FlaskConical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { supabaseWeb as supabase } from '../../../lib/supabaseWeb';
import type { Store } from '../../types';

interface SalesTabProps {
  store: Store;
}

interface Order {
  id: string;
  order_number?: string;
  shopify_order_id?: string;
  shopify_order_number?: string;
  user_id?: string;
  store_domain: string;
  status: string;
  total_price: number;
  currency: string;
  items: any[];
  shipping_address?: any;
  created_at: string;
  updated_at?: string;
  // Buyer info
  buyer_name?: string;
  buyer_email?: string;
  // Source
  is_test?: boolean;
}

export default function SalesTab({ store }: SalesTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    loadOrders();
  }, [store.domain]);

  async function loadOrders() {
    setLoading(true);
    console.log('📦 [SalesTab] Loading orders for store:', store.domain);
    try {
      // 1. Get orders from shopify_orders
      const { data: shopifyOrders, error: ordersError } = await supabase
        .from('shopify_orders')
        .select('*')
        .eq('store_domain', store.domain)
        .order('created_at', { ascending: false })
        .limit(50);

      console.log('📦 [SalesTab] shopify_orders query:', {
        storeDomain: store.domain,
        ordersCount: shopifyOrders?.length || 0,
        data: shopifyOrders,
        error: ordersError
      });

      if (ordersError) {
        console.error('❌ [SalesTab] Error fetching shopify_orders:', ordersError);
      }

      // 2. Get transaction info for these orders
      const transactionIds = shopifyOrders?.map(o => o.transaction_id).filter(Boolean) || [];
      const uniqueTransactionIds = [...new Set(transactionIds)];
      let transactionsMap: Record<number, any> = {};

      if (uniqueTransactionIds.length > 0) {
        // Query transactions - include buyer_name, buyer_email, shipping_address
        const { data: transData, error: transError } = await supabase
          .from('transactions')
          .select('id, user_id, status, buyer_name, buyer_email, buyer_phone, shipping_address')
          .in('id', uniqueTransactionIds);

        console.log('📦 [SalesTab] transactions query:', {
          ids: uniqueTransactionIds,
          data: transData,
          error: transError
        });

        if (transData) {
          transData.forEach(t => {
            transactionsMap[t.id] = t;
          });
        }
      }

      // 3. Get user info for all user_ids
      const userIds = new Set<string>();
      Object.values(transactionsMap).forEach((t: any) => {
        if (t.user_id) userIds.add(t.user_id);
      });

      let usersMap: Record<string, { full_name: string | null; email: string | null }> = {};

      if (userIds.size > 0) {
        // Get from user_profiles
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', Array.from(userIds));

        profiles?.forEach(p => {
          usersMap[p.id] = { full_name: p.full_name, email: null };
        });

        // Note: emails come from transaction.buyer_email, not from RPC
        // The RPC get_users_emails may not exist, so we skip it
      }

      // 4. Normalize orders
      const normalizedOrders: Order[] = [];
      console.log('📦 [SalesTab] Starting normalization, shopifyOrders count:', shopifyOrders?.length || 0);

      // Orders from shopify_orders
      shopifyOrders?.forEach((so: any) => {
        const transaction = transactionsMap[so.transaction_id] || {};
        const userId = transaction.user_id;
        const user = userId ? usersMap[userId] || {} : {};
        const shippingAddress = transaction.shipping_address || {};

        // Buyer info comes directly from transaction (buyer_name, buyer_email)
        // or fallback to user profile
        const buyerName = transaction.buyer_name || user.full_name || null;
        const buyerEmail = transaction.buyer_email || user.email || null;
        const buyerPhone = transaction.buyer_phone || null;

        normalizedOrders.push({
          id: String(so.id),
          order_number: so.shopify_order_number,
          shopify_order_id: so.shopify_order_id,
          shopify_order_number: so.shopify_order_number,
          user_id: userId,
          store_domain: so.store_domain,
          status: transaction.status === 'approved' ? 'completed' : so.status || 'pending',
          total_price: so.order_amount || 0,
          currency: 'CLP',
          items: so.order_items || [],
          shipping_address: { ...shippingAddress, phone: buyerPhone },
          created_at: so.created_at,
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          is_test: so.shopify_order_id?.startsWith('test_'),
        });
      });

      // Sort by date descending
      normalizedOrders.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      console.log('📦 [SalesTab] Setting orders state with', normalizedOrders.length, 'orders');
      setOrders(normalizedOrders);

      // Calculate stats
      const pending = normalizedOrders.filter(
        o => o.status === 'pending' || o.status === 'processing' || o.status === 'created'
      ).length;
      const completed = normalizedOrders.filter(
        o => o.status === 'completed' || o.status === 'delivered' || o.status === 'approved'
      ).length;
      const revenue = normalizedOrders.reduce((acc, o) => acc + (o.total_price || 0), 0);

      setStats({
        total: normalizedOrders.length,
        pending,
        completed,
        totalRevenue: revenue,
      });
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatPrice(price: number, currency = 'CLP') {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(price);
  }

  function getStatusBadge(status: string) {
    const statusConfig: Record<string, { bg: string; text: string; icon: any; label: string }> = {
      pending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock, label: 'Pendiente' },
      created: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock, label: 'Creado' },
      processing: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Package, label: 'Procesando' },
      shipped: { bg: 'bg-purple-100', text: 'text-purple-700', icon: Truck, label: 'Enviado' },
      delivered: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Entregado' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Completado' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Aprobado' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Cancelado' },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon size={12} />
        {config.label}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="animate-spin text-green-600 mb-2" size={32} />
        <p className="text-gray-500">Cargando pedidos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
          <ShoppingCart size={20} className="text-green-600" />
          Pedidos de la Tienda
        </h3>
        <button
          onClick={loadOrders}
          className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 text-gray-300 text-sm mb-2">
            <ShoppingCart size={18} />
            <span>Total pedidos</span>
          </div>
          <p className="text-3xl font-bold">{stats.total}</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 text-amber-100 text-sm mb-2">
            <Clock size={18} />
            <span>Pendientes</span>
          </div>
          <p className="text-3xl font-bold">{stats.pending}</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 text-green-100 text-sm mb-2">
            <CheckCircle size={18} />
            <span>Completados</span>
          </div>
          <p className="text-3xl font-bold">{stats.completed}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 text-purple-100 text-sm mb-2">
            <DollarSign size={18} />
            <span>Ingresos totales</span>
          </div>
          <p className="text-xl font-bold">{formatPrice(stats.totalRevenue)}</p>
        </div>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
          <ShoppingCart className="mx-auto text-gray-400 mb-3" size={48} />
          <p className="text-gray-500 font-medium">No hay pedidos aún</p>
          <p className="text-sm text-gray-400 mt-1">
            Los pedidos realizados desde la app aparecerán aquí
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isExpanded = expandedOrder === order.id;

            return (
              <div
                key={order.id}
                className={`bg-white border-2 rounded-xl overflow-hidden transition-all ${
                  isExpanded ? 'border-green-400 shadow-lg' : 'border-gray-200 hover:border-green-300'
                }`}
              >
                {/* Order Header - Clickable */}
                <button
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Order Number */}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900">
                            {order.shopify_order_number || order.order_number || `#${order.id.slice(0, 8)}`}
                          </p>
                          {order.is_test && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                              <FlaskConical size={10} />
                              Prueba
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                      </div>

                      {/* Buyer Info */}
                      <div className="hidden sm:block border-l border-gray-200 pl-4">
                        <div className="flex items-center gap-2 text-sm">
                          <User size={14} className="text-gray-400" />
                          <span className="text-gray-900 font-medium">
                            {order.buyer_name || 'Sin nombre'}
                          </span>
                        </div>
                        {order.buyer_email && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Mail size={12} className="text-gray-400" />
                            <span>{order.buyer_email}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Status */}
                      {getStatusBadge(order.status)}

                      {/* Total */}
                      <p className="font-bold text-gray-900 text-lg">
                        {formatPrice(order.total_price, order.currency)}
                      </p>

                      {/* Expand Icon */}
                      {isExpanded ? (
                        <ChevronUp size={20} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={20} className="text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Buyer Info */}
                      <div>
                        <h5 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                          <User size={12} />
                          Comprador
                        </h5>
                        <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                          <div>
                            <span className="text-gray-500">Nombre:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {order.buyer_name || order.shipping_address?.fullName || 'No disponible'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Email:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {order.buyer_email || order.shipping_address?.email || 'No disponible'}
                            </span>
                          </div>
                          {order.shipping_address?.phone && (
                            <div>
                              <span className="text-gray-500">Teléfono:</span>
                              <span className="ml-2 font-medium text-gray-900">
                                {order.shipping_address.phone}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Products */}
                      <div>
                        <h5 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                          <Package size={12} />
                          Productos ({order.items?.length || 0})
                        </h5>
                        <div className="bg-white rounded-lg p-3 max-h-32 overflow-y-auto">
                          {order.items && order.items.length > 0 ? (
                            <div className="space-y-2">
                              {order.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 text-sm">
                                  {item.images?.[0] || item.imagePrompt ? (
                                    <img
                                      src={item.images?.[0] || `https://picsum.photos/seed/${item.imagePrompt}/40/40`}
                                      alt=""
                                      className="w-8 h-8 rounded object-cover"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center">
                                      <Package size={12} className="text-gray-400" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-gray-900 truncate text-xs">
                                      {item.name || item.title}
                                    </p>
                                    <p className="text-gray-500 text-xs">
                                      x{item.quantity} · {formatPrice(item.price || item.selectedVariant?.price || 0)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 text-center py-2">Sin items</p>
                          )}
                        </div>
                      </div>

                      {/* Shopify Link */}
                      <div>
                        <h5 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                          <ExternalLink size={12} />
                          Shopify
                        </h5>
                        <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                          {order.shopify_order_id && !order.is_test ? (
                            <>
                              <div>
                                <span className="text-gray-500">ID Shopify:</span>
                                <span className="ml-2 font-mono text-xs text-gray-900">
                                  {order.shopify_order_id}
                                </span>
                              </div>
                              <a
                                href={`https://${store.domain}/admin/orders/${order.shopify_order_id.replace('gid://shopify/Order/', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 font-medium"
                              >
                                <ExternalLink size={14} />
                                Ver en Shopify Admin
                              </a>
                            </>
                          ) : order.is_test ? (
                            <div className="flex items-center gap-2 text-amber-600">
                              <FlaskConical size={16} />
                              <span className="text-sm">Pedido de prueba (no sincronizado con Shopify)</span>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">No sincronizado aún</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Shipping Address */}
                    {order.shipping_address && (order.shipping_address.address || order.shipping_address.street) && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h5 className="text-xs font-bold text-gray-500 mb-2">Dirección de envío</h5>
                        <p className="text-sm text-gray-700">
                          {order.shipping_address.address || order.shipping_address.street}
                          {order.shipping_address.city && `, ${order.shipping_address.city}`}
                          {order.shipping_address.region && `, ${order.shipping_address.region}`}
                          {(order.shipping_address.zipCode || order.shipping_address.zip_code) && ` (${order.shipping_address.zipCode || order.shipping_address.zip_code})`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-700">
          <strong>Nota:</strong> Los pedidos de prueba (marcados con <FlaskConical size={12} className="inline" />)
          no se sincronizan con Shopify. En producción, solo aparecerán pedidos reales con enlace directo al Admin de Shopify.
        </p>
      </div>
    </div>
  );
}
