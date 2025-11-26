export const formatCLP = (amount: number): string => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Calculate discount percentage
 * @param price - Current sale price
 * @param compareAtPrice - Original price before discount
 * @returns Discount percentage (e.g., 20 for 20% off) or null if no discount
 */
export const calculateDiscount = (
  price: number,
  compareAtPrice: number | null | undefined
): number | null => {
  if (!compareAtPrice || compareAtPrice <= price) {
    return null;
  }
  const discount = Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
  return discount > 0 ? discount : null;
};

/**
 * Check if product is on sale
 */
export const isOnSale = (
  price: number,
  compareAtPrice: number | null | undefined
): boolean => {
  return !!compareAtPrice && compareAtPrice > price;
};

