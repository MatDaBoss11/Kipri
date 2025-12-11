import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES } from '../../constants/categories';
import DataCacheService from '../../services/DataCacheService';
import ProductGroupingService, { ProductGroup, CombinedProduct } from '../../services/ProductGroupingService';
import { Product, Promotion } from '../../types';
import CombinedProductCard from '../../components/CombinedProductCard';
import ProductComparisonModal from '../../components/ProductComparisonModal';

const { width } = Dimensions.get('window');

const PricesScreen = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [combinedProducts, setCombinedProducts] = useState<CombinedProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCombinedProduct, setSelectedCombinedProduct] = useState<CombinedProduct | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [imageUrls, setImageUrls] = useState<{ [key: string]: { url: string | null; loading: boolean } }>({});

  const cacheService = DataCacheService.getInstance();
  const groupingService = ProductGroupingService.getInstance();

  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true);

      // Check cached data first
      if (cacheService.isProductsCacheValid && cacheService.cachedProducts) {
        setProducts(cacheService.cachedProducts);
        setIsLoading(false);
        console.log('Displayed cached data immediately');
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

  const processProducts = React.useCallback(() => {
    // Filter products by category
    let filteredItems: (Product | Promotion)[] = [...products];

    if (selectedCategory) {
      filteredItems = filteredItems.filter(item => {
        const itemCategory = (item as Product).category || (item as Promotion).category;
        return itemCategory?.toLowerCase() === selectedCategory.toLowerCase();
      });
    }

    // Group the filtered items using the grouping service
    const groups = groupingService.groupProducts(filteredItems);

    // Convert groups to combined products
    const combined = groupingService.createCombinedProducts(groups);
    setCombinedProducts(combined);

    // Load images for each combined product
    loadImagesForProducts(combined);
  }, [products, selectedCategory, groupingService]);

  const loadImagesForProducts = async (combined: CombinedProduct[]) => {
    const newImageUrls: { [key: string]: { url: string | null; loading: boolean } } = {};

    // Initialize loading state
    combined.forEach(cp => {
      newImageUrls[cp.id] = { url: null, loading: true };
    });
    setImageUrls(newImageUrls);

    // Load images in parallel
    const imagePromises = combined.map(async (cp) => {
      try {
        const url = await cacheService.getSignedImageUrl(cp.primaryImageProductId, true);
        return { id: cp.id, url, loading: false };
      } catch (error) {
        console.error('Error loading image for', cp.id, error);
        return { id: cp.id, url: null, loading: false };
      }
    });

    const results = await Promise.all(imagePromises);

    const finalUrls: { [key: string]: { url: string | null; loading: boolean } } = {};
    results.forEach(result => {
      finalUrls[result.id] = { url: result.url, loading: result.loading };
    });
    setImageUrls(finalUrls);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    processProducts();
  }, [processProducts]);

  // Re-fetch data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (!cacheService.isProductsCacheValid) {
        console.log('Cache invalidated - re-fetching products on focus');
        fetchData();
      }
    }, [cacheService, fetchData])
  );

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

  const showProductDetails = (combinedProduct: CombinedProduct) => {
    console.log('showProductDetails called for:', combinedProduct.name);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedCombinedProduct(combinedProduct);
    setModalVisible(true);
  };

  const handlePriceUpdated = () => {
    // Refresh data after price update
    fetchData();
  };

  const renderCombinedProductCard = ({ item }: { item: CombinedProduct }) => {
    const imageData = imageUrls[item.id] || { url: null, loading: true };

    return (
      <CombinedProductCard
        combinedProduct={item}
        onPress={() => showProductDetails(item)}
        colors={colors}
        colorScheme={colorScheme}
        imageUrl={imageData.url}
        imageLoading={imageData.loading}
      />
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
            <Text style={styles.countText}>{combinedProducts.length} products</Text>
          </View>
        </View>
      </View>

      {/* Products List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingBrand, { color: colors.primary }]}>Kipri</Text>
          <ActivityIndicator size="large" color={colors.primary} style={styles.loadingSpinner} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Finding the best prices...</Text>
        </View>
      ) : combinedProducts.length === 0 ? (
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
        <FlatList
          data={combinedProducts}
          renderItem={renderCombinedProductCard}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.productListContent,
            { paddingBottom: Platform.OS === 'ios' ? 100 : 20 }
          ]}
        />
      )}

      {/* Product Comparison Modal */}
      <ProductComparisonModal
        visible={modalVisible}
        combinedProduct={selectedCombinedProduct}
        onClose={() => setModalVisible(false)}
        colors={colors}
        colorScheme={colorScheme}
        promotions={promotions}
        onPriceUpdated={handlePriceUpdated}
      />
    </LinearGradient>
  );
};

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
  productListContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
});

export default PricesScreen;
