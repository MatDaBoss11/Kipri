import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { FlatGrid } from 'react-native-super-grid';
import { Image } from 'expo-image';
import DataCacheService from '../../services/DataCacheService';
import { Product, Promotion } from '../../types';
import { CATEGORIES } from '../../constants/categories';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

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
    if (selectedCategory === categoryName) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(categoryName);
    }
  };

  const showProductDetails = (product: Product | Promotion) => {
    setSelectedProduct(product);
    setModalVisible(true);
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
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#f3f1f5' }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary + '20', colors.background + '10']}
        style={styles.header}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>Kipri</Text>
      </LinearGradient>

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
          spacing={8}
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
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} style={styles.modalBlur}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Product Details</Text>
                <TouchableOpacity
                  style={[styles.closeButton, { backgroundColor: colors.background }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {selectedProduct && (
                <ScrollView style={styles.modalBody}>
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
                </ScrollView>
              )}
            </View>
          </BlurView>
        </View>
      </Modal>
    </View>
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
      style={[styles.productImage, { width: size, height: size }]}
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
    paddingVertical: 16,
  },
  categoriesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  categoriesScroll: {
    maxHeight: 70,
  },
  categoriesContent: {
    paddingHorizontal: 8,
  },
  categoryButton: {
    width: 60,
    height: 60,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderWidth: 1.5,
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
    marginTop: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
    paddingLeft: 4,
    paddingRight: 16,
  },
  productCard: {
    height: 150,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  cardImageContainer: {
    flex: 3,
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
  },
  promotionStore: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardContent: {
    flex: 2,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceContainer: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 2,
  },
  priceText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  storeText: {
    fontSize: 8,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 1,
  },
  sizeText: {
    fontSize: 7,
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
  },
  detailIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
});

export default PricesScreen;