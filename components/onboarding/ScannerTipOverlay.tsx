import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';

interface ScannerTipContent {
  icon: string;
  title: string;
  steps: string[];
}

const TIPS: Record<string, ScannerTipContent> = {
  add: {
    icon: '+',
    title: 'Adding a New Product',
    steps: [
      'Point your camera at the price tag and snap a photo',
      "We'll read the details automatically — edit if needed",
      'Then take a photo of the product itself',
    ],
  },
  update: {
    icon: '↻',
    title: 'Updating a Price',
    steps: [
      'Point your camera at the new price tag',
      "We'll detect the product and update the price",
      "That's it — the price list updates instantly",
    ],
  },
  receipt: {
    icon: '🧾',
    title: 'Scanning a Receipt',
    steps: [
      'Snap a photo of your receipt (multiple photos for long receipts)',
      "Tap Done when you've captured everything",
      'Review the items, pick a store, and save',
    ],
  },
};

interface ScannerTipOverlayProps {
  mode: string;
  onDismiss: () => void;
}

export default function ScannerTipOverlay({ mode, onDismiss }: ScannerTipOverlayProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const tip = TIPS[mode];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (!tip) return null;

  const bgColor = isDark ? '#1E293B' : '#FFFFFF';
  const textColor = isDark ? '#F1F5F9' : '#11181C';
  const subTextColor = isDark ? '#94A3B8' : '#64748B';
  const stepBgColor = isDark ? '#0F172A' : '#F8FAFC';

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: bgColor,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: '#6366F1' + '20' }]}>
          <Text style={styles.iconText}>{tip.icon}</Text>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: textColor }]}>{tip.title}</Text>

        {/* Steps */}
        <View style={styles.stepsContainer}>
          {tip.steps.map((step, index) => (
            <View key={index} style={[styles.stepRow, { backgroundColor: stepBgColor }]}>
              <View style={[styles.stepNumber, { backgroundColor: '#6366F1' }]}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: subTextColor }]}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Got it button */}
        <TouchableOpacity
          style={[styles.gotItButton, { backgroundColor: '#6366F1' }]}
          onPress={onDismiss}
          activeOpacity={0.8}
        >
          <Text style={styles.gotItText}>Got it</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  card: {
    width: '85%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  stepsContainer: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  stepText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  gotItButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 14,
  },
  gotItText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
