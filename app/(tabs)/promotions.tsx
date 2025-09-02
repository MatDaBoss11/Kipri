import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DataCacheService from '../../services/DataCacheService';
import { Promotion } from '../../types';
import { STORE_INFO } from '../../constants/categories';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';


const PromotionsScreen = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
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
      
      const filtered = selectedStore === 'Tous Les Produits' 
        ? allPromotions
        : allPromotions.filter(item => item.store_name === selectedStore);
      
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
          <Text style={[styles.storeSelectionTitle, { color: colors.text }]}>
            Choose Your Store
          </Text>
          <Text style={[styles.storeSelectionSubtitle, { color: colors.text, opacity: 0.7 }]}>
            Select a store to view their latest promotions
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
                <TouchableOpacity
                  style={[
                    styles.storeButton,
                    { 
                      backgroundColor: store.color + '20',
                      borderColor: store.color + '50',
                    }
                  ]}
                  onPress={() => selectStore(store.name)}
                  activeOpacity={0.8}
                >
                  <View style={styles.storeButtonContent}>
                    <View style={[
                      styles.storeIconContainer,
                      { backgroundColor: store.color + '30' }
                    ]}>
                      <Text style={styles.storeIcon}>{store.icon}</Text>
                    </View>
                    <Text style={[styles.storeButtonText, { color: store.color }]}>
                      {store.name}
                    </Text>
                  </View>
                </TouchableOpacity>
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
            <Text style={styles.backButtonIcon}>🏪</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {selectedStore === 'Tous Les Produits' ? 'Hot Deals & Offers' : `${selectedStore} Deals`}
          </Text>
          <View style={styles.headerAccent}>
            <Text style={styles.fireIcon}>🔥</Text>
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
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryChip,
              {
                backgroundColor: selectedCategory === category ? '#6366F1' : colors.card,
                borderColor: selectedCategory === category ? '#6366F1' : colors.border,
              }
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text style={[
              styles.categoryChipText,
              {
                color: selectedCategory === category ? '#ffffff' : colors.text,
                fontWeight: selectedCategory === category ? '600' : '500'
              }
            ]}>
              {category}
            </Text>
          </TouchableOpacity>
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
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Finding amazing deals...
            </Text>
          </View>
        ) : filteredPromotions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>🏷️</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No promotions found
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.text, opacity: 0.6 }]}>
              {selectedCategory === 'All' 
                ? 'Check back later for new deals'
                : `No deals in ${selectedCategory} category`}
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
  storeSelectionTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
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
    borderWidth: 1,
    overflow: 'hidden',
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
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
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
  },
  backButtonIcon: {
    fontSize: 20,
    color: 'white',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerAccent: {
    width: 40,
    alignItems: 'center',
  },
  fireIcon: {
    fontSize: 24,
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
    borderWidth: 1,
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
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
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
  },
  promotionCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  currentPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  oldPriceContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
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
  },
  savingsText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsSection: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb20',
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