import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import {
  Animated,
  ColorSchemeName,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { findPromotionForProduct } from '../constants/mainProductList';
import { useAppData } from '../contexts/AppDataContext';
import { useSavedItems } from '../contexts/SavedItemsContext';
import { Product, Promotion } from '../types';

const { width } = Dimensions.get('window');

export interface CombinedProduct {
  id: string;
  name: string;
  brand?: string;
  size?: string;
  categories?: string[];
  products: (Product | Promotion)[];
  primaryProduct: Product | Promotion;
  primaryImageProductId: string;
}

interface CombinedProductCardProps {
  combinedProduct: CombinedProduct;
  onPress: () => void;
  colors: any;
  colorScheme: ColorSchemeName;
  promotions?: Promotion[];
}

// Skeleton placeholder component
const ImageSkeleton: React.FC<{ colors: any }> = ({ colors }) => {
  return (
    <View style={[styles.imagePlaceholder, { backgroundColor: colors.background }]}>
      <View style={[styles.skeletonShimmer, { backgroundColor: colors.border }]} />
    </View>
  );
};

const CombinedProductCard: React.FC<CombinedProductCardProps> = ({
  combinedProduct,
  onPress,
  colors,
  colorScheme,
  promotions = [],
}) => {
  const { name, brand, size, products, primaryImageProductId, primaryProduct } = combinedProduct;

  // Calculate dynamic height for iOS based on number of products
  const getCardHeight = () => {
    if (Platform.OS !== 'ios') return 160;
    // iOS: Each product needs more vertical space due to stacked layout
    const baseHeight = 100; // Base height for image and product info
    const perProductHeight = 40; // Height per product in vertical layout
    return Math.max(160, baseHeight + (products.length * perProductHeight));
  };
  const { saveLowestPriceProduct, removeItem, isProductSaved } = useSavedItems();
  const { getImageUrl } = useAppData();

  // Generate image URL on-demand (synchronous, fast!)
  const imageUrl = useMemo(() => {
    const imageFilename = 'images' in primaryProduct ? (primaryProduct as any).images : undefined;
    return getImageUrl(primaryImageProductId, imageFilename);
  }, [primaryImageProductId, primaryProduct, getImageUrl]);

  // Check if any product from this combined product is saved
  const getSavedProductInfo = (): { isSaved: boolean; savedId: string | null } => {
    for (const product of products) {
      const store = 'store' in product ? product.store : product.store_name;
      if (isProductSaved(product.id, store)) {
        return { isSaved: true, savedId: `${product.id}_${store}` };
      }
    }
    return { isSaved: false, savedId: null };
  };

  const { isSaved, savedId } = getSavedProductInfo();

  const handleBookmarkPress = async (event: import('react-native').GestureResponderEvent) => {
    event.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (isSaved && savedId) {
        await removeItem(savedId);
      } else {
        await saveLowestPriceProduct(combinedProduct, promotions);
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const getStoreName = (item: Product | Promotion): string => {
    return 'store' in item ? item.store : item.store_name;
  };

  const getPrice = (item: Product | Promotion): number => {
    return 'price' in item ? item.price : item.new_price;
  };

  const isPromotion = (item: Product | Promotion): boolean => {
    return 'isPromotion' in item;
  };

  const getEffectivePrice = (item: Product | Promotion): { price: number; isPromotion: boolean } => {
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

  const getLowestPrice = (): number => {
    return Math.min(...products.map(p => getEffectivePrice(p).price));
  };

  const getStoreColor = (storeName: string): string => {
    const normalizedStore = storeName.toLowerCase();
    if (normalizedStore.includes('winner')) return '#FF9800';
    if (normalizedStore.includes('super') || normalizedStore.includes('u')) return '#2196F3';
    if (normalizedStore.includes('king') || normalizedStore.includes('saver')) return '#9C27B0';
    return colors.primary;
  };

  const getPriceColor = (price: number, isPromo: boolean): string => {
    const lowestPrice = getLowestPrice();
    if (price === lowestPrice && products.length > 1) {
      return isPromo ? '#ff6b6b' : '#10b981';
    }
    if (price > lowestPrice * 1.1) {
      return '#ef4444';
    }
    return colors.text;
  };

  const lowestPrice = getLowestPrice();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.card },
        Platform.OS === 'ios' && { height: getCardHeight(), minHeight: getCardHeight() }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Bookmark Icon */}
      <TouchableOpacity
        style={styles.bookmarkButton}
        onPress={handleBookmarkPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialIcons
          name={isSaved ? 'bookmark' : 'bookmark-border'}
          size={24}
          color={isSaved ? '#10B981' : colors.text}
        />
      </TouchableOpacity>

      {/* Image Section - Lazy loaded with expo-image disk caching */}
      <View style={styles.imageSection}>
        <Image
          source={{ uri: imageUrl }}
          style={styles.productImage}
          contentFit="cover"
          cachePolicy="disk"
          transition={200}
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          placeholderContentFit="cover"
        />
      </View>

      {/* Details Section */}
      <View style={styles.detailsSection}>
        {/* Brand */}
        {brand && (
          <Text style={[styles.brandText, { color: colors.primary }]} numberOfLines={1}>
            {brand}
          </Text>
        )}

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
                  Platform.OS === 'ios' ? styles.priceRowIOS : styles.priceRow,
                  isPriceLowest && styles.lowestPriceRow,
                  isPriceLowest && hasPromo && { backgroundColor: '#ff6b6b15' },
                  isPriceLowest && !hasPromo && { backgroundColor: '#10b98115' }
                ]}
              >
                {Platform.OS === 'ios' ? (
                  // iOS: Vertical layout - store name on top, price below
                  <View style={styles.priceRowIOSContent}>
                    <View style={styles.storeNameContainerIOS}>
                      <View
                        style={[
                          styles.storeDot,
                          { backgroundColor: getStoreColor(storeName) }
                        ]}
                      />
                      <Text
                        style={[
                          styles.storeNameIOS,
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
                    <View style={styles.priceContainerIOS}>
                      {hasPromo && originalPrice !== displayPrice && (
                        <Text style={[styles.previousPrice, { color: colors.error }]}>
                          Rs {formatPrice(originalPrice)}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.priceTextIOS,
                          { color: getPriceColor(displayPrice, hasPromo) },
                          isPriceLowest && styles.lowestPriceText
                        ]}
                      >
                        Rs {formatPrice(displayPrice)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  // Android: Horizontal layout (original)
                  <>
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
                          {formatPrice(originalPrice)}
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
                  </>
                )}
              </View>
            );
          })}
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
    height: 160,
    position: 'relative',
  },
  bookmarkButton: {
    position: 'absolute',
    top: 8,
    // iOS: top left (over image), Android: top right (over text area)
    left: Platform.OS === 'ios' ? 8 : undefined,
    right: Platform.OS === 'ios' ? undefined : 8,
    zIndex: 10,
    padding: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
  },
  imageSection: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  productImage: {
    width: 150,
    height: 150,
    borderRadius: 8,
  },
  imagePlaceholder: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    overflow: 'hidden',
  },
  skeletonShimmer: {
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
  detailsSection: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  brandText: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    // Smaller font for iOS to prevent overlapping (iOS renders fonts larger)
    fontSize: Platform.OS === 'ios' ? 16 : 24,
    fontWeight: Platform.OS === 'ios' ? '600' : '700',
    marginBottom: 2,
    // More generous line height for iOS
    lineHeight: Platform.OS === 'ios' ? 20 : 26,
  },
  sizeText: {
    fontSize: 12,
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
  priceRowIOS: {
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderRadius: 6,
  },
  priceRowIOSContent: {
    flexDirection: 'column',
  },
  storeNameContainerIOS: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeNameIOS: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  priceContainerIOS: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    marginTop: 1,
    gap: 6,
  },
  priceTextIOS: {
    fontSize: 13,
    fontWeight: '600',
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
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  storeName: {
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '600',
  },
  lowestPriceText: {
    fontWeight: '800',
  },
});

export default CombinedProductCard;
