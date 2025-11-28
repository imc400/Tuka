/**
 * Shipping Tab Component - Advanced Version
 *
 * Permite configurar las tarifas de envío de la tienda con:
 * - Múltiples métodos de envío por zona (Estándar, Express, Same Day)
 * - Tarifas por peso y/o precio
 * - Envío gratis con condiciones combinables
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
  Clock,
  Scale,
  Zap,
  Gift,
  Settings,
} from 'lucide-react';
import { supabaseWeb as supabase } from '../../../lib/supabaseWeb';
import type { Store } from '../../types';
import { CHILE_REGIONS, type Region, type Commune, getRegionByCode } from '../../data/chileRegions';

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

interface ShippingMethod {
  id?: string;
  zone_id?: string;
  name: string;
  code: string;
  description?: string;
  estimated_delivery: string;
  sort_order: number;
  is_active: boolean;
  rates: ShippingRate[];
  applies_to_communes: string[] | null; // null = todas las comunas
  isExpanded?: boolean;
  showCommuneSelector?: boolean;
}

interface ShippingRate {
  id?: string;
  method_id?: string;
  name: string;
  min_weight_grams: number;
  max_weight_grams: number | null;
  min_subtotal: number;
  max_subtotal: number | null;
  price: number;
  price_per_extra_kg: number;
  priority: number;
  is_active: boolean;
}

interface CommuneRate {
  id?: string;
  zone_id?: string;
  commune_code: string;
  commune_name: string;
  price_adjustment: number;
  fixed_price: number | null;
  is_active: boolean;
}

interface ShippingZone {
  id?: string;
  region_code: string;
  region_name: string;
  base_price: number;
  has_commune_breakdown: boolean;
  is_active: boolean;
  methods: ShippingMethod[];
  commune_rates: CommuneRate[];
  isExpanded?: boolean;
  showCommunes?: boolean;
}

interface FreeShippingRule {
  id?: string;
  name: string;
  min_subtotal: number | null;
  max_subtotal: number | null;
  min_weight_grams: number | null;
  max_weight_grams: number | null;
  min_items: number | null;
  applies_to_methods: string[] | null;
  applies_to_zones: string[] | null;
  priority: number;
  is_active: boolean;
}

interface ShopifyShippingRate {
  id: number;
  name: string;
  price: string;
  min_order_subtotal?: string;
  max_order_subtotal?: string;
}

// Generar código único para método
function generateMethodCode(): string {
  return `method_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export default function ShippingTab({ store }: ShippingTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'zones' | 'free_shipping'>('zones');

  // Estado de configuración
  const [config, setConfig] = useState<ShippingConfig>({
    shipping_type: 'flat_shopify',
    free_shipping_threshold: null,
    default_shipping_name: 'Envío estándar',
    estimated_delivery: '3-5 días hábiles',
    is_active: true,
  });

  // Zonas de envío con métodos
  const [zones, setZones] = useState<ShippingZone[]>([]);

  // Reglas de envío gratis
  const [freeShippingRules, setFreeShippingRules] = useState<FreeShippingRule[]>([]);

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

      // Cargar zonas con métodos y tarifas
      const { data: zonesData } = await supabase
        .from('store_shipping_zones')
        .select('*')
        .eq('store_id', store.id)
        .order('region_code');

      if (zonesData && zonesData.length > 0) {
        // Para cada zona, cargar sus métodos y tarifas
        const zonesWithMethods = await Promise.all(
          zonesData.map(async (zone) => {
            const { data: methodsData } = await supabase
              .from('store_shipping_methods')
              .select('*')
              .eq('zone_id', zone.id)
              .order('sort_order');

            const methods = await Promise.all(
              (methodsData || []).map(async (method) => {
                const { data: ratesData } = await supabase
                  .from('store_shipping_rates')
                  .select('*')
                  .eq('method_id', method.id)
                  .order('priority', { ascending: false });

                return {
                  ...method,
                  rates: ratesData || [],
                  applies_to_communes: method.applies_to_communes || null,
                  isExpanded: false,
                  showCommuneSelector: false,
                };
              })
            );

            // Cargar tarifas por comuna si existen
            const { data: communeRatesData } = await supabase
              .from('store_shipping_commune_rates')
              .select('*')
              .eq('zone_id', zone.id)
              .order('commune_name');

            return {
              id: zone.id,
              region_code: zone.region_code,
              region_name: zone.region_name,
              base_price: zone.base_price,
              has_commune_breakdown: zone.has_commune_breakdown,
              is_active: zone.is_active,
              methods,
              commune_rates: communeRatesData || [],
              isExpanded: false,
              showCommunes: false,
            };
          })
        );

        setZones(zonesWithMethods);
      }

      // Cargar reglas de envío gratis
      const { data: freeRulesData } = await supabase
        .from('store_free_shipping_rules')
        .select('*')
        .eq('store_id', store.id)
        .order('priority', { ascending: false });

      if (freeRulesData) {
        setFreeShippingRules(freeRulesData);
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
      // 1. Guardar/actualizar configuración principal
      const configPayload = {
        store_id: store.id,
        shipping_type: config.shipping_type,
        free_shipping_threshold: config.free_shipping_threshold,
        default_shipping_name: config.default_shipping_name,
        estimated_delivery: config.estimated_delivery,
        is_active: config.is_active,
      };

      if (config.id) {
        await supabase.from('store_shipping_config').update(configPayload).eq('id', config.id);
      } else {
        const { data } = await supabase
          .from('store_shipping_config')
          .insert(configPayload)
          .select()
          .single();
        if (data) setConfig((prev) => ({ ...prev, id: data.id }));
      }

      // 2. Si es modo manual, guardar zonas, métodos y tarifas
      if (config.shipping_type === 'zone_manual') {
        // Eliminar zonas existentes (cascade elimina métodos y tarifas)
        await supabase.from('store_shipping_zones').delete().eq('store_id', store.id);

        for (const zone of zones) {
          // Insertar zona
          const { data: zoneData, error: zoneError } = await supabase
            .from('store_shipping_zones')
            .insert({
              store_id: store.id,
              region_code: zone.region_code,
              region_name: zone.region_name,
              base_price: zone.base_price || 0,
              has_commune_breakdown: zone.has_commune_breakdown,
              is_active: zone.is_active,
            })
            .select()
            .single();

          if (zoneError) throw zoneError;

          // Insertar métodos de la zona
          for (const method of zone.methods) {
            const { data: methodData, error: methodError } = await supabase
              .from('store_shipping_methods')
              .insert({
                zone_id: zoneData.id,
                name: method.name,
                code: method.code,
                description: method.description,
                estimated_delivery: method.estimated_delivery,
                sort_order: method.sort_order,
                is_active: method.is_active,
                applies_to_communes: method.applies_to_communes,
              })
              .select()
              .single();

            if (methodError) throw methodError;

            // Insertar tarifas del método
            for (const rate of method.rates) {
              await supabase.from('store_shipping_rates').insert({
                method_id: methodData.id,
                name: rate.name,
                min_weight_grams: rate.min_weight_grams,
                max_weight_grams: rate.max_weight_grams,
                min_subtotal: rate.min_subtotal,
                max_subtotal: rate.max_subtotal,
                price: rate.price,
                price_per_extra_kg: rate.price_per_extra_kg,
                priority: rate.priority,
                is_active: rate.is_active,
              });
            }
          }

          // Insertar tarifas por comuna si está habilitado
          if (zone.has_commune_breakdown && zone.commune_rates.length > 0) {
            for (const communeRate of zone.commune_rates) {
              await supabase.from('store_shipping_commune_rates').insert({
                zone_id: zoneData.id,
                commune_code: communeRate.commune_code,
                commune_name: communeRate.commune_name,
                price_adjustment: communeRate.price_adjustment,
                fixed_price: communeRate.fixed_price,
                is_active: communeRate.is_active,
              });
            }
          }
        }
      }

      // 3. Guardar reglas de envío gratis
      await supabase.from('store_free_shipping_rules').delete().eq('store_id', store.id);

      for (const rule of freeShippingRules) {
        await supabase.from('store_free_shipping_rules').insert({
          store_id: store.id,
          name: rule.name,
          min_subtotal: rule.min_subtotal,
          max_subtotal: rule.max_subtotal,
          min_weight_grams: rule.min_weight_grams,
          max_weight_grams: rule.max_weight_grams,
          min_items: rule.min_items,
          applies_to_methods: rule.applies_to_methods,
          applies_to_zones: rule.applies_to_zones,
          priority: rule.priority,
          is_active: rule.is_active,
        });
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

  // === FUNCIONES PARA ZONAS ===

  function addZone(region: Region) {
    if (zones.find((z) => z.region_code === region.code)) return;

    // Crear tarifas por comuna con precio base 0 (usará precio de la zona)
    const communeRates: CommuneRate[] = region.communes.map((commune) => ({
      commune_code: commune.code,
      commune_name: commune.name,
      price_adjustment: 0,
      fixed_price: null,
      is_active: true,
    }));

    setZones([
      ...zones,
      {
        region_code: region.code,
        region_name: region.name,
        base_price: 0,
        has_commune_breakdown: false,
        is_active: true,
        methods: [
          {
            name: 'Envío Estándar',
            code: 'standard',
            estimated_delivery: '3-5 días hábiles',
            sort_order: 0,
            is_active: true,
            rates: [
              {
                name: 'Tarifa base',
                min_weight_grams: 0,
                max_weight_grams: null,
                min_subtotal: 0,
                max_subtotal: null,
                price: 4990,
                price_per_extra_kg: 0,
                priority: 0,
                is_active: true,
              },
            ],
            applies_to_communes: null, // null = todas las comunas
            isExpanded: false,
            showCommuneSelector: false,
          },
        ],
        commune_rates: communeRates,
        isExpanded: true,
        showCommunes: false,
      },
    ]);
  }

  function removeZone(regionCode: string) {
    setZones(zones.filter((z) => z.region_code !== regionCode));
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
      base_price: 0,
      has_commune_breakdown: false,
      is_active: true,
      methods: [
        {
          name: 'Envío Estándar',
          code: 'standard',
          estimated_delivery: '3-5 días hábiles',
          sort_order: 0,
          is_active: true,
          rates: [
            {
              name: 'Tarifa base',
              min_weight_grams: 0,
              max_weight_grams: null,
              min_subtotal: 0,
              max_subtotal: null,
              price: defaultPrice,
              price_per_extra_kg: 0,
              priority: 0,
              is_active: true,
            },
          ],
          applies_to_communes: null,
          isExpanded: false,
          showCommuneSelector: false,
        },
      ],
      commune_rates: region.communes.map((commune) => ({
        commune_code: commune.code,
        commune_name: commune.name,
        price_adjustment: 0,
        fixed_price: null,
        is_active: true,
      })),
      isExpanded: false,
      showCommunes: false,
    }));

    setZones([...zones, ...newZones]);
  }

  // === FUNCIONES PARA MÉTODOS ===

  function addMethodToZone(regionCode: string) {
    setZones(
      zones.map((zone) => {
        if (zone.region_code !== regionCode) return zone;

        return {
          ...zone,
          methods: [
            ...zone.methods,
            {
              name: 'Nuevo método',
              code: generateMethodCode(),
              estimated_delivery: '3-5 días hábiles',
              sort_order: zone.methods.length,
              is_active: true,
              rates: [
                {
                  name: 'Tarifa base',
                  min_weight_grams: 0,
                  max_weight_grams: null,
                  min_subtotal: 0,
                  max_subtotal: null,
                  price: 4990,
                  price_per_extra_kg: 0,
                  priority: 0,
                  is_active: true,
                },
              ],
              applies_to_communes: null,
              isExpanded: true,
              showCommuneSelector: false,
            },
          ],
        };
      })
    );
  }

  function removeMethodFromZone(regionCode: string, methodCode: string) {
    setZones(
      zones.map((zone) => {
        if (zone.region_code !== regionCode) return zone;
        return {
          ...zone,
          methods: zone.methods.filter((m) => m.code !== methodCode),
        };
      })
    );
  }

  function updateMethod(regionCode: string, methodCode: string, updates: Partial<ShippingMethod>) {
    setZones(
      zones.map((zone) => {
        if (zone.region_code !== regionCode) return zone;
        return {
          ...zone,
          methods: zone.methods.map((m) =>
            m.code === methodCode ? { ...m, ...updates } : m
          ),
        };
      })
    );
  }

  function toggleMethodExpanded(regionCode: string, methodCode: string) {
    setZones(
      zones.map((zone) => {
        if (zone.region_code !== regionCode) return zone;
        return {
          ...zone,
          methods: zone.methods.map((m) =>
            m.code === methodCode ? { ...m, isExpanded: !m.isExpanded } : m
          ),
        };
      })
    );
  }

  function toggleMethodCommuneSelector(regionCode: string, methodCode: string) {
    setZones(
      zones.map((zone) => {
        if (zone.region_code !== regionCode) return zone;
        return {
          ...zone,
          methods: zone.methods.map((m) =>
            m.code === methodCode ? { ...m, showCommuneSelector: !m.showCommuneSelector } : m
          ),
        };
      })
    );
  }

  function updateMethodCommunes(regionCode: string, methodCode: string, communes: string[] | null) {
    setZones(
      zones.map((zone) => {
        if (zone.region_code !== regionCode) return zone;
        return {
          ...zone,
          methods: zone.methods.map((m) =>
            m.code === methodCode ? { ...m, applies_to_communes: communes } : m
          ),
        };
      })
    );
  }

  function toggleCommuneInMethod(regionCode: string, methodCode: string, communeCode: string) {
    setZones(
      zones.map((zone) => {
        if (zone.region_code !== regionCode) return zone;
        return {
          ...zone,
          methods: zone.methods.map((m) => {
            if (m.code !== methodCode) return m;
            const current = m.applies_to_communes || [];
            const updated = current.includes(communeCode)
              ? current.filter((c) => c !== communeCode)
              : [...current, communeCode];
            return { ...m, applies_to_communes: updated.length > 0 ? updated : null };
          }),
        };
      })
    );
  }

  // === FUNCIONES PARA TARIFAS ===

  function addRateToMethod(regionCode: string, methodCode: string) {
    setZones(
      zones.map((zone) => {
        if (zone.region_code !== regionCode) return zone;
        return {
          ...zone,
          methods: zone.methods.map((method) => {
            if (method.code !== methodCode) return method;
            return {
              ...method,
              rates: [
                ...method.rates,
                {
                  name: `Tarifa ${method.rates.length + 1}`,
                  min_weight_grams: 0,
                  max_weight_grams: null,
                  min_subtotal: 0,
                  max_subtotal: null,
                  price: 4990,
                  price_per_extra_kg: 0,
                  priority: method.rates.length,
                  is_active: true,
                },
              ],
            };
          }),
        };
      })
    );
  }

  function updateRate(
    regionCode: string,
    methodCode: string,
    rateIndex: number,
    updates: Partial<ShippingRate>
  ) {
    setZones(
      zones.map((zone) => {
        if (zone.region_code !== regionCode) return zone;
        return {
          ...zone,
          methods: zone.methods.map((method) => {
            if (method.code !== methodCode) return method;
            return {
              ...method,
              rates: method.rates.map((rate, idx) =>
                idx === rateIndex ? { ...rate, ...updates } : rate
              ),
            };
          }),
        };
      })
    );
  }

  function removeRate(regionCode: string, methodCode: string, rateIndex: number) {
    setZones(
      zones.map((zone) => {
        if (zone.region_code !== regionCode) return zone;
        return {
          ...zone,
          methods: zone.methods.map((method) => {
            if (method.code !== methodCode) return method;
            return {
              ...method,
              rates: method.rates.filter((_, idx) => idx !== rateIndex),
            };
          }),
        };
      })
    );
  }

  // === FUNCIONES PARA COMUNAS ===

  function toggleShowCommunes(regionCode: string) {
    setZones(
      zones.map((z) => (z.region_code === regionCode ? { ...z, showCommunes: !z.showCommunes } : z))
    );
  }

  function toggleCommuneBreakdown(regionCode: string) {
    setZones(
      zones.map((z) => {
        if (z.region_code !== regionCode) return z;
        return { ...z, has_commune_breakdown: !z.has_commune_breakdown };
      })
    );
  }

  function updateCommuneRate(regionCode: string, communeCode: string, updates: Partial<CommuneRate>) {
    setZones(
      zones.map((zone) => {
        if (zone.region_code !== regionCode) return zone;
        return {
          ...zone,
          commune_rates: zone.commune_rates.map((cr) =>
            cr.commune_code === communeCode ? { ...cr, ...updates } : cr
          ),
        };
      })
    );
  }

  function setAllCommunesPriceInZone(regionCode: string, fixedPrice: number | null) {
    setZones(
      zones.map((zone) => {
        if (zone.region_code !== regionCode) return zone;
        return {
          ...zone,
          commune_rates: zone.commune_rates.map((cr) => ({
            ...cr,
            fixed_price: fixedPrice,
            price_adjustment: 0,
          })),
        };
      })
    );
  }

  // === FUNCIONES PARA ENVÍO GRATIS ===

  function addFreeShippingRule() {
    setFreeShippingRules([
      ...freeShippingRules,
      {
        name: 'Nueva regla de envío gratis',
        min_subtotal: 50000,
        max_subtotal: null,
        min_weight_grams: null,
        max_weight_grams: null,
        min_items: null,
        applies_to_methods: null,
        applies_to_zones: null,
        priority: freeShippingRules.length,
        is_active: true,
      },
    ]);
  }

  function updateFreeShippingRule(index: number, updates: Partial<FreeShippingRule>) {
    setFreeShippingRules(
      freeShippingRules.map((rule, idx) => (idx === index ? { ...rule, ...updates } : rule))
    );
  }

  function removeFreeShippingRule(index: number) {
    setFreeShippingRules(freeShippingRules.filter((_, idx) => idx !== index));
  }

  // === RENDER ===

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
                Usa las tarifas configuradas en tu tienda Shopify.
              </p>
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

          {/* Opción: Tarifas por Zona (Manual Avanzado) */}
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
              <div className="font-medium text-gray-900">Tarifas por Zona (Avanzado)</div>
              <p className="text-sm text-gray-500 mt-1">
                Múltiples métodos de envío, tarifas por peso y precio, envío gratis condicional.
              </p>
            </div>
          </label>

          {/* Opción: Grumo Logistics (Próximamente) */}
          <label className="flex items-start gap-3 p-4 rounded-lg border-2 cursor-not-allowed opacity-60 border-gray-200">
            <input type="radio" name="shipping_type" value="grumo_logistics" disabled className="mt-1" />
            <div className="flex-1">
              <div className="font-medium text-gray-900 flex items-center gap-2">
                Grumo Logistics
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Próximamente</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Tarifas negociadas con carriers (BlueExpress, Chilexpress, etc.)
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Tabs para Zonas y Envío Gratis (solo en modo manual) */}
      {config.shipping_type === 'zone_manual' && (
        <>
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('zones')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'zones'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <MapPin size={16} className="inline mr-2" />
              Zonas y Métodos
            </button>
            <button
              onClick={() => setActiveTab('free_shipping')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'free_shipping'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Gift size={16} className="inline mr-2" />
              Envío Gratis
            </button>
          </div>

          {/* Tab: Zonas y Métodos */}
          {activeTab === 'zones' && (
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-gray-900 flex items-center gap-2">
                  <MapPin size={18} className="text-gray-600" />
                  Zonas de Envío
                </h4>
                <button
                  onClick={() => addAllZonesWithDefaultPrice(4990)}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  <Plus size={14} />
                  Agregar todas ($4.990)
                </button>
              </div>

              {/* Lista de zonas */}
              {zones.length > 0 ? (
                <div className="space-y-4">
                  {zones.map((zone) => (
                    <div key={zone.region_code} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Header de zona */}
                      <div
                        className="flex items-center gap-3 p-4 bg-gray-50 cursor-pointer"
                        onClick={() => toggleZoneExpanded(zone.region_code)}
                      >
                        {zone.isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">{zone.region_name}</span>
                          <span className="text-xs text-gray-500 ml-2">({zone.region_code})</span>
                          <span className="text-xs text-gray-400 ml-3">
                            {zone.methods.length} método{zone.methods.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeZone(zone.region_code);
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Contenido expandido de zona */}
                      {zone.isExpanded && (
                        <div className="p-4 border-t border-gray-200 space-y-4">
                          {/* Métodos de envío */}
                          {zone.methods.map((method) => (
                            <div
                              key={method.code}
                              className="border border-gray-100 rounded-lg bg-white"
                            >
                              {/* Header de método */}
                              <div
                                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                                onClick={() => toggleMethodExpanded(zone.region_code, method.code)}
                              >
                                {method.isExpanded ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronRight size={16} />
                                )}
                                <div className="flex-1 flex items-center gap-2">
                                  <Truck size={16} className="text-gray-400" />
                                  <span className="font-medium text-gray-800">{method.name}</span>
                                  <span className="text-xs text-gray-500">
                                    ({method.estimated_delivery})
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    - {method.rates.length} tarifa{method.rates.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                {zone.methods.length > 1 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeMethodFromZone(zone.region_code, method.code);
                                    }}
                                    className="text-red-400 hover:text-red-600 p-1"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>

                              {/* Contenido del método expandido */}
                              {method.isExpanded && (
                                <div className="p-3 pt-0 space-y-3">
                                  {/* Configuración del método */}
                                  <div className="p-3 bg-blue-50 rounded-lg space-y-3 border border-blue-100">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="text-xs text-gray-600 font-medium">Nombre del método</label>
                                        <input
                                          type="text"
                                          value={method.name}
                                          onChange={(e) =>
                                            updateMethod(zone.region_code, method.code, {
                                              name: e.target.value,
                                            })
                                          }
                                          className="w-full p-2 border border-gray-200 rounded text-sm"
                                          placeholder="Ej: Envío Express, Same Day, Contra Entrega..."
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-600 font-medium">Tiempo de entrega</label>
                                        <input
                                          type="text"
                                          value={method.estimated_delivery}
                                          onChange={(e) =>
                                            updateMethod(zone.region_code, method.code, {
                                              estimated_delivery: e.target.value,
                                            })
                                          }
                                          className="w-full p-2 border border-gray-200 rounded text-sm"
                                          placeholder="Ej: 1-2 días, Hoy, Al momento de pagar..."
                                        />
                                      </div>
                                    </div>

                                    {/* Selector de comunas */}
                                    <div className="pt-2 border-t border-blue-200">
                                      <div
                                        className="flex items-center justify-between cursor-pointer"
                                        onClick={() => toggleMethodCommuneSelector(zone.region_code, method.code)}
                                      >
                                        <div className="flex items-center gap-2">
                                          <MapPin size={14} className="text-blue-600" />
                                          <span className="text-xs font-medium text-gray-700">
                                            Aplica a comunas:
                                          </span>
                                          <span className="text-xs text-blue-600 font-medium">
                                            {method.applies_to_communes === null
                                              ? 'Todas las comunas'
                                              : `${method.applies_to_communes.length} comuna${method.applies_to_communes.length !== 1 ? 's' : ''} seleccionada${method.applies_to_communes.length !== 1 ? 's' : ''}`}
                                          </span>
                                        </div>
                                        <span className="text-xs text-blue-500">
                                          {method.showCommuneSelector ? '▲ Ocultar' : '▼ Seleccionar'}
                                        </span>
                                      </div>

                                      {method.showCommuneSelector && (
                                        <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200 max-h-48 overflow-y-auto">
                                          <div className="flex items-center justify-between mb-2">
                                            <button
                                              onClick={() => updateMethodCommunes(zone.region_code, method.code, null)}
                                              className={`text-xs px-2 py-1 rounded ${
                                                method.applies_to_communes === null
                                                  ? 'bg-blue-600 text-white'
                                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                              }`}
                                            >
                                              Todas
                                            </button>
                                            <button
                                              onClick={() => updateMethodCommunes(zone.region_code, method.code, [])}
                                              className="text-xs text-gray-500 hover:text-gray-700"
                                            >
                                              Limpiar selección
                                            </button>
                                          </div>
                                          <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                                            {(() => {
                                              const region = getRegionByCode(zone.region_code);
                                              return region?.communes.map((commune) => {
                                                const isSelected = method.applies_to_communes === null || method.applies_to_communes.includes(commune.code);
                                                return (
                                                  <button
                                                    key={commune.code}
                                                    onClick={() => {
                                                      if (method.applies_to_communes === null) {
                                                        // Si está en "todas", cambiar a solo esta comuna
                                                        updateMethodCommunes(zone.region_code, method.code, [commune.code]);
                                                      } else {
                                                        toggleCommuneInMethod(zone.region_code, method.code, commune.code);
                                                      }
                                                    }}
                                                    className={`text-xs px-2 py-1.5 rounded text-left truncate ${
                                                      isSelected && method.applies_to_communes !== null
                                                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                                        : method.applies_to_communes === null
                                                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                                                    }`}
                                                    title={commune.name}
                                                  >
                                                    {commune.name}
                                                  </button>
                                                );
                                              });
                                            })()}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Tarifas */}
                                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide pt-2">
                                    Tarifas de este método
                                  </div>
                                  {method.rates.map((rate, rateIdx) => (
                                    <div
                                      key={rateIdx}
                                      className="p-3 bg-gray-50 rounded-lg space-y-3"
                                    >
                                      <div className="flex items-center justify-between">
                                        <input
                                          type="text"
                                          value={rate.name}
                                          onChange={(e) =>
                                            updateRate(zone.region_code, method.code, rateIdx, {
                                              name: e.target.value,
                                            })
                                          }
                                          className="font-medium text-sm bg-transparent border-none focus:outline-none"
                                          placeholder="Nombre de tarifa"
                                        />
                                        {method.rates.length > 1 && (
                                          <button
                                            onClick={() =>
                                              removeRate(zone.region_code, method.code, rateIdx)
                                            }
                                            className="text-red-400 hover:text-red-600"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        )}
                                      </div>

                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {/* Peso */}
                                        <div>
                                          <label className="text-xs text-gray-500 flex items-center gap-1">
                                            <Scale size={12} />
                                            Peso mín (g)
                                          </label>
                                          <input
                                            type="number"
                                            value={rate.min_weight_grams}
                                            onChange={(e) =>
                                              updateRate(zone.region_code, method.code, rateIdx, {
                                                min_weight_grams: parseInt(e.target.value) || 0,
                                              })
                                            }
                                            className="w-full p-2 border border-gray-200 rounded text-sm"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-500">Peso máx (g)</label>
                                          <input
                                            type="number"
                                            value={rate.max_weight_grams || ''}
                                            onChange={(e) =>
                                              updateRate(zone.region_code, method.code, rateIdx, {
                                                max_weight_grams: e.target.value
                                                  ? parseInt(e.target.value)
                                                  : null,
                                              })
                                            }
                                            placeholder="Sin límite"
                                            className="w-full p-2 border border-gray-200 rounded text-sm"
                                          />
                                        </div>

                                        {/* Subtotal */}
                                        <div>
                                          <label className="text-xs text-gray-500 flex items-center gap-1">
                                            <DollarSign size={12} />
                                            Subtotal mín
                                          </label>
                                          <input
                                            type="number"
                                            value={rate.min_subtotal}
                                            onChange={(e) =>
                                              updateRate(zone.region_code, method.code, rateIdx, {
                                                min_subtotal: parseInt(e.target.value) || 0,
                                              })
                                            }
                                            className="w-full p-2 border border-gray-200 rounded text-sm"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-500">Subtotal máx</label>
                                          <input
                                            type="number"
                                            value={rate.max_subtotal || ''}
                                            onChange={(e) =>
                                              updateRate(zone.region_code, method.code, rateIdx, {
                                                max_subtotal: e.target.value
                                                  ? parseInt(e.target.value)
                                                  : null,
                                              })
                                            }
                                            placeholder="Sin límite"
                                            className="w-full p-2 border border-gray-200 rounded text-sm"
                                          />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        {/* Precio */}
                                        <div>
                                          <label className="text-xs text-gray-500">Precio ($)</label>
                                          <input
                                            type="number"
                                            value={rate.price}
                                            onChange={(e) =>
                                              updateRate(zone.region_code, method.code, rateIdx, {
                                                price: parseInt(e.target.value) || 0,
                                              })
                                            }
                                            className="w-full p-2 border border-gray-200 rounded text-sm font-medium"
                                          />
                                        </div>
                                        {/* Precio por kg extra */}
                                        <div>
                                          <label className="text-xs text-gray-500">$/kg extra</label>
                                          <input
                                            type="number"
                                            value={rate.price_per_extra_kg}
                                            onChange={(e) =>
                                              updateRate(zone.region_code, method.code, rateIdx, {
                                                price_per_extra_kg: parseInt(e.target.value) || 0,
                                              })
                                            }
                                            placeholder="0"
                                            className="w-full p-2 border border-gray-200 rounded text-sm"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ))}

                                  <button
                                    onClick={() => addRateToMethod(zone.region_code, method.code)}
                                    className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 flex items-center justify-center gap-2"
                                  >
                                    <Plus size={14} />
                                    Agregar tarifa
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Agregar método */}
                          <button
                            onClick={() => addMethodToZone(zone.region_code)}
                            className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
                          >
                            <Plus size={16} />
                            Agregar método de envío
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No hay zonas configuradas. Agrega regiones para configurar tarifas.
                </p>
              )}

              {/* Selector para agregar zona */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Agregar región</label>
                <select
                  onChange={(e) => {
                    const region = CHILE_REGIONS.find((r) => r.code === e.target.value);
                    if (region) addZone(region);
                    e.target.value = '';
                  }}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>Selecciona una región...</option>
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

          {/* Tab: Envío Gratis */}
          {activeTab === 'free_shipping' && (
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-gray-900 flex items-center gap-2">
                  <Gift size={18} className="text-gray-600" />
                  Reglas de Envío Gratis
                </h4>
                <button
                  onClick={addFreeShippingRule}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  <Plus size={14} />
                  Nueva regla
                </button>
              </div>

              {freeShippingRules.length > 0 ? (
                <div className="space-y-4">
                  {freeShippingRules.map((rule, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={rule.name}
                          onChange={(e) => updateFreeShippingRule(idx, { name: e.target.value })}
                          className="font-medium text-gray-900 bg-transparent border-none focus:outline-none flex-1"
                          placeholder="Nombre de la regla"
                        />
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={rule.is_active}
                              onChange={(e) =>
                                updateFreeShippingRule(idx, { is_active: e.target.checked })
                              }
                              className="rounded"
                            />
                            Activa
                          </label>
                          <button
                            onClick={() => removeFreeShippingRule(idx)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-gray-500">
                        Todas las condiciones deben cumplirse (lógica AND)
                      </p>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {/* Subtotal */}
                        <div>
                          <label className="text-xs text-gray-500">Subtotal mínimo ($)</label>
                          <input
                            type="number"
                            value={rule.min_subtotal || ''}
                            onChange={(e) =>
                              updateFreeShippingRule(idx, {
                                min_subtotal: e.target.value ? parseInt(e.target.value) : null,
                              })
                            }
                            placeholder="Sin mínimo"
                            className="w-full p-2 border border-gray-200 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Subtotal máximo ($)</label>
                          <input
                            type="number"
                            value={rule.max_subtotal || ''}
                            onChange={(e) =>
                              updateFreeShippingRule(idx, {
                                max_subtotal: e.target.value ? parseInt(e.target.value) : null,
                              })
                            }
                            placeholder="Sin límite"
                            className="w-full p-2 border border-gray-200 rounded text-sm"
                          />
                        </div>

                        {/* Peso */}
                        <div>
                          <label className="text-xs text-gray-500">Peso máximo (g)</label>
                          <input
                            type="number"
                            value={rule.max_weight_grams || ''}
                            onChange={(e) =>
                              updateFreeShippingRule(idx, {
                                max_weight_grams: e.target.value ? parseInt(e.target.value) : null,
                              })
                            }
                            placeholder="Sin límite"
                            className="w-full p-2 border border-gray-200 rounded text-sm"
                          />
                        </div>

                        {/* Items mínimos */}
                        <div>
                          <label className="text-xs text-gray-500">Items mínimos</label>
                          <input
                            type="number"
                            value={rule.min_items || ''}
                            onChange={(e) =>
                              updateFreeShippingRule(idx, {
                                min_items: e.target.value ? parseInt(e.target.value) : null,
                              })
                            }
                            placeholder="Sin mínimo"
                            className="w-full p-2 border border-gray-200 rounded text-sm"
                          />
                        </div>
                      </div>

                      {/* Aplica a zonas */}
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">
                          Aplica a zonas (dejar vacío = todas)
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {zones.map((zone) => (
                            <button
                              key={zone.region_code}
                              onClick={() => {
                                const current = rule.applies_to_zones || [];
                                const updated = current.includes(zone.region_code)
                                  ? current.filter((z) => z !== zone.region_code)
                                  : [...current, zone.region_code];
                                updateFreeShippingRule(idx, {
                                  applies_to_zones: updated.length > 0 ? updated : null,
                                });
                              }}
                              className={`text-xs px-2 py-1 rounded ${
                                rule.applies_to_zones?.includes(zone.region_code)
                                  ? 'bg-gray-900 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {zone.region_code}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Gift size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No hay reglas de envío gratis configuradas</p>
                  <button
                    onClick={addFreeShippingRule}
                    className="mt-3 text-sm text-gray-600 hover:text-gray-900"
                  >
                    + Crear primera regla
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Botón Guardar */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
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
