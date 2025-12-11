import { Image } from 'expo-image';
import React from 'react';
import {
  ActivityIndicator,
  ColorSchemeName,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Product, Promotion } from '../types';
import { findPromotionForProduct } from '../constants/mainProductList';

const { width } = Dimensions.get('window');

// Store priority for image selection: Winners > Super U > King Savers
const STORE_PRIORITY: { [key: string]: number } = {
  'winners': 1,
  'super u': 2,
  'kingsavers': 3,
  'king savers': 3,
};

export interface CombinedProduct {
  id: string;
  name: string;
  size?: string;
  category?: string;
  products: (Product | Promotion)[];
  primaryProduct: Product | Promotion;
  primaryImageProductId: string;
}

interface CombinedProductCardProps {
  combinedProduct: CombinedProduct;
  onPress: () => void;
  colors: any;
  colorScheme: ColorSchemeName;
  imageUrl: string | null;
  imageLoading: boolean;
  promotions?: Promotion[];
}

const CombinedProductCard: React.FC<CombinedProductCardProps> = ({
  combinedProduct,
  onPress,
  colors,
  colorScheme,
  imageUrl,
  imageLoading,
  promotions = [],
}) => {
  const { name, size, products } = combinedProduct;

  const getStoreName = (item: Product | Promotion): string => {
    return 'store' in item ? item.store : item.store_name;
  };

  const getPrice = (item: Product | Promotion): number => {
    return 'price' in item ? item.price : item.new_price;
  };

  const isPromotion = (item: Product | Promotion): boolean => {
    return 'isPromotion' in item;
  };

  const getPreviousPrice = (item: Product | Promotion): number | undefined => {
    if ('previous_price' in item) {
      return item.previous_price;
    }
    return undefined;
  };

  const getEffectivePrice = (item: Product | Promotion): { price: number; isPromotion: boolean } => {
    // Only regular products can have promotions, not promotions themselves
    if ('store' in item && !('isPromotion' in item)) {
      const promotion = findPromotionForProduct(item as Product, promotions);
      if (promotion) {
        return { price: promotion.new_price, isPromotion: true };
      }
    }
    return { price: getPrice(item), isPromotion: false };
  };

  const formatPrice = (price: any): string => {
    if (price == null) return '0.00';
    try {
      const parsed = typeof price === 'number' ? price : parseFloat(price.toString());
      return parsed.toFixed(2);
    } catch {
      return price.toString();
    }
  };

  // Get the lowest price from all stores for highlighting (includes promotions)
  const getLowestPrice = (): number => {
    return Math.min(...products.map(p => getEffectivePrice(p).price));
  };

  // Get store color based on store name
  const getStoreColor = (storeName: string): string => {
    const normalizedStore = storeName.toLowerCase();
    if (normalizedStore.includes('winner')) return '#FF9800';
    if (normalizedStore.includes('super') || normalizedStore.includes('u')) return '#2196F3';
    if (normalizedStore.includes('king') || normalizedStore.includes('saver')) return '#9C27B0';
    return colors.primary;
  };

  // Get price color based on whether it's the lowest (uses effective prices)
  const getPriceColor = (price: number, isPromo: boolean): string => {
    const lowestPrice = getLowestPrice();
    if (price === lowestPrice && products.length > 1) {
      return isPromo ? '#ff6b6b' : '#10b981'; // Red for promo, green for lowest
    }
    if (price > lowestPrice * 1.1) {
      return '#ef4444'; // Red for higher prices
    }
    return colors.text;
  };

  const lowestPrice = getLowestPrice();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Image Section */}
      <View style={styles.imageSection}>
        {imageLoading ? (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.productImage}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.background }]}>
            <Text style={styles.placeholderIcon}>No Image</Text>
          </View>
        )}
      </View>

      {/* Details Section */}
      <View style={styles.detailsSection}>
        {/* Product Name */}
        <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
          {name}
        </Text>

        {/* Size */}
        {size && (
          <Text style={[styles.sizeText, { color: colors.text }]} numberOfLines={1}>
            {size}
          </Text>
        )}

        {/* Store Prices */}
        <View style={styles.pricesContainer}>
          {products.map((product, index) => {
            const storeName = getStoreName(product);
            const effectivePrice = getEffectivePrice(product);
            const displayPrice = effectivePrice.price;
            const hasPromo = effectivePrice.isPromotion;
            const isPriceLowest = displayPrice === lowestPrice && products.length > 1;
            const isPromo = isPromotion(product);
            const originalPrice = getPrice(product);

            return (
              <View
                key={`${storeName}-${index}`}
                style={[
                  styles.priceRow,
                  isPriceLowest && styles.lowestPriceRow,
                  isPriceLowest && hasPromo && { backgroundColor: '#ff6b6b15' },
                  isPriceLowest && !hasPromo && { backgroundColor: '#10b98115' }
                ]}
              >
                <View style={styles.storeNameContainer}>
                  <View
                    style={[
                      styles.storeDot,
                      { backgroundColor: getStoreColor(storeName) }
                    ]}
                  />
                  <Text
                    style={[
                      styles.storeName,
                      { color: colors.text }
                    ]}
                    numberOfLines={1}
                  >
                    {storeName}
                  </Text>
                  {(isPromo || hasPromo) && (
                    <View style={styles.promoBadge}>
                      <Text style={styles.promoText}>PROMO</Text>
                    </View>
                  )}
                </View>
                <View style={styles.priceContainer}>
                  {hasPromo && originalPrice !== displayPrice && (
                    <Text style={[styles.previousPrice, { color: colors.error }]}>
                      Rs {formatPrice(originalPrice)}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.priceText,
                      { color: getPriceColor(displayPrice, hasPromo) },
                      isPriceLowest && styles.lowestPriceText
                    ]}
                  >
                    Rs {formatPrice(displayPrice)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Tap indicator */}
        <View style={styles.tapIndicator}>
          <Text style={[styles.tapText, { color: colors.text }]}>Tap for details</Text>
          <Text style={[styles.tapArrow, { color: colors.primary }]}>+</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, // Reduced shadow offset slightly
    shadowOpacity: 0.15,
    shadowRadius: 6, // Reduced shadow radius
    elevation: 4, // Reduced elevation
    overflow: 'hidden',
    height: 160, // Match image height
  },
  imageSection: {
    width: 160, // Larger square image
    height: 160, // Same as width for square
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4, // Added small padding
  },
  productImage: {
    width: 150,
    height: 150,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 20, // Reduced icon size
    opacity: 0.5,
  },
  detailsSection: {
    flex: 1, // Take remaining space
    paddingVertical: 8, // Add some vertical padding
    paddingHorizontal: 8, // Add horizontal padding
    justifyContent: 'flex-start', // Align content to top
    overflow: 'hidden', // Cut off bottom content
  },
  productName: {
    fontSize: 24, // 50% larger (from 16 to 24)
    fontWeight: '700',
    marginBottom: 2,
    lineHeight: 26, // Tighter line height
  },
  sizeText: {
    fontSize: 12, // Reduced from 18 to 12
    opacity: 0.6,
    marginBottom: 4,
  },
  pricesContainer: {
    gap: 2,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 1,
    paddingHorizontal: 3,
    borderRadius: 6,
  },
  lowestPriceRow: {
    borderWidth: 1,
    borderColor: '#10b98130',
  },
  storeNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  storeDot: {
    width: 6, // Slightly smaller dot
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  storeName: {
    fontSize: 14, // Increased from 12 to 14
    fontWeight: '500',
  },
  promoBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  promoText: {
    color: 'white',
    fontSize: 8,
    fontWeight: '700',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previousPrice: {
    fontSize: 10,
    textDecorationLine: 'line-through',
    opacity: 0.8,
  },
  priceText: {
    fontSize: 14, // Increased from 12 to 14
    fontWeight: '600',
  },
  lowestPriceText: {
    fontWeight: '800',
  },
  tapIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 0,
    display: 'none', // Hide tap indicator to make card cleaner/shorter as requested "thinner" often implies less clutter
  },
  tapText: {
    fontSize: 9,
    opacity: 0.4,
  },
  tapArrow: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CombinedProductCard;
