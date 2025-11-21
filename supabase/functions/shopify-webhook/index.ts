/**
 * SHOPIFY WEBHOOK HANDLER
 *
 * Recibe notificaciones en tiempo real de Shopify cuando:
 * - Se crea un producto
 * - Se actualiza un producto (precio, título, etc)
 * - Se elimina un producto
 * - Cambia el inventario/stock
 *
 * Esto mantiene Supabase sincronizado en tiempo real con Shopify
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-topic, x-shopify-hmac-sha256, x-shopify-shop-domain',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get webhook metadata from headers
    const topic = req.headers.get('X-Shopify-Topic')
    const shopDomain = req.headers.get('X-Shopify-Shop-Domain')
    const hmac = req.headers.get('X-Shopify-Hmac-Sha256')

    console.log(`📥 Webhook received: ${topic} from ${shopDomain}`)

    if (!topic || !shopDomain) {
      return new Response(
        JSON.stringify({ error: 'Missing required headers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // TODO: Verify HMAC signature for security (importante para producción)
    // const isValid = await verifyShopifyHmac(req, hmac)
    // if (!isValid) {
    //   return new Response('Invalid signature', { status: 401 })
    // }

    const payload = await req.json()

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Use service role for admin access
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Route to appropriate handler based on topic
    switch (topic) {
      case 'products/create':
        await handleProductCreate(supabase, shopDomain, payload)
        break

      case 'products/update':
        await handleProductUpdate(supabase, shopDomain, payload)
        break

      case 'products/delete':
        await handleProductDelete(supabase, shopDomain, payload)
        break

      case 'inventory_levels/update':
        await handleInventoryUpdate(supabase, shopDomain, payload)
        break

      default:
        console.log(`⚠️ Unhandled webhook topic: ${topic}`)
    }

    return new Response(
      JSON.stringify({ success: true, topic }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('❌ Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Handle new product creation
 */
async function handleProductCreate(supabase: any, shopDomain: string, product: any) {
  console.log(`✨ Creating product: ${product.title}`)

  const productData = {
    id: `gid://shopify/Product/${product.id}`,
    store_domain: shopDomain,
    title: product.title,
    description: product.body_html || '',
    price: parseFloat(product.variants[0]?.price || '0'),
    compare_at_price: product.variants[0]?.compare_at_price
      ? parseFloat(product.variants[0].compare_at_price)
      : null,
    vendor: product.vendor || '',
    product_type: product.product_type || '',
    tags: product.tags ? product.tags.split(', ') : [],
    images: product.images?.map((img: any) => img.src) || [],
    available: product.variants?.some((v: any) =>
      v.inventory_quantity > 0 || v.inventory_policy === 'continue'
    ) || false,
    synced_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('products')
    .insert(productData)

  if (error) {
    console.error('Error creating product:', error)
    throw error
  }

  // Create variants
  for (const variant of product.variants || []) {
    await upsertVariant(supabase, product.id, variant)
  }

  console.log(`✅ Product created: ${product.title}`)
}

/**
 * Handle product updates (price, title, description, etc)
 */
async function handleProductUpdate(supabase: any, shopDomain: string, product: any) {
  console.log(`🔄 Updating product: ${product.title}`)

  const productData = {
    id: `gid://shopify/Product/${product.id}`,
    store_domain: shopDomain,
    title: product.title,
    description: product.body_html || '',
    price: parseFloat(product.variants[0]?.price || '0'),
    compare_at_price: product.variants[0]?.compare_at_price
      ? parseFloat(product.variants[0].compare_at_price)
      : null,
    vendor: product.vendor || '',
    product_type: product.product_type || '',
    tags: product.tags ? product.tags.split(', ') : [],
    images: product.images?.map((img: any) => img.src) || [],
    available: product.variants?.some((v: any) =>
      v.inventory_quantity > 0 || v.inventory_policy === 'continue'
    ) || false,
    synced_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('products')
    .upsert(productData, { onConflict: 'id' })

  if (error) {
    console.error('Error updating product:', error)
    throw error
  }

  // Update variants
  for (const variant of product.variants || []) {
    await upsertVariant(supabase, product.id, variant)
  }

  console.log(`✅ Product updated: ${product.title}`)
}

/**
 * Handle product deletion
 */
async function handleProductDelete(supabase: any, shopDomain: string, product: any) {
  console.log(`🗑️ Deleting product ID: ${product.id}`)

  const productId = `gid://shopify/Product/${product.id}`

  // Delete variants first (foreign key constraint)
  await supabase
    .from('product_variants')
    .delete()
    .eq('product_id', productId)

  // Delete product
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)

  if (error) {
    console.error('Error deleting product:', error)
    throw error
  }

  console.log(`✅ Product deleted: ${product.id}`)
}

/**
 * Handle inventory/stock changes (CRITICAL for e-commerce)
 */
async function handleInventoryUpdate(supabase: any, shopDomain: string, inventory: any) {
  console.log(`📦 Inventory update - Item: ${inventory.inventory_item_id}, Available: ${inventory.available}`)

  // Get variant by inventory_item_id
  const variantId = `gid://shopify/ProductVariant/${inventory.inventory_item_id}`

  // Update variant availability
  const { error: variantError } = await supabase
    .from('product_variants')
    .update({
      available: inventory.available > 0,
      inventory_quantity: inventory.available
    })
    .eq('id', variantId)

  if (variantError) {
    console.error('Error updating variant inventory:', variantError)
  }

  // Update product availability (if ALL variants are out of stock, mark product unavailable)
  const { data: variants } = await supabase
    .from('product_variants')
    .select('available, product_id')
    .eq('id', variantId)
    .single()

  if (variants) {
    // Check if ANY variant of this product is available
    const { data: allVariants } = await supabase
      .from('product_variants')
      .select('available')
      .eq('product_id', variants.product_id)

    const productAvailable = allVariants?.some((v: any) => v.available) || false

    await supabase
      .from('products')
      .update({
        available: productAvailable,
        synced_at: new Date().toISOString()
      })
      .eq('id', variants.product_id)
  }

  console.log(`✅ Inventory updated`)
}

/**
 * Helper: Upsert product variant
 */
async function upsertVariant(supabase: any, productId: string, variant: any) {
  const variantData = {
    id: `gid://shopify/ProductVariant/${variant.id}`,
    product_id: `gid://shopify/Product/${productId}`,
    title: variant.title,
    price: parseFloat(variant.price),
    compare_at_price: variant.compare_at_price
      ? parseFloat(variant.compare_at_price)
      : null,
    sku: variant.sku,
    barcode: variant.barcode,
    inventory_quantity: variant.inventory_quantity || 0,
    available: variant.inventory_quantity > 0 || variant.inventory_policy === 'continue',
    weight: variant.weight,
    weight_unit: variant.weight_unit,
  }

  const { error } = await supabase
    .from('product_variants')
    .upsert(variantData, { onConflict: 'id' })

  if (error) {
    console.error('Error upserting variant:', error)
  }
}
