/**
 * Collections Tab Component
 *
 * Permite a las tiendas sincronizar y gestionar qué colecciones de Shopify
 * aparecen en Grumo y en qué orden
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  GripVertical,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Package,
  Loader2,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Pencil,
  X,
  Upload,
  Info,
} from 'lucide-react';
import type { Store } from '../../types';
import { supabaseWeb as supabase } from '../../../lib/supabaseWeb';

interface CollectionsTabProps {
  store: Store;
}

interface ShopifyCollection {
  id: string;
  handle: string;
  title: string;
  description?: string;
  image?: {
    url: string;
  };
}

interface StoreCollection {
  id: string;
  store_id: number;
  collection_id: string;
  collection_handle: string;
  collection_title: string;
  collection_image?: string;
  products_count: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function CollectionsTab({ store }: CollectionsTabProps) {
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [shopifyCollections, setShopifyCollections] = useState<ShopifyCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAllShopify, setShowAllShopify] = useState(false);

  // Estado para modal de edición de imagen
  const [editingCollection, setEditingCollection] = useState<StoreCollection | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');

  // Cargar colecciones guardadas de Supabase
  const loadSavedCollections = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('store_collections')
        .select('*')
        .eq('store_id', store.id)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCollections(data || []);
    } catch (err) {
      console.error('Error loading collections:', err);
      setError('Error al cargar las colecciones guardadas');
    }
  }, [store.id]);

  // Cargar colecciones desde Shopify
  const fetchShopifyCollections = async () => {
    setSyncing(true);
    setError(null);

    try {
      const query = `
        query GetCollections {
          collections(first: 100) {
            edges {
              node {
                id
                handle
                title
                description
                image {
                  url
                }
              }
            }
          }
        }
      `;

      const response = await fetch(
        `https://${store.domain}/api/2024-01/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': store.access_token,
          },
          body: JSON.stringify({ query }),
        }
      );

      if (!response.ok) {
        throw new Error('Error al conectar con Shopify');
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(data.errors[0]?.message || 'Error en la consulta a Shopify');
      }

      const fetchedCollections: ShopifyCollection[] = data.data.collections.edges.map(
        (edge: any) => edge.node
      );

      setShopifyCollections(fetchedCollections);
      setSuccess(`Se encontraron ${fetchedCollections.length} colecciones en Shopify`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error fetching Shopify collections:', err);
      setError(err.message || 'Error al obtener colecciones de Shopify');
    } finally {
      setSyncing(false);
    }
  };

  // Agregar colección a las seleccionadas
  const addCollection = async (shopifyCollection: ShopifyCollection) => {
    setSaving(true);
    setError(null);

    try {
      const newOrder = collections.length;
      const newCollection = {
        store_id: store.id,
        collection_id: shopifyCollection.id,
        collection_handle: shopifyCollection.handle,
        collection_title: shopifyCollection.title,
        collection_image: shopifyCollection.image?.url || null,
        products_count: 0, // Se actualizará al sincronizar productos
        display_order: newOrder,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('store_collections')
        .insert([newCollection])
        .select()
        .single();

      if (error) throw error;

      setCollections([...collections, data]);
      setSuccess(`"${shopifyCollection.title}" agregada correctamente`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error adding collection:', err);
      setError(err.message || 'Error al agregar la colección');
    } finally {
      setSaving(false);
    }
  };

  // Eliminar colección
  const removeCollection = async (collectionId: string) => {
    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('store_collections')
        .delete()
        .eq('id', collectionId);

      if (error) throw error;

      const updatedCollections = collections.filter((c) => c.id !== collectionId);
      // Reordenar
      const reorderedCollections = updatedCollections.map((c, index) => ({
        ...c,
        display_order: index,
      }));

      // Actualizar orden en DB
      for (const col of reorderedCollections) {
        await supabase
          .from('store_collections')
          .update({ display_order: col.display_order })
          .eq('id', col.id);
      }

      setCollections(reorderedCollections);
      setSuccess('Colección eliminada');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error removing collection:', err);
      setError(err.message || 'Error al eliminar la colección');
    } finally {
      setSaving(false);
    }
  };

  // Toggle activo/inactivo
  const toggleActive = async (collection: StoreCollection) => {
    setSaving(true);

    try {
      const { error } = await supabase
        .from('store_collections')
        .update({ is_active: !collection.is_active })
        .eq('id', collection.id);

      if (error) throw error;

      setCollections(
        collections.map((c) =>
          c.id === collection.id ? { ...c, is_active: !c.is_active } : c
        )
      );
    } catch (err: any) {
      console.error('Error toggling collection:', err);
      setError(err.message || 'Error al actualizar la colección');
    } finally {
      setSaving(false);
    }
  };

  // Mover colección arriba/abajo
  const moveCollection = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= collections.length) return;

    setSaving(true);

    try {
      const newCollections = [...collections];
      const temp = newCollections[index];
      newCollections[index] = newCollections[newIndex];
      newCollections[newIndex] = temp;

      // Actualizar display_order
      const updates = newCollections.map((c, i) => ({ ...c, display_order: i }));

      for (const col of updates) {
        await supabase
          .from('store_collections')
          .update({ display_order: col.display_order })
          .eq('id', col.id);
      }

      setCollections(updates);
    } catch (err: any) {
      console.error('Error moving collection:', err);
      setError(err.message || 'Error al reordenar');
    } finally {
      setSaving(false);
    }
  };

  // Verificar si una colección ya está agregada
  const isCollectionAdded = (shopifyId: string) => {
    return collections.some((c) => c.collection_id === shopifyId);
  };

  // Abrir modal de edición de imagen
  const openEditImageModal = (collection: StoreCollection) => {
    setEditingCollection(collection);
    setNewImageUrl(collection.collection_image || '');
  };

  // Guardar nueva imagen
  const saveCollectionImage = async () => {
    if (!editingCollection) return;

    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('store_collections')
        .update({ collection_image: newImageUrl || null })
        .eq('id', editingCollection.id);

      if (error) throw error;

      // Actualizar estado local
      setCollections(
        collections.map((c) =>
          c.id === editingCollection.id
            ? { ...c, collection_image: newImageUrl || undefined }
            : c
        )
      );

      setSuccess('Imagen actualizada correctamente');
      setTimeout(() => setSuccess(null), 3000);
      setEditingCollection(null);
      setNewImageUrl('');
    } catch (err: any) {
      console.error('Error updating image:', err);
      setError(err.message || 'Error al actualizar la imagen');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadSavedCollections();
      setLoading(false);
    };
    init();
  }, [loadSavedCollections]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-grumo-purple" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Colecciones de Productos
            </h2>
            <p className="text-gray-600 mt-1">
              Selecciona qué colecciones de tu tienda Shopify aparecerán en Grumo
              y en qué orden se mostrarán en el menú horizontal.
            </p>
          </div>
          <button
            onClick={fetchShopifyCollections}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-grumo-purple text-white rounded-lg hover:bg-grumo-violet disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Sincronizar desde Shopify
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mt-4 flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
            <Check className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}
      </div>

      {/* Selected Collections */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Colecciones Seleccionadas ({collections.length})
        </h3>

        {collections.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No hay colecciones seleccionadas</p>
            <p className="text-sm mt-1">
              Sincroniza desde Shopify y agrega las colecciones que deseas mostrar
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {collections.map((collection, index) => (
              <div
                key={collection.id}
                className={`flex items-center gap-4 p-4 rounded-lg border ${
                  collection.is_active
                    ? 'bg-white border-gray-200'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                {/* Drag Handle & Order */}
                <div className="flex items-center gap-2 text-gray-400">
                  <GripVertical className="w-5 h-5" />
                  <span className="text-sm font-medium w-6 text-center">
                    {index + 1}
                  </span>
                </div>

                {/* Image with Edit Button */}
                <div className="relative group">
                  {collection.collection_image ? (
                    <img
                      src={collection.collection_image}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <button
                    onClick={() => openEditImageModal(collection)}
                    className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    title="Editar imagen"
                  >
                    <Pencil className="w-4 h-4 text-white" />
                  </button>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">
                    {collection.collection_title}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {collection.products_count} productos • {collection.collection_handle}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Move Up/Down */}
                  <button
                    onClick={() => moveCollection(index, 'up')}
                    disabled={index === 0 || saving}
                    className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                    title="Mover arriba"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveCollection(index, 'down')}
                    disabled={index === collections.length - 1 || saving}
                    className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                    title="Mover abajo"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  {/* Toggle Active */}
                  <button
                    onClick={() => toggleActive(collection)}
                    disabled={saving}
                    className={`p-2 rounded-lg transition-colors ${
                      collection.is_active
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                    title={collection.is_active ? 'Ocultar' : 'Mostrar'}
                  >
                    {collection.is_active ? (
                      <Eye className="w-5 h-5" />
                    ) : (
                      <EyeOff className="w-5 h-5" />
                    )}
                  </button>

                  {/* Remove */}
                  <button
                    onClick={() => removeCollection(collection.id)}
                    disabled={saving}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <span className="text-lg">×</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shopify Collections */}
      {shopifyCollections.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Colecciones Disponibles en Shopify ({shopifyCollections.length})
            </h3>
            <button
              onClick={() => setShowAllShopify(!showAllShopify)}
              className="text-sm text-grumo-purple hover:underline"
            >
              {showAllShopify ? 'Ver menos' : 'Ver todas'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(showAllShopify
              ? shopifyCollections
              : shopifyCollections.slice(0, 6)
            ).map((collection) => {
              const isAdded = isCollectionAdded(collection.id);
              return (
                <div
                  key={collection.id}
                  className={`p-4 rounded-lg border ${
                    isAdded
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 hover:border-grumo-purple'
                  } transition-colors`}
                >
                  <div className="flex items-start gap-3">
                    {collection.image?.url ? (
                      <img
                        src={collection.image.url}
                        alt=""
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">
                        {collection.title}
                      </h4>
                      <p className="text-sm text-gray-500 truncate">
                        {collection.description || collection.handle}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {collection.handle}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => !isAdded && addCollection(collection)}
                    disabled={isAdded || saving}
                    className={`w-full mt-3 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      isAdded
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-grumo-purple text-white hover:bg-grumo-purple/90'
                    }`}
                  >
                    {isAdded ? (
                      <span className="flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" />
                        Agregada
                      </span>
                    ) : (
                      'Agregar'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview */}
      {collections.filter((c) => c.is_active).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Vista Previa del Menú
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Así se verán las colecciones en la app de Grumo:
          </p>

          <div className="bg-gray-100 rounded-xl p-4 overflow-x-auto">
            <div className="flex gap-3 min-w-max">
              {/* All Products Button */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-grumo-dark flex items-center justify-center">
                  <Package className="w-8 h-8 text-white" />
                </div>
                <span className="text-xs mt-2 text-gray-700 font-medium">
                  Todos
                </span>
              </div>

              {/* Collection Buttons */}
              {collections
                .filter((c) => c.is_active)
                .map((collection) => (
                  <div key={collection.id} className="flex flex-col items-center">
                    {collection.collection_image ? (
                      <img
                        src={collection.collection_image}
                        alt=""
                        className="w-16 h-16 rounded-full object-cover border-2 border-white shadow"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center border-2 border-white shadow">
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <span className="text-xs mt-2 text-gray-700 font-medium max-w-[70px] truncate text-center">
                      {collection.collection_title}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición de Imagen */}
      {editingCollection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Editar Imagen de Colección
              </h3>
              <button
                onClick={() => {
                  setEditingCollection(null);
                  setNewImageUrl('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Collection Info */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Package className="w-5 h-5 text-grumo-purple" />
                <span className="font-medium text-gray-900">
                  {editingCollection.collection_title}
                </span>
              </div>

              {/* Recommendations */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 mb-2">
                      Recomendaciones para la imagen:
                    </p>
                    <ul className="space-y-1 text-blue-700">
                      <li>• <strong>Tamaño ideal:</strong> 400 x 400 píxeles</li>
                      <li>• <strong>Formato:</strong> Cuadrado (1:1) para verse bien en círculo</li>
                      <li>• <strong>Tipo de archivo:</strong> PNG o JPG</li>
                      <li>• <strong>Peso máximo:</strong> 500KB para carga rápida</li>
                      <li>• <strong>Consejo:</strong> Centra el elemento principal en la imagen</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Image Preview */}
              <div className="flex justify-center">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-3">Vista previa:</p>
                  {newImageUrl ? (
                    <img
                      src={newImageUrl}
                      alt="Preview"
                      className="w-24 h-24 rounded-full object-cover border-4 border-grumo-purple/20 shadow-lg mx-auto"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center border-4 border-gray-200 mx-auto">
                      <ImageIcon className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                </div>
              </div>

              {/* URL Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL de la imagen
                </label>
                <div className="relative">
                  <Upload className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="url"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="https://ejemplo.com/imagen.jpg"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-grumo-purple focus:border-grumo-purple outline-none transition-all"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Pega la URL directa de la imagen. Puedes usar servicios como Shopify, Imgur, o tu propio servidor.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => {
                  setEditingCollection(null);
                  setNewImageUrl('');
                }}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={saveCollectionImage}
                disabled={saving}
                className="flex-1 py-3 px-4 bg-grumo-purple text-white rounded-lg hover:bg-grumo-violet disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Imagen'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
