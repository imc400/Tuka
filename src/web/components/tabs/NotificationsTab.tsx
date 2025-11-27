/**
 * Notifications Tab Component
 *
 * Panel para enviar notificaciones push a los suscriptores de una tienda
 * y ver el historial de notificaciones enviadas con métricas detalladas.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Send,
  Clock,
  Users,
  TrendingUp,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Image,
  Eye,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar,
  MousePointer,
  ShoppingCart,
  Smartphone,
  Target,
  BarChart3,
  X,
  Link,
  Package,
  Layers,
  ExternalLink,
} from 'lucide-react';
import type { Store, NotificationRecord } from '../../types';
import {
  sendStoreNotification,
  getSubscriberCount,
  getNotificationHistory,
} from '../../services/notificationService';
import { supabaseWeb as supabase } from '../../../lib/supabaseWeb';

// Tipos para destino de notificación
type DestinationType = 'none' | 'collection' | 'product';

interface StoreCollection {
  id: string;
  collection_id: string;
  collection_handle: string;
  collection_title: string;
  collection_image?: string;
  is_active: boolean;
}

interface CachedProduct {
  id: string;
  title: string;
  images: string[];
  price: string;
}

interface NotificationsTabProps {
  store: Store;
}

type DateFilter = 'all' | 'today' | 'week' | 'month';
type SortBy = 'date' | 'sent' | 'ctr';

export default function NotificationsTab({ store }: NotificationsTabProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [history, setHistory] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const [expandedNotification, setExpandedNotification] = useState<number | null>(null);

  // Destino de la notificación
  const [destinationType, setDestinationType] = useState<DestinationType>('none');
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [selectedCollectionHandle, setSelectedCollectionHandle] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Filtros
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [showFilters, setShowFilters] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, [store.domain]);

  // Cargar colecciones y productos cuando cambia el tipo de destino
  useEffect(() => {
    if (destinationType === 'collection' && collections.length === 0) {
      loadCollections();
    } else if (destinationType === 'product' && products.length === 0) {
      loadProducts();
    }
  }, [destinationType]);

  async function loadData() {
    setLoading(true);
    try {
      const [count, notifications] = await Promise.all([
        getSubscriberCount(store.domain),
        getNotificationHistory(store.domain, 50),
      ]);
      setSubscriberCount(count);
      setHistory(notifications);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  }

  // Cargar colecciones activas de la tienda
  async function loadCollections() {
    setLoadingDestinations(true);
    try {
      const { data, error } = await supabase
        .from('store_collections')
        .select('*')
        .eq('store_id', store.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCollections(data || []);
    } catch (error) {
      console.error('Error cargando colecciones:', error);
    } finally {
      setLoadingDestinations(false);
    }
  }

  // Cargar productos del cache (sin límite para tener acceso a todos)
  async function loadProducts() {
    setLoadingDestinations(true);
    try {
      // Cargar todos los productos disponibles de la tienda
      const { data, error } = await supabase
        .from('products')
        .select('id, title, images, price')
        .eq('store_domain', store.domain)
        .eq('available', true)
        .order('title', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
      console.log(`📦 [NotificationsTab] Loaded ${data?.length || 0} products for ${store.domain}`);
    } catch (error) {
      console.error('Error cargando productos:', error);
    } finally {
      setLoadingDestinations(false);
    }
  }

  // Filtrar productos por búsqueda
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 20);
    const search = productSearch.toLowerCase();
    return products.filter(p => p.title.toLowerCase().includes(search)).slice(0, 20);
  }, [products, productSearch]);

  // Filtrar y ordenar historial
  const filteredHistory = useMemo(() => {
    let filtered = [...history];

    // Filtrar por fecha
    const now = new Date();
    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(n => new Date(n.created_at || n.sent_at) >= today);
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(n => new Date(n.created_at || n.sent_at) >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(n => new Date(n.created_at || n.sent_at) >= monthAgo);
    }

    // Ordenar
    if (sortBy === 'sent') {
      filtered.sort((a, b) => (b.total_sent || 0) - (a.total_sent || 0));
    } else if (sortBy === 'ctr') {
      const getCTR = (n: any) => n.total_sent > 0 ? (n.total_clicked || 0) / n.total_sent : 0;
      filtered.sort((a, b) => getCTR(b) - getCTR(a));
    } else {
      filtered.sort((a, b) =>
        new Date(b.created_at || b.sent_at).getTime() - new Date(a.created_at || a.sent_at).getTime()
      );
    }

    return filtered;
  }, [history, dateFilter, sortBy]);

  // Calcular métricas agregadas
  const metrics = useMemo(() => {
    const totalSent = history.reduce((acc, n) => acc + (n.total_sent || 0), 0);
    const totalClicked = history.reduce((acc, n) => acc + (n.total_clicked || 0), 0);
    const avgCTR = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
    const totalConversions = history.reduce((acc, n) => acc + (n.conversions || 0), 0);
    const totalRevenue = history.reduce((acc, n) => acc + (n.revenue || 0), 0);

    return { totalSent, totalClicked, avgCTR, totalConversions, totalRevenue };
  }, [history]);

  // Construir datos de navegación según el tipo de destino
  function buildNotificationData() {
    const baseData: any = {
      storeId: store.domain,
    };

    if (destinationType === 'collection' && selectedCollectionHandle) {
      const selectedCollection = collections.find(c => c.collection_handle === selectedCollectionHandle);
      return {
        ...baseData,
        type: 'collection',
        collectionHandle: selectedCollectionHandle,
        collectionTitle: selectedCollection?.collection_title || '',
      };
    }

    if (destinationType === 'product' && selectedProductId) {
      const selectedProduct = products.find(p => p.id === selectedProductId);
      return {
        ...baseData,
        type: 'product',
        productId: selectedProductId,
        productTitle: selectedProduct?.title || '',
      };
    }

    return {
      ...baseData,
      type: 'general',
    };
  }

  // Obtener descripción del destino seleccionado
  function getDestinationLabel(): string {
    if (destinationType === 'collection' && selectedCollectionHandle) {
      const col = collections.find(c => c.collection_handle === selectedCollectionHandle);
      return `Colección: ${col?.collection_title || selectedCollectionHandle}`;
    }
    if (destinationType === 'product' && selectedProductId) {
      const prod = products.find(p => p.id === selectedProductId);
      return `Producto: ${prod?.title || 'Seleccionado'}`;
    }
    return 'Sin enlace específico';
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setSendResult({
        type: 'error',
        message: 'Por favor completa el título y el mensaje',
      });
      return;
    }

    if (subscriberCount === 0) {
      setSendResult({
        type: 'warning',
        message: 'Esta tienda no tiene suscriptores aún',
      });
      return;
    }

    // Validar que se haya seleccionado destino si es requerido
    if (destinationType === 'collection' && !selectedCollectionHandle) {
      setSendResult({
        type: 'error',
        message: 'Por favor selecciona una colección',
      });
      return;
    }

    if (destinationType === 'product' && !selectedProductId) {
      setSendResult({
        type: 'error',
        message: 'Por favor selecciona un producto',
      });
      return;
    }

    const destLabel = getDestinationLabel();
    if (!confirm(`¿Enviar notificación a ${subscriberCount} suscriptores?\n\nDestino al tocar: ${destLabel}`)) {
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const notificationData = buildNotificationData();

      const result = await sendStoreNotification(
        store.domain,
        store.store_name || store.domain,
        {
          title: title.trim(),
          body: body.trim(),
          imageUrl: imageUrl.trim() || undefined,
          data: notificationData,
        }
      );

      if (result.success) {
        setSendResult({
          type: 'success',
          message: result.message,
        });
        setTitle('');
        setBody('');
        setImageUrl('');
        setDestinationType('none');
        setSelectedCollectionHandle('');
        setSelectedProductId('');
        setProductSearch('');
        await loadData();
      } else {
        setSendResult({
          type: 'error',
          message: result.message,
        });
      }
    } catch (error: any) {
      setSendResult({
        type: 'error',
        message: error.message || 'Error al enviar notificación',
      });
    } finally {
      setSending(false);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `Hace ${minutes}m`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days}d`;
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatFullDate(dateString: string) {
    return new Date(dateString).toLocaleString('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getCTR(notification: any): number {
    if (!notification.total_sent || notification.total_sent === 0) return 0;
    return ((notification.total_clicked || 0) / notification.total_sent) * 100;
  }

  function getCTRColor(ctr: number): string {
    if (ctr >= 10) return 'text-green-600 bg-green-50';
    if (ctr >= 5) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="animate-spin text-gray-600 mb-2" size={32} />
        <p className="text-gray-500">Cargando notificaciones...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-grumo-dark rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Users size={14} />
            <span>Suscriptores</span>
          </div>
          <p className="text-3xl font-bold">{subscriberCount}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 text-blue-100 text-xs mb-1">
            <Send size={14} />
            <span>Enviadas</span>
          </div>
          <p className="text-3xl font-bold">{metrics.totalSent}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 text-green-100 text-xs mb-1">
            <MousePointer size={14} />
            <span>CTR Promedio</span>
          </div>
          <p className="text-3xl font-bold">{metrics.avgCTR.toFixed(1)}%</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 text-amber-100 text-xs mb-1">
            <ShoppingCart size={14} />
            <span>Conversiones</span>
          </div>
          <p className="text-3xl font-bold">{metrics.totalConversions}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 text-purple-100 text-xs mb-1">
            <TrendingUp size={14} />
            <span>Revenue</span>
          </div>
          <p className="text-2xl font-bold">${metrics.totalRevenue.toLocaleString('es-CL')}</p>
        </div>
      </div>

      {/* Send Notification Form */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h3 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
          <Send size={20} className="text-gray-600" />
          Enviar Nueva Notificación
        </h3>

        {sendResult && (
          <div
            className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
              sendResult.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : sendResult.type === 'warning'
                ? 'bg-amber-50 border border-amber-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {sendResult.type === 'success' ? (
              <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
            ) : sendResult.type === 'warning' ? (
              <AlertCircle className="text-amber-600 flex-shrink-0" size={20} />
            ) : (
              <XCircle className="text-red-600 flex-shrink-0" size={20} />
            )}
            <p
              className={`text-sm ${
                sendResult.type === 'success'
                  ? 'text-green-700'
                  : sendResult.type === 'warning'
                  ? 'text-amber-700'
                  : 'text-red-700'
              }`}
            >
              {sendResult.message}
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
              placeholder="Ej: ¡Nueva colección disponible!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={50}
              disabled={sending}
            />
            <p className="text-xs text-gray-500 mt-1">{title.length}/50 caracteres</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Mensaje <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none resize-none"
              placeholder="Ej: Descubre nuestros nuevos productos con 20% de descuento"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={150}
              disabled={sending}
            />
            <p className="text-xs text-gray-500 mt-1">{body.length}/150 caracteres</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                <span className="flex items-center gap-1">
                  <Image size={14} />
                  URL de Imagen{' '}
                  <span className="text-gray-400 text-xs font-normal">(opcional)</span>
                </span>
              </label>
              <input
                type="text"
                className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                placeholder="https://tutienda.com/promo.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                disabled={sending}
              />
              <p className="text-xs text-gray-500 mt-1">
                Dimensiones recomendadas: <strong>1024x1024 px</strong> (cuadrado). Máximo 1MB. Se muestra como thumbnail a la derecha del banner y expandida al mantener presionada la notificación.
              </p>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="mt-2 h-20 rounded-lg object-cover border"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                <span className="flex items-center gap-1">
                  <Link size={14} />
                  Destino al tocar{' '}
                  <span className="text-gray-400 text-xs font-normal">(opcional)</span>
                </span>
              </label>

              {/* Selector de tipo de destino */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setDestinationType('none');
                    setSelectedCollectionHandle('');
                    setSelectedProductId('');
                  }}
                  disabled={sending}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border-2 ${
                    destinationType === 'none'
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Sin enlace
                </button>
                <button
                  type="button"
                  onClick={() => setDestinationType('collection')}
                  disabled={sending}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border-2 flex items-center justify-center gap-1 ${
                    destinationType === 'collection'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'
                  }`}
                >
                  <Layers size={14} />
                  Colección
                </button>
                <button
                  type="button"
                  onClick={() => setDestinationType('product')}
                  disabled={sending}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border-2 flex items-center justify-center gap-1 ${
                    destinationType === 'product'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  <Package size={14} />
                  Producto
                </button>
              </div>

              {/* Selector de colección */}
              {destinationType === 'collection' && (
                <div className="space-y-2">
                  {loadingDestinations ? (
                    <div className="flex items-center justify-center py-4 text-gray-500">
                      <Loader2 size={20} className="animate-spin mr-2" />
                      Cargando colecciones...
                    </div>
                  ) : collections.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-700">
                        No tienes colecciones activas. Ve a la pestaña de <strong>Colecciones</strong> para configurarlas.
                      </p>
                    </div>
                  ) : (
                    <select
                      value={selectedCollectionHandle}
                      onChange={(e) => setSelectedCollectionHandle(e.target.value)}
                      disabled={sending}
                      className="w-full p-3 border-2 border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
                    >
                      <option value="">Selecciona una colección...</option>
                      {collections.map((col) => (
                        <option key={col.id} value={col.collection_handle}>
                          {col.collection_title}
                        </option>
                      ))}
                    </select>
                  )}

                  {selectedCollectionHandle && (
                    <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                      {collections.find(c => c.collection_handle === selectedCollectionHandle)?.collection_image && (
                        <img
                          src={collections.find(c => c.collection_handle === selectedCollectionHandle)?.collection_image}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-purple-900">
                          {collections.find(c => c.collection_handle === selectedCollectionHandle)?.collection_title}
                        </p>
                        <p className="text-xs text-purple-600">
                          Al tocar, se mostrará esta colección
                        </p>
                      </div>
                      <ExternalLink size={16} className="text-purple-400" />
                    </div>
                  )}
                </div>
              )}

              {/* Selector de producto */}
              {destinationType === 'product' && (
                <div className="space-y-2">
                  {loadingDestinations ? (
                    <div className="flex items-center justify-center py-4 text-gray-500">
                      <Loader2 size={20} className="animate-spin mr-2" />
                      Cargando productos...
                    </div>
                  ) : products.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-700">
                        No hay productos sincronizados. Ejecuta la sincronización desde <strong>Configuración</strong>.
                      </p>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        disabled={sending}
                        className="w-full p-3 border-2 border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />

                      <div className="max-h-48 overflow-y-auto border-2 border-gray-200 rounded-lg">
                        {filteredProducts.map((prod) => (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => setSelectedProductId(prod.id)}
                            disabled={sending}
                            className={`w-full flex items-center gap-3 p-2 text-left hover:bg-blue-50 transition-colors ${
                              selectedProductId === prod.id ? 'bg-blue-100' : ''
                            }`}
                          >
                            {prod.images && prod.images[0] ? (
                              <img
                                src={prod.images[0]}
                                alt=""
                                className="w-10 h-10 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                                <Package size={16} className="text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {prod.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                ${parseFloat(prod.price).toLocaleString('es-CL')}
                              </p>
                            </div>
                            {selectedProductId === prod.id && (
                              <CheckCircle size={16} className="text-blue-600 flex-shrink-0" />
                            )}
                          </button>
                        ))}
                        {filteredProducts.length === 0 && (
                          <p className="text-center text-gray-500 text-sm py-4">
                            No se encontraron productos
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {selectedProductId && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                      {products.find(p => p.id === selectedProductId)?.images?.[0] && (
                        <img
                          src={products.find(p => p.id === selectedProductId)?.images[0]}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">
                          {products.find(p => p.id === selectedProductId)?.title}
                        </p>
                        <p className="text-xs text-blue-600">
                          Al tocar, se abrirá este producto
                        </p>
                      </div>
                      <ExternalLink size={16} className="text-blue-400" />
                    </div>
                  )}
                </div>
              )}

              {destinationType === 'none' && (
                <p className="text-xs text-gray-500 mt-1">
                  Al tocar la notificación, abrirá la tienda sin ir a un lugar específico
                </p>
              )}
            </div>
          </div>

          {store.logo_url && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-xs text-purple-700 mb-2">
                <strong>Tip:</strong> Usa el logo de tu tienda para que la notificación se vea profesional:
              </p>
              <div className="flex items-center gap-2">
                <img src={store.logo_url} alt="Logo" className="w-8 h-8 rounded object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl(store.logo_url || '')}
                  className="text-xs text-purple-600 hover:text-purple-800 underline"
                >
                  Usar logo de la tienda
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !body.trim() || subscriberCount === 0}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Enviando a {subscriberCount} dispositivos...
              </>
            ) : (
              <>
                <Send size={20} />
                Enviar a {subscriberCount} suscriptores
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notification History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
            <Clock size={20} className="text-gray-600" />
            Historial de Notificaciones
            <span className="text-sm font-normal text-gray-500">
              ({filteredHistory.length} de {history.length})
            </span>
          </h3>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              showFilters ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Filter size={16} />
            Filtros
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Filtros expandibles */}
        {showFilters && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4 flex flex-wrap gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">
                <Calendar size={12} className="inline mr-1" />
                Período
              </label>
              <div className="flex gap-1">
                {[
                  { value: 'all', label: 'Todo' },
                  { value: 'today', label: 'Hoy' },
                  { value: 'week', label: '7 días' },
                  { value: 'month', label: '30 días' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDateFilter(option.value as DateFilter)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      dateFilter === option.value
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">
                <BarChart3 size={12} className="inline mr-1" />
                Ordenar por
              </label>
              <div className="flex gap-1">
                {[
                  { value: 'date', label: 'Fecha' },
                  { value: 'sent', label: 'Enviados' },
                  { value: 'ctr', label: 'CTR' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value as SortBy)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      sortBy === option.value
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {filteredHistory.length === 0 ? (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
            <p className="text-gray-500">
              {history.length === 0
                ? 'No se han enviado notificaciones aún'
                : 'No hay notificaciones que coincidan con los filtros'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {history.length === 0
                ? 'Las notificaciones que envíes aparecerán aquí'
                : 'Intenta cambiar los filtros para ver más resultados'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((notification: any) => {
              const ctr = getCTR(notification);
              const isExpanded = expandedNotification === notification.id;

              return (
                <div
                  key={notification.id}
                  className={`bg-white border-2 rounded-xl overflow-hidden transition-all ${
                    isExpanded ? 'border-purple-400 shadow-lg' : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  {/* Header clickeable */}
                  <button
                    onClick={() => setExpandedNotification(isExpanded ? null : notification.id)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex gap-3">
                      {notification.image_url && (
                        <img
                          src={notification.image_url}
                          alt=""
                          className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-gray-900 truncate pr-2">{notification.title}</h4>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-500">
                              {formatDate(notification.created_at || notification.sent_at)}
                            </span>
                            {isExpanded ? (
                              <ChevronUp size={16} className="text-gray-400" />
                            ) : (
                              <ChevronDown size={16} className="text-gray-400" />
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 truncate mb-2">{notification.body}</p>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded">
                            <Smartphone size={12} />
                            <span>{notification.total_sent || 0}</span>
                          </div>
                          <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded">
                            <MousePointer size={12} />
                            <span>{notification.total_clicked || 0}</span>
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded font-bold ${getCTRColor(ctr)}`}>
                            <Target size={12} />
                            <span>{ctr.toFixed(1)}% CTR</span>
                          </div>
                          {notification.conversions > 0 && (
                            <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded">
                              <ShoppingCart size={12} />
                              <span>{notification.conversions} ventas</span>
                            </div>
                          )}

                          {/* Barra de progreso CTR */}
                          <div className="flex-1 min-w-[80px] self-center">
                            <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  ctr >= 10 ? 'bg-green-500' : ctr >= 5 ? 'bg-yellow-500' : 'bg-gray-400'
                                }`}
                                style={{ width: `${Math.min(ctr * 5, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Detalles expandidos */}
                  {isExpanded && (
                    <div className="border-t-2 border-gray-100 bg-gray-50 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Info general */}
                        <div>
                          <h5 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                            <Clock size={12} />
                            Información
                          </h5>
                          <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Fecha de envío:</span>
                              <span className="font-medium">
                                {formatFullDate(notification.created_at || notification.sent_at)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Dispositivos alcanzados:</span>
                              <span className="font-medium">{notification.total_sent || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Entregadas:</span>
                              <span className="font-medium text-green-600">
                                {notification.total_delivered || notification.total_sent || 0}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Clicks:</span>
                              <span className="font-medium text-blue-600">{notification.total_clicked || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">CTR:</span>
                              <span className={`font-bold ${ctr >= 10 ? 'text-green-600' : ctr >= 5 ? 'text-yellow-600' : 'text-gray-600'}`}>
                                {ctr.toFixed(2)}%
                              </span>
                            </div>
                            {notification.data?.productId && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Producto vinculado:</span>
                                <span className="font-mono text-xs text-purple-600 truncate max-w-[150px]">
                                  {notification.data.productId}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Destinatarios */}
                        <div>
                          <h5 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                            <Users size={12} />
                            Destinatarios ({notification.recipients?.length || 0})
                          </h5>
                          <div className="bg-white rounded-lg p-3 max-h-40 overflow-y-auto">
                            {notification.recipients && notification.recipients.length > 0 ? (
                              <div className="space-y-1">
                                {notification.recipients.map((r: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Smartphone size={12} className="text-gray-400" />
                                      <span className="font-mono text-gray-600">...{r.token}</span>
                                    </div>
                                    {r.clicked && (
                                      <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs">
                                        Click
                                      </span>
                                    )}
                                    {r.converted && (
                                      <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-xs">
                                        Compró
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 text-center py-4">
                                Sin información de destinatarios
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Conversiones asociadas */}
                      {notification.conversions > 0 && (
                        <div className="mt-4">
                          <h5 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                            <ShoppingCart size={12} />
                            Compras asociadas
                          </h5>
                          <div className="bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-amber-800">
                                  <strong>{notification.conversions}</strong> compras realizadas después de esta notificación
                                </p>
                                {notification.revenue && (
                                  <p className="text-xs text-amber-600 mt-1">
                                    Ingresos generados: ${notification.revenue.toLocaleString('es-CL')}
                                  </p>
                                )}
                              </div>
                              <ShoppingCart size={24} className="text-amber-400" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Preview de imagen */}
                      {notification.image_url && (
                        <div className="mt-4">
                          <h5 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                            <Image size={12} />
                            Imagen adjunta
                          </h5>
                          <img
                            src={notification.image_url}
                            alt="Imagen de notificación"
                            className="rounded-lg max-h-40 object-cover border"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
