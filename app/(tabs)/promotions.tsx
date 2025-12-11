import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STORE_INFO } from '../../constants/categories';
import { filterPromotionsByMainList } from '../../constants/mainProductList';
import DataCacheService from '../../services/DataCacheService';
import { Promotion } from '../../types';


const PromotionsScreen = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Helper function to convert hex to rgba
  const hexToRgba = (hex: string, opacity: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [filteredPromotions, setFilteredPromotions] = useState<Promotion[]>([]);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showStoreSelection, setShowStoreSelection] = useState(true);

  const cacheService = DataCacheService.getInstance();

  const startAnimations = React.useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const fetchPromotions = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const allPromotions = await cacheService.getPromotions();

      let filtered: Promotion[];

      if (selectedStore === 'Tous Les Produits') {
        // For "All Products" view, filter to only show products from the main product list
        // This filtering happens AFTER receiving data from the database
        filtered = filterPromotionsByMainList(allPromotions);
        console.log(`Filtered promotions: ${filtered.length} out of ${allPromotions.length} match main product list`);
      } else {
        // For specific store view, also filter by main product list
        const storeFiltered = allPromotions.filter(item => item.store_name === selectedStore);
        filtered = filterPromotionsByMainList(storeFiltered);
        console.log(`Store "${selectedStore}": ${filtered.length} out of ${storeFiltered.length} match main product list`);
      }

      setPromotions(filtered);

      // Extract categories (normalize case)
      const categorySet = new Set(['All']);
      filtered.forEach(item => {
        if (item.category) {
          // Capitalize first letter and lowercase the rest for consistent display
          const normalizedCategory = item.category.charAt(0).toUpperCase() + item.category.slice(1).toLowerCase();
          categorySet.add(normalizedCategory);
        }
      });
      setCategories(Array.from(categorySet));

    } catch (error) {
      console.error('Error fetching promotions:', error);
      Alert.alert('Error', 'Failed to load promotions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [cacheService, selectedStore]);

  const filterPromotions = React.useCallback(() => {
    if (selectedCategory === 'All') {
      setFilteredPromotions(promotions);
    } else {
      setFilteredPromotions(promotions.filter(item => item.category?.toLowerCase() === selectedCategory.toLowerCase()));
    }
  }, [promotions, selectedCategory]);

  useEffect(() => {
    loadSavedStore();
    startAnimations();
  }, [startAnimations]);

  useEffect(() => {
    if (selectedStore && !showStoreSelection) {
      fetchPromotions();
    }
  }, [selectedStore, showStoreSelection, fetchPromotions]);

  useEffect(() => {
    filterPromotions();
  }, [filterPromotions]);

  const loadSavedStore = async () => {
    try {
      const savedStore = await AsyncStorage.getItem('selected_store');
      const isOnMainMenu = await AsyncStorage.getItem('is_on_main_menu');
      
      if (isOnMainMenu === 'true') {
        setShowStoreSelection(true);
        setSelectedStore(null);
      } else if (savedStore) {
        setSelectedStore(savedStore);
        setShowStoreSelection(false);
      }
    } catch (error) {
      console.error('Error loading saved store:', error);
    }
  };

  const saveSelectedStore = async (store: string) => {
    try {
      await AsyncStorage.setItem('selected_store', store);
      await AsyncStorage.setItem('is_on_main_menu', 'false');
    } catch (error) {
      console.error('Error saving selected store:', error);
    }
  };

  const saveMainMenuState = async () => {
    try {
      await AsyncStorage.setItem('is_on_main_menu', 'true');
    } catch (error) {
      console.error('Error saving main menu state:', error);
    }
  };

  const selectStore = async (store: string) => {
    setSelectedStore(store);
    setShowStoreSelection(false);
    setSelectedCategory('All');
    await saveSelectedStore(store);
  };

  const showStoreSelectionScreen = async () => {
    setShowStoreSelection(true);
    setSelectedStore(null);
    setPromotions([]);
    setIsLoading(false);
    await saveMainMenuState();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPromotions();
    setRefreshing(false);
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

  const calculateSavings = (item: Promotion): number => {
    if (!item.previous_price || !item.new_price) return 0;
    try {
      const previousPrice = typeof item.previous_price === 'number' 
        ? item.previous_price 
        : parseFloat(item.previous_price as string) || 0;
      const newPrice = typeof item.new_price === 'number' 
        ? item.new_price 
        : parseFloat(item.new_price as string) || 0;
      return previousPrice - newPrice;
    } catch {
      return 0;
    }
  };

  if (showStoreSelection) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Animated.View style={[
          styles.storeSelectionContainer,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}>
          <View style={styles.storeSelectionHeader}>
            <Text style={[styles.kipriLogoLarge, { color: colors.primary }]}>Kipri</Text>
            <Text style={[styles.storeSelectionTitle, { color: colors.text }]}>Deals</Text>
          </View>
          <Text style={[styles.storeSelectionSubtitle, { color: colors.text, opacity: 0.7 }]}>
            Choose your store to view latest promotions
          </Text>
          
          <View style={styles.storeButtonsContainer}>
            {STORE_INFO.map((store, index) => (
              <Animated.View
                key={store.name}
                style={[
                  styles.storeButtonWrapper,
                  { 
                    opacity: fadeAnim,
                    transform: [{ 
                      translateY: slideAnim.interpolate({
                        inputRange: [0, 30],
                        outputRange: [0, 50 + (index * 20)]
                      })
                    }]
                  }
                ]}
              >
                <Pressable
                  onPress={() => selectStore(store.name)}
                  android_ripple={null}
                >
                  <View style={[
                    styles.newStoreButton,
                    {
                      backgroundColor: hexToRgba(store.color, 0.12),
                      ...(Platform.OS === 'android' && {
                        borderWidth: 0,
                        borderColor: 'transparent',
                        needsOffscreenAlphaCompositing: false,
                        overflow: 'visible',
                        elevation: 0,
                      })
                    }
                  ]}>
                    <View style={[
                      styles.newStoreIconContainer,
                      { backgroundColor: hexToRgba(store.color, 0.18) }
                    ]}>
                      <Text style={styles.storeIcon}>{store.icon}</Text>
                    </View>
                    <Text style={[styles.storeButtonText, { color: store.color }]}>
                      {store.name}
                    </Text>
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <BlurView style={styles.header} tint={colorScheme || 'default'} intensity={80}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={showStoreSelectionScreen}
          >
            <Text style={styles.backButtonIcon}>{"<"}</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.kipriHeaderLogo, { color: colors.primary }]}>Kipri</Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {selectedStore === 'Tous Les Produits' ? 'Deals' : selectedStore}
            </Text>
          </View>
          <View style={styles.headerAccent}>
            <Text style={styles.fireIcon}>Deals</Text>
          </View>
        </View>
      </BlurView>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((category) => (
          <Pressable
            key={category}
            onPress={() => setSelectedCategory(category)}
            android_ripple={null}
          >
            <View style={[
              styles.newCategoryChip,
              {
                backgroundColor: selectedCategory === category ? '#6366F1' : colors.card,
                ...(Platform.OS === 'android' && {
                  borderWidth: 0,
                  borderColor: 'transparent',
                  needsOffscreenAlphaCompositing: false,
                  overflow: 'visible',
                  elevation: selectedCategory === category ? 0 : 0,
                })
              }
            ]}>
              <Text style={[
                styles.categoryChipText,
                {
                  color: selectedCategory === category ? '#ffffff' : colors.text,
                  fontWeight: selectedCategory === category ? '600' : '500'
                }
              ]}>
                {category}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Promotions List */}
      <ScrollView
        style={styles.promotionsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingBrand, { color: colors.primary }]}>Kipri</Text>
            <ActivityIndicator size="large" color="#6366F1" style={styles.loadingSpinner} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Finding the best deals...
            </Text>
          </View>
        ) : filteredPromotions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyBrand, { color: colors.primary }]}>Kipri</Text>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>No deals</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No promotions found
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.text, opacity: 0.6 }]}>
              {selectedCategory === 'All'
                ? 'Check back soon for new deals!'
                : `Try selecting a different category`}
            </Text>
          </View>
        ) : (
          filteredPromotions.map((item, index) => (
            <Animated.View
              key={`${item.id}-${index}`}
              style={[
                styles.promotionCard,
                {
                  backgroundColor: colors.card,
                  opacity: fadeAnim,
                  transform: [{ 
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 30],
                      outputRange: [0, 30 + (index * 10)]
                    })
                  }]
                }
              ]}
            >
              <View style={styles.promotionHeader}>
                <Text style={[styles.productName, { color: colors.text }]}>
                  {item.product_name || 'Unknown Product'}
                </Text>
                <LinearGradient
                  colors={['#ef4444', '#dc2626']}
                  style={styles.hotDealBadge}
                >
                  <Text style={styles.hotDealText}>🔥 HOT DEAL</Text>
                </LinearGradient>
              </View>

              <View style={styles.priceSection}>
                <View style={[styles.currentPriceContainer, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.currentPrice, { color: colors.primary }]}>
                    Rs {formatPrice(item.new_price)}
                  </Text>
                </View>
                
                {item.previous_price && (
                  <>
                    <View style={[styles.oldPriceContainer, { backgroundColor: colors.text + '10' }]}>
                      <Text style={[styles.oldPrice, { color: colors.text }]}>
                        Rs {formatPrice(item.previous_price)}
                      </Text>
                    </View>
                    {calculateSavings(item) > 0 && (
                      <View style={styles.savingsContainer}>
                        <Text style={styles.savingsText}>
                          Save Rs {calculateSavings(item).toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              <View style={[styles.detailsSection, { backgroundColor: colors.background }]}>
                <View style={styles.detailRow}>
                  <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={styles.detailIcon}>📦</Text>
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={[styles.detailLabel, { color: colors.text, opacity: 0.6 }]}>Size</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {item.size || 'N/A'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={styles.detailIcon}>🏪</Text>
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={[styles.detailLabel, { color: colors.text, opacity: 0.6 }]}>Store</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {item.store_name || 'N/A'}
                    </Text>
                  </View>
                </View>

                {item.category && (
                  <View style={styles.detailRow}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={styles.detailIcon}>🏷️</Text>
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={[styles.detailLabel, { color: colors.text, opacity: 0.6 }]}>Category</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {item.category}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  storeSelectionContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  storeSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  kipriLogoLarge: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  storeSelectionTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  storeSelectionSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 60,
  },
  storeButtonsContainer: {
    gap: 20,
  },
  storeButtonWrapper: {
    marginBottom: 20,
  },
  storeButton: {
    height: 80,
    borderRadius: 16,
    borderWidth: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  newStoreButton: {
    height: 80,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: Platform.OS === 'android' ? 0 : 4,
    borderWidth: 0,
    borderColor: 'transparent',
    ...(Platform.OS === 'android' && {
      needsOffscreenAlphaCompositing: false,
      renderToHardwareTextureAndroid: false,
    })
  },
  newStoreIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: Platform.OS === 'android' ? 0 : 2,
    overflow: 'hidden',
    ...(Platform.OS === 'android' && {
      borderWidth: 0,
      borderColor: 'transparent',
    })
  },
  storeButtonContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  storeIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: Platform.OS === 'android' ? 0 : 2,
    overflow: 'hidden',
    ...(Platform.OS === 'android' && {
      borderWidth: 0,
      borderColor: 'transparent',
    })
  },
  storeIcon: {
    fontSize: 24,
  },
  storeButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  backButtonIcon: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  kipriHeaderLogo: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.8,
  },
  headerAccent: {
    width: 40,
    alignItems: 'center',
  },
  fireIcon: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366F1',
    opacity: 0.6,
  },
  categoriesContainer: {
    maxHeight: 70,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  newCategoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: Platform.OS === 'android' ? 0 : 2,
    borderWidth: 0,
    borderColor: 'transparent',
    ...(Platform.OS === 'android' && {
      needsOffscreenAlphaCompositing: false,
      renderToHardwareTextureAndroid: false,
    })
  },
  categoryChipText: {
    fontSize: 14,
  },
  promotionsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
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
    paddingVertical: 100,
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
    backgroundColor: '#ef444420',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyIcon: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.5,
    color: '#ef4444',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  promotionCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  promotionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  hotDealBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  hotDealText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  currentPriceContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  currentPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  oldPriceContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  oldPrice: {
    fontSize: 14,
    textDecorationLine: 'line-through',
    textDecorationColor: '#ef4444',
  },
  savingsContainer: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  savingsText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsSection: {
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 1,
  },
  detailIcon: {
    fontSize: 16,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PromotionsScreen;