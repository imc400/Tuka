/**
 * Edge Function: calculate-shipping (v2 - Advanced)
 * Calcula tarifas de envío usando el sistema avanzado:
 * 1. Múltiples métodos por zona (Estándar, Express, Same Day)
 * 2. Tarifas con condiciones de peso Y precio
 * 3. Envío gratis con condiciones combinables
 * 4. Fallback a Shopify Admin API si no hay configuración
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CartItem {
  id: string;
  quantity: number;
  price: number;
  storeId: string;
  selectedVariant?: { id: string };
}

interface ShippingAddress {
  address1: string;
  city: string;
  province: string;
  zip: string;
  country_code: string;
}

interface ShippingRateResponse {
  id: string;
  title: string;
  price: number;
  code: string;
  source: string;
  estimatedDelivery?: string;
  methodCode?: string;
}

interface ShippingMethod {
  id: string;
  zone_id: string;
  name: string;
  code: string;
  description: string | null;
  estimated_delivery: string | null;
  sort_order: number;
  is_active: boolean;
}

interface ShippingRate {
  id: string;
  method_id: string;
  name: string | null;
  min_weight_grams: number;
  max_weight_grams: number | null;
  min_subtotal: number;
  max_subtotal: number | null;
  price: number;
  price_per_extra_kg: number;
  priority: number;
  is_active: boolean;
}

interface FreeShippingRule {
  id: string;
  store_id: number;
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

interface CommuneRate {
  id: string;
  method_id: string;
  commune_code: string;
  commune_name: string;
  price_override: number | null;
  price_adjustment: number;
  is_active: boolean;
}

// Mapeo de provincias a códigos de región
const PROVINCE_TO_REGION: Record<string, string> = {
  'Región Metropolitana de Santiago': 'RM',
  'Santiago Metropolitan': 'RM',
  'Santiago': 'RM',
  'Metropolitana': 'RM',
  'Valparaíso': 'V',
  'Biobío': 'VIII',
  'Bio Bio': 'VIII',
  'Maule': 'VII',
  "O'Higgins": 'VI',
  'Araucanía': 'IX',
  'La Araucanía': 'IX',
  'Los Lagos': 'X',
  'Los Ríos': 'XIV',
  'Coquimbo': 'IV',
  'Antofagasta': 'II',
  'Atacama': 'III',
  'Tarapacá': 'I',
  'Arica y Parinacota': 'XV',
  'Aysén': 'XI',
  'Magallanes': 'XII',
  'Ñuble': 'XVI',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('📥 Incoming request - Advanced Shipping v2');

    const { cartItems, shippingAddress }: {
      cartItems: CartItem[];
      shippingAddress: ShippingAddress;
    } = body;

    console.log(`📦 Calculating shipping for ${cartItems.length} items`);

    // Agrupar items por tienda
    const itemsByStore: Record<string, CartItem[]> = {};
    cartItems.forEach((item) => {
      const domain = item.storeId.replace(/^real-/, '');
      if (!itemsByStore[domain]) itemsByStore[domain] = [];
      itemsByStore[domain].push(item);
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obtener tiendas
    const storeDomains = Object.keys(itemsByStore);
    console.log(`🔍 Fetching data for ${storeDomains.length} stores`);

    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, domain, access_token, admin_api_token')
      .in('domain', storeDomains);

    if (storesError) {
      throw new Error(`Error fetching stores: ${storesError.message}`);
    }

    if (!stores || stores.length === 0) {
      throw new Error('Stores not found');
    }

    // Calcular shipping para cada tienda
    const shippingRates: Record<string, ShippingRateResponse[]> = {};
    const errors: Record<string, string> = {};

    for (const store of stores) {
      try {
        const storeItems = itemsByStore[store.domain];
        console.log(`\n🏪 ${store.domain}: ${storeItems.length} items`);

        // Calcular subtotal
        const subtotal = storeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        console.log(`   💰 Subtotal: $${subtotal.toLocaleString()}`);

        // Calcular cantidad de items
        const totalItems = storeItems.reduce((sum, item) => sum + item.quantity, 0);
        console.log(`   📦 Total items: ${totalItems}`);

        // Calcular peso total del carrito
        const totalWeightGrams = await calculateCartWeight(supabase, storeItems);
        console.log(`   ⚖️  Total weight: ${totalWeightGrams}g (${(totalWeightGrams / 1000).toFixed(2)}kg)`);

        // Intentar calcular con el sistema avanzado del dashboard
        const advancedRates = await calculateAdvancedShipping(
          supabase,
          store.id,
          store.domain,
          subtotal,
          totalWeightGrams,
          totalItems,
          shippingAddress
        );

        if (advancedRates && advancedRates.length > 0) {
          console.log(`   ✅ Advanced shipping: ${advancedRates.length} método(s)`);
          shippingRates[store.domain] = advancedRates;
          continue;
        }

        // Fallback: Sistema legacy del dashboard
        const legacyRates = await calculateLegacyDashboardShipping(
          supabase,
          store.id,
          store.domain,
          subtotal,
          shippingAddress
        );

        if (legacyRates && legacyRates.length > 0) {
          console.log(`   ✅ Legacy dashboard shipping: ${legacyRates.length} opción(es)`);
          shippingRates[store.domain] = legacyRates;
          continue;
        }

        // Fallback: Shopify Admin API
        if (store.admin_api_token) {
          const shopifyRates = await calculateShopifyAdminShipping(
            store.domain,
            store.admin_api_token,
            subtotal
          );

          if (shopifyRates && shopifyRates.length > 0) {
            console.log(`   ✅ Shopify Admin API: ${shopifyRates.length} opción(es)`);
            shippingRates[store.domain] = shopifyRates;
            continue;
          }
        }

        // Fallback final: Tarifa MVP default
        console.log(`   ℹ️  Using default MVP rate: $3.990`);
        shippingRates[store.domain] = [{
          id: 'default-standard',
          title: 'Envío estándar',
          price: 3990,
          code: 'STANDARD',
          source: 'default-mvp',
        }];

      } catch (error: any) {
        console.error(`   ❌ Error processing ${store.domain}:`, error.message);
        errors[store.domain] = error.message;
      }
    }

    const response = {
      success: Object.keys(shippingRates).length > 0,
      shippingRates,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    };

    console.log(`\n✅ Completed. Success: ${response.success}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Shipping calculation error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * Calcula el peso total del carrito consultando product_variants
 */
async function calculateCartWeight(
  supabase: any,
  cartItems: CartItem[]
): Promise<number> {
  try {
    // Extraer variant IDs del carrito
    const variantIds: string[] = [];
    cartItems.forEach(item => {
      if (item.selectedVariant?.id) {
        // El ID viene como gid://shopify/ProductVariant/123456
        const numericId = item.selectedVariant.id.split('/').pop();
        if (numericId) variantIds.push(numericId);
      }
    });

    if (variantIds.length === 0) {
      console.log(`   ⚖️  No variant IDs found, using default weight`);
      return 500 * cartItems.reduce((sum, item) => sum + item.quantity, 0); // 500g default per item
    }

    // Consultar pesos de las variantes
    const { data: variants, error } = await supabase
      .from('product_variants')
      .select('shopify_variant_id, weight, weight_unit')
      .in('shopify_variant_id', variantIds);

    if (error || !variants) {
      console.log(`   ⚠️  Error fetching weights:`, error?.message);
      return 500 * cartItems.reduce((sum, item) => sum + item.quantity, 0);
    }

    // Crear mapa de pesos
    const weightMap: Record<string, number> = {};
    variants.forEach((v: any) => {
      let weightGrams = v.weight || 0;
      // Convertir a gramos según unidad (weight_unit es KILOGRAMS por defecto)
      if (v.weight_unit === 'KILOGRAMS' || v.weight_unit === 'kg') {
        weightGrams = weightGrams * 1000;
      } else if (v.weight_unit === 'POUNDS' || v.weight_unit === 'lb') {
        weightGrams = weightGrams * 453.592;
      } else if (v.weight_unit === 'OUNCES' || v.weight_unit === 'oz') {
        weightGrams = weightGrams * 28.3495;
      }
      // Si ya está en gramos (GRAMS, g), no convertir
      weightMap[v.shopify_variant_id] = weightGrams;
    });

    // Calcular peso total
    let totalWeight = 0;
    cartItems.forEach(item => {
      if (item.selectedVariant?.id) {
        const numericId = item.selectedVariant.id.split('/').pop();
        if (numericId && weightMap[numericId]) {
          totalWeight += weightMap[numericId] * item.quantity;
        } else {
          // Default 500g si no se encuentra
          totalWeight += 500 * item.quantity;
        }
      } else {
        totalWeight += 500 * item.quantity;
      }
    });

    return Math.round(totalWeight);
  } catch (error: any) {
    console.error(`   ⚠️  Error calculating weight:`, error.message);
    return 500 * cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }
}

/**
 * Sistema avanzado de envíos con múltiples métodos y tarifas por peso/precio
 */
async function calculateAdvancedShipping(
  supabase: any,
  storeId: number,
  storeDomain: string,
  subtotal: number,
  weightGrams: number,
  totalItems: number,
  address: ShippingAddress
): Promise<ShippingRateResponse[] | null> {
  try {
    // Determinar la región del usuario
    const regionCode = PROVINCE_TO_REGION[address.province] || address.province;
    console.log(`   📍 Region: ${regionCode} (province: ${address.province})`);

    // Obtener zonas de la tienda con métodos y tarifas
    const { data: zones, error: zonesError } = await supabase
      .from('store_shipping_zones')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true);

    if (zonesError || !zones || zones.length === 0) {
      console.log(`   ⚠️  No shipping zones found for store ${storeId}`);
      return null;
    }

    // Buscar zona que coincida con la región
    let matchingZone = zones.find(
      (z: any) => z.region_code === regionCode || z.region_code === address.province
    );

    // Si no hay zona específica, usar la primera como default
    if (!matchingZone) {
      console.log(`   ⚠️  No zone for region ${regionCode}, using first zone as default`);
      matchingZone = zones[0];
    }

    console.log(`   📦 Using zone: ${matchingZone.region_name} (${matchingZone.region_code})`);

    // Obtener métodos de envío para esta zona
    const { data: methods, error: methodsError } = await supabase
      .from('store_shipping_methods')
      .select('*')
      .eq('zone_id', matchingZone.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (methodsError || !methods || methods.length === 0) {
      console.log(`   ⚠️  No shipping methods found for zone ${matchingZone.id}`);
      return null;
    }

    console.log(`   📋 Found ${methods.length} shipping methods`);

    // Obtener reglas de envío gratis para la tienda
    const { data: freeShippingRules } = await supabase
      .from('store_free_shipping_rules')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    // Calcular tarifas para cada método
    const rates: ShippingRateResponse[] = [];

    for (const method of methods as ShippingMethod[]) {
      // Obtener tarifas del método
      const { data: methodRates } = await supabase
        .from('store_shipping_rates')
        .select('*')
        .eq('method_id', method.id)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (!methodRates || methodRates.length === 0) {
        console.log(`   ⚠️  No rates for method ${method.name}`);
        continue;
      }

      // Encontrar la tarifa que aplica según peso Y subtotal
      const applicableRate = findApplicableRate(methodRates, weightGrams, subtotal);

      if (!applicableRate) {
        console.log(`   ⚠️  No applicable rate for method ${method.name} (weight: ${weightGrams}g, subtotal: $${subtotal})`);
        continue;
      }

      // Calcular precio base
      let finalPrice = applicableRate.price;

      // Si hay precio por kg extra y el peso excede el máximo
      if (applicableRate.price_per_extra_kg > 0 && applicableRate.max_weight_grams) {
        const excessGrams = weightGrams - applicableRate.max_weight_grams;
        if (excessGrams > 0) {
          const extraKgs = Math.ceil(excessGrams / 1000);
          finalPrice += extraKgs * applicableRate.price_per_extra_kg;
          console.log(`   📦 Extra weight charge: ${extraKgs}kg × $${applicableRate.price_per_extra_kg} = $${extraKgs * applicableRate.price_per_extra_kg}`);
        }
      }

      // Verificar ajustes por comuna
      const communeAdjustment = await getCommuneAdjustment(supabase, method.id, address.city);
      if (communeAdjustment.override !== null) {
        finalPrice = communeAdjustment.override;
        console.log(`   🏘️ Commune override: $${finalPrice}`);
      } else if (communeAdjustment.adjustment !== 0) {
        finalPrice += communeAdjustment.adjustment;
        console.log(`   🏘️ Commune adjustment: ${communeAdjustment.adjustment > 0 ? '+' : ''}$${communeAdjustment.adjustment}`);
      }

      // Verificar si aplica envío gratis
      const freeShippingApplies = checkFreeShipping(
        freeShippingRules || [],
        method.code,
        matchingZone.region_code,
        subtotal,
        weightGrams,
        totalItems
      );

      if (freeShippingApplies) {
        console.log(`   🎉 Free shipping applies for ${method.name}!`);
        finalPrice = 0;
      }

      // Construir título con tiempo de entrega
      let title = method.name;
      if (method.estimated_delivery && finalPrice > 0) {
        title = `${method.name} (${method.estimated_delivery})`;
      } else if (finalPrice === 0) {
        title = `${method.name} - ¡Gratis!`;
        if (method.estimated_delivery) {
          title = `${method.name} (${method.estimated_delivery}) - ¡Gratis!`;
        }
      }

      rates.push({
        id: `advanced-${method.id}`,
        title,
        price: finalPrice,
        code: method.code,
        source: 'dashboard-advanced',
        estimatedDelivery: method.estimated_delivery || undefined,
        methodCode: method.code,
      });

      console.log(`   ✅ ${method.name}: $${finalPrice.toLocaleString()}`);
    }

    // Ordenar: gratis primero, luego por precio
    rates.sort((a, b) => {
      if (a.price === 0 && b.price !== 0) return -1;
      if (a.price !== 0 && b.price === 0) return 1;
      return a.price - b.price;
    });

    return rates.length > 0 ? rates : null;

  } catch (error: any) {
    console.error(`   ❌ Error in advanced shipping:`, error.message);
    return null;
  }
}

/**
 * Encuentra la tarifa aplicable según peso y subtotal
 */
function findApplicableRate(
  rates: ShippingRate[],
  weightGrams: number,
  subtotal: number
): ShippingRate | null {
  // Ordenar por prioridad (mayor primero)
  const sortedRates = [...rates].sort((a, b) => b.priority - a.priority);

  for (const rate of sortedRates) {
    // Verificar condición de peso
    const weightOk = weightGrams >= rate.min_weight_grams &&
      (rate.max_weight_grams === null || weightGrams <= rate.max_weight_grams);

    // Verificar condición de subtotal
    const subtotalOk = subtotal >= rate.min_subtotal &&
      (rate.max_subtotal === null || subtotal <= rate.max_subtotal);

    // Ambas condiciones deben cumplirse (AND logic)
    if (weightOk && subtotalOk) {
      return rate;
    }
  }

  // Si ninguna tarifa específica aplica, buscar la más genérica (sin límites)
  const genericRate = sortedRates.find(rate =>
    rate.min_weight_grams === 0 &&
    rate.max_weight_grams === null &&
    rate.min_subtotal === 0 &&
    rate.max_subtotal === null
  );

  return genericRate || sortedRates[sortedRates.length - 1] || null;
}

/**
 * Obtiene ajuste de precio por comuna
 */
async function getCommuneAdjustment(
  supabase: any,
  methodId: string,
  city: string
): Promise<{ override: number | null; adjustment: number }> {
  try {
    // Normalizar nombre de ciudad para búsqueda
    const cityNormalized = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const { data: communeRates } = await supabase
      .from('store_shipping_commune_rates')
      .select('*')
      .eq('method_id', methodId)
      .eq('is_active', true);

    if (!communeRates || communeRates.length === 0) {
      return { override: null, adjustment: 0 };
    }

    // Buscar comuna que coincida
    const matchingCommune = communeRates.find((c: CommuneRate) => {
      const communeNormalized = c.commune_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return communeNormalized.includes(cityNormalized) || cityNormalized.includes(communeNormalized);
    });

    if (matchingCommune) {
      return {
        override: matchingCommune.price_override,
        adjustment: matchingCommune.price_adjustment || 0,
      };
    }

    return { override: null, adjustment: 0 };
  } catch {
    return { override: null, adjustment: 0 };
  }
}

/**
 * Verifica si aplica envío gratis según las reglas configuradas
 */
function checkFreeShipping(
  rules: FreeShippingRule[],
  methodCode: string,
  zoneCode: string,
  subtotal: number,
  weightGrams: number,
  totalItems: number
): boolean {
  if (!rules || rules.length === 0) return false;

  // Ordenar por prioridad (mayor primero)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    // Verificar si aplica a este método
    if (rule.applies_to_methods && rule.applies_to_methods.length > 0) {
      if (!rule.applies_to_methods.includes(methodCode)) continue;
    }

    // Verificar si aplica a esta zona
    if (rule.applies_to_zones && rule.applies_to_zones.length > 0) {
      if (!rule.applies_to_zones.includes(zoneCode)) continue;
    }

    // Verificar todas las condiciones (AND logic - todas deben cumplirse)
    let allConditionsMet = true;

    // Condición de subtotal mínimo
    if (rule.min_subtotal !== null && subtotal < rule.min_subtotal) {
      allConditionsMet = false;
    }

    // Condición de subtotal máximo
    if (rule.max_subtotal !== null && subtotal > rule.max_subtotal) {
      allConditionsMet = false;
    }

    // Condición de peso mínimo
    if (rule.min_weight_grams !== null && weightGrams < rule.min_weight_grams) {
      allConditionsMet = false;
    }

    // Condición de peso máximo
    if (rule.max_weight_grams !== null && weightGrams > rule.max_weight_grams) {
      allConditionsMet = false;
    }

    // Condición de cantidad mínima de items
    if (rule.min_items !== null && totalItems < rule.min_items) {
      allConditionsMet = false;
    }

    if (allConditionsMet) {
      console.log(`   🎁 Free shipping rule matched: "${rule.name}"`);
      return true;
    }
  }

  return false;
}

/**
 * Sistema legacy del dashboard (para compatibilidad)
 */
async function calculateLegacyDashboardShipping(
  supabase: any,
  storeId: number,
  storeDomain: string,
  subtotal: number,
  address: ShippingAddress
): Promise<ShippingRateResponse[] | null> {
  try {
    // Obtener configuración de envío legacy
    const { data: config } = await supabase
      .from('store_shipping_config')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .single();

    if (!config || config.shipping_type === 'flat_shopify') {
      return null;
    }

    if (config.shipping_type === 'zone_manual') {
      // Obtener zonas configuradas
      const { data: zones } = await supabase
        .from('store_shipping_zones')
        .select(`
          *,
          communes:store_shipping_communes(*)
        `)
        .eq('store_id', storeId)
        .eq('is_active', true);

      if (!zones || zones.length === 0) {
        return null;
      }

      // Determinar la región del usuario
      const regionCode = PROVINCE_TO_REGION[address.province] || address.province;

      // Buscar zona que coincida
      const matchingZone = zones.find(
        (z: any) => z.region_code === regionCode || z.region_code === address.province
      );

      const zone = matchingZone || zones[0];
      if (!zone) return null;

      let price = zone.base_price;

      // Si hay desglose por comuna
      if (zone.has_commune_breakdown && zone.communes && zone.communes.length > 0) {
        const cityNormalized = address.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const matchingCommune = zone.communes.find((c: any) => {
          const communeNormalized = c.commune_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return communeNormalized.includes(cityNormalized) || cityNormalized.includes(communeNormalized);
        });

        if (matchingCommune) {
          price = matchingCommune.price;
        }
      }

      // Verificar envío gratis (legacy)
      if (config.free_shipping_threshold && subtotal >= config.free_shipping_threshold) {
        return [{
          id: 'legacy-free',
          title: 'Envío gratis',
          price: 0,
          code: 'FREE',
          source: 'dashboard-legacy-free',
        }];
      }

      const shippingName = config.default_shipping_name || 'Envío estándar';
      const estimatedDelivery = config.estimated_delivery ? ` (${config.estimated_delivery})` : '';

      return [{
        id: `legacy-${zone.region_code}`,
        title: `${shippingName}${estimatedDelivery}`,
        price: price,
        code: zone.region_code,
        source: 'dashboard-legacy',
      }];
    }

    return null;
  } catch (error: any) {
    console.error(`   ❌ Error in legacy shipping:`, error.message);
    return null;
  }
}

/**
 * Fallback a Shopify Admin API
 */
async function calculateShopifyAdminShipping(
  storeDomain: string,
  adminToken: string,
  subtotal: number
): Promise<ShippingRateResponse[] | null> {
  try {
    console.log(`   🔄 Fetching from Shopify Admin API...`);

    const response = await fetch(
      `https://${storeDomain}/admin/api/2024-10/shipping_zones.json`,
      {
        headers: {
          'X-Shopify-Access-Token': adminToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`   ❌ Shopify API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const zones = data.shipping_zones || [];

    const rates: ShippingRateResponse[] = [];
    const rateMap = new Map<string, ShippingRateResponse>();

    for (const zone of zones) {
      const priceBasedRates = zone.price_based_shipping_rates || [];
      const weightBasedRates = zone.weight_based_shipping_rates || [];

      // Procesar tarifas basadas en precio
      for (const rate of priceBasedRates) {
        const minOrderSubtotal = parseFloat(rate.min_order_subtotal || '0');
        const maxOrderSubtotal = rate.max_order_subtotal ? parseFloat(rate.max_order_subtotal) : Infinity;

        if (subtotal >= minOrderSubtotal && subtotal <= maxOrderSubtotal) {
          const price = parseFloat(rate.price);
          const key = `${rate.name}-${price}`;

          if (!rateMap.has(key) || rateMap.get(key)!.price > price) {
            rateMap.set(key, {
              id: `shopify-${rate.id}`,
              title: rate.name,
              price: price,
              code: rate.id.toString(),
              source: 'shopify-admin',
            });
          }
        }
      }

      // Si no hay tarifas por precio, usar las de peso
      if (priceBasedRates.length === 0 && weightBasedRates.length > 0) {
        for (const rate of weightBasedRates) {
          const price = parseFloat(rate.price);
          const key = `${rate.name}-${price}`;

          if (!rateMap.has(key)) {
            rateMap.set(key, {
              id: `shopify-weight-${rate.id}`,
              title: rate.name,
              price: price,
              code: rate.id.toString(),
              source: 'shopify-admin-weight',
            });
          }
        }
      }
    }

    rates.push(...Array.from(rateMap.values()).sort((a, b) => a.price - b.price));

    return rates.length > 0 ? rates : null;
  } catch (error: any) {
    console.error(`   ❌ Shopify Admin API error:`, error.message);
    return null;
  }
}
