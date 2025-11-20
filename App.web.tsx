import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { supabaseWeb as supabase } from './src/lib/supabaseWeb';
import './index.css';
import { Settings, Plus, Trash2, ExternalLink, Loader2, Save, Edit2, X, RefreshCw } from 'lucide-react';

const AdminApp = () => {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [editingStore, setEditingStore] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    domain: '',
    storefrontToken: '',
    adminToken: '',
    storeName: '',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    themeColor: '#000000'
  });

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('stores').select('*').order('created_at', { ascending: false });
    if (data) setStores(data);
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      domain: '',
      storefrontToken: '',
      adminToken: '',
      storeName: '',
      description: '',
      logoUrl: '',
      bannerUrl: '',
      themeColor: '#000000'
    });
    setEditingStore(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingStore) {
      // Update existing store
      const updateData: any = {
        store_name: formData.storeName,
        description: formData.description,
        logo_url: formData.logoUrl,
        banner_url: formData.bannerUrl,
        theme_color: formData.themeColor
      };

      // Only update tokens if provided (don't overwrite with empty)
      if (formData.storefrontToken) {
        updateData.access_token = formData.storefrontToken;
      }
      if (formData.adminToken) {
        updateData.admin_api_token = formData.adminToken;
      }

      console.log('🔄 Actualizando tienda:', editingStore.domain, 'ID:', editingStore.id);
      console.log('📝 Datos a guardar:', updateData);

      const { data, error } = await supabase
        .from('stores')
        .update(updateData)
        .eq('id', editingStore.id)
        .select();

      if (error) {
        console.error('❌ Error al actualizar:', error);
        alert('Error al actualizar: ' + error.message);
      } else {
        console.log('✅ Tienda actualizada:', data);
        if (data && data.length > 0) {
          alert('Tienda actualizada correctamente');
          resetForm();
          fetchStores();
        } else {
          console.error('⚠️ No se encontró la tienda para actualizar');
          alert('No se pudo actualizar la tienda. Intenta recargar la página.');
        }
      }
    } else {
      // Insert new store
      if (!formData.domain || !formData.storefrontToken) {
        return alert('Dominio y Storefront Token son obligatorios');
      }

      const { error } = await supabase.from('stores').insert({
        domain: formData.domain,
        access_token: formData.storefrontToken,
        admin_api_token: formData.adminToken || null,
        store_name: formData.storeName,
        description: formData.description,
        logo_url: formData.logoUrl,
        banner_url: formData.bannerUrl,
        theme_color: formData.themeColor
      });

      if (error) {
        alert('Error al guardar: ' + error.message);
      } else {
        alert('Tienda agregada correctamente');
        resetForm();
        fetchStores();
      }
    }
  };

  const handleEdit = (store: any) => {
    setEditingStore(store);
    setFormData({
      domain: store.domain,
      storefrontToken: '', // Don't show token for security
      adminToken: '', // Don't show token for security
      storeName: store.store_name || '',
      description: store.description || '',
      logoUrl: store.logo_url || '',
      bannerUrl: store.banner_url || '',
      themeColor: store.theme_color || '#000000'
    });
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta tienda?')) return;
    const { error } = await supabase.from('stores').delete().eq('id', id);
    if (!error) {
      fetchStores();
      if (editingStore?.id === id) resetForm();
    }
  };

  const handleSync = async (store: any) => {
    setSyncing(store.domain);

    try {
      console.log(`🔄 Starting sync for ${store.domain}...`);

      // Create sync log
      const { data: syncLog, error: logError } = await supabase
        .from('sync_logs')
        .insert({
          store_domain: store.domain,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (logError) throw logError;

      let productsAdded = 0;
      let productsUpdated = 0;
      let productsDeleted = 0;
      const startTime = Date.now();

      // Fetch all products from Shopify using GraphQL
      const allProducts: any[] = [];
      let hasNextPage = true;
      let cursor: string | null = null;

      while (hasNextPage) {
        const query = `
          {
            products(first: 250${cursor ? `, after: "${cursor}"` : ''}) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                node {
                  id
                  title
                  description
                  vendor
                  productType
                  tags
                  variants(first: 100) {
                    edges {
                      node {
                        id
                        title
                        price { amount }
                        compareAtPrice { amount }
                        sku
                        barcode
                        availableForSale
                        weight
                        weightUnit
                      }
                    }
                  }
                  images(first: 10) {
                    edges {
                      node {
                        src
                        altText
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        const response = await fetch(
          `https://${store.domain}/api/2023-01/graphql.json`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Storefront-Access-Token': store.access_token,
            },
            body: JSON.stringify({ query }),
          }
        );

        const json = await response.json();

        if (json.errors) {
          throw new Error(JSON.stringify(json.errors));
        }

        const productsData = json.data.products;
        allProducts.push(...productsData.edges);

        hasNextPage = productsData.pageInfo.hasNextPage;
        cursor = productsData.pageInfo.endCursor;
      }

      console.log(`✅ Fetched ${allProducts.length} products from ${store.domain}`);

      // Get existing products from Supabase
      const { data: existingProducts } = await supabase
        .from('products')
        .select('id')
        .eq('store_domain', store.domain);

      const existingIds = new Set(existingProducts?.map((p) => p.id) || []);
      const shopifyIds = new Set(allProducts.map((edge) => edge.node.id));

      // Delete discontinued products
      const idsToDelete = Array.from(existingIds).filter((id) => !shopifyIds.has(id));
      if (idsToDelete.length > 0) {
        await supabase.from('products').delete().in('id', idsToDelete);
        productsDeleted = idsToDelete.length;
      }

      // Upsert products
      for (const edge of allProducts) {
        const product = edge.node;
        const defaultVariant = product.variants.edges[0]?.node;

        const productData = {
          id: product.id,
          store_domain: store.domain,
          title: product.title,
          description: product.description || '',
          price: parseFloat(defaultVariant?.price.amount || '0'),
          compare_at_price: defaultVariant?.compareAtPrice?.amount
            ? parseFloat(defaultVariant.compareAtPrice.amount)
            : null,
          vendor: product.vendor || '',
          product_type: product.productType || '',
          tags: product.tags || [],
          images: product.images.edges.map((img: any) => img.node.src),
          available: product.variants.edges.some((v: any) => v.node.availableForSale),
          synced_at: new Date().toISOString(),
        };

        await supabase.from('products').upsert(productData, { onConflict: 'id' });

        if (existingIds.has(product.id)) {
          productsUpdated++;
        } else {
          productsAdded++;
        }

        // Upsert variants
        for (const variantEdge of product.variants.edges) {
          const variant = variantEdge.node;
          const variantData = {
            id: variant.id,
            product_id: product.id,
            title: variant.title,
            price: parseFloat(variant.price.amount),
            compare_at_price: variant.compareAtPrice?.amount
              ? parseFloat(variant.compareAtPrice.amount)
              : null,
            sku: variant.sku,
            barcode: variant.barcode,
            inventory_quantity: 0, // Not available in Storefront API
            available: variant.availableForSale,
            weight: variant.weight,
            weight_unit: variant.weightUnit,
          };

          await supabase.from('product_variants').upsert(variantData, { onConflict: 'id' });
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      // Update sync log
      await supabase
        .from('sync_logs')
        .update({
          status: 'success',
          products_synced: allProducts.length,
          products_added: productsAdded,
          products_updated: productsUpdated,
          products_deleted: productsDeleted,
          completed_at: new Date().toISOString(),
          duration_seconds: duration,
        })
        .eq('id', syncLog.id);

      const message = `✅ Sincronización exitosa para ${store.store_name || store.domain}\n\n` +
                     `📦 Productos agregados: ${productsAdded}\n` +
                     `🔄 Productos actualizados: ${productsUpdated}\n` +
                     `🗑️ Productos eliminados: ${productsDeleted}\n` +
                     `⏱️ Tiempo: ${duration}s`;
      alert(message);
      console.log(message);

    } catch (error: any) {
      const errorMsg = `❌ Error al sincronizar: ${error.message}`;
      alert(errorMsg);
      console.error(errorMsg);
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans">
      <nav className="bg-slate-900 text-white p-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Settings size={24} />
            </div>
            <h1 className="text-xl font-bold">ShopUnite Admin</h1>
          </div>
          <div className="text-xs text-gray-400">v2.0.0 Pro</div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Form Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  {editingStore ? (
                    <><Edit2 size={20} className="text-amber-600"/> Editar Tienda</>
                  ) : (
                    <><Plus size={20} className="text-indigo-600"/> Nueva Tienda</>
                  )}
                </h2>
                {editingStore && (
                  <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                    Shopify Domain {!editingStore && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100"
                    placeholder="ejemplo.myshopify.com"
                    value={formData.domain}
                    onChange={e => setFormData({...formData, domain: e.target.value})}
                    disabled={!!editingStore}
                    required={!editingStore}
                  />
                  {editingStore && <p className="text-xs text-gray-400 mt-1">El dominio no se puede cambiar</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                    Storefront API Token {!editingStore && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder={editingStore ? "Dejar vacío para mantener" : "Token para catálogo"}
                    value={formData.storefrontToken}
                    onChange={e => setFormData({...formData, storefrontToken: e.target.value})}
                    required={!editingStore}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    📦 Para sincronizar productos. Obtener en: Settings → Apps → Develop apps
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                    Admin API Token <span className="text-amber-600">(Nuevo - Importante)</span>
                  </label>
                  <input
                    type="password"
                    className="w-full p-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-amber-50"
                    placeholder={editingStore ? "Dejar vacío para mantener" : "shpat_xxxxx (con permisos write_orders)"}
                    value={formData.adminToken}
                    onChange={e => setFormData({...formData, adminToken: e.target.value})}
                  />
                  <p className="text-xs text-amber-600 mt-1 font-semibold">
                    🛒 Necesario para crear órdenes automáticas. Requiere permisos:
                  </p>
                  <ul className="text-xs text-gray-500 mt-1 ml-4 space-y-0.5">
                    <li>• read_orders, write_orders</li>
                    <li>• read_draft_orders, write_draft_orders</li>
                    <li>• read_customers, write_customers</li>
                  </ul>
                  <a
                    href="https://github.com/anthropics/shopunite-marketplace/blob/main/QUICK_START.md#paso-3-generar-admin-api-tokens-de-shopify-5-minutos"
                    target="_blank"
                    className="text-xs text-indigo-600 hover:underline mt-1 inline-block"
                  >
                    📖 Ver guía completa →
                  </a>
                </div>

                <div className="border-t border-gray-100 my-4 pt-4">
                  <p className="text-xs text-gray-400 mb-3 font-semibold">Personalización</p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nombre Personalizado</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Ej: Tienda Oficial Nike"
                        value={formData.storeName}
                        onChange={e => setFormData({...formData, storeName: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Descripción Corta</label>
                      <textarea
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm h-20 resize-none"
                        placeholder="Lo mejor en deportes..."
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">URL del Logo (Circular)</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="https://ejemplo.com/logo.png"
                        value={formData.logoUrl}
                        onChange={e => setFormData({...formData, logoUrl: e.target.value})}
                      />
                      <p className="text-xs text-gray-400 mt-1">Se muestra como avatar circular en la app</p>
                      {formData.logoUrl && (
                        <div className="mt-2">
                          <img src={formData.logoUrl} alt="Preview" className="w-12 h-12 rounded-full object-cover border-2 border-gray-200" onError={(e) => { e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>' }} />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">URL del Banner</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="https://ejemplo.com/banner.jpg"
                        value={formData.bannerUrl}
                        onChange={e => setFormData({...formData, bannerUrl: e.target.value})}
                      />
                      <p className="text-xs text-gray-400 mt-1">Banner principal en la página de la tienda</p>
                      {formData.bannerUrl && (
                        <div className="mt-2">
                          <img src={formData.bannerUrl} alt="Preview" className="w-full h-24 rounded-lg object-cover border-2 border-gray-200" onError={(e) => { e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>' }} />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Color del Tema</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          className="h-10 w-10 rounded cursor-pointer border-0 p-0"
                          value={formData.themeColor}
                          onChange={e => setFormData({...formData, themeColor: e.target.value})}
                        />
                        <input
                          type="text"
                          className="flex-1 p-2 border border-gray-300 rounded-lg text-sm font-mono"
                          value={formData.themeColor}
                          onChange={e => setFormData({...formData, themeColor: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full ${editingStore ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2`}
                >
                  <Save size={18} />
                  {editingStore ? 'Actualizar Tienda' : 'Guardar Tienda'}
                </button>

                {editingStore && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-full bg-gray-200 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* List Section */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Tiendas Registradas</h2>
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                {stores.length} activas
              </span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Loader2 className="animate-spin mb-2" size={32} />
                <p>Cargando tiendas...</p>
              </div>
            ) : stores.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center border border-dashed border-gray-300">
                <p className="text-gray-500 mb-2">No hay tiendas registradas aún.</p>
                <p className="text-sm text-gray-400">Usa el formulario de la izquierda para agregar tu primera tienda Shopify.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stores.map(store => (
                  <div
                    key={store.id}
                    className={`bg-white rounded-xl p-5 shadow-sm border-2 ${editingStore?.id === store.id ? 'border-amber-400' : 'border-gray-200'} flex flex-col sm:flex-row gap-6 items-start sm:items-center hover:shadow-md transition-all`}
                  >
                    {/* Preview Logo/Banner/Color */}
                    <div className="flex gap-3 flex-shrink-0">
                      <div
                        className="w-16 h-16 rounded-lg shadow-inner flex items-center justify-center text-white font-bold text-xl"
                        style={{ backgroundColor: store.theme_color || '#000000' }}
                      >
                        {store.logo_url ? (
                          <img src={store.logo_url} alt="" className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          (store.store_name || store.domain || 'SH').substring(0, 2).toUpperCase()
                        )}
                      </div>
                      {store.banner_url && (
                        <div className="w-24 h-16 rounded-lg overflow-hidden border border-gray-200">
                          <img src={store.banner_url} alt="Banner" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-gray-900 truncate">
                          {store.store_name || store.domain}
                        </h3>
                        <a
                          href={`https://${store.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-indigo-600"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                      <p className="text-sm text-gray-500 mb-2 line-clamp-2">
                        {store.description || 'Sin descripción personalizada'}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">ID: {store.id}</span>
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded truncate max-w-[200px]">
                          {store.domain}
                        </span>
                        <span className={`px-2 py-1 rounded font-semibold ${
                          store.access_token
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {store.access_token ? '✅ Storefront API' : '❌ Sin Storefront'}
                        </span>
                        <span className={`px-2 py-1 rounded font-semibold ${
                          store.admin_api_token
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {store.admin_api_token ? '✅ Admin API' : '⚠️ Falta Admin API'}
                        </span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleSync(store)}
                        disabled={syncing === store.domain}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw size={16} className={syncing === store.domain ? 'animate-spin' : ''} />
                        {syncing === store.domain ? 'Sincronizando...' : 'Sincronizar'}
                      </button>
                      <button
                        onClick={() => handleEdit(store)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
                      >
                        <Edit2 size={16} /> Editar
                      </button>
                      <button
                        onClick={() => handleDelete(store.id)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                      >
                        <Trash2 size={16} /> Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminApp;
