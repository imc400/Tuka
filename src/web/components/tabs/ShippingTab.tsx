/**
 * Shipping Tab Component
 *
 * Permite configurar las tarifas de envío de la tienda
 * - Tarifas planas (sincronizadas desde Shopify)
 * - Tarifas por zona (configuración manual)
 */

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  MapPin,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  DollarSign,
  Package,
} from 'lucide-react';
import { supabaseWeb as supabase } from '../../../lib/supabaseWeb';
import type { Store } from '../../types';
import { CHILE_REGIONS, type Region } from '../../data/chileRegions';

interface ShippingTabProps {
  store: Store;
}

type ShippingType = 'flat_shopify' | 'zone_manual' | 'grumo_logistics';

interface ShippingConfig {
  id?: string;
  shipping_type: ShippingType;
  free_shipping_threshold: number | null;
  default_shipping_name: string;
  estimated_delivery: string;
  is_active: boolean;
}

interface ShippingZone {
  id?: string;
  region_code: string;
  region_name: string;
  base_price: number;
  has_commune_breakdown: boolean;
  is_active: boolean;
  communes?: ShippingCommune[];
  isExpanded?: boolean;
}

interface ShippingCommune {
  id?: string;
  commune_code: string;
  commune_name: string;
  price: number;
  is_active: boolean;
}

interface ShopifyShippingRate {
  id: number;
  name: string;
  price: string;
  min_order_subtotal?: string;
  max_order_subtotal?: string;
}

export default function ShippingTab({ store }: ShippingTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estado de configuración
  const [config, setConfig] = useState<ShippingConfig>({
    shipping_type: 'flat_shopify',
    free_shipping_threshold: null,
    default_shipping_name: 'Envío estándar',
    estimated_delivery: '3-5 días hábiles',
    is_active: true,
  });

  // Zonas de envío (para modo manual)
  const [zones, setZones] = useState<ShippingZone[]>([]);

  // Tarifas de Shopify (para referencia)
  const [shopifyRates, setShopifyRates] = useState<ShopifyShippingRate[]>([]);

  // Cargar configuración existente
  useEffect(() => {
    loadShippingConfig();
  }, [store.id]);

  async function loadShippingConfig() {
    setLoading(true);
    try {
      // Cargar configuración principal
      const { data: configData } = await supabase
        .from('store_shipping_config')
        .select('*')
        .eq('store_id', store.id)
        .single();

      if (configData) {
        setConfig({
          id: configData.id,
          shipping_type: configData.shipping_type,
          free_shipping_threshold: configData.free_shipping_threshold,
          default_shipping_name: configData.default_shipping_name || 'Envío estándar',
          estimated_delivery: configData.estimated_delivery || '3-5 días hábiles',
          is_active: configData.is_active,
        });
      }

      // Cargar zonas si hay configuración manual
      const { data: zonesData } = await supabase
        .from('store_shipping_zones')
        .select(`
          *,
          communes:store_shipping_communes(*)
        `)
        .eq('store_id', store.id)
        .order('region_code');

      if (zonesData && zonesData.length > 0) {
        setZones(
          zonesData.map((z) => ({
            id: z.id,
            region_code: z.region_code,
            region_name: z.region_name,
            base_price: z.base_price,
            has_commune_breakdown: z.has_commune_breakdown,
            is_active: z.is_active,
            communes: z.communes || [],
            isExpanded: false,
          }))
        );
      }

      // Intentar cargar tarifas de Shopify para referencia
      if (store.admin_api_token) {
        await loadShopifyRates();
      }
    } catch (error: any) {
      console.error('Error loading shipping config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadShopifyRates() {
    try {
      const response = await fetch(
        `https://${store.domain}/admin/api/2024-10/shipping_zones.json`,
        {
          headers: {
            'X-Shopify-Access-Token': store.admin_api_token!,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rates: ShopifyShippingRate[] = [];

        for (const zone of data.shipping_zones || []) {
          for (const rate of zone.price_based_shipping_rates || []) {
            rates.push({
              id: rate.id,
              name: rate.name,
              price: rate.price,
              min_order_subtotal: rate.min_order_subtotal,
              max_order_subtotal: rate.max_order_subtotal,
            });
          }
        }

        setShopifyRates(rates);
      }
    } catch (error) {
      console.error('Error loading Shopify rates:', error);
    }
  }

  async function handleSyncFromShopify() {
    setSyncing(true);
    setResult(null);

    try {
      await loadShopifyRates();
      setResult({
        type: 'success',
        message: `Se encontraron ${shopifyRates.length} tarifas en Shopify`,
      });
    } catch (error: any) {
      setResult({
        type: 'error',
        message: 'Error al sincronizar con Shopify',
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setResult(null);

    try {
      // Guardar/actualizar configuración principal
      const configPayload = {
        store_id: store.id,
        shipping_type: config.shipping_type,
        free_shipping_threshold: config.free_shipping_threshold,
        default_shipping_name: config.default_shipping_name,
        estimated_delivery: config.estimated_delivery,
        is_active: config.is_active,
      };

      if (config.id) {
        // Actualizar existente
        const { error } = await supabase
          .from('store_shipping_config')
          .update(configPayload)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        // Crear nuevo
        const { data, error } = await supabase
          .from('store_shipping_config')
          .insert(configPayload)
          .select()
          .single();

        if (error) throw error;
        setConfig((prev) => ({ ...prev, id: data.id }));
      }

      // Si es modo manual, guardar zonas
      if (config.shipping_type === 'zone_manual') {
        // Eliminar zonas existentes y recrear
        await supabase.from('store_shipping_zones').delete().eq('store_id', store.id);

        for (const zone of zones) {
          // Insertar zona
          const { data: zoneData, error: zoneError } = await supabase
            .from('store_shipping_zones')
            .insert({
              store_id: store.id,
              region_code: zone.region_code,
              region_name: zone.region_name,
              base_price: zone.base_price,
              has_commune_breakdown: zone.has_commune_breakdown,
              is_active: zone.is_active,
            })
            .select()
            .single();

          if (zoneError) throw zoneError;

          // Insertar comunas si hay desglose
          if (zone.has_commune_breakdown && zone.communes && zone.communes.length > 0) {
            const communesPayload = zone.communes.map((c) => ({
              zone_id: zoneData.id,
              commune_code: c.commune_code,
              commune_name: c.commune_name,
              price: c.price,
              is_active: c.is_active,
            }));

            const { error: communesError } = await supabase
              .from('store_shipping_communes')
              .insert(communesPayload);

            if (communesError) throw communesError;
          }
        }
      }

      setResult({
        type: 'success',
        message: 'Configuración de envíos guardada correctamente',
      });
    } catch (error: any) {
      console.error('Error saving shipping config:', error);
      setResult({
        type: 'error',
        message: error.message || 'Error al guardar la configuración',
      });
    } finally {
      setSaving(false);
    }
  }

  function addZone(region: Region) {
    // Verificar que no exista ya
    if (zones.find((z) => z.region_code === region.code)) {
      return;
    }

    setZones([
      ...zones,
      {
        region_code: region.code,
        region_name: region.name,
        base_price: 4990,
        has_commune_breakdown: false,
        is_active: true,
        communes: [],
        isExpanded: false,
      },
    ]);
  }

  function removeZone(regionCode: string) {
    setZones(zones.filter((z) => z.region_code !== regionCode));
  }

  function updateZone(regionCode: string, updates: Partial<ShippingZone>) {
    setZones(zones.map((z) => (z.region_code === regionCode ? { ...z, ...updates } : z)));
  }

  function toggleZoneExpanded(regionCode: string) {
    setZones(
      zones.map((z) => (z.region_code === regionCode ? { ...z, isExpanded: !z.isExpanded } : z))
    );
  }

  function addAllZonesWithDefaultPrice(defaultPrice: number) {
    const newZones: ShippingZone[] = CHILE_REGIONS.filter(
      (r) => !zones.find((z) => z.region_code === r.code)
    ).map((region) => ({
      region_code: region.code,
      region_name: region.name,
      base_price: defaultPrice,
      has_commune_breakdown: false,
      is_active: true,
      communes: [],
      isExpanded: false,
    }));

    setZones([...zones, ...newZones]);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
          <Truck size={20} className="text-gray-600" />
          Configuración de Envíos
        </h3>
      </div>

      {/* Result Message */}
      {result && (
        <div
          className={`p-4 rounded-lg flex items-start gap-3 ${
            result.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {result.type === 'success' ? (
            <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
          ) : (
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          )}
          <p className={`text-sm ${result.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
            {result.message}
          </p>
        </div>
      )}

      {/* Tipo de Tarifa */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Package size={18} className="text-gray-600" />
          Tipo de Tarifa
        </h4>

        <div className="space-y-3">
          {/* Opción: Tarifas Planas de Shopify */}
          <label
            className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              config.shipping_type === 'flat_shopify'
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="shipping_type"
              value="flat_shopify"
              checked={config.shipping_type === 'flat_shopify'}
              onChange={() => setConfig({ ...config, shipping_type: 'flat_shopify' })}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Tarifas Planas (Shopify)</div>
              <p className="text-sm text-gray-500 mt-1">
                Usa las tarifas configuradas en tu tienda Shopify. Se sincronizan automáticamente.
              </p>
              {config.shipping_type === 'flat_shopify' && shopifyRates.length > 0 && (
                <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                  <div className="text-xs font-medium text-gray-600 mb-2">
                    Tarifas encontradas en Shopify:
                  </div>
                  {shopifyRates.map((rate) => (
                    <div key={rate.id} className="text-sm text-gray-700 flex justify-between">
                      <span>{rate.name}</span>
                      <span className="font-medium">
                        ${parseInt(rate.price).toLocaleString('es-CL')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {config.shipping_type === 'flat_shopify' && (
                <button
                  onClick={handleSyncFromShopify}
                  disabled={syncing || !store.admin_api_token}
                  className="mt-3 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Sincronizando...' : 'Sincronizar desde Shopify'}
                </button>
              )}
            </div>
          </label>

          {/* Opción: Tarifas por Zona */}
          <label
            className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              config.shipping_type === 'zone_manual'
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="shipping_type"
              value="zone_manual"
              checked={config.shipping_type === 'zone_manual'}
              onChange={() => setConfig({ ...config, shipping_type: 'zone_manual' })}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">Tarifas por Zona (Manual)</div>
              <p className="text-sm text-gray-500 mt-1">
                Configura tarifas personalizadas por región y opcionalmente por comuna.
              </p>
            </div>
          </label>

          {/* Opción: Grumo Logistics (Próximamente) */}
          <label
            className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-not-allowed opacity-60 ${
              config.shipping_type === 'grumo_logistics'
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200'
            }`}
          >
            <input
              type="radio"
              name="shipping_type"
              value="grumo_logistics"
              disabled
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900 flex items-center gap-2">
                Grumo Logistics
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                  Próximamente
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Tarifas negociadas con carriers (BlueExpress, Chilexpress, etc.)
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Configuración de Envío Gratis */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign size={18} className="text-gray-600" />
          Envío Gratis
        </h4>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enable_free_shipping"
              checked={config.free_shipping_threshold !== null}
              onChange={(e) =>
                setConfig({
                  ...config,
                  free_shipping_threshold: e.target.checked ? 50000 : null,
                })
              }
              className="w-5 h-5 rounded border-gray-300"
            />
            <label htmlFor="enable_free_shipping" className="text-sm text-gray-700">
              Habilitar envío gratis sobre un monto mínimo
            </label>
          </div>

          {config.free_shipping_threshold !== null && (
            <div className="ml-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto mínimo para envío gratis
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={config.free_shipping_threshold}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      free_shipping_threshold: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full pl-8 p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                  placeholder="50000"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Los pedidos sobre este monto tendrán envío gratis
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Zonas de Envío (solo si es modo manual) */}
      {config.shipping_type === 'zone_manual' && (
        <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <MapPin size={18} className="text-gray-600" />
              Zonas de Envío
            </h4>

            <div className="flex gap-2">
              <button
                onClick={() => addAllZonesWithDefaultPrice(4990)}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <Plus size={14} />
                Agregar todas ($4.990)
              </button>
            </div>
          </div>

          {/* Lista de zonas configuradas */}
          {zones.length > 0 ? (
            <div className="space-y-3">
              {zones.map((zone) => {
                const regionData = CHILE_REGIONS.find((r) => r.code === zone.region_code);

                return (
                  <div
                    key={zone.region_code}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Header de la zona */}
                    <div className="flex items-center gap-3 p-4 bg-gray-50">
                      <button
                        onClick={() => toggleZoneExpanded(zone.region_code)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {zone.isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>

                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{zone.region_name}</span>
                        <span className="text-xs text-gray-500 ml-2">({zone.region_code})</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                            $
                          </span>
                          <input
                            type="number"
                            value={zone.base_price}
                            onChange={(e) =>
                              updateZone(zone.region_code, {
                                base_price: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-28 pl-6 p-2 border border-gray-300 rounded text-sm"
                          />
                        </div>

                        <button
                          onClick={() => removeZone(zone.region_code)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Desglose por comunas (expandido) */}
                    {zone.isExpanded && regionData && (
                      <div className="p-4 border-t border-gray-200 bg-white">
                        <div className="flex items-center gap-2 mb-3">
                          <input
                            type="checkbox"
                            id={`breakdown_${zone.region_code}`}
                            checked={zone.has_commune_breakdown}
                            onChange={(e) =>
                              updateZone(zone.region_code, {
                                has_commune_breakdown: e.target.checked,
                                communes: e.target.checked
                                  ? regionData.communes.map((c) => ({
                                      commune_code: c.code,
                                      commune_name: c.name,
                                      price: zone.base_price,
                                      is_active: true,
                                    }))
                                  : [],
                              })
                            }
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <label
                            htmlFor={`breakdown_${zone.region_code}`}
                            className="text-sm text-gray-700"
                          >
                            Desglosar por comuna
                          </label>
                        </div>

                        {zone.has_commune_breakdown && zone.communes && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                            {zone.communes.map((commune) => (
                              <div
                                key={commune.commune_code}
                                className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                              >
                                <span className="flex-1 text-sm text-gray-700 truncate">
                                  {commune.commune_name}
                                </span>
                                <div className="relative">
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                                    $
                                  </span>
                                  <input
                                    type="number"
                                    value={commune.price}
                                    onChange={(e) => {
                                      const newCommunes = zone.communes!.map((c) =>
                                        c.commune_code === commune.commune_code
                                          ? { ...c, price: parseInt(e.target.value) || 0 }
                                          : c
                                      );
                                      updateZone(zone.region_code, { communes: newCommunes });
                                    }}
                                    className="w-20 pl-4 p-1 border border-gray-200 rounded text-xs"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              No hay zonas configuradas. Agrega regiones para configurar tarifas.
            </p>
          )}

          {/* Selector para agregar nueva zona */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Agregar región</label>
            <select
              onChange={(e) => {
                const region = CHILE_REGIONS.find((r) => r.code === e.target.value);
                if (region) addZone(region);
                e.target.value = '';
              }}
              className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
              defaultValue=""
            >
              <option value="" disabled>
                Selecciona una región...
              </option>
              {CHILE_REGIONS.filter((r) => !zones.find((z) => z.region_code === r.code)).map(
                (region) => (
                  <option key={region.code} value={region.code}>
                    {region.name}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      )}

      {/* Botón Guardar */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-grumo-dark hover:bg-black disabled:bg-gray-300 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
      >
        {saving ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <Save size={20} />
            Guardar Configuración de Envíos
          </>
        )}
      </button>
    </div>
  );
}
