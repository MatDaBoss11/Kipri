import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { CATEGORIES } from '../constants/categories';

const { width } = Dimensions.get('window');
const GRID_PADDING = 20;
const GRID_GAP = 12;
const CARD_WIDTH = (width - GRID_PADDING * 2 - GRID_GAP) / 2;

interface CategoryPickerScreenProps {
  onCategorySelected: (categoryName: string) => void;
}

const CategoryPickerScreen = ({ onCategorySelected }: CategoryPickerScreenProps) => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleSelect = (categoryName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCategorySelected(categoryName);
  };

  return (
    <LinearGradient
      colors={['#4F46E5', '#6366F1', '#818CF8']}
      style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
    >
      <StatusBar style="light" />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <Text style={styles.brandName}>Kipri</Text>
        <Text style={styles.subtitle}>What do you want to compare first?</Text>
      </Animated.View>

      {/* Category Grid */}
      <Animated.View
        style={[
          styles.grid,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {CATEGORIES.map((category, index) => (
          <TouchableOpacity
            key={category.name}
            style={styles.card}
            onPress={() => handleSelect(category.name)}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.08)']}
              style={styles.cardGradient}
            >
              <Text style={styles.cardEmoji}>{category.emoji}</Text>
              <Text style={styles.cardLabel}>{category.displayName}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: GRID_PADDING,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandName: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'center',
    gap: GRID_GAP,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 0.75,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

export default CategoryPickerScreen;
