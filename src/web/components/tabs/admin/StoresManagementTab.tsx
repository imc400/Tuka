/**
 * Stores Management Tab - Super Admin Dashboard
 *
 * Gestión completa de tiendas:
 * - Agregar nuevas tiendas
 * - Editar tiendas existentes
 * - Sincronizar productos
 * - Toggle visibilidad
 */

import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  Store,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { supabaseWeb as supabase } from '../../../../lib/supabaseWeb';
import type { Store as StoreType } from '../../../types';

interface StoresManagementTabProps {
  stores: StoreType[];
  onStoresUpdated: () => void;
  onOpenStoreDashboard: (store: StoreType) => void;
}

interface StoreFormData {
  domain: string;
  storefrontToken: string;
  adminToken: string;
  storeName: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
  themeColor: string;
  commissionRate: number;
}

const initialFormData: StoreFormData = {
  domain: '',
  storefrontToken: '',
  adminToken: '',
  storeName: '',
  description: '',
  logoUrl: '',
  bannerUrl: '',
  themeColor: '#9333EA',
  commissionRate: 0,
};

export default function StoresManagementTab({
  stores,
  onStoresUpdated,
  onOpenStoreDashboard,
}: StoresManagementTabProps) {
  const [editingStore, setEditingStore] = useState<StoreType | null>(null);
  const [formData, setFormData] = useState<StoreFormData>(initialFormData);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingStore(null);
    setShowForm(false);
  };

  const handleEdit = (store: StoreType) => {
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
      commissionRate: (store.commission_rate || 0) * 100,
    });
    setShowForm(true);
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
        commission_rate: formData.commissionRate / 100,
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
        onStoresUpdated();
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
        commission_rate: formData.commissionRate / 100,
        is_hidden: true,
      });

      if (error) {
        alert('Error al guardar: ' + error.message);
      } else {
        alert('Tienda agregada correctamente');
        resetForm();
        onStoresUpdated();
      }
    }
  };

  const handleDelete = async (store: StoreType) => {
    if (!confirm(`¿Estás seguro de eliminar "${store.store_name || store.domain}"?`)) return;

    const { error } = await supabase.from('stores').delete().eq('id', store.id);
    if (error) {
      alert('Error al eliminar: ' + error.message);
    } else {
      onStoresUpdated();
    }
  };

  const handleToggleVisibility = async (store: StoreType) => {
    const newHiddenState = !store.is_hidden;
    const action = newHiddenState ? 'ocultar' : 'mostrar';

    if (!confirm(`¿Estás seguro de ${action} "${store.store_name || store.domain}" en la app?`)) return;

    const { error } = await supabase
      .from('stores')
      .update({ is_hidden: newHiddenState })
      .eq('id', store.id);

    if (error) {
      alert('Error al actualizar visibilidad: ' + error.message);
    } else {
      onStoresUpdated();
    }
  };

  const handleSync = async (store: StoreType) => {
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
                  descriptionHtml
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
          description_html: product.descriptionHtml || '',
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

      alert(
        `Sincronización exitosa para ${store.store_name || store.domain}\n\n` +
        `Productos agregados: ${productsAdded}\n` +
        `Productos actualizados: ${productsUpdated}\n` +
        `Productos eliminados: ${productsDeleted}\n` +
        `Tiempo: ${duration}s`
      );

      onStoresUpdated();
    } catch (error: any) {
      alert(`Error al sincronizar: ${error.message}`);
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Gestión de Tiendas</h2>
          <p className="text-sm text-gray-500">{stores.length} tienda{stores.length !== 1 ? 's' : ''} registrada{stores.length !== 1 ? 's' : ''}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus size={18} />
            Nueva Tienda
          </button>
        )}
      </div>

      {/* Form (shown when adding/editing) */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {editingStore ? (
                <>
                  <Edit2 size={20} className="text-amber-600" />
                  Editar: {editingStore.store_name || editingStore.domain}
                </>
              ) : (
                <>
                  <Plus size={20} className="text-purple-600" />
                  Nueva Tienda Shopify
                </>
              )}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column - API Config */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  Configuración API
                </h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shopify Domain {!editingStore && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100"
                    placeholder="ejemplo.myshopify.com"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    disabled={!!editingStore}
                    required={!editingStore}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Storefront API Token {!editingStore && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder={editingStore ? 'Dejar vacío para mantener' : 'Token para catálogo'}
                    value={formData.storefrontToken}
                    onChange={(e) => setFormData({ ...formData, storefrontToken: e.target.value })}
                    required={!editingStore}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Admin API Token
                  </label>
                  <input
                    type="password"
                    className="w-full p-3 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-amber-50"
                    placeholder={editingStore ? 'Dejar vacío para mantener' : 'shpat_xxxxx (con permisos write_orders)'}
                    value={formData.adminToken}
                    onChange={(e) => setFormData({ ...formData, adminToken: e.target.value })}
                  />
                  <p className="text-xs text-amber-600 mt-1">Necesario para crear órdenes automáticas</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comisión Grumo (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      className="w-full p-3 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none bg-green-50"
                      placeholder="0"
                      value={formData.commissionRate}
                      onChange={(e) => setFormData({ ...formData, commissionRate: parseFloat(e.target.value) || 0 })}
                    />
                    <span className="text-gray-500 font-medium">%</span>
                  </div>
                  <p className="text-xs text-green-600 mt-1">Porcentaje que Grumo cobra por cada venta (0 = gratis)</p>
                </div>
              </div>

              {/* Right Column - Branding */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  Personalización
                </h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="Ej: Tienda Oficial"
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none h-20 resize-none"
                    placeholder="Descripción corta..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL del Logo</label>
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                      placeholder="https://..."
                      value={formData.logoUrl}
                      onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                    />
                    {formData.logoUrl && (
                      <img
                        src={formData.logoUrl}
                        alt="Preview"
                        className="mt-2 w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color del Tema</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        className="h-10 w-10 rounded cursor-pointer border-0 p-0"
                        value={formData.themeColor}
                        onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                      />
                      <input
                        type="text"
                        className="flex-1 p-3 border border-gray-300 rounded-lg text-sm font-mono"
                        value={formData.themeColor}
                        onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                type="submit"
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-white font-medium rounded-lg transition-colors ${
                  editingStore
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                <Save size={18} />
                {editingStore ? 'Actualizar Tienda' : 'Guardar Tienda'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stores Grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {stores.map((store) => (
          <div
            key={store.id}
            className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
              editingStore?.id === store.id
                ? 'border-amber-400 ring-2 ring-amber-100'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {/* Store Header */}
            <div
              className="h-20 relative"
              style={{
                background: store.banner_url
                  ? `url(${store.banner_url}) center/cover`
                  : `linear-gradient(135deg, ${store.theme_color || '#9333EA'} 0%, ${store.theme_color || '#9333EA'}88 100%)`,
              }}
            >
              <div className="absolute -bottom-6 left-4">
                {store.logo_url ? (
                  <img
                    src={store.logo_url}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover border-3 border-white shadow-lg"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg border-3 border-white shadow-lg"
                    style={{ backgroundColor: store.theme_color || '#6B7280' }}
                  >
                    {(store.store_name || store.domain).substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Visibility Badge */}
              <div className="absolute top-2 right-2">
                {store.is_hidden ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-900/70 text-white">
                    <EyeOff size={12} />
                    Oculta
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/90 text-white">
                    <Eye size={12} />
                    Visible
                  </span>
                )}
              </div>
            </div>

            {/* Store Info */}
            <div className="pt-8 px-4 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{store.store_name || store.domain}</h3>
                  <p className="text-xs text-gray-500">{store.domain}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  (store.commission_rate || 0) === 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {((store.commission_rate || 0) * 100).toFixed(0)}% comisión
                </span>
              </div>

              {store.description ? (
                <p className="text-sm text-gray-600 mt-2 mb-3 line-clamp-2">{store.description}</p>
              ) : (
                <div className="mb-3" />
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onOpenStoreDashboard(store)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
                >
                  <ExternalLink size={14} />
                  Dashboard
                </button>
                <button
                  onClick={() => handleSync(store)}
                  disabled={syncing === store.domain}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={14} className={syncing === store.domain ? 'animate-spin' : ''} />
                  {syncing === store.domain ? 'Sincronizando...' : 'Sync'}
                </button>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleEdit(store)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                >
                  <Edit2 size={14} />
                  Editar
                </button>
                <button
                  onClick={() => handleToggleVisibility(store)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    store.is_hidden
                      ? 'bg-green-50 text-green-700 hover:bg-green-100'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  {store.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  {store.is_hidden ? 'Mostrar' : 'Ocultar'}
                </button>
                <button
                  onClick={() => handleDelete(store)}
                  className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {stores.length === 0 && !showForm && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Store size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay tiendas registradas</h3>
          <p className="text-gray-500 mb-4">Agrega tu primera tienda Shopify para comenzar</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus size={18} />
            Agregar Tienda
          </button>
        </div>
      )}
    </div>
  );
}
