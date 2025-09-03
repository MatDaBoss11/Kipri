import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlatGrid } from 'react-native-super-grid';
import { CATEGORIES, BACKEND_URL } from '../../constants/categories';
import DataCacheService from '../../services/DataCacheService';
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | Promotion | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showUpdatePrice, setShowUpdatePrice] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);

  const cacheService = DataCacheService.getInstance();

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
  }, [products, promotions, selectedCategory]);

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
      const response = await fetch(`${BACKEND_URL}/update-product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_name: selectedProduct.product,
          size: selectedProduct.size,
          price: newPrice.trim(),
          store: selectedProduct.store,
          categories: [selectedProduct.category],
        }),
      });

      if (response.ok) {
        await cacheService.invalidateProducts();
        Alert.alert('Success', 'Product price updated successfully!');
        setModalVisible(false);
        setShowUpdatePrice(false);
        setNewPrice('');
        // Refresh the products list
        fetchData();
      } else {
        const errorText = await response.text();
        handleUpdateError(response.status, errorText);
      }
    } catch (error) {
      console.error('Network error in update price:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  const handleUpdateError = (statusCode: number, responseBody: string) => {
    const errorBody = responseBody.toLowerCase();
    
    switch (statusCode) {
      case 400:
        if (errorBody.includes('not found')) {
          Alert.alert('Error', 'Product not found. Please try again.');
        } else {
          Alert.alert('Error', 'Invalid product data. Please check the price and try again.');
        }
        break;
      case 404:
        Alert.alert('Error', 'Product not found in the database.');
        break;
      default:
        Alert.alert('Error', `Server error (${statusCode}). Please try again later.`);
        break;
    }
  };

  const isValidPrice = (priceText: string): boolean => {
    if (!priceText) return false;
    const cleanPrice = priceText.replace(/[Rs\.\s]/gi, '');
    return /^[\d,]*$/.test(cleanPrice) && !cleanPrice.endsWith(',');
  };

  const getPriceValue = (priceText: string): number => {
    const cleanPrice = priceText.replace(/[Rs\.\s]/gi, '').replace(',', '.');
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

  const renderProductCard = ({ item, index }: { item: Product | Promotion; index: number }) => {
    const isPromotion = 'isPromotion' in item;
    
    if (isPromotion) {
      const promotion = item as Promotion;
      return (
        <TouchableOpacity 
          style={[styles.productCard, { width: cardWidth, backgroundColor: '#fce7e7' }]}
          onPress={() => showProductDetails(promotion as any)}
        >
          <View style={styles.promotionCardContent}>
            
            <View style={styles.promotionTextContainer}>
              <Text style={[styles.promotionProductName, { color: colors.text }]} numberOfLines={3}>
                {promotion.product_name || 'Unknown Product'}
              </Text>
              
              <View style={styles.promotionPriceContainer}>
                {promotion.previous_price && (
                  <Text style={styles.promotionPreviousPrice}>
                    Rs {formatPrice(promotion.previous_price)}
                  </Text>
                )}
                
                <Text style={styles.promotionNewPrice}>
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
        style={[styles.productCard, { width: cardWidth, backgroundColor: '#ffffff' }]}
        onPress={() => showProductDetails(product)}
      >
        <View style={styles.cardImageContainer}>
          <ProductImage productId={product.id} size={115}/>
        </View>
        
        <View style={styles.cardContent}>
          <View style={[styles.priceContainer, { backgroundColor: colors.primary }]}>
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

  return (
    <LinearGradient
      colors={['#f8f8f8', '#f4f4f4', '#f6f6f6']}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Kipri</Text>
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
                  backgroundColor: selectedCategory === category.name ? '#6b7280' : '#e9e4e4',
                  borderColor: selectedCategory === category.name ? '#6b7280' : 'transparent',
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
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading prices...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Text style={styles.emptyIcon}>🛍️</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No products found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.text }]}>
            Check back later for product updates
          </Text>
        </View>
      ) : (
        <FlatGrid
          itemDimension={cardWidth}
          data={filteredItems}
          style={styles.productGrid}
          spacing={12}
          renderItem={renderProductCard}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        />
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
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {selectedProduct && (
                <ScrollView style={styles.modalBody}>
                  <Text style={{ color: 'red', fontSize: 18 }}>DEBUG: Modal is working!</Text>
                  {!('isPromotion' in selectedProduct) && (
                    <View style={styles.modalImageContainer}>
                      <ProductImage productId={selectedProduct.id} size={200} />
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
                            <Text style={styles.updatePriceTitle}>Update Product Price</Text>
                            <Text style={styles.updatePriceSubtitle}>Enter a new price for this product</Text>
                          </View>
                          <Text style={styles.updatePriceArrow}>→</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.updatePriceForm, { backgroundColor: colors.background }]}>
                          <Text style={[styles.updatePriceFormTitle, { color: colors.text }]}>Update Price</Text>
                          
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
                                <Text style={styles.submitUpdateText}>Update Price</Text>
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

const ProductImage: React.FC<{ productId: string; size?: number }> = ({ productId, size = 100 }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const cacheService = DataCacheService.getInstance();

  const loadImage = React.useCallback(async () => {
    try {
      const url = await cacheService.getSignedImageUrl(productId);
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
      <View style={[styles.imagePlaceholder, { width: size, height: size }]}>
        <ActivityIndicator size="small" color="#6366F1" />
      </View>
    );
  }

  if (!imageUrl) {
    return (
      <View style={[styles.imagePlaceholder, { width: size, height: size }]}>
        <Text style={styles.placeholderIcon}>📷</Text>
        <Text style={styles.placeholderText}>No image</Text>
      </View>
    );
  }

  return (
    <Image
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
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
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 3,
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
    borderWidth: 1,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366F120',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    opacity: 0.6,
  },
  productGrid: {
    flex: 1,
    paddingLeft: 1,
    paddingRight: 20,
    paddingTop: 2,
    paddingBottom: 20,
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
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  placeholderText: {
    fontSize: 8,
    color: '#6b7280',
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
    color: '#ef4444',
    textAlign: 'center',
    textDecorationLine: 'line-through',
    marginBottom: 2,
    opacity: 0.8,
  },
  promotionNewPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
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
    elevation: 10,
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
    color: '#6b7280',
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
    elevation: 3,
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
    elevation: 1,
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
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
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