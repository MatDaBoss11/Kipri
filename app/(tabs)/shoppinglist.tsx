import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSavedItems } from '../../contexts/SavedItemsContext';
import SavedItemCard from '../../components/SavedItemCard';
import ShoppingListFilters, { PriceRange } from '../../components/ShoppingListFilters';
import { SavedItem } from '../../types';

const ShoppingListScreen = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const { savedItems, isLoading, clearAll } = useSavedItems();

  // Filter states
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<PriceRange>(null);

  // Normalize store name for comparison
  const normalizeStoreName = (storeName: string): string => {
    const lower = storeName.toLowerCase().trim();
    if (lower.includes('winner')) return 'Winners';
    if (lower.includes('king') || lower.includes('saver')) return 'Kingsavers';
    if (lower.includes('super') || lower.includes('u')) return 'Super U';
    return storeName;
  };

  // Apply filters to saved items
  const filteredItems = useMemo(() => {
    return savedItems.filter((item) => {
      // Store filter
      if (selectedStores.length > 0) {
        const normalizedStore = normalizeStoreName(item.store);
        if (!selectedStores.includes(normalizedStore)) {
          return false;
        }
      }

      // Category filter - check if any selected category is in the item's categories array
      if (selectedCategories.length > 0) {
        if (!item.categories || item.categories.length === 0) {
          return false;
        }
        const itemCategoriesLower = item.categories.map(c => c.toLowerCase());
        const hasMatchingCategory = selectedCategories.some(selected =>
          itemCategoriesLower.includes(selected.toLowerCase())
        );
        if (!hasMatchingCategory) {
          return false;
        }
      }

      // Price range filter
      if (priceRange) {
        switch (priceRange) {
          case 'under50':
            if (item.price >= 50) return false;
            break;
          case '50to100':
            if (item.price < 50 || item.price >= 100) return false;
            break;
          case '100to200':
            if (item.price < 100 || item.price >= 200) return false;
            break;
          case 'over200':
            if (item.price < 200) return false;
            break;
        }
      }

      return true;
    });
  }, [savedItems, selectedStores, selectedCategories, priceRange]);

  // Calculate total for filtered items
  const filteredTotal = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.price, 0);
  }, [filteredItems]);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear Shopping List',
      'Are you sure you want to remove all items from your shopping list?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              await clearAll();
            } catch (error) {
              console.error('Error clearing shopping list:', error);
              Alert.alert('Error', 'Failed to clear shopping list. Please try again.');
            }
          },
        },
      ]
    );
  }, [clearAll]);

  const renderItem = useCallback(
    ({ item }: { item: SavedItem }) => (
      <SavedItemCard
        item={item}
        colors={colors}
        colorScheme={colorScheme}
      />
    ),
    [colors, colorScheme]
  );

  const keyExtractor = useCallback((item: SavedItem) => item.id, []);

  const ListEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyBrand, { color: colors.primary }]}>Kipri</Text>
        <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + '20' }]}>
          <Text style={styles.emptyIcon}>No items</Text>
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {savedItems.length === 0
            ? 'Your shopping list is empty'
            : 'No items match your filters'}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.text }]}>
          {savedItems.length === 0
            ? 'Save items from the Prices tab to build your list'
            : 'Try adjusting your filter selections'}
        </Text>
      </View>
    ),
    [colors, savedItems.length]
  );

  const ListFooterComponent = useCallback(
    () =>
      filteredItems.length > 0 ? (
        <View style={[styles.footerContainer, { backgroundColor: colors.card }]}>
          <View style={Platform.OS === 'ios' ? styles.footerContentIOS : styles.footerContent}>
            <Text style={[styles.footerLabel, { color: colors.text }]}>
              Estimated Total ({filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}):
            </Text>
            <Text style={[styles.footerTotal, { color: '#10B981' }]}>
              Rs {filteredTotal.toFixed(2)}
            </Text>
          </View>
        </View>
      ) : null,
    [filteredItems.length, filteredTotal, colors]
  );

  return (
    <LinearGradient
      colors={colorScheme === 'dark' ? ['#0F172A', '#1E293B', '#334155'] : ['#f5f5f5', '#f2f2f2', '#f3f3f3']}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.kipriLogo, { color: colors.primary }]}>Kipri</Text>
          <Text style={[styles.headerSubtitle, { color: colors.text }]}>Shopping List</Text>
        </View>
        {savedItems.length > 0 && (
          <TouchableOpacity
            style={[styles.clearButton, { backgroundColor: '#ef4444' }]}
            onPress={handleClearAll}
            activeOpacity={0.7}
          >
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <ShoppingListFilters
        selectedStores={selectedStores}
        setSelectedStores={setSelectedStores}
        selectedCategories={selectedCategories}
        setSelectedCategories={setSelectedCategories}
        priceRange={priceRange}
        setPriceRange={setPriceRange}
        colors={colors}
        colorScheme={colorScheme}
      />

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingBrand, { color: colors.primary }]}>Kipri</Text>
          <ActivityIndicator size="large" color={colors.primary} style={styles.loadingSpinner} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading your list...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={ListEmptyComponent}
          ListFooterComponent={ListFooterComponent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === 'ios' ? 180 : 120 },
          ]}
        />
      )}
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
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
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
  listContent: {
    paddingTop: 8,
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
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  footerContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerContentIOS: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  footerTotal: {
    fontSize: 24,
    fontWeight: '800',
  },
});

export default ShoppingListScreen;
