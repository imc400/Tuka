/**
 * ProductDetailView Component
 * Vista detallada de producto con todos los datos de Shopify
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import {
  ChevronLeft,
  ShoppingBag,
  ShieldCheck,
  Star,
  Truck,
  Package,
  Info,
  Tag,
  Ruler,
  Sparkles,
} from 'lucide-react-native';
import type { Product, ProductVariant, Store, ProductOption } from '../types';
import { ImageGallery } from './ImageGallery';

interface Props {
  product: Product;
  store: Store;
  selectedVariant: ProductVariant | null;
  onVariantSelect: (variant: ProductVariant | null) => void;
  onAddToCart: () => void;
  onGoBack: () => void;
  formatCLP: (price: number) => string;
}

// Helper functions
const calculateDiscount = (price: number, compareAtPrice: number | null | undefined): number | null => {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
};

const isOnSale = (price: number, compareAtPrice: number | null | undefined): boolean => {
  return !!compareAtPrice && compareAtPrice > price;
};

export function ProductDetailView({
  product,
  store,
  selectedVariant,
  onVariantSelect,
  onAddToCart,
  onGoBack,
  formatCLP,
}: Props) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Fallback image if no images
  const fallbackImage = product.imagePrompt
    ? `https://picsum.photos/seed/${product.imagePrompt}/800/800`
    : 'https://via.placeholder.com/800x800.png?text=Producto';

  // Get current price (from variant or product)
  const currentPrice = selectedVariant?.price || product.price;
  const currentCompareAtPrice = selectedVariant?.compareAtPrice || product.compareAtPrice;
  const discount = calculateDiscount(currentPrice, currentCompareAtPrice);
  const onSale = isOnSale(currentPrice, currentCompareAtPrice);

  // Get stock info
  const stockQuantity = selectedVariant?.quantityAvailable ?? product.totalInventory;
  const isAvailable = selectedVariant ? selectedVariant.available : product.availableForSale !== false;
  const lowStock = stockQuantity !== null && stockQuantity !== undefined && stockQuantity > 0 && stockQuantity <= 5;

  // Process metafields for display
  const metafieldsToShow = useMemo(() => {
    if (!product.metafields) return [];
    const fields: { label: string; value: string; icon: any }[] = [];

    if (product.metafields['custom.material']) {
      fields.push({ label: 'Material', value: product.metafields['custom.material'], icon: Sparkles });
    }
    if (product.metafields['custom.care_instructions']) {
      fields.push({ label: 'Cuidados', value: product.metafields['custom.care_instructions'], icon: Info });
    }
    if (product.metafields['custom.dimensions']) {
      fields.push({ label: 'Dimensiones', value: product.metafields['custom.dimensions'], icon: Ruler });
    }
    if (product.metafields['custom.specifications']) {
      fields.push({ label: 'Especificaciones', value: product.metafields['custom.specifications'], icon: Package });
    }

    return fields;
  }, [product.metafields]);

  // Get rating info
  const rating = product.metafields?.['reviews.rating'] || product.metafields?.['product.rating'];
  const ratingCount = product.metafields?.['reviews.rating_count'];

  // Toggle section
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Clean description (remove HTML tags if using plain description)
  const cleanDescription = product.description
    ? product.description.replace(/<[^>]*>/g, '').trim() || 'Producto de calidad disponible en nuestra tienda.'
    : 'Producto de calidad disponible en nuestra tienda.';

  // Render visual option selector (Color, Size, etc.)
  const renderOptionSelector = (option: ProductOption) => {
    // Get currently selected value for this option
    const selectedValue = selectedVariant?.selectedOptions?.find(
      (so) => so.name === option.name
    )?.value;

    // Check if this looks like a color option
    const isColorOption = option.name.toLowerCase().includes('color') ||
                          option.name.toLowerCase().includes('colour');

    return (
      <View key={option.id} className="mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">
          {option.name}: <Text className="font-normal text-gray-600">{selectedValue || 'Selecciona'}</Text>
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {option.values.map((value) => {
            // Find variant that has this option value
            const matchingVariant = product.variants?.find((v) =>
              v.selectedOptions?.some((so) => so.name === option.name && so.value === value)
            );
            const isSelected = selectedValue === value;
            const isAvailable = matchingVariant?.available !== false;

            return (
              <TouchableOpacity
                key={value}
                onPress={() => {
                  if (matchingVariant && isAvailable) {
                    onVariantSelect(matchingVariant);
                  }
                }}
                disabled={!isAvailable}
                className={`px-4 py-2 rounded-lg border-2 ${
                  isSelected
                    ? 'border-purple-600 bg-purple-50'
                    : isAvailable
                    ? 'border-gray-200 bg-white'
                    : 'border-gray-100 bg-gray-50 opacity-50'
                }`}
              >
                <Text
                  className={`text-sm ${
                    isSelected
                      ? 'font-bold text-purple-600'
                      : isAvailable
                      ? 'text-gray-700'
                      : 'text-gray-400 line-through'
                  }`}
                >
                  {value}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1">
        {/* Image Gallery with carousel */}
        <View className="relative">
          <ImageGallery
            images={product.images || []}
            fallbackImage={fallbackImage}
          />
          <TouchableOpacity
            onPress={onGoBack}
            className="absolute top-12 left-4 bg-white/90 p-3 rounded-full shadow-lg"
          >
            <ChevronLeft size={24} color="black" />
          </TouchableOpacity>
          {/* Badge de descuento */}
          {discount && (
            <View className="absolute top-12 right-4 bg-red-500 px-3 py-2 rounded-xl shadow-lg">
              <Text className="text-white text-sm font-bold">-{discount}%</Text>
            </View>
          )}
        </View>

        <View className="bg-white p-6">
          <View className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

          {/* Vendor/Brand badge */}
          {product.vendor && (
            <View className="flex-row items-center mb-2">
              <Tag size={12} color="#6B7280" />
              <Text className="text-xs text-gray-500 ml-1">{product.vendor}</Text>
            </View>
          )}

          {/* Title and Store */}
          <View className="flex-row justify-between items-start mb-4">
            <View className="flex-1 pr-4">
              <Text className="text-2xl font-bold text-gray-900 mb-2">{product.name}</Text>
              <Text className="text-purple-600 font-medium text-sm">de {store.name}</Text>

              {/* Rating */}
              {rating && (
                <View className="flex-row items-center mt-2">
                  <Star size={14} color="#FBBF24" fill="#FBBF24" />
                  <Text className="text-sm font-semibold text-gray-700 ml-1">{rating}</Text>
                  {ratingCount && (
                    <Text className="text-xs text-gray-500 ml-1">({ratingCount} opiniones)</Text>
                  )}
                </View>
              )}
            </View>

            {/* Price section */}
            <View className="items-end">
              {onSale ? (
                <>
                  <Text className="text-xs text-gray-400 line-through mb-1">
                    {formatCLP(currentCompareAtPrice!)}
                  </Text>
                  <Text className="text-2xl font-bold text-red-600">{formatCLP(currentPrice)}</Text>
                  <View className="bg-red-100 px-2 py-1 rounded mt-1">
                    <Text className="text-red-600 text-xs font-bold">
                      Ahorras {formatCLP(currentCompareAtPrice! - currentPrice)}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text className="text-xs text-gray-400 mb-1">Precio</Text>
                  <Text className="text-2xl font-bold text-gray-900">{formatCLP(currentPrice)}</Text>
                </>
              )}
            </View>
          </View>

          {/* Stock indicator */}
          {isAvailable ? (
            <View className="flex-row items-center mb-4">
              {lowStock ? (
                <View className="flex-row items-center bg-orange-50 px-3 py-2 rounded-lg">
                  <Package size={14} color="#EA580C" />
                  <Text className="text-orange-600 text-xs font-medium ml-1">
                    ¡Últimas {stockQuantity} unidades!
                  </Text>
                </View>
              ) : stockQuantity !== null && stockQuantity !== undefined && stockQuantity > 0 ? (
                <View className="flex-row items-center bg-green-50 px-3 py-2 rounded-lg">
                  <Package size={14} color="#16A34A" />
                  <Text className="text-green-600 text-xs font-medium ml-1">
                    En stock ({stockQuantity} disponibles)
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center bg-green-50 px-3 py-2 rounded-lg">
                  <Package size={14} color="#16A34A" />
                  <Text className="text-green-600 text-xs font-medium ml-1">Disponible</Text>
                </View>
              )}
            </View>
          ) : (
            <View className="flex-row items-center bg-red-50 px-3 py-2 rounded-lg mb-4">
              <Package size={14} color="#DC2626" />
              <Text className="text-red-600 text-xs font-medium ml-1">Agotado</Text>
            </View>
          )}

          {/* Visual Option Selectors (Color, Size, etc.) */}
          {product.options && product.options.length > 0 && product.options[0].name !== 'Title' && (
            <View className="border-t border-gray-100 pt-4 mb-4">
              {product.options.map((option) => renderOptionSelector(option))}
            </View>
          )}

          {/* Description */}
          <View className="border-t border-gray-100 pt-4 mb-4">
            <Text className="text-xs uppercase font-bold text-gray-400 mb-2">Descripción</Text>
            <Text className="text-gray-600 text-sm leading-relaxed">{cleanDescription}</Text>
          </View>

          {/* Product Type / Category */}
          {product.productType && (
            <View className="flex-row items-center mb-4">
              <Text className="text-xs text-gray-500">Categoría: </Text>
              <Text className="text-xs font-medium text-purple-600">{product.productType}</Text>
            </View>
          )}

          {/* Metafields (Material, Care, Dimensions, etc.) */}
          {metafieldsToShow.length > 0 && (
            <View className="border-t border-gray-100 pt-4 mb-4">
              <Text className="text-xs uppercase font-bold text-gray-400 mb-3">Detalles del producto</Text>
              {metafieldsToShow.map((field, index) => (
                <View key={index} className="flex-row items-start mb-3">
                  <View className="w-6 h-6 bg-gray-100 rounded-full items-center justify-center mr-3">
                    <field.icon size={12} color="#6B7280" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-gray-700">{field.label}</Text>
                    <Text className="text-xs text-gray-600 mt-0.5">{field.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <View className="border-t border-gray-100 pt-4 mb-4">
              <Text className="text-xs uppercase font-bold text-gray-400 mb-2">Etiquetas</Text>
              <View className="flex-row flex-wrap gap-2">
                {product.tags.slice(0, 8).map((tag, index) => (
                  <View key={index} className="bg-gray-100 px-3 py-1 rounded-full">
                    <Text className="text-xs text-gray-600">{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Verified store badge */}
          {store.isRealStore && (
            <View className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 flex-row items-center gap-2">
              <ShieldCheck size={16} color="#16A34A" />
              <Text className="text-green-800 text-xs font-medium">
                Producto verificado de tienda oficial
              </Text>
            </View>
          )}

          {/* Shipping info hint */}
          <View className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-6 flex-row items-center gap-2">
            <Truck size={16} color="#2563EB" />
            <Text className="text-blue-800 text-xs font-medium">
              Envío calculado al momento del checkout
            </Text>
          </View>

          {/* Add to Cart Button */}
          <TouchableOpacity
            onPress={onAddToCart}
            className={`w-full py-4 rounded-xl shadow-lg flex-row items-center justify-center gap-2 ${
              isAvailable ? 'bg-purple-600' : 'bg-gray-400'
            }`}
            disabled={!isAvailable}
          >
            <ShoppingBag size={20} color="white" />
            <Text className="text-white font-bold text-lg">
              {isAvailable ? 'Agregar al Carrito' : 'No Disponible'}
            </Text>
          </TouchableOpacity>

          {/* SKU info (small) */}
          {selectedVariant?.sku && (
            <Text className="text-xs text-gray-400 text-center mt-3">
              SKU: {selectedVariant.sku}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
