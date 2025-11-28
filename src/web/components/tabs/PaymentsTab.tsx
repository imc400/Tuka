/**
 * Payments Tab Component
 *
 * Dashboard de pagos para tiendas - MODELO MULTI-PAYMENT
 *
 * En este modelo:
 * - Cada tienda recibe sus pagos DIRECTAMENTE en su cuenta de MP
 * - Grumo cobra comisión via application_fee
 * - No hay transferencias pendientes - el dinero llega al instante
 */

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Link2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  ExternalLink,
  AlertTriangle,
  TrendingUp,
  ArrowRightLeft,
  Calendar,
  DollarSign,
  Info,
  Zap,
} from 'lucide-react';
import { supabaseWeb as supabase } from '../../../lib/supabaseWeb';
import type { Store } from '../../types';

interface PaymentsTabProps {
  store: Store;
}

interface StorePaymentV2 {
  id: number;
  store_domain: string;
  transaction_id: number;
  mp_preference_id?: string;
  mp_payment_id?: string;
  mp_collector_id?: string;
  gross_amount: number;
  application_fee: number;
  mp_fee_amount: number;
  net_to_store: number;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'cancelled';
  payment_method?: string;
  shopify_order_id?: string;
  shopify_order_number?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

interface PaymentsSummary {
  totalSales: number;
  totalReceived: number;
  totalFees: number;
  successfulPayments: number;
  pendingPayments: number;
}

// URL base de la API de Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const FUNCTIONS_URL = SUPABASE_URL.replace('/rest/v1', '').replace(/\/$/, '') + '/functions/v1';

// Configuración de MP OAuth
const MP_CLIENT_ID = import.meta.env.VITE_MERCADOPAGO_CLIENT_ID || '';
const MP_REDIRECT_URI = `${FUNCTIONS_URL}/mp-oauth-callback`;

export default function PaymentsTab({ store }: PaymentsTabProps) {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<StorePaymentV2[]>([]);
  const [summary, setSummary] = useState<PaymentsSummary>({
    totalSales: 0,
    totalReceived: 0,
    totalFees: 0,
    successfulPayments: 0,
    pendingPayments: 0,
  });
  const [connecting, setConnecting] = useState(false);
  const [refreshingToken, setRefreshingToken] = useState(false);

  const isConnected = !!store.mp_connected_at;
  const hasCollectorId = !!store.mp_user_id; // mp_user_id es el collector_id
  const tokenExpiresSoon = store.mp_token_expires_at
    ? new Date(store.mp_token_expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    : false;

  useEffect(() => {
    loadData();
  }, [store.domain]);

  async function loadData() {
    setLoading(true);
    try {
      // Cargar pagos de la nueva tabla store_payments_v2
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('store_payments_v2')
        .select('*')
        .eq('store_domain', store.domain)
        .order('created_at', { ascending: false })
        .limit(50);

      if (paymentsError) {
        console.error('Error loading payments:', paymentsError);
      } else {
        setPayments(paymentsData || []);

        // Calcular resumen
        const approved = (paymentsData || []).filter(p => p.status === 'approved');
        const pending = (paymentsData || []).filter(p => ['pending', 'processing'].includes(p.status));

        setSummary({
          totalSales: approved.reduce((sum, p) => sum + p.gross_amount, 0),
          totalReceived: approved.reduce((sum, p) => sum + p.net_to_store, 0),
          totalFees: approved.reduce((sum, p) => sum + p.application_fee, 0),
          successfulPayments: approved.length,
          pendingPayments: pending.length,
        });
      }
    } catch (error) {
      console.error('Error loading payments data:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleConnectMP() {
    if (!MP_CLIENT_ID) {
      alert('Error: Mercado Pago no está configurado');
      return;
    }

    setConnecting(true);

    // Construir URL de autorización de MP
    const authUrl = new URL('https://auth.mercadopago.cl/authorization');
    authUrl.searchParams.set('client_id', MP_CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('platform_id', 'mp');
    authUrl.searchParams.set('state', store.domain);
    authUrl.searchParams.set('redirect_uri', MP_REDIRECT_URI);

    window.location.href = authUrl.toString();
  }

  async function handleRefreshToken() {
    setRefreshingToken(true);
    try {
      const response = await fetch(`${FUNCTIONS_URL}/mp-refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_domain: store.domain }),
      });

      if (response.ok) {
        alert('Token renovado exitosamente');
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      alert('Error al renovar el token');
    } finally {
      setRefreshingToken(false);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
            <CheckCircle2 size={12} />
            Pagado
          </span>
        );
      case 'pending':
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">
            <Clock size={12} />
            {status === 'processing' ? 'Procesando' : 'Pendiente'}
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
            <XCircle size={12} />
            Rechazado
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
            <XCircle size={12} />
            Cancelado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="animate-spin text-purple-600 mb-2" size={32} />
        <p className="text-gray-500">Cargando información de pagos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner del nuevo modelo */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-5 text-white">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Zap size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-1">Pagos Directos</h3>
            <p className="text-white/90 text-sm">
              Cada venta se deposita directamente en tu cuenta de Mercado Pago.
              Sin esperas, sin transferencias pendientes. Grumo cobra automáticamente
              su comisión ({((store.commission_rate ?? 0) * 100).toFixed(0)}%) y tú recibes el resto al instante.
            </p>
          </div>
        </div>
      </div>

      {/* Conexión con Mercado Pago */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Wallet size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Tu cuenta de Mercado Pago</h3>
              <p className="text-sm text-gray-500">
                {isConnected
                  ? 'Cuenta conectada - Recibes pagos directamente'
                  : 'Conecta tu cuenta para recibir pagos directamente'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {isConnected ? (
            <div className="space-y-4">
              {/* Estado conectado */}
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={24} className="text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">Cuenta conectada</p>
                    <p className="text-sm text-green-700">{store.mp_email}</p>
                  </div>
                </div>
                <a
                  href="https://www.mercadopago.cl/balance"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-green-700 hover:text-green-800"
                >
                  Ver balance <ExternalLink size={14} />
                </a>
              </div>

              {/* Info de conexión */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Collector ID</p>
                  <p className="font-mono text-sm text-gray-700">{store.mp_user_id || '-'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Conectado desde</p>
                  <p className="text-sm text-gray-700">
                    {store.mp_connected_at ? formatDate(store.mp_connected_at) : '-'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Comisión Grumo</p>
                  <p className="text-sm text-gray-700">
                    {((store.commission_rate ?? 0) * 100).toFixed(0)}% por venta
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Token expira</p>
                  <p className={`text-sm ${tokenExpiresSoon ? 'text-orange-600' : 'text-gray-700'}`}>
                    {store.mp_token_expires_at ? formatDate(store.mp_token_expires_at) : '-'}
                  </p>
                </div>
              </div>

              {/* Warning si no tiene collector_id */}
              {!hasCollectorId && (
                <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900">Configuración incompleta</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Tu cuenta no tiene un Collector ID configurado. Los pagos irán temporalmente
                      a la cuenta de Grumo hasta que se complete la configuración.
                    </p>
                  </div>
                </div>
              )}

              {/* Warning si token expira pronto */}
              {tokenExpiresSoon && (
                <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <AlertTriangle size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-orange-900">Token por expirar</p>
                    <p className="text-sm text-orange-700 mt-1">
                      Tu conexión expirará pronto. Renueva para seguir recibiendo pagos directos.
                    </p>
                    <button
                      onClick={handleRefreshToken}
                      disabled={refreshingToken}
                      className="mt-3 px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {refreshingToken ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                      Renovar Token
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Estado no conectado */
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Link2 size={32} className="text-gray-400" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Conecta tu cuenta de Mercado Pago
              </h4>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Para recibir pagos directamente en tu cuenta, necesitas conectar Mercado Pago.
                Mientras no conectes, los pagos irán a la cuenta de Grumo.
              </p>
              <button
                onClick={handleConnectMP}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#009ee3] text-white font-medium rounded-lg hover:bg-[#008ed0] disabled:opacity-50 transition-colors"
              >
                {connecting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <img
                    src="https://http2.mlstatic.com/frontend-assets/mp-web-navigation/ui-navigation/6.6.77/mercadopago/logo__large.png"
                    alt="MP"
                    className="h-5"
                  />
                )}
                Conectar con Mercado Pago
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Métricas de ventas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-green-600" />
            </div>
            <span className="text-xs text-gray-500">
              {summary.successfulPayments} ventas
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(summary.totalSales)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Ventas totales</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Wallet size={20} className="text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(summary.totalReceived)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Recibido en tu cuenta</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-orange-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(summary.totalFees)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Comisiones Grumo</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-yellow-600" />
            </div>
            <span className="text-xs text-gray-500">
              {summary.pendingPayments} pagos
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {summary.pendingPayments}
          </p>
          <p className="text-sm text-gray-500 mt-1">Pendientes</p>
        </div>
      </div>

      {/* Historial de pagos */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Historial de Pagos</h3>
          <button
            onClick={loadData}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={18} className="text-gray-500" />
          </button>
        </div>

        {payments.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowRightLeft size={48} className="text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Sin ventas aún
            </h4>
            <p className="text-gray-500">
              Las ventas aparecerán aquí cuando recibas pedidos a través de Grumo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pedido
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Venta
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Comisión
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recibido
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(payment.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-gray-700">
                        {payment.shopify_order_number || `TX-${payment.transaction_id}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(payment.gross_amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-orange-600">
                      -{formatCurrency(payment.application_fee)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                      {formatCurrency(payment.net_to_store)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(payment.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info sobre el modelo de pagos */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">¿Cómo funcionan los pagos?</p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
              <li>Cuando un cliente compra en tu tienda, el pago va directo a tu cuenta de MP</li>
              <li>Grumo cobra automáticamente su comisión ({((store.commission_rate ?? 0) * 100).toFixed(0)}%)</li>
              <li>Tú recibes el monto neto al instante, sin esperas</li>
              <li>Mercado Pago también cobra su fee estándar (varía según método de pago)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
