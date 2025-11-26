/**
 * ShopUnite Admin Dashboard - Web Version
 *
 * Dashboard administrativo para gestionar tiendas Shopify:
 * - Agregar/editar/eliminar tiendas
 * - Sincronizar productos
 * - Enviar notificaciones push (real con Expo Push API)
 * - Ver estadísticas y pedidos
 *
 * @version 3.0.0
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { supabaseWeb as supabase } from './src/lib/supabaseWeb';
import './index.css';
import {
  Settings,
  Plus,
  Loader2,
  Save,
  Edit2,
  X,
  RefreshCw,
} from 'lucide-react';

// Componentes modulares
import { StoreCard, StoreDashboard } from './src/web/components';
import type { Store, StoreFormData, DashboardView } from './src/web/types';

const AdminApp = () => {
  // State
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState<StoreFormData>({
    domain: '',
    storefrontToken: '',
    adminToken: '',
    storeName: '',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    themeColor: '#9333EA',
  });

  // View state
  const [view, setView] = useState<DashboardView>('stores');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // Load stores on mount
  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });
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
      themeColor: '#9333EA',
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
        theme_color: formData.themeColor,
      };

      if (formData.storefrontToken) {
        updateData.access_token = formData.storefrontToken;
      }
      if (formData.adminToken) {
        updateData.admin_api_token = formData.adminToken;
      }

      const { error } = await supabase
        .from('stores')
        .update(updateData)
        .eq('id', editingStore.id);

      if (error) {
        alert('Error al actualizar: ' + error.message);
      } else {
        alert('Tienda actualizada correctamente');
        resetForm();
        fetchStores();
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
        theme_color: formData.themeColor,
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

  const handleEdit = (store: Store) => {
    setEditingStore(store);
    setFormData({
      domain: store.domain,
      storefrontToken: '',
      adminToken: '',
      storeName: store.store_name || '',
      description: store.description || '',
      logoUrl: store.logo_url || '',
      bannerUrl: store.banner_url || '',
      themeColor: store.theme_color || '#9333EA',
    });
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

  const handleSync = async (store: Store) => {
    setSyncing(store.domain);

    try {
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

      // Get existing products
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
            inventory_quantity: 0,
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

      const message =
        `Sincronización exitosa para ${store.store_name || store.domain}\n\n` +
        `Productos agregados: ${productsAdded}\n` +
        `Productos actualizados: ${productsUpdated}\n` +
        `Productos eliminados: ${productsDeleted}\n` +
        `Tiempo: ${duration}s`;
      alert(message);
    } catch (error: any) {
      alert(`Error al sincronizar: ${error.message}`);
    } finally {
      setSyncing(null);
    }
  };

  const handleOpenDashboard = (store: Store) => {
    setSelectedStore(store);
    setView('store-detail');
  };

  const handleBackToStores = () => {
    setSelectedStore(null);
    setView('stores');
    fetchStores(); // Refresh stores list
  };

  // Render Store Detail View
  if (view === 'store-detail' && selectedStore) {
    return (
      <StoreDashboard
        store={selectedStore}
        onBack={handleBackToStores}
        onStoreUpdated={() => {
          fetchStores();
          // Update selected store with fresh data
          const updated = stores.find((s) => s.id === selectedStore.id);
          if (updated) setSelectedStore(updated);
        }}
      />
    );
  }

  // Render Main Stores List View
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans">
      {/* Navigation - Grumo Branding (Minimalista) */}
      <nav className="bg-grumo-dark text-white p-4 sticky top-0 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* Grumo Isotipo - 4 capsules con gradiente */}
            <div className="w-10 h-10 grid grid-cols-2 gap-1">
              <div className="rounded-lg" style={{ background: '#FF4F6F' }}></div>
              <div className="rounded-lg" style={{ background: 'linear-gradient(135deg, #FF4F6F 0%, #C13BFF 100%)' }}></div>
              <div className="rounded-lg" style={{ background: '#C13BFF' }}></div>
              <div className="rounded-lg" style={{ background: 'linear-gradient(135deg, #C13BFF 0%, #6A34FF 100%)' }}></div>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">grumo</h1>
              <p className="text-xs text-gray-400">Dashboard Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchStores}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
            >
              <RefreshCw size={16} />
              Actualizar
            </button>
          </div>
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
                    <>
                      <Edit2 size={20} className="text-amber-600" /> Editar Tienda
                    </>
                  ) : (
                    <>
                      <Plus size={20} className="text-gray-600" /> Nueva Tienda
                    </>
                  )}
                </h2>
                {editingStore && (
                  <button
                    onClick={resetForm}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                    Shopify Domain{' '}
                    {!editingStore && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none disabled:bg-gray-100"
                    placeholder="ejemplo.myshopify.com"
                    value={formData.domain}
                    onChange={(e) =>
                      setFormData({ ...formData, domain: e.target.value })
                    }
                    disabled={!!editingStore}
                    required={!editingStore}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                    Storefront API Token{' '}
                    {!editingStore && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none"
                    placeholder={
                      editingStore ? 'Dejar vacío para mantener' : 'Token para catálogo'
                    }
                    value={formData.storefrontToken}
                    onChange={(e) =>
                      setFormData({ ...formData, storefrontToken: e.target.value })
                    }
                    required={!editingStore}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">
                    Admin API Token
                  </label>
                  <input
                    type="password"
                    className="w-full p-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-amber-50"
                    placeholder={
                      editingStore
                        ? 'Dejar vacío para mantener'
                        : 'shpat_xxxxx (con permisos write_orders)'
                    }
                    value={formData.adminToken}
                    onChange={(e) =>
                      setFormData({ ...formData, adminToken: e.target.value })
                    }
                  />
                  <p className="text-xs text-amber-600 mt-1">
                    Necesario para crear órdenes automáticas
                  </p>
                </div>

                <div className="border-t border-gray-100 my-4 pt-4">
                  <p className="text-xs text-gray-400 mb-3 font-semibold">
                    Personalización
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Nombre
                      </label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Ej: Tienda Oficial"
                        value={formData.storeName}
                        onChange={(e) =>
                          setFormData({ ...formData, storeName: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Descripción
                      </label>
                      <textarea
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm h-16 resize-none"
                        placeholder="Descripción corta..."
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        URL del Logo
                      </label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="https://..."
                        value={formData.logoUrl}
                        onChange={(e) =>
                          setFormData({ ...formData, logoUrl: e.target.value })
                        }
                      />
                      {formData.logoUrl && (
                        <img
                          src={formData.logoUrl}
                          alt="Preview"
                          className="mt-2 w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        URL del Banner
                      </label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="https://..."
                        value={formData.bannerUrl}
                        onChange={(e) =>
                          setFormData({ ...formData, bannerUrl: e.target.value })
                        }
                      />
                      {formData.bannerUrl && (
                        <img
                          src={formData.bannerUrl}
                          alt="Preview"
                          className="mt-2 w-full h-20 rounded-lg object-cover border-2 border-gray-200"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Color del Tema
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          className="h-10 w-10 rounded cursor-pointer border-0 p-0"
                          value={formData.themeColor}
                          onChange={(e) =>
                            setFormData({ ...formData, themeColor: e.target.value })
                          }
                        />
                        <input
                          type="text"
                          className="flex-1 p-2 border border-gray-300 rounded-lg text-sm font-mono"
                          value={formData.themeColor}
                          onChange={(e) =>
                            setFormData({ ...formData, themeColor: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 hover:opacity-90 ${
                    editingStore
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-grumo-dark hover:bg-black'
                  }`}
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
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-grumo-dark text-white">
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
                <p className="text-sm text-gray-400">
                  Usa el formulario de la izquierda para agregar tu primera tienda
                  Shopify.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {stores.map((store) => (
                  <StoreCard
                    key={store.id}
                    store={store}
                    isEditing={editingStore?.id === store.id}
                    isSyncing={syncing === store.domain}
                    onOpenDashboard={handleOpenDashboard}
                    onSync={handleSync}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer - Grumo Branding (Minimalista) */}
      <footer className="bg-grumo-dark text-center py-6 mt-12">
        <div className="flex items-center justify-center gap-2 mb-2">
          {/* Isotipo con gradiente */}
          <div className="w-6 h-6 grid grid-cols-2 gap-0.5">
            <div className="rounded" style={{ background: '#FF4F6F' }}></div>
            <div className="rounded" style={{ background: 'linear-gradient(135deg, #FF4F6F 0%, #C13BFF 100%)' }}></div>
            <div className="rounded" style={{ background: '#C13BFF' }}></div>
            <div className="rounded" style={{ background: 'linear-gradient(135deg, #C13BFF 0%, #6A34FF 100%)' }}></div>
          </div>
          <span className="text-white font-bold">grumo</span>
        </div>
        <p className="text-sm text-gray-500">
          Dashboard Admin v3.0
        </p>
      </footer>
    </div>
  );
};

export default AdminApp;
