/**
 * Edge Function: calculate-shipping
 * Calcula tarifas de envío usando múltiples estrategias:
 * 1. Configuración manual del dashboard (zone_manual)
 * 2. Tarifas planas de Shopify (flat_shopify)
 * 3. Storefront API como fallback
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

interface ShippingRate {
  id: string;
  title: string;
  price: number;
  code: string;
  source: string;
}

interface ShippingConfig {
  shipping_type: 'flat_shopify' | 'zone_manual' | 'grumo_logistics';
  free_shipping_threshold: number | null;
  default_shipping_name: string;
  estimated_delivery: string;
  is_active: boolean;
}

interface ShippingZone {
  region_code: string;
  region_name: string;
  base_price: number;
  has_commune_breakdown: boolean;
  is_active: boolean;
  communes?: ShippingCommune[];
}

interface ShippingCommune {
  commune_code: string;
  commune_name: string;
  price: number;
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
    console.log('📥 Incoming request');

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

    // Obtener tokens Storefront API
    const storeDomains = Object.keys(itemsByStore);
    console.log(`🔍 Fetching tokens for ${storeDomains.length} stores`);

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
    const shippingRates: Record<string, ShippingRate[]> = {};
    const errors: Record<string, string> = {};

    // Función helper para calcular tarifas desde configuración del dashboard
    async function calculateFromDashboardConfig(
      storeId: number,
      storeDomain: string,
      subtotal: number,
      address: ShippingAddress
    ): Promise<ShippingRate[] | null> {
      try {
        // Obtener configuración de envío
        const { data: config } = await supabase
          .from('store_shipping_config')
          .select('*')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .single();

        if (!config || config.shipping_type === 'flat_shopify') {
          // No hay config o usa tarifas de Shopify
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
            console.log(`   ⚠️ No hay zonas configuradas para ${storeDomain}`);
            return null;
          }

          // Determinar la región del usuario
          const regionCode = PROVINCE_TO_REGION[address.province] || address.province;
          console.log(`   📍 Buscando zona para región: ${regionCode} (provincia: ${address.province})`);

          // Buscar zona que coincida con la región
          const matchingZone = zones.find(
            (z: ShippingZone) => z.region_code === regionCode || z.region_code === address.province
          );

          if (!matchingZone) {
            console.log(`   ⚠️ No hay zona configurada para ${regionCode}`);
            // Buscar si hay una zona "default" o usar la primera
            const defaultZone = zones[0];
            if (defaultZone) {
              console.log(`   📦 Usando zona por defecto: ${defaultZone.region_name}`);
            }
          }

          const zone = matchingZone || zones[0];
          if (!zone) return null;

          let price = zone.base_price;

          // Si hay desglose por comuna, buscar precio específico
          if (zone.has_commune_breakdown && zone.communes && zone.communes.length > 0) {
            const cityNormalized = address.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const matchingCommune = zone.communes.find((c: ShippingCommune) => {
              const communeNormalized = c.commune_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              return communeNormalized.includes(cityNormalized) || cityNormalized.includes(communeNormalized);
            });

            if (matchingCommune) {
              price = matchingCommune.price;
              console.log(`   🏘️ Comuna encontrada: ${matchingCommune.commune_name} - $${price}`);
            }
          }

          // Verificar envío gratis
          if (config.free_shipping_threshold && subtotal >= config.free_shipping_threshold) {
            console.log(`   🎉 Envío gratis! Subtotal ($${subtotal}) >= umbral ($${config.free_shipping_threshold})`);
            return [{
              id: 'dashboard-free',
              title: 'Envío gratis',
              price: 0,
              code: 'FREE',
              source: 'dashboard-zone-free',
            }];
          }

          const shippingName = config.default_shipping_name || 'Envío estándar';
          const estimatedDelivery = config.estimated_delivery ? ` (${config.estimated_delivery})` : '';

          return [{
            id: `dashboard-${zone.region_code}`,
            title: `${shippingName}${estimatedDelivery}`,
            price: price,
            code: zone.region_code,
            source: 'dashboard-zone-manual',
          }];
        }

        return null;
      } catch (error: any) {
        console.error(`   ❌ Error obteniendo config del dashboard:`, error.message);
        return null;
      }
    }

    for (const store of stores) {
      try {
        if (!store.access_token) {
          errors[store.domain] = 'Storefront API token not configured';
          continue;
        }

        const storeItems = itemsByStore[store.domain];
        console.log(`🏪 ${store.domain}: ${storeItems.length} items`);

        // OPTIMIZACIÓN UX: Calcular subtotal primero para decisión estratégica
        const subtotal = storeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        console.log(`   💰 Cart subtotal: $${subtotal}`);

        // PRIORIDAD 1: Intentar tarifas configuradas en el dashboard de Grumo
        console.log(`   🔍 Buscando configuración en dashboard para store_id: ${store.id}`);
        const dashboardRates = await calculateFromDashboardConfig(
          store.id,
          store.domain,
          subtotal,
          shippingAddress
        );

        if (dashboardRates && dashboardRates.length > 0) {
          console.log(`   ✅ Usando tarifas del dashboard: ${dashboardRates.length} opción(es)`);
          shippingRates[store.domain] = dashboardRates;
          continue; // Siguiente tienda
        }

        console.log(`   📦 No hay config en dashboard, usando Shopify...`);

        // PRIORIDAD 2: SKIP STOREFRONT API si subtotal muy bajo (mejora UX - respuesta instantánea)
        const FAST_PATH_THRESHOLD = 40000; // Mínimo razonable para tarifas nativas
        if (subtotal < FAST_PATH_THRESHOLD && store.admin_api_token) {
          console.log(`   ⚡ FAST PATH: Low subtotal - skipping Storefront API, using Admin API directly`);

          try {
            const shippingZonesResponse = await fetch(
              `https://${store.domain}/admin/api/2024-10/shipping_zones.json`,
              {
                headers: {
                  'X-Shopify-Access-Token': store.admin_api_token,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (shippingZonesResponse.ok) {
              const zonesData = await shippingZonesResponse.json();
              const zones = zonesData.shipping_zones || [];

              console.log(`   📋 Found ${zones.length} shipping zones`);

              const fixedRates: ShippingRate[] = [];
              const rateMap = new Map<string, ShippingRate>();

              for (const zone of zones) {
                const priceBasedRates = zone.price_based_shipping_rates || [];

                for (const rate of priceBasedRates) {
                  const minOrderSubtotal = parseFloat(rate.min_order_subtotal || '0');
                  const maxOrderSubtotal = rate.max_order_subtotal ? parseFloat(rate.max_order_subtotal) : Infinity;

                  if (subtotal >= minOrderSubtotal && subtotal <= maxOrderSubtotal) {
                    const price = parseFloat(rate.price);
                    const key = `${rate.name}-${price}`;

                    if (!rateMap.has(key) || rateMap.get(key)!.price > price) {
                      rateMap.set(key, {
                        id: `admin-${rate.id}`,
                        title: rate.name,
                        price: price,
                        code: rate.id.toString(),
                        source: 'admin-api-fast',
                      });
                    }
                  }
                }
              }

              fixedRates.push(...Array.from(rateMap.values()).sort((a, b) => a.price - b.price));

              if (fixedRates.length > 0) {
                shippingRates[store.domain] = fixedRates;
                console.log(`   ✅ FAST: Using ${fixedRates.length} native rate(s)`);
                continue;
              } else {
                // No hay tarifas nativas aplicables, usar default
                console.log(`   ⚡ FAST: Using default MVP rate $3.990`);
                shippingRates[store.domain] = [{
                  id: 'default-standard',
                  title: 'Envío estándar',
                  price: 3990,
                  code: 'STANDARD',
                  source: 'default-mvp-fast',
                }];
                continue;
              }
            }
          } catch (fastError: any) {
            console.error(`   ⚠️  Fast path failed:`, fastError.message);
            // Continuar con Storefront API normal
          }
        }

        // Paso 1: Crear Cart (reemplaza Checkout API deprecado)
        const cartCreateMutation = `
          mutation cartCreate($input: CartInput!) {
            cartCreate(input: $input) {
              cart {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const lines = storeItems.map((item) => ({
          merchandiseId: item.selectedVariant?.id || item.id,
          quantity: item.quantity,
        }));

        // Normalizar dirección para Storefront API
        const deliveryAddress = {
          address1: shippingAddress.address1,
          city: shippingAddress.city,
          province: shippingAddress.province,
          zip: shippingAddress.zip,
          country: 'CL', // Código de 2 letras
        };

        console.log(`   📋 Creating cart with delivery address...`);

        const cartResponse = await fetch(
          `https://${store.domain}/api/2024-10/graphql.json`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Storefront-Access-Token': store.access_token,
            },
            body: JSON.stringify({
              query: cartCreateMutation,
              variables: {
                input: {
                  lines,
                  buyerIdentity: {
                    deliveryAddressPreferences: [{
                      deliveryAddress
                    }]
                  },
                },
              },
            }),
          }
        );

        if (!cartResponse.ok) {
          const errorText = await cartResponse.text();
          console.error(`   ❌ Cart creation failed:`, errorText);
          errors[store.domain] = 'Failed to create cart';
          continue;
        }

        const cartData = await cartResponse.json();

        if (cartData.errors) {
          console.error(`   ❌ GraphQL errors:`, cartData.errors);
          errors[store.domain] = cartData.errors[0]?.message || 'Cart error';
          continue;
        }

        if (cartData.data?.cartCreate?.userErrors?.length > 0) {
          const userError = cartData.data.cartCreate.userErrors[0];
          console.error(`   ❌ User errors:`, userError);
          errors[store.domain] = userError.message;
          continue;
        }

        const cartId = cartData.data?.cartCreate?.cart?.id;

        if (!cartId) {
          errors[store.domain] = 'No cart ID returned';
          continue;
        }

        console.log(`   ✅ Cart created: ${cartId}`);

        // Paso 2: Poll para esperar a que las tarifas estén listas (OPTIMIZADO PARA UX)
        console.log(`   ⏳ Polling for shipping rates...`);

        const cartQuery = `
          query getCart($cartId: ID!) {
            cart(id: $cartId) {
              deliveryGroups(first: 10) {
                edges {
                  node {
                    deliveryOptions {
                      handle
                      title
                      estimatedCost {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        // Subtotal ya calculado arriba en línea 100
        const MIN_THRESHOLD = 40000;
        const useQuickFallback = subtotal < MIN_THRESHOLD;

        let attempts = 0;
        const MAX_ATTEMPTS = useQuickFallback ? 3 : 5; // Reducido: 3 intentos (~3s) o 5 (~5s)
        let deliveryOptions: any[] = [];
        let ratesReady = false;

        if (useQuickFallback) {
          console.log(`   ⚡ Quick mode: Low subtotal ($${subtotal}) - will fallback fast to Admin API`);
        }

        while (attempts < MAX_ATTEMPTS && !ratesReady) {
          attempts++;

          // Esperar antes de cada intento (REDUCIDO)
          if (attempts > 1) {
            await new Promise(resolve => setTimeout(resolve, 800)); // Reducido de 1500ms a 800ms
          } else {
            // Primer intento: esperar menos
            await new Promise(resolve => setTimeout(resolve, 500)); // Reducido de 1000ms a 500ms
          }

          console.log(`   📥 Attempt ${attempts}/${MAX_ATTEMPTS} - Fetching delivery options...`);

          const ratesResponse = await fetch(
            `https://${store.domain}/api/2024-10/graphql.json`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Storefront-Access-Token': store.access_token,
              },
              body: JSON.stringify({
                query: cartQuery,
                variables: { cartId },
              }),
            }
          );

          if (!ratesResponse.ok) {
            const errorText = await ratesResponse.text();
            console.error(`   ❌ Failed to fetch rates:`, errorText);

            if (attempts >= MAX_ATTEMPTS) {
              errors[store.domain] = 'Failed to fetch shipping rates';
            }
            continue;
          }

          const ratesData = await ratesResponse.json();

          if (ratesData.errors) {
            console.error(`   ❌ GraphQL errors:`, ratesData.errors);

            if (attempts >= MAX_ATTEMPTS) {
              errors[store.domain] = ratesData.errors[0]?.message || 'Rates query error';
            }
            continue;
          }

          const deliveryGroups = ratesData.data?.cart?.deliveryGroups?.edges || [];

          if (deliveryGroups.length > 0) {
            deliveryOptions = deliveryGroups[0]?.node?.deliveryOptions || [];

            if (deliveryOptions.length > 0) {
              ratesReady = true;
              console.log(`   ✅ Rates ready! Found ${deliveryOptions.length} options`);
              break;
            } else {
              console.log(`   ⏳ Delivery group exists but no options yet...`);
            }
          } else {
            console.log(`   ⏳ No delivery groups yet...`);
          }
        }

        if (!ratesReady || deliveryOptions.length === 0) {
          console.warn(`   ⚠️  Storefront API didn't return rates - trying Admin API fallback...`);

          // FALLBACK: Obtener tarifas fijas desde Shopify Admin API
          if (store.admin_api_token) {
            try {
              console.log(`   🔄 Fetching shipping zones from Admin API...`);

              const shippingZonesResponse = await fetch(
                `https://${store.domain}/admin/api/2024-10/shipping_zones.json`,
                {
                  headers: {
                    'X-Shopify-Access-Token': store.admin_api_token,
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (shippingZonesResponse.ok) {
                const zonesData = await shippingZonesResponse.json();
                const zones = zonesData.shipping_zones || [];

                console.log(`   📋 Found ${zones.length} shipping zones`);
                // Subtotal ya calculado arriba en línea 210

                // Extraer todas las tarifas basadas en precio
                const fixedRates: ShippingRate[] = [];
                const rateMap = new Map<string, ShippingRate>(); // Para eliminar duplicados

                for (const zone of zones) {
                  const priceBasedRates = zone.price_based_shipping_rates || [];
                  const weightBasedRates = zone.weight_based_shipping_rates || [];

                  // Procesar tarifas basadas en precio
                  for (const rate of priceBasedRates) {
                    const minOrderSubtotal = parseFloat(rate.min_order_subtotal || '0');
                    const maxOrderSubtotal = rate.max_order_subtotal ? parseFloat(rate.max_order_subtotal) : Infinity;

                    // Verificar si el subtotal califica para esta tarifa
                    if (subtotal >= minOrderSubtotal && subtotal <= maxOrderSubtotal) {
                      const price = parseFloat(rate.price);
                      const key = `${rate.name}-${price}`;

                      // Solo agregar si no existe o si tiene menor precio
                      if (!rateMap.has(key) || rateMap.get(key)!.price > price) {
                        rateMap.set(key, {
                          id: `admin-${rate.id}`,
                          title: rate.name,
                          price: price,
                          code: rate.id.toString(),
                          source: 'admin-api-fixed',
                        });
                      }
                    }
                  }

                  // Procesar tarifas basadas en peso (si no hay basadas en precio)
                  if (priceBasedRates.length === 0) {
                    for (const rate of weightBasedRates) {
                      const price = parseFloat(rate.price);
                      const key = `${rate.name}-${price}`;

                      if (!rateMap.has(key)) {
                        rateMap.set(key, {
                          id: `admin-weight-${rate.id}`,
                          title: rate.name,
                          price: price,
                          code: rate.id.toString(),
                          source: 'admin-api-weight',
                        });
                      }
                    }
                  }
                }

                // Convertir a array y ordenar: gratis primero, luego por precio
                fixedRates.push(...Array.from(rateMap.values()).sort((a, b) => a.price - b.price));

                if (fixedRates.length > 0) {
                  shippingRates[store.domain] = fixedRates;
                  console.log(`   ✅ Using ${fixedRates.length} fixed rate(s) from Admin API`);
                  continue;
                } else {
                  console.log(`   ⚠️  No applicable rates found for subtotal $${subtotal}`);
                  console.log(`   ℹ️  Using default MVP rate: $3.990`);

                  // MVP: Mostrar tarifa default cuando no califican para tarifas nativas
                  shippingRates[store.domain] = [{
                    id: 'default-standard',
                    title: 'Envío estándar',
                    price: 3990,
                    code: 'STANDARD',
                    source: 'default-mvp',
                  }];
                  continue;
                }
              }
            } catch (adminError: any) {
              console.error(`   ❌ Admin API fallback failed:`, adminError.message);
            }
          } else {
            console.log(`   ⚠️  No admin_api_token available for fallback`);
          }

          // Si todo falla, usar tarifa default MVP
          console.log(`   ℹ️  Final fallback: Using default MVP rate $3.990`);
          shippingRates[store.domain] = [{
            id: 'default-standard',
            title: 'Envío estándar',
            price: 3990,
            code: 'STANDARD',
            source: 'default-mvp',
          }];
          continue;
        }

        // Convertir a nuestro formato
        shippingRates[store.domain] = deliveryOptions.map((option: any) => ({
          id: option.handle,
          title: option.title,
          price: parseFloat(option.estimatedCost.amount),
          code: option.handle,
          source: 'storefront-cart',
        }));

        console.log(`   ✅ Successfully retrieved ${shippingRates[store.domain].length} shipping options`);

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

    console.log(`✅ Completed. Success: ${response.success}`);

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
