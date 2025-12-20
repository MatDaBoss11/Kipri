import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ColorSchemeName,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { SavedItem } from '../types';
import { useSavedItems } from '../contexts/SavedItemsContext';

interface SavedItemCardProps {
  item: SavedItem;
  colors: any;
  colorScheme: ColorSchemeName;
}

const SavedItemCard: React.FC<SavedItemCardProps> = ({
  item,
  colors,
  colorScheme,
}) => {
  const { removeItem } = useSavedItems();

  const getStoreColor = (storeName: string): string => {
    const normalizedStore = storeName.toLowerCase();
    if (normalizedStore.includes('winner')) return '#FF9800';
    if (normalizedStore.includes('super') || normalizedStore.includes('u')) return '#2196F3';
    if (normalizedStore.includes('king') || normalizedStore.includes('saver')) return '#9C27B0';
    return '#6366F1';
  };

  const formatPrice = (price: number): string => {
    return price.toFixed(2);
  };

  const handleRemove = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await removeItem(item.id);
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const storeColor = getStoreColor(item.store);

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {/* Left Section - Store indicator and product info */}
      <View style={styles.leftSection}>
        <View style={[styles.storeDot, { backgroundColor: storeColor }]} />
        <View style={styles.infoContainer}>
          <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
            {item.productName}
          </Text>
          {item.size && (
            <Text style={[styles.sizeText, { color: colors.text }]}>
              {item.size}
            </Text>
          )}
          <View style={styles.metaRow}>
            <Text style={[styles.storeText, { color: storeColor }]}>
              {item.store}
            </Text>
            {item.categories && item.categories.length > 0 && (
              <Text style={[styles.categoryText, { color: colors.text }]}>
                {item.categories.map(cat =>
                  cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase()
                ).join(', ')}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Right Section - Price and bookmark */}
      <View style={styles.rightSection}>
        <Text style={[styles.priceText, { color: '#10B981' }]}>
          Rs {formatPrice(item.price)}
        </Text>
        <TouchableOpacity
          style={styles.bookmarkButton}
          onPress={handleRemove}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons
            name="bookmark"
            size={28}
            color="#10B981"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  storeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    marginRight: 12,
  },
  infoContainer: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sizeText: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryText: {
    fontSize: 12,
    opacity: 0.5,
    textTransform: 'capitalize',
  },
  rightSection: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  bookmarkButton: {
    padding: 4,
  },
});

export default SavedItemCard;
