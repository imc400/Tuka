/**
 * Sales Tab Component
 *
 * Muestra los pedidos de la tienda
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
  MapPin,
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
  user_id: string;
  store_domain: string;
  status: string;
  total_price: number;
  currency: string;
  items: any[];
  shipping_address?: any;
  created_at: string;
  updated_at?: string;
}

export default function SalesTab({ store }: SalesTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
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
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('store_domain', store.domain)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error cargando pedidos:', error);
        return;
      }

      const ordersList = data || [];
      setOrders(ordersList);

      // Calcular estadísticas
      const pending = ordersList.filter(
        (o) => o.status === 'pending' || o.status === 'processing'
      ).length;
      const completed = ordersList.filter(
        (o) => o.status === 'completed' || o.status === 'delivered'
      ).length;
      const revenue = ordersList.reduce((acc, o) => acc + (o.total_price || 0), 0);

      setStats({
        total: ordersList.length,
        pending,
        completed,
        totalRevenue: revenue,
      });
    } catch (error) {
      console.error('Error:', error);
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
      processing: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Package, label: 'Procesando' },
      shipped: { bg: 'bg-purple-100', text: 'text-purple-700', icon: Truck, label: 'Enviado' },
      delivered: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Entregado' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Completado' },
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
        <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Pedido
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Productos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          #{order.order_number || order.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <User size={10} />
                          {order.user_id.slice(0, 8)}...
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        {order.items && order.items.length > 0 ? (
                          <div>
                            <p className="text-gray-900">
                              {order.items.length} producto{order.items.length > 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-gray-500 truncate max-w-[200px]">
                              {order.items.map((item: any) => item.title || item.name).join(', ')}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">Sin items</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-gray-900">
                        {formatPrice(order.total_price, order.currency)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-600">{formatDate(order.created_at)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-700">
          <strong>Nota:</strong> Los pedidos se crean automáticamente desde la app móvil cuando
          los usuarios realizan compras. Para gestionar pedidos completos, usa el Admin de Shopify.
        </p>
      </div>
    </div>
  );
}
