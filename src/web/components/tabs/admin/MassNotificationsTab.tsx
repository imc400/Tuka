/**
 * Mass Notifications Tab - Super Admin Dashboard
 *
 * Envío de notificaciones push segmentadas:
 * - Seleccionar tiendas específicas o todas
 * - Preview de audiencia total
 * - Historial de campañas globales
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Send,
  Users,
  Store,
  Check,
  CheckSquare,
  Square,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Image as ImageIcon,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  Smartphone,
  X,
} from 'lucide-react';
import { supabaseWeb as supabase } from '../../../../lib/supabaseWeb';
import type { Store as StoreType } from '../../../types';

interface MassNotificationsTabProps {
  stores: StoreType[];
}

interface SubscriberCount {
  store_domain: string;
  count: number;
}

interface CampaignHistory {
  id: number;
  title: string;
  body: string;
  store_id: string;
  total_sent: number;
  sent_at: string;
  store_name?: string;
}

export default function MassNotificationsTab({ stores }: MassNotificationsTabProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Selection state
  const [selectedStores, setSelectedStores] = useState<Set<string>>(new Set());
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});

  // UI state
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignHistory[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  useEffect(() => {
    loadSubscriberCounts();
    loadRecentCampaigns();
  }, [stores]);

  async function loadSubscriberCounts() {
    const storeDomainsArr = stores.map(s => s.domain);

    const { data } = await supabase
      .from('store_subscriptions')
      .select('store_domain')
      .in('store_domain', storeDomainsArr)
      .is('unsubscribed_at', null);

    const counts: Record<string, number> = {};
    stores.forEach(s => { counts[s.domain] = 0; });

    (data || []).forEach(sub => {
      if (counts[sub.store_domain] !== undefined) {
        counts[sub.store_domain]++;
      }
    });

    setSubscriberCounts(counts);
  }

  async function loadRecentCampaigns() {
    setLoadingCampaigns(true);
    const storeDomainsArr = stores.map(s => s.domain);

    const { data } = await supabase
      .from('notifications_sent')
      .select('*')
      .in('store_id', storeDomainsArr)
      .order('sent_at', { ascending: false })
      .limit(20);

    // Enrich with store names
    const enriched = (data || []).map(campaign => {
      const store = stores.find(s => s.domain === campaign.store_id);
      return {
        ...campaign,
        store_name: store?.store_name || campaign.store_id,
      };
    });

    setCampaigns(enriched);
    setLoadingCampaigns(false);
  }

  function toggleStore(domain: string) {
    const newSelected = new Set(selectedStores);
    if (newSelected.has(domain)) {
      newSelected.delete(domain);
    } else {
      newSelected.add(domain);
    }
    setSelectedStores(newSelected);
  }

  function selectAll() {
    const allDomains = stores.map(s => s.domain);
    setSelectedStores(new Set(allDomains));
  }

  function selectNone() {
    setSelectedStores(new Set());
  }

  function getSelectedSubscriberCount(): number {
    let total = 0;
    selectedStores.forEach(domain => {
      total += subscriberCounts[domain] || 0;
    });
    return total;
  }

  function getTotalSubscriberCount(): number {
    return Object.values(subscriberCounts).reduce((sum, count) => sum + count, 0);
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setSendResult({ success: false, message: 'Título y mensaje son obligatorios' });
      return;
    }

    if (selectedStores.size === 0) {
      setSendResult({ success: false, message: 'Selecciona al menos una tienda' });
      return;
    }

    setSending(true);
    setSendResult(null);

    let totalSent = 0;
    let totalErrors = 0;
    const selectedDomainsArr = Array.from(selectedStores);

    try {
      // Send to each selected store
      for (const storeDomain of selectedDomainsArr) {
        try {
          // Get push tokens for this store's subscribers
          const { data: subscriptions } = await supabase
            .from('store_subscriptions')
            .select('user_id')
            .eq('store_domain', storeDomain)
            .is('unsubscribed_at', null);

          if (!subscriptions || subscriptions.length === 0) continue;

          const userIds = subscriptions.map(s => s.user_id);

          const { data: pushTokens } = await supabase
            .from('push_tokens')
            .select('expo_push_token')
            .in('user_id', userIds);

          if (!pushTokens || pushTokens.length === 0) continue;

          // Send via Expo Push API
          const messages = pushTokens.map(token => ({
            to: token.expo_push_token,
            sound: 'default',
            title: title,
            body: body,
            data: {
              type: 'campaign',
              store_domain: storeDomain,
              ...(linkUrl ? { url: linkUrl } : {}),
            },
            ...(imageUrl ? { image: imageUrl } : {}),
          }));

          // Send in chunks of 100
          const chunkSize = 100;
          for (let i = 0; i < messages.length; i += chunkSize) {
            const chunk = messages.slice(i, i + chunkSize);

            const response = await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(chunk),
            });

            if (response.ok) {
              totalSent += chunk.length;
            }
          }

          // Log the campaign for this store
          await supabase.from('notifications_sent').insert({
            store_id: storeDomain,
            title: title,
            body: body,
            image_url: imageUrl || null,
            link_url: linkUrl || null,
            total_sent: pushTokens.length,
            sent_at: new Date().toISOString(),
          });
        } catch (storeError) {
          console.error(`Error sending to ${storeDomain}:`, storeError);
          totalErrors++;
        }
      }

      if (totalSent > 0) {
        setSendResult({
          success: true,
          message: `Notificación enviada a ${totalSent} dispositivos en ${selectedStores.size} tienda${selectedStores.size > 1 ? 's' : ''}`,
        });

        // Reset form
        setTitle('');
        setBody('');
        setImageUrl('');
        setLinkUrl('');
        setSelectedStores(new Set());

        // Reload campaigns
        loadRecentCampaigns();
      } else {
        setSendResult({
          success: false,
          message: 'No se encontraron suscriptores con tokens de push válidos',
        });
      }
    } catch (error: any) {
      setSendResult({ success: false, message: error.message });
    } finally {
      setSending(false);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Bell size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Notificaciones Masivas</h2>
            <p className="text-pink-100 text-sm">
              Envía push a suscriptores de múltiples tiendas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 mt-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{getTotalSubscriberCount()}</p>
            <p className="text-xs text-pink-200">Suscriptores totales</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stores.length}</p>
            <p className="text-xs text-pink-200">Tiendas</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Store Selection */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-3">Seleccionar Tiendas</h3>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="flex-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
              >
                Todas
              </button>
              <button
                onClick={selectNone}
                className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Ninguna
              </button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100">
            {stores.map((store) => {
              const isSelected = selectedStores.has(store.domain);
              const count = subscriberCounts[store.domain] || 0;

              return (
                <button
                  key={store.domain}
                  onClick={() => toggleStore(store.domain)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                    isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare size={20} className="text-purple-600 flex-shrink-0" />
                  ) : (
                    <Square size={20} className="text-gray-400 flex-shrink-0" />
                  )}

                  {store.logo_url ? (
                    <img
                      src={store.logo_url}
                      alt=""
                      className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                      style={{ backgroundColor: store.theme_color || '#6B7280' }}
                    >
                      {(store.store_name || store.domain).substring(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {store.store_name || store.domain}
                    </p>
                    <p className="text-xs text-gray-500">{count} suscriptor{count !== 1 ? 'es' : ''}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selection Summary */}
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedStores.size} tienda{selectedStores.size !== 1 ? 's' : ''} seleccionada{selectedStores.size !== 1 ? 's' : ''}
              </span>
              <span className="text-sm font-semibold text-purple-700">
                {getSelectedSubscriberCount()} destinatarios
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Compose */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Componer Notificación</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="Ej: ¡Nueva colección disponible!"
                  maxLength={50}
                />
                <p className="text-xs text-gray-400 mt-1">{title.length}/50 caracteres</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensaje <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none h-24 resize-none"
                  placeholder="Ej: Descubre los nuevos productos que tenemos para ti..."
                  maxLength={200}
                />
                <p className="text-xs text-gray-400 mt-1">{body.length}/200 caracteres</p>
              </div>

              {/* Advanced Options Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700"
              >
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Opciones avanzadas
              </button>

              {showAdvanced && (
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                      <ImageIcon size={14} />
                      URL de Imagen (opcional)
                    </label>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="https://ejemplo.com/imagen.jpg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                      <LinkIcon size={14} />
                      URL de Destino (opcional)
                    </label>
                    <input
                      type="text"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="https://ejemplo.com/promocion"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Preview */}
            {(title || body) && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Smartphone size={16} />
                  Vista previa
                </p>
                <div className="bg-gray-100 rounded-xl p-4 max-w-xs">
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Bell size={16} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {title || 'Título de la notificación'}
                        </p>
                        <p className="text-gray-600 text-xs mt-0.5 line-clamp-2">
                          {body || 'Mensaje de la notificación...'}
                        </p>
                      </div>
                    </div>
                    {imageUrl && (
                      <img
                        src={imageUrl}
                        alt="Preview"
                        className="mt-2 w-full h-24 object-cover rounded-lg"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Send Result */}
            {sendResult && (
              <div
                className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
                  sendResult.success ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                {sendResult.success ? (
                  <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                ) : (
                  <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
                )}
                <div>
                  <p className={`font-medium ${sendResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {sendResult.success ? 'Enviado correctamente' : 'Error al enviar'}
                  </p>
                  <p className={`text-sm ${sendResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {sendResult.message}
                  </p>
                </div>
                <button
                  onClick={() => setSendResult(null)}
                  className="ml-auto text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={sending || !title || !body || selectedStores.size === 0}
              className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-medium rounded-lg hover:from-pink-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Enviar a {getSelectedSubscriberCount()} suscriptor{getSelectedSubscriberCount() !== 1 ? 'es' : ''}
                </>
              )}
            </button>
          </div>

          {/* Recent Campaigns */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Campañas Recientes</h3>
            </div>

            {loadingCampaigns ? (
              <div className="p-8 text-center">
                <Loader2 className="animate-spin text-gray-400 mx-auto" size={24} />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No hay campañas enviadas</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {campaign.title}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {campaign.body}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <Store size={12} />
                            {campaign.store_name}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <Users size={12} />
                            {campaign.total_sent} enviados
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <Clock size={12} />
                          {formatDate(campaign.sent_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
