import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES } from '../../constants/categories';
import DataCacheService from '../../services/DataCacheService';
import SupabaseService from '../../services/SupabaseService';
import ProductGroupingService, { ProductGroup, PriceLevel } from '../../services/ProductGroupingService';
import { Product, Promotion } from '../../types';

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 3; // 3 columns with proper spacing

const PricesScreen = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [filteredItems, setFilteredItems] = useState<(Product | Promotion)[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | Promotion | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showUpdatePrice, setShowUpdatePrice] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const cacheService = DataCacheService.getInstance();
  const groupingService = ProductGroupingService.getInstance();

  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Check cached data first
      if (cacheService.isProductsCacheValid && cacheService.cachedProducts) {
        setProducts(cacheService.cachedProducts);
        setIsLoading(false);
        console.log('📋 Displayed cached data immediately');
      }
      
      if (cacheService.isPromotionsCacheValid && cacheService.cachedPromotions) {
        setPromotions(cacheService.cachedPromotions);
      }

      // Fetch fresh data
      const [fetchedProducts, fetchedPromotions] = await Promise.all([
        cacheService.getProducts(),
        cacheService.getPromotions()
      ]);

      setProducts(fetchedProducts);
      setPromotions(fetchedPromotions);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load data. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [cacheService]);

  const filterItems = React.useCallback(() => {
    let allItems: (Product | Promotion)[] = [
      ...products,
      ...promotions.map(p => ({ ...p, isPromotion: true }))
    ];

    if (selectedCategory) {
      allItems = allItems.filter(item => {
        const itemCategory = (item as Product).category || (item as Promotion).category;
        return itemCategory?.toLowerCase() === selectedCategory.toLowerCase();
      });
    }

    setFilteredItems(allItems);
    
    // Group the filtered items using the grouping service
    const groups = groupingService.groupProducts(allItems);
    setProductGroups(groups);
  }, [products, promotions, selectedCategory, groupingService]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    filterItems();
  }, [filterItems]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleRefreshData = async () => {
    try {
      setIsRefreshing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Force refresh all data by bypassing cache
      await Promise.all([
        cacheService.getProducts(true),
        cacheService.getPromotions(true)
      ]);
      
      // Refresh the UI data
      await fetchData();
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error refreshing data:', error);
      Alert.alert('Error', 'Failed to refresh data. Please check your connection and try again.');
    } finally {
      setIsRefreshing(false);
    }
  };



  const selectCategory = (categoryName: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedCategory === categoryName) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(categoryName);
    }
  };

  const showProductDetails = (product: Product | Promotion) => {
    console.log('showProductDetails called with:', product);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedProduct(product);
    setShowUpdatePrice(false);
    setNewPrice('');
    setModalVisible(true);
    console.log('Modal should be visible now');
  };

  const handleUpdatePrice = () => {
    if (!selectedProduct || 'isPromotion' in selectedProduct) {
      Alert.alert('Error', 'Cannot update price for promotions');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowUpdatePrice(true);
  };

  const submitPriceUpdate = async () => {
    if (!selectedProduct || 'isPromotion' in selectedProduct) {
      return;
    }

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
      // First, find the product in the database by matching name, size, and store
      const products = await SupabaseService.getProducts({
        filters: {
          product: selectedProduct.product,
          size: selectedProduct.size,
          store: selectedProduct.store
        }
      });

      if (!products || products.length === 0) {
        Alert.alert('Error', 'Product not found in database. Please try again.');
        return;
      }

      const productToUpdate = products[0];

      // Update the product price in Supabase
      const updatedProduct = await SupabaseService.updateProduct(productToUpdate.id!, {
        price: priceValue.toString()
      });

      if (updatedProduct) {
        // Invalidate cache and refresh data
        await cacheService.invalidateProducts();
        Alert.alert('Success', 'Product price updated successfully!');
        setModalVisible(false);
        setShowUpdatePrice(false);
        setNewPrice('');
        // Refresh the products list
        fetchData();
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



  const isValidPrice = (priceText: string): boolean => {
    if (!priceText) return false;
    // Only remove "Rs" and spaces for validation, keep decimal points
    const cleanPrice = priceText.replace(/Rs/gi, '').replace(/\s/g, '').replace(',', '.');
    // Allow digits, one decimal point, and optionally one comma (for European format)
    return /^[\d]+(\.[\d]*)?$/.test(cleanPrice) || /^[\d]+,[\d]*$/.test(cleanPrice);
  };

  const getPriceValue = (priceText: string): number => {
    // Only remove "Rs" and spaces, keep decimal points and commas
    const cleanPrice = priceText.replace(/Rs/gi, '').replace(/\s/g, '').replace(',', '.');
    return parseFloat(cleanPrice) || 0;
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

  const getPriceColor = (priceLevel: PriceLevel) => {
    switch (priceLevel) {
      case PriceLevel.LOWEST:
        return '#10b981'; // Green
      case PriceLevel.MIDDLE:
        return '#f59e0b'; // Yellow/Orange
      case PriceLevel.HIGHEST:
        return '#ef4444'; // Red
      default:
        return colors.primary; // Default blue
    }
  };

  const renderProductCard = ({ item, groupIndex, itemIndex, priceLevel }: { 
    item: Product | Promotion; 
    groupIndex: number; 
    itemIndex: number;
    priceLevel: PriceLevel;
  }) => {
    const isPromotion = 'isPromotion' in item;
    
    if (isPromotion) {
      const promotion = item as Promotion;
      return (
        <TouchableOpacity 
          style={[styles.productCard, { width: cardWidth, backgroundColor: colorScheme === 'dark' ? '#FCA5A5' : '#fce7e7' }]}
          onPress={() => showProductDetails(promotion as any)}
        >
          <View style={styles.promotionCardContent}>
            
            <View style={styles.promotionTextContainer}>
              <Text style={[styles.promotionProductName, { color: colors.text }]} numberOfLines={3}>
                {promotion.product_name || 'Unknown Product'}
              </Text>
              
              <View style={styles.promotionPriceContainer}>
                {promotion.previous_price && (
                  <Text style={[styles.promotionPreviousPrice, { color: colors.error }]}>
                    Rs {formatPrice(promotion.previous_price)}
                  </Text>
                )}
                
                <Text style={[styles.promotionNewPrice, { color: colors.success }]}>
                  Rs {formatPrice(promotion.new_price)}
                </Text>
              </View>
              
              <View style={[styles.promotionStoreContainer, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.promotionStore, { color: colors.primary }]}>
                  {promotion.store_name}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    const product = item as Product;
    return (
      <TouchableOpacity 
        style={[styles.productCard, { width: cardWidth, backgroundColor: colors.card }]}
        onPress={() => showProductDetails(product)}
      >
        <View style={styles.cardImageContainer}>
          <ProductImage productId={product.id} size={115} colors={colors}/>
        </View>
        
        <View style={styles.cardContent}>
          <View style={[styles.priceContainer, { backgroundColor: getPriceColor(priceLevel) }]}>
            <Text style={styles.priceText}>Rs {formatPrice(product.price)}</Text>
          </View>
          
          <Text style={[styles.storeText, { color: colors.text }]} numberOfLines={1}>
            {product.store}
          </Text>
          
          <Text style={[styles.sizeText, { color: colors.text }]} numberOfLines={1}>
            {product.size || 'N/A'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderProductGroup = (group: ProductGroup, groupIndex: number) => {
    const isLastGroup = groupIndex === productGroups.length - 1;
    const productCount = group.products.length;
    
    // Calculate centering based on number of products
    const getRowStyle = () => {
      if (productCount === 1) {
        return [styles.productRow, styles.productRowCenter];
      } else if (productCount === 2) {
        return [styles.productRow, styles.productRowCenter];
      }
      return styles.productRow;
    };

    const getCardWrapperStyle = (productCount: number) => {
      if (productCount === 1) {
        return [styles.productCardWrapper, styles.singleProductWrapper];
      } else if (productCount === 2) {
        return [styles.productCardWrapper, styles.twoProductWrapper];
      }
      return styles.productCardWrapper;
    };
    
    return (
      <View key={group.id} style={styles.productGroupContainer}>
        <View style={getRowStyle()}>
          {group.products.map((item, slotIndex) => {
            const priceLevel = groupingService.getPriceLevel(group, slotIndex);
            
            return (
              <View key={`${item.id}-${groupIndex}-${slotIndex}`} style={getCardWrapperStyle(productCount)}>
                {renderProductCard({ 
                  item, 
                  groupIndex, 
                  itemIndex: slotIndex, 
                  priceLevel 
                })}
              </View>
            );
          })}
        </View>
        
        {!isLastGroup && (
          <View style={[styles.groupSeparator, { backgroundColor: colors.border }]} />
        )}
      </View>
    );
  };

  return (
    <LinearGradient
      colors={colorScheme === 'dark' ? ['#0F172A', '#1E293B', '#334155'] : ['#f8f8f8', '#f4f4f4', '#f6f6f6']}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.kipriLogo, { color: colors.primary }]}>Kipri</Text>
          <Text style={[styles.headerSubtitle, { color: colors.text }]}>Prices</Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: '#3B82F6' }]}
          onPress={handleRefreshData}
          disabled={isRefreshing}
          activeOpacity={0.7}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.refreshButtonText}>Refresh</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Categories Section */}
      <View style={styles.categoriesSection}>
        <Text style={[styles.categoriesTitle, { color: colors.text }]}>Categories</Text>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContent}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.name}
              style={[
                styles.categoryButton,
                {
                  backgroundColor: selectedCategory === category.name 
                    ? colors.primary 
                    : colorScheme === 'dark' ? '#475569' : '#e9e4e4',
                  borderColor: selectedCategory === category.name ? colors.primary : 'transparent',
                }
              ]}
              onPress={() => selectCategory(category.name)}
            >
              <Text style={styles.categoryEmoji}>{category.emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Status Message */}
        <View style={[styles.statusContainer, { backgroundColor: colors.primary + '30', borderColor: colors.primary + '30' }]}>
          <Text style={[styles.statusText, { color: colors.text }]}>
            {selectedCategory ? `Category: ${selectedCategory}` : 'Showing all products'}
          </Text>
          <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.countText}>{filteredItems.length} items</Text>
          </View>
        </View>
      </View>

      {/* Products Grid */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingBrand, { color: colors.primary }]}>Kipri</Text>
          <ActivityIndicator size="large" color={colors.primary} style={styles.loadingSpinner} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Finding the best prices...</Text>
        </View>
      ) : productGroups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyBrand, { color: colors.primary }]}>Kipri</Text>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Text style={styles.emptyIcon}>No items</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No products found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.text }]}>
            {selectedCategory ? 'Try selecting a different category' : 'Pull down to refresh and check for new deals'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.productGrid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.productGridContent,
            { paddingBottom: Platform.OS === 'ios' ? 100 : 20 }
          ]}
        >
          {productGroups.map((group, index) => renderProductGroup(group, index))}
        </ScrollView>
      )}

      {/* Product Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          console.log('Modal close requested');
          setModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} style={styles.modalBlur}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Product Details</Text>
                <TouchableOpacity
                  style={[styles.closeButton, { backgroundColor: colors.background }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[styles.closeButtonText, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {selectedProduct && (
                <ScrollView style={styles.modalBody}>
                  {!('isPromotion' in selectedProduct) && (
                    <View style={styles.modalImageContainer}>
                      <ProductImage productId={selectedProduct.id} size={200} colors={colors} />
                    </View>
                  )}
                  
                  <Text style={[styles.productNameModal, { color: colors.text }]}>
                    {'product' in selectedProduct ? selectedProduct.product : selectedProduct.product_name || 'Unknown Product'}
                  </Text>
                  
                  <View style={[styles.priceContainerModal, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.priceTextModal, { color: colors.primary }]}>
                      Rs {formatPrice('price' in selectedProduct ? selectedProduct.price : selectedProduct.new_price)}
                    </Text>
                  </View>

                  <View style={styles.detailsGrid}>
                    <DetailRow 
                      icon="🏪" 
                      label="Store" 
                      value={'store' in selectedProduct ? selectedProduct.store : selectedProduct.store_name} 
                      colors={colors} 
                    />
                    {!('isPromotion' in selectedProduct) && (
                      <DetailRow icon="📦" label="Size" value={selectedProduct.size || 'N/A'} colors={colors} />
                    )}
                    <DetailRow icon="🏷️" label="Category" value={selectedProduct.category || 'N/A'} colors={colors} />
                    <DetailRow 
                      icon="⏰" 
                      label="Added" 
                      value={'created_at' in selectedProduct ? formatDate(selectedProduct.created_at) : formatDate(selectedProduct.timestamp)} 
                      colors={colors} 
                    />
                    {'isPromotion' in selectedProduct && selectedProduct.previous_price && (
                      <DetailRow 
                        icon="💰" 
                        label="Previous Price" 
                        value={`Rs ${formatPrice(selectedProduct.previous_price)}`} 
                        colors={colors} 
                      />
                    )}
                  </View>

                  {/* Update Price Section - Only for regular products, not promotions */}
                  {!('isPromotion' in selectedProduct) && (
                    <>
                      {!showUpdatePrice ? (
                        <TouchableOpacity
                          style={[styles.updatePriceButton, { backgroundColor: colors.primary }]}
                          onPress={handleUpdatePrice}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.updatePriceIconContainer, { backgroundColor: colors.background }]}>
                            <Text style={styles.updatePriceIcon}>💰</Text>
                          </View>
                          <View style={styles.updatePriceTextContainer}>
                            <Text style={styles.updatePriceTitle}>Wrong price? Click here</Text>
                            <Text style={styles.updatePriceSubtitle}>Update to the correct price</Text>
                          </View>
                          <Text style={styles.updatePriceArrow}>→</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.updatePriceForm, { backgroundColor: colors.background }]}>
                          <Text style={[styles.updatePriceFormTitle, { color: colors.text }]}>Fix Price</Text>
                          
                          <View style={[styles.currentPriceDisplay, { backgroundColor: colors.card }]}>
                            <Text style={[styles.currentPriceLabel, { color: colors.text }]}>Current Price</Text>
                            <Text style={[styles.currentPriceValue, { color: colors.primary }]}>
                              Rs {formatPrice(selectedProduct.price)}
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
                    </>
                  )}
                </ScrollView>
              )}
            </View>
          </BlurView>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const ProductImage: React.FC<{ productId: string; size?: number; colors: any }> = ({ productId, size = 100, colors }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const cacheService = DataCacheService.getInstance();

  const loadImage = React.useCallback(async () => {
    try {
      // Always force refresh images to avoid cache issues
      const url = await cacheService.getSignedImageUrl(productId, true);
      setImageUrl(url);
    } catch (error) {
      console.error('Error loading image:', error);
    } finally {
      setLoading(false);
    }
  }, [cacheService, productId]);

  useEffect(() => {
    loadImage();
  }, [loadImage]);

  if (loading) {
    return (
      <View style={[styles.imagePlaceholder, { width: size, height: size, backgroundColor: colors.background }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!imageUrl) {
    return (
      <View style={[styles.imagePlaceholder, { width: size, height: size, backgroundColor: colors.background }]}>
        <Text style={styles.placeholderIcon}>📷</Text>
        <Text style={[styles.placeholderText, { color: colors.text }]}>No image</Text>
      </View>
    );
  }

  return (
    <Image
      key={imageUrl} // Force re-render when URL changes
      source={{ uri: imageUrl }}
      style={[styles.productImage, { width: size, height: size * 0.8 }]}
      contentFit="cover"
    />
  );
};

const DetailRow: React.FC<{
  icon: string;
  label: string;
  value: string;
  colors: any;
}> = ({ icon, label, value, colors }) => (
  <View style={[styles.detailRow, { backgroundColor: colors.background }]}>
    <View style={[styles.detailIconContainer, { backgroundColor: colors.primary + '20' }]}>
      <Text style={styles.detailRowIcon}>{icon}</Text>
    </View>
    <View style={styles.detailRowContent}>
      <Text style={[styles.detailRowLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.detailRowValue, { color: colors.text }]}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  kipriLogo: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.7,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  categoriesSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  categoriesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  categoriesScroll: {
    maxHeight: 76,
    paddingVertical: 4,
  },
  categoriesContent: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  categoryButton: {
    width: 60,
    height: 60,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderWidth: Platform.OS === 'android' ? 0 : 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: Platform.OS === 'android' ? 0 : 3,
    ...(Platform.OS === 'android' && {
      needsOffscreenAlphaCompositing: false,
      overflow: 'visible',
    }),
    marginVertical: 2,
  },
  categoryEmoji: {
    fontSize: 24,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: Platform.OS === 'android' ? 0 : 1,
    borderColor: 'transparent',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: Platform.OS === 'android' ? 0 : 2,
    ...(Platform.OS === 'android' && {
      needsOffscreenAlphaCompositing: false,
      overflow: 'visible',
    }),
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  countText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBrand: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  loadingSpinner: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBrand: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 20,
    opacity: 0.3,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyIcon: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  productGrid: {
    flex: 1,
    paddingLeft: 1,
    paddingRight: 20,
    paddingTop: 2,
    paddingBottom: 20,
  },
  productGridContent: {
    paddingBottom: 20,
  },
  productGroupContainer: {
    marginBottom: 8,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },
  productRowCenter: {
    justifyContent: 'center',
  },
  productRowSpaceEvenly: {
    justifyContent: 'space-evenly',
  },
  productCardWrapper: {
    flex: 1,
    maxWidth: cardWidth,
  },
  singleProductWrapper: {
    flex: 0,
    width: cardWidth,
    marginHorizontal: 0,
  },
  twoProductWrapper: {
    flex: 0,
    width: cardWidth,
    marginHorizontal: 6,
  },
  groupSeparator: {
    height: 2,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    opacity: 0.6,
  },
  productCard: {
    height: 150,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
    marginVertical: 4,
  },
  cardImageContainer: {
    flex: 2.3,
    position: 'relative',
    overflow: 'hidden',
  },
  productImage: {
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  placeholderText: {
    fontSize: 8,
  },
  promotionCardContent: {
    flex: 1,
    position: 'relative',
    padding: 8,
  },
  promotionTextContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  promotionProductName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 8,
  },
  promotionPriceContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  promotionPreviousPrice: {
    fontSize: 10,
    textAlign: 'center',
    textDecorationLine: 'line-through',
    marginBottom: 2,
    opacity: 0.8,
  },
  promotionNewPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  promotionStoreContainer: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 1,
  },
  promotionStore: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardContent: {
    flex: 1,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceContainer: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  priceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  storeText: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 1,
  },
  sizeText: {
    fontSize: 9,
    opacity: 0.7,
    textAlign: 'center',
  },
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
    width: '90%',
    maxHeight: '80%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: Platform.OS === 'android' ? 0 : 10,
    borderWidth: 0,
    borderColor: 'transparent',
    ...(Platform.OS === 'android' && {
      needsOffscreenAlphaCompositing: false,
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
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
  },
  modalBody: {
    padding: 16,
  },
  modalImageContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  productNameModal: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  priceContainerModal: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: Platform.OS === 'android' ? 0 : 3,
    borderWidth: 0,
    borderColor: 'transparent',
    ...(Platform.OS === 'android' && {
      needsOffscreenAlphaCompositing: false,
      overflow: 'visible',
    }),
  },
  priceTextModal: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  detailsGrid: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: Platform.OS === 'android' ? 0 : 1,
    borderWidth: 0,
    borderColor: 'transparent',
    ...(Platform.OS === 'android' && {
      needsOffscreenAlphaCompositing: false,
      overflow: 'visible',
    }),
  },
  detailIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  detailRowIcon: {
    fontSize: 16,
  },
  detailRowContent: {
    flex: 1,
  },
  detailRowLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  detailRowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  updatePriceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  updatePriceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  updatePriceIcon: {
    fontSize: 20,
  },
  updatePriceTextContainer: {
    flex: 1,
  },
  updatePriceTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  updatePriceSubtitle: {
    color: 'white',
    fontSize: 12,
    opacity: 0.9,
  },
  updatePriceArrow: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
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
  updatePriceFormTitle: {
    fontSize: 18,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  newPriceInput: {
    borderWidth: Platform.OS === 'android' ? 0 : 1,
    borderColor: 'transparent',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    ...(Platform.OS === 'android' && {
      needsOffscreenAlphaCompositing: false,
      overflow: 'visible',
    }),
    shadowRadius: 2,
    elevation: 1,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cancelUpdateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitUpdateButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  submitUpdateText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PricesScreen;
