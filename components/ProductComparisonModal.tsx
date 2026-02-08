import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ColorSchemeName,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { findPromotionForProduct } from '../constants/mainProductList';
import { useSavedItems } from '../contexts/SavedItemsContext';
import DataCacheService from '../services/DataCacheService';
import SupabaseService from '../services/SupabaseService';
import { Product, Promotion } from '../types';
import { CombinedProduct } from './CombinedProductCard';

const NO_IMAGE_PLACEHOLDER = require('../assets/images/Screenshot 2025-12-11 121944.png');

interface ProductComparisonModalProps {
  visible: boolean;
  combinedProduct: CombinedProduct | null;
  onClose: () => void;
  colors: any;
  colorScheme: ColorSchemeName;
  promotions: Promotion[];
  onPriceUpdated: () => void;
}

const ProductComparisonModal: React.FC<ProductComparisonModalProps> = ({
  visible,
  combinedProduct,
  onClose,
  colors,
  colorScheme,
  promotions,
  onPriceUpdated,
}) => {
  const { saveSpecificProduct, removeItem, isProductSaved } = useSavedItems();
  const [selectedProductForUpdate, setSelectedProductForUpdate] = useState<Product | null>(null);
  const [showUpdatePrice, setShowUpdatePrice] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const cacheService = DataCacheService.getInstance();

  // Generate carousel images synchronously - no async needed!
  const carouselImages = combinedProduct ? combinedProduct.products.map((product) => {
    const storeName = 'store' in product ? product.store : product.store_name;
    const imageFilename = 'images' in product ? (product as any).images : undefined;
    const url = cacheService.getImageUrl(product.id, imageFilename);
    return { url, storeName };
  }) : [];

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, gestureState) => {
        const { dx } = gestureState;
        const threshold = 50;

        if (dx > threshold && currentImageIndex > 0) {
          setCurrentImageIndex(currentImageIndex - 1);
        } else if (dx < -threshold && combinedProduct && currentImageIndex < combinedProduct.products.length - 1) {
          setCurrentImageIndex(currentImageIndex + 1);
        }
      },
    })
  ).current;

  const goToPreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const goToNextImage = () => {
    if (combinedProduct && currentImageIndex < combinedProduct.products.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  // Reset image index when modal opens
  useEffect(() => {
    if (visible && combinedProduct) {
      setCurrentImageIndex(0);
    }
  }, [visible, combinedProduct]);

  if (!combinedProduct) return null;

  const { name, brand, size, categories, products } = combinedProduct;

  const getStoreName = (item: Product | Promotion): string => {
    return 'store' in item ? item.store : item.store_name;
  };

  const getProductName = (item: Product | Promotion): string => {
    return 'product' in item ? item.product : item.product_name || 'Unknown Product';
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

  const formatPrice = (price: any): string => {
    if (price == null) return '0.00';
    try {
      const parsed = typeof price === 'number' ? price : parseFloat(price.toString());
      return parsed.toFixed(2);
    } catch {
      return price.toString();
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(diff / (1000 * 60 * 60));

      if (days > 0) {
        return `${days} days ago`;
      } else if (hours > 0) {
        return `${hours} hours ago`;
      } else {
        return 'Just now';
      }
    } catch {
      return 'Unknown';
    }
  };


  const getHighestPrice = (): number => {
    // Use original prices for highest calculation
    return Math.max(...products.map(p => getPrice(p)));
  };

  const getSavingsPercentage = (): number => {
    const lowest = Math.min(...products.map(p => {
      const isProductType = !isPromotion(p);
      if (isProductType) {
        const promo = findPromotionForProduct(p as Product, promotions);
        return promo ? promo.new_price : getPrice(p);
      }
      return getPrice(p);
    }));
    const highest = getHighestPrice();
    if (highest === 0) return 0;
    return Math.round(((highest - lowest) / highest) * 100);
  };

  const getStoreColor = (storeName: string): string => {
    const normalizedStore = storeName.toLowerCase();
    if (normalizedStore.includes('winner')) return '#FF9800';
    if (normalizedStore.includes('super') || normalizedStore.includes('u')) return '#2196F3';
    if (normalizedStore.includes('king') || normalizedStore.includes('saver')) return '#9C27B0';
    return colors.primary;
  };

  const getEffectiveModalPrice = (product: Product | Promotion): { price: number; isPromotion: boolean; originalPrice: number } => {
    const isProductType = !isPromotion(product);
    if (isProductType) {
      const promo = findPromotionForProduct(product as Product, promotions);
      if (promo) {
        return { price: promo.new_price, isPromotion: true, originalPrice: getPrice(product) };
      }
    }
    return { price: getPrice(product), isPromotion: false, originalPrice: getPrice(product) };
  };

  const getPriceColor = (price: number, hasPromo: boolean): string => {
    // Recalculate lowest considering promotions
    const lowestPrice = Math.min(...products.map(p => getEffectiveModalPrice(p).price));
    if (price === lowestPrice && products.length > 1) {
      return hasPromo ? '#ff6b6b' : '#10b981';
    }
    if (price > lowestPrice * 1.1) {
      return '#ef4444';
    }
    return colors.text;
  };

  const lowestPrice = Math.min(...products.map(p => getEffectiveModalPrice(p).price));
  const highestPrice = getHighestPrice();
  const savingsPercentage = getSavingsPercentage();

  const isValidPrice = (priceText: string): boolean => {
    if (!priceText) return false;
    const cleanPrice = priceText.replace(/Rs/gi, '').replace(/\s/g, '').replace(',', '.');
    return /^[\d]+(\.[\d]*)?$/.test(cleanPrice) || /^[\d]+,[\d]*$/.test(cleanPrice);
  };

  const getPriceValue = (priceText: string): number => {
    const cleanPrice = priceText.replace(/Rs/gi, '').replace(/\s/g, '').replace(',', '.');
    return parseFloat(cleanPrice) || 0;
  };

  const handleUpdatePrice = (product: Product) => {
    // Check if this product has a promotion
    const hasPromotion = findPromotionForProduct(product, promotions) !== null;

    if (hasPromotion) {
      Alert.alert('Cannot Update', 'Price cannot be updated during promotion');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedProductForUpdate(product);
    setShowUpdatePrice(true);
    setNewPrice('');
  };

  const submitPriceUpdate = async () => {
    if (!selectedProductForUpdate) return;

    if (!newPrice.trim()) {
      Alert.alert('Error', 'Please enter a new price');
      return;
    }

    if (!isValidPrice(newPrice)) {
      Alert.alert('Error', 'Invalid price format. Please enter a valid amount (e.g., "Rs 12.50" or "12,50")');
      return;
    }

    const priceValue = getPriceValue(newPrice);
    if (priceValue > 1000) {
      Alert.alert('Error', 'Price exceeds Rs 1000 limit. Please verify the amount');
      return;
    }

    setIsUpdatingPrice(true);

    try {
      const products = await SupabaseService.getProducts({
        filters: {
          product: selectedProductForUpdate.product,
          size: selectedProductForUpdate.size,
          store: selectedProductForUpdate.store
        }
      });

      if (!products || products.length === 0) {
        Alert.alert('Error', 'Product not found in database. Please try again.');
        return;
      }

      const productToUpdate = products[0];

      const updatedProduct = await SupabaseService.updateProduct(productToUpdate.id!, {
        price: priceValue.toString()
      });

      if (updatedProduct) {
        await cacheService.invalidateProducts();
        Alert.alert('Success', 'Product price updated successfully!');
        setShowUpdatePrice(false);
        setSelectedProductForUpdate(null);
        setNewPrice('');
        onPriceUpdated();
        onClose();
      } else {
        Alert.alert('Error', 'Failed to update product price. Please try again.');
      }
    } catch (error) {
      console.error('Error updating price:', error);
      Alert.alert('Error', 'Failed to update price. Please check your connection and try again.');
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowUpdatePrice(false);
    setSelectedProductForUpdate(null);
    setNewPrice('');
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <BlurView intensity={80} style={styles.modalBlur}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Price Comparison</Text>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.background }]}
                onPress={handleClose}
              >
                <Text style={[styles.closeButtonText, { color: colors.text }]}>X</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: Platform.OS === 'android' ? 40 : 20 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Product Image Carousel */}
              <View style={styles.carouselContainer}>
                {carouselImages.length > 0 ? (
                  <>
                    <View style={styles.carouselWrapper} {...panResponder.panHandlers}>
                      {/* Left Arrow */}
                      {currentImageIndex > 0 && (
                        <TouchableOpacity
                          style={styles.arrowButton}
                          onPress={goToPreviousImage}
                        >
                          <Text style={styles.arrowText}>‹</Text>
                        </TouchableOpacity>
                      )}

                      <View style={styles.imageWrapper}>
                        <Image
                          source={{ uri: carouselImages[currentImageIndex]?.url }}
                          style={styles.productImage}
                          contentFit="cover"
                          cachePolicy="disk"
                          transition={200}
                          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                          placeholderContentFit="cover"
                        />
                      </View>

                      {/* Right Arrow */}
                      {currentImageIndex < carouselImages.length - 1 && (
                        <TouchableOpacity
                          style={styles.arrowButton}
                          onPress={goToNextImage}
                        >
                          <Text style={styles.arrowText}>›</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Supermarket Name Below Image */}
                    <Text style={[styles.storeLabel, { color: colors.text }]}>
                      {carouselImages[currentImageIndex]?.storeName}
                    </Text>

                    {/* Carousel Dots/Navigation */}
                    {carouselImages.length > 1 && (
                      <View style={styles.carouselDots}>
                        {carouselImages.map((_, index) => (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.dot,
                              {
                                backgroundColor:
                                  index === currentImageIndex
                                    ? colors.primary
                                    : colors.primary + '40'
                              }
                            ]}
                            onPress={() => setCurrentImageIndex(index)}
                          />
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <View style={[styles.imagePlaceholder, { backgroundColor: colors.background }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                )}
              </View>

              {/* Product Info */}
              {brand && (
                <Text style={[styles.brandText, { color: colors.primary }]}>{brand}</Text>
              )}
              <Text style={[styles.productName, { color: colors.text }]}>{name}</Text>

              {size && (
                <View style={[styles.infoRow, { backgroundColor: colors.background }]}>
                  <Text style={[styles.infoLabel, { color: colors.text }]}>Size</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{size}</Text>
                </View>
              )}

              {categories && categories.length > 0 && (
                <View style={[styles.infoRow, { backgroundColor: colors.background }]}>
                  <Text style={[styles.infoLabel, { color: colors.text }]}>
                    {categories.length > 1 ? 'Categories' : 'Category'}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {categories.map(cat =>
                      cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()
                    ).join(', ')}
                  </Text>
                </View>
              )}

              {/* Savings Summary */}
              {products.length > 1 && savingsPercentage > 0 && (
                <View style={[styles.savingsCard, { backgroundColor: '#10b98120' }]}>
                  <Text style={styles.savingsIcon}>$</Text>
                  <View style={styles.savingsTextContainer}>
                    <Text style={styles.savingsTitle}>Potential Savings</Text>
                    <Text style={styles.savingsAmount}>
                      Save Rs {formatPrice(highestPrice - lowestPrice)} ({savingsPercentage}%)
                    </Text>
                  </View>
                </View>
              )}

              {/* Store-by-Store Comparison */}
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Prices by Store
              </Text>

              {products.map((product, index) => {
                const storeName = getStoreName(product);
                const productName = getProductName(product);
                const effectivePrice = getEffectiveModalPrice(product);
                const displayPrice = effectivePrice.price;
                const hasPromo = effectivePrice.isPromotion;
                const originalPrice = effectivePrice.originalPrice;

                // Recalculate lowest with promos for comparison
                const lowestWithPromos = Math.min(...products.map(p => getEffectiveModalPrice(p).price));
                const isPriceLowest = displayPrice === lowestWithPromos && products.length > 1;

                const isPromo = isPromotion(product);
                const isProductType = !isPromo;
                const previousPrice = getPreviousPrice(product);

                // Check if this specific product is saved
                const productIsSaved = isProductSaved(product.id, storeName);

                const handleBookmarkPress = async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  try {
                    if (productIsSaved) {
                      await removeItem(`${product.id}_${storeName}`);
                    } else {
                      await saveSpecificProduct(product, promotions);
                    }
                  } catch (error) {
                    console.error('Error toggling bookmark:', error);
                  }
                };

                return (
                  <View
                    key={`store-${index}`}
                    style={[
                      styles.storeCard,
                      { backgroundColor: colors.background },
                      isPriceLowest && styles.bestPriceCard,
                      isPriceLowest && hasPromo && { borderColor: '#ff6b6b' },
                      isPriceLowest && !hasPromo && { borderColor: '#10b981' }
                    ]}
                  >
                    {isPriceLowest && (
                      <View style={[styles.bestPriceBadge, { backgroundColor: hasPromo ? '#ff6b6b' : '#10b981' }]}>
                        <Text style={styles.bestPriceText}>BEST PRICE</Text>
                      </View>
                    )}

                    <View style={styles.storeHeader}>
                      {/* Store Name - Split into lines for iOS */}
                      <View style={styles.storeNameColumn}>
                        <View style={styles.storeNameRow}>
                          <View
                            style={[
                              styles.storeColorDot,
                              { backgroundColor: getStoreColor(storeName) }
                            ]}
                          />
                          {Platform.OS === 'ios' ? (
                            // iOS: Split store name into multiple lines
                            <View style={styles.storeNameTextContainer}>
                              {storeName.split(' ').map((word, wordIndex) => (
                                <Text
                                  key={wordIndex}
                                  style={[styles.storeCardNameIOS, { color: colors.text }]}
                                >
                                  {word}
                                </Text>
                              ))}
                            </View>
                          ) : (
                            <Text style={[styles.storeCardName, { color: colors.text }]}>
                              {storeName}
                            </Text>
                          )}
                        </View>
                        {(isPromo || hasPromo) && (
                          <View style={[styles.promoBadgeLarge, { backgroundColor: '#ef4444', marginTop: 4, alignSelf: 'flex-start', marginLeft: 20 }]}>
                            <Text style={styles.promoBadgeText}>PROMO</Text>
                          </View>
                        )}
                      </View>

                      {/* Bookmark Button - Centered between store name and price */}
                      <TouchableOpacity
                        style={styles.modalBookmarkButtonCentered}
                        onPress={handleBookmarkPress}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <MaterialIcons
                          name={productIsSaved ? 'bookmark' : 'bookmark-border'}
                          size={28}
                          color={productIsSaved ? '#10B981' : colors.text}
                        />
                      </TouchableOpacity>

                      {/* Price Column */}
                      <View style={styles.priceColumn}>
                        {hasPromo && originalPrice !== displayPrice && (
                          <Text style={[styles.previousPriceLarge, { color: colors.error }]}>
                            {formatPrice(originalPrice)}
                          </Text>
                        )}
                        {isPromo && previousPrice && !hasPromo && (
                          <Text style={[styles.previousPriceLarge, { color: colors.error }]}>
                            {formatPrice(previousPrice)}
                          </Text>
                        )}
                        <Text
                          style={[
                            styles.storePriceLarge,
                            { color: getPriceColor(displayPrice, hasPromo) },
                            isPriceLowest && styles.bestPriceAmount
                          ]}
                        >
                          Rs {formatPrice(displayPrice)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.storeDetails}>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.text }]}>
                          Product Name at Store:
                        </Text>
                        <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>
                          {productName}
                        </Text>
                      </View>

                      {'size' in product && product.size && (
                        <View style={styles.detailRow}>
                          <Text style={[styles.detailLabel, { color: colors.text }]}>Size:</Text>
                          <Text style={[styles.detailValue, { color: colors.text }]}>
                            {product.size}
                          </Text>
                        </View>
                      )}

                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.text }]}>Updated:</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                          {'created_at' in product
                            ? formatDate(product.created_at)
                            : formatDate((product as Promotion).timestamp)}
                        </Text>
                      </View>
                    </View>

                    {/* Update Price Button for regular products */}
                    {isProductType && !hasPromo && (
                      <TouchableOpacity
                        style={[styles.updatePriceBtn, { backgroundColor: colors.primary + '20' }]}
                        onPress={() => handleUpdatePrice(product as Product)}
                      >
                        <Text style={[styles.updatePriceBtnText, { color: colors.primary }]}>
                          Wrong price? Update it
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              {/* Update Price Form */}
              {showUpdatePrice && selectedProductForUpdate && (
                <View style={[styles.updatePriceForm, { backgroundColor: colors.background }]}>
                  <Text style={[styles.updateFormTitle, { color: colors.text }]}>
                    Update Price for {getStoreName(selectedProductForUpdate)}
                  </Text>

                  <View style={[styles.currentPriceDisplay, { backgroundColor: colors.card }]}>
                    <Text style={[styles.currentPriceLabel, { color: colors.text }]}>Current Price</Text>
                    <Text style={[styles.currentPriceValue, { color: colors.primary }]}>
                      Rs {formatPrice(selectedProductForUpdate.price)}
                    </Text>
                  </View>

                  <View style={styles.newPriceInputContainer}>
                    <Text style={[styles.newPriceLabel, { color: colors.text }]}>New Price</Text>
                    <TextInput
                      style={[
                        styles.newPriceInput,
                        {
                          backgroundColor: colors.card,
                          color: colors.text,
                          borderColor: colors.border
                        }
                      ]}
                      value={newPrice}
                      onChangeText={setNewPrice}
                      placeholder="Rs 12.50 or 12,50"
                      placeholderTextColor={colors.text + '60'}
                      keyboardType="numeric"
                      returnKeyType="done"
                    />
                  </View>

                  <View style={styles.updatePriceActions}>
                    <TouchableOpacity
                      style={[styles.cancelUpdateButton, { backgroundColor: colors.card }]}
                      onPress={() => {
                        setShowUpdatePrice(false);
                        setSelectedProductForUpdate(null);
                        setNewPrice('');
                      }}
                    >
                      <Text style={[styles.cancelUpdateText, { color: colors.text }]}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.submitUpdateButton,
                        {
                          backgroundColor: isUpdatingPrice ? colors.background : colors.primary,
                          opacity: isUpdatingPrice ? 0.6 : 1
                        }
                      ]}
                      onPress={submitPriceUpdate}
                      disabled={isUpdatingPrice}
                    >
                      {isUpdatingPrice ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Text style={styles.submitUpdateText}>Save Changes</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBlur: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '92%',
    maxHeight: '85%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: Platform.OS === 'android' ? 0 : 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
  },
  carouselContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  carouselWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  imageWrapper: {
    alignItems: 'center',
    marginBottom: 8,
  },
  productImage: {
    width: 180,
    height: 180,
    borderRadius: 12,
  },
  imagePlaceholder: {
    width: 180,
    height: 180,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowButton: {
    padding: 8,
  },
  arrowText: {
    fontSize: 32,
    fontWeight: '300',
    color: '#000',
  },
  storeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  placeholderIcon: {
    fontSize: 14,
    opacity: 0.5,
  },
  brandText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  productName: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  savingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  savingsIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  savingsTextContainer: {
    flex: 1,
  },
  savingsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 4,
  },
  savingsAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
  },
  storeCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bestPriceCard: {
    borderWidth: 2,
  },
  bestPriceBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bestPriceText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  storeNameColumn: {
    flex: 1,
    maxWidth: Platform.OS === 'ios' ? 100 : undefined,
  },
  storeNameRow: {
    flexDirection: 'row',
    alignItems: Platform.OS === 'ios' ? 'flex-start' : 'center',
  },
  storeColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
    marginTop: Platform.OS === 'ios' ? 3 : 0,
  },
  storeNameTextContainer: {
    flexDirection: 'column',
  },
  storeCardName: {
    fontSize: 16,
    fontWeight: '700',
  },
  storeCardNameIOS: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  modalBookmarkButtonCentered: {
    paddingHorizontal: 16,
    alignSelf: 'center',
  },
  promoBadgeLarge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  promoBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalBookmarkButton: {
    marginLeft: 8,
    padding: 4,
  },
  priceColumn: {
    alignItems: 'flex-end',
  },
  previousPriceLarge: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  storePriceLarge: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  bestPriceAmount: {
    fontSize: 24,
  },
  storeDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 12,
    opacity: 0.7,
    flex: 0.4,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '500',
    flex: 0.6,
    textAlign: 'right',
  },
  updatePriceBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  updatePriceBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  updatePriceForm: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  updateFormTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  currentPriceDisplay: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentPriceLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  currentPriceValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  newPriceInputContainer: {
    marginBottom: 16,
  },
  newPriceLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  newPriceInput: {
    borderWidth: Platform.OS === 'android' ? 0 : 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  updatePriceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelUpdateButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelUpdateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitUpdateButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitUpdateText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ProductComparisonModal;
