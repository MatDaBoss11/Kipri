import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
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
import { CombinedProduct } from '../../services/ProductGroupingService';
import CombinedProductCard from '../../components/CombinedProductCard';
import ProductComparisonModal from '../../components/ProductComparisonModal';
import { useAppData } from '../../contexts/AppDataContext';

const { width } = Dimensions.get('window');

const PricesScreen = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Use preloaded data from AppDataContext
  const {
    combinedProducts: allCombinedProducts,
    imageUrls: preloadedImageUrls,
    promotions,
    isLoading,
    refresh
  } = useAppData();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCombinedProduct, setSelectedCombinedProduct] = useState<CombinedProduct | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter combined products by category and search text
  const combinedProducts = useMemo(() => {
    let filtered = allCombinedProducts;

    // Filter by category - check if selected category is in the categories array
    if (selectedCategory) {
      filtered = filtered.filter(cp =>
        cp.products.some(p => {
          // Handle new categories array format
          const itemCategories = 'categories' in p ? p.categories : undefined;
          if (itemCategories && Array.isArray(itemCategories)) {
            return itemCategories.some(cat =>
              cat?.toLowerCase() === selectedCategory.toLowerCase()
            );
          }
          return false;
        })
      );
    }

    return filtered;
  }, [allCombinedProducts, selectedCategory]);

  // Generate status message based on filters
  const statusMessage = useMemo(() => {
    if (selectedCategory) {
      return `Category: ${selectedCategory}`;
    }
    return 'Showing all products';
  }, [selectedCategory]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshData = async () => {
    try {
      setIsRefreshing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await refresh();

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error refreshing data:', error);
      Alert.alert('Error', 'Failed to refresh data. Please check your connection.');
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
    refresh();
  };

  const renderCombinedProductCard = ({ item }: { item: CombinedProduct }) => {
    // Use preloaded image URLs from context
    const imageUrl = preloadedImageUrls[item.primaryImageProductId] || null;

    return (
      <CombinedProductCard
        combinedProduct={item}
        onPress={() => showProductDetails(item)}
        colors={colors}
        colorScheme={colorScheme}
        imageUrl={imageUrl}
        imageLoading={false}
        promotions={promotions}
      />
    );
  };

  return (
    <LinearGradient
      colors={colorScheme === 'dark' ? ['#0F172A', '#1E293B', '#334155'] : ['#f5f5f5', '#f2f2f2', '#f3f3f3']}
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
            {statusMessage}
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
            {selectedCategory
              ? 'Try selecting a different category'
              : 'Pull down to refresh and check for new deals'}
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
    flex: 1,
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
