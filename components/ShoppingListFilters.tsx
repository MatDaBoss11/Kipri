import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ColorSchemeName,
} from 'react-native';
import { CATEGORIES } from '../constants/categories';

export type PriceRange = 'under50' | '50to100' | '100to200' | 'over200' | null;

interface ShoppingListFiltersProps {
  selectedStores: string[];
  setSelectedStores: (stores: string[]) => void;
  selectedCategories: string[];
  setSelectedCategories: (categories: string[]) => void;
  priceRange: PriceRange;
  setPriceRange: (range: PriceRange) => void;
  colors: any;
  colorScheme: ColorSchemeName;
}

const STORES = [
  { name: 'Winners', color: '#FF9800' },
  { name: 'Super U', color: '#2196F3' },
  { name: 'Kingsavers', color: '#9C27B0' },
];

const PRICE_RANGES: { key: PriceRange; label: string }[] = [
  { key: 'under50', label: 'Under Rs 50' },
  { key: '50to100', label: 'Rs 50-100' },
  { key: '100to200', label: 'Rs 100-200' },
  { key: 'over200', label: 'Over Rs 200' },
];

const ShoppingListFilters: React.FC<ShoppingListFiltersProps> = ({
  selectedStores,
  setSelectedStores,
  selectedCategories,
  setSelectedCategories,
  priceRange,
  setPriceRange,
  colors,
  colorScheme,
}) => {
  const toggleStore = (storeName: string) => {
    if (selectedStores.includes(storeName)) {
      setSelectedStores(selectedStores.filter(s => s !== storeName));
    } else {
      setSelectedStores([...selectedStores, storeName]);
    }
  };

  const toggleCategory = (categoryName: string) => {
    if (selectedCategories.includes(categoryName)) {
      setSelectedCategories(selectedCategories.filter(c => c !== categoryName));
    } else {
      setSelectedCategories([...selectedCategories, categoryName]);
    }
  };

  const togglePriceRange = (range: PriceRange) => {
    if (priceRange === range) {
      setPriceRange(null);
    } else {
      setPriceRange(range);
    }
  };

  const hasActiveFilters = selectedStores.length > 0 || selectedCategories.length > 0 || priceRange !== null;

  const clearFilters = () => {
    setSelectedStores([]);
    setSelectedCategories([]);
    setPriceRange(null);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Store Filters */}
        {STORES.map((store) => {
          const isSelected = selectedStores.includes(store.name);
          return (
            <TouchableOpacity
              key={store.name}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isSelected ? store.color : colors.card,
                  borderColor: isSelected ? store.color : colors.border,
                },
              ]}
              onPress={() => toggleStore(store.name)}
            >
              <View
                style={[
                  styles.storeIndicator,
                  { backgroundColor: isSelected ? 'white' : store.color },
                ]}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? 'white' : colors.text },
                ]}
              >
                {store.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Separator */}
        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {/* Category Filters */}
        {CATEGORIES.map((category) => {
          const isSelected = selectedCategories.includes(category.name);
          return (
            <TouchableOpacity
              key={category.name}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => toggleCategory(category.name)}
            >
              <Text style={styles.categoryEmoji}>{category.emoji}</Text>
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? 'white' : colors.text },
                ]}
              >
                {category.displayName}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Separator */}
        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {/* Price Range Filters */}
        {PRICE_RANGES.map((range) => {
          const isSelected = priceRange === range.key;
          return (
            <TouchableOpacity
              key={range.key}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isSelected ? '#10B981' : colors.card,
                  borderColor: isSelected ? '#10B981' : colors.border,
                },
              ]}
              onPress={() => togglePriceRange(range.key)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? 'white' : colors.text },
                ]}
              >
                {range.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <TouchableOpacity
            style={[styles.clearButton, { backgroundColor: '#ef4444' }]}
            onPress={clearFilters}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  storeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryEmoji: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  separator: {
    width: 1,
    height: 24,
    marginHorizontal: 8,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default ShoppingListFilters;
