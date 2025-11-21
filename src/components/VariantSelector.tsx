import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ProductVariant } from '../types';

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedVariant: ProductVariant | null;
  onVariantSelect: (variant: ProductVariant) => void;
}

export const VariantSelector: React.FC<VariantSelectorProps> = ({
  variants,
  selectedVariant,
  onVariantSelect,
}) => {
  if (!variants || variants.length === 0) {
    return null;
  }

  // Si solo hay una variante y es "Default Title", no mostrar selector
  if (variants.length === 1 && variants[0].title === 'Default Title') {
    return null;
  }

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Selecciona una opción:</Text>
      <View style={styles.variantsContainer}>
        {variants.map((variant) => {
          const isSelected = selectedVariant?.id === variant.id;
          const isAvailable = variant.available;

          return (
            <TouchableOpacity
              key={variant.id}
              style={[
                styles.variantButton,
                isSelected && styles.selectedVariant,
                !isAvailable && styles.unavailableVariant,
              ]}
              onPress={() => isAvailable && onVariantSelect(variant)}
              disabled={!isAvailable}
            >
              <View style={styles.variantContent}>
                <Text
                  style={[
                    styles.variantTitle,
                    isSelected && styles.selectedText,
                    !isAvailable && styles.unavailableText,
                  ]}
                  numberOfLines={2}
                >
                  {variant.title}
                </Text>
                <Text
                  style={[
                    styles.variantPrice,
                    isSelected && styles.selectedText,
                    !isAvailable && styles.unavailableText,
                  ]}
                >
                  {formatPrice(variant.price)}
                </Text>
              </View>
              {!isAvailable && (
                <View style={styles.unavailableBadge}>
                  <Text style={styles.unavailableBadgeText}>Agotado</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  variantsContainer: {
    gap: 8,
  },
  variantButton: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#fff',
    position: 'relative',
  },
  selectedVariant: {
    borderColor: '#000',
    backgroundColor: '#f8f8f8',
  },
  unavailableVariant: {
    borderColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    opacity: 0.6,
  },
  variantContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  variantTitle: {
    fontSize: 15,
    color: '#333',
    flex: 1,
    fontWeight: '500',
  },
  variantPrice: {
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
  },
  selectedText: {
    color: '#000',
  },
  unavailableText: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  unavailableBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ff4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  unavailableBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
