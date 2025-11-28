/**
 * CollectionsMenu Component
 *
 * Menú horizontal scrolleable de colecciones para filtrar productos
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Package } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

interface StoreCollection {
  id: string;
  collection_id: string;
  collection_handle: string;
  collection_title: string;
  collection_image?: string;
  products_count: number;
  display_order: number;
  is_active: boolean;
}

interface CollectionsMenuProps {
  storeId: number;
  selectedCollection: string | null;
  onSelectCollection: (collectionHandle: string | null) => void;
}

export function CollectionsMenu({
  storeId,
  selectedCollection,
  onSelectCollection,
}: CollectionsMenuProps) {
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const loadCollections = async () => {
      // Validar storeId
      if (!storeId || storeId <= 0) {
        console.log('[CollectionsMenu] Invalid storeId:', storeId);
        if (isMounted) {
          setLoading(false);
          setCollections([]);
        }
        return;
      }

      try {
        console.log('[CollectionsMenu] Loading collections for store:', storeId);

        // Timeout de 8 segundos para evitar carga infinita
        timeoutId = setTimeout(() => {
          if (isMounted && loading) {
            console.warn('[CollectionsMenu] Timeout loading collections');
            setLoading(false);
            setCollections([]);
          }
        }, 8000);

        const { data, error } = await supabase
          .from('store_collections')
          .select('*')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        clearTimeout(timeoutId);

        if (error) {
          console.error('[CollectionsMenu] Supabase error:', error);
          throw error;
        }

        console.log('[CollectionsMenu] Loaded', data?.length || 0, 'collections');

        if (isMounted) {
          setCollections(data || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('[CollectionsMenu] Error loading collections:', err);
        if (isMounted) {
          setCollections([]);
          setLoading(false);
        }
      }
    };

    setLoading(true);
    loadCollections();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [storeId]);

  // Si no hay colecciones configuradas, no mostrar nada
  if (!loading && collections.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <View className="py-4">
        <ActivityIndicator size="small" color="#9333EA" />
      </View>
    );
  }

  return (
    <View className="mb-4">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 0, gap: 12 }}
      >
        {/* Botón "Todos" */}
        <TouchableOpacity
          onPress={() => onSelectCollection(null)}
          className="items-center"
        >
          <View
            className={`w-16 h-16 rounded-full items-center justify-center mb-1 ${
              selectedCollection === null
                ? 'bg-purple-600 border-2 border-purple-600'
                : 'bg-gray-100 border-2 border-gray-200'
            }`}
          >
            <Package
              size={24}
              color={selectedCollection === null ? '#FFFFFF' : '#6B7280'}
            />
          </View>
          <Text
            className={`text-xs font-medium ${
              selectedCollection === null ? 'text-purple-600' : 'text-gray-600'
            }`}
          >
            Todos
          </Text>
        </TouchableOpacity>

        {/* Colecciones */}
        {collections.map((collection) => {
          const isSelected = selectedCollection === collection.collection_handle;
          return (
            <TouchableOpacity
              key={collection.id}
              onPress={() => onSelectCollection(collection.collection_handle)}
              className="items-center"
            >
              {collection.collection_image ? (
                <View
                  className={`w-16 h-16 rounded-full overflow-hidden mb-1 ${
                    isSelected
                      ? 'border-2 border-purple-600'
                      : 'border-2 border-gray-200'
                  }`}
                >
                  <Image
                    source={{ uri: collection.collection_image }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                </View>
              ) : (
                <View
                  className={`w-16 h-16 rounded-full items-center justify-center mb-1 ${
                    isSelected
                      ? 'bg-purple-100 border-2 border-purple-600'
                      : 'bg-gray-100 border-2 border-gray-200'
                  }`}
                >
                  <Text className="text-lg font-bold text-gray-500">
                    {collection.collection_title.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text
                className={`text-xs font-medium max-w-[64px] text-center ${
                  isSelected ? 'text-purple-600' : 'text-gray-600'
                }`}
                numberOfLines={1}
              >
                {collection.collection_title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
