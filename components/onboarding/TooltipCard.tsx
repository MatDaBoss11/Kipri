import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ONBOARDING_STEPS } from './onboardingSteps';

interface TooltipCardProps {
  stepIndex: number;
  totalSteps: number;
  title: string;
  body: string;
  onNext: () => void;
  onSkip: () => void;
  isLast: boolean;
  position: 'above' | 'below';
  arrowX: number; // horizontal center of the arrow relative to card left
  isDark: boolean;
}

export default function TooltipCard({
  stepIndex,
  totalSteps,
  title,
  body,
  onNext,
  onSkip,
  isLast,
  position,
  arrowX,
  isDark,
}: TooltipCardProps) {
  const bgColor = isDark ? '#1E293B' : '#FFFFFF';
  const textColor = isDark ? '#F1F5F9' : '#11181C';
  const subTextColor = isDark ? '#94A3B8' : '#64748B';
  const primaryColor = '#6366F1';

  return (
    <View style={styles.container}>
      {/* Arrow pointing up (when tooltip is below target) */}
      {position === 'below' && (
        <View style={[styles.arrowUp, { left: Math.max(20, Math.min(arrowX - 8, 280)) }]}>
          <View style={[styles.arrowUpInner, { borderBottomColor: bgColor }]} />
        </View>
      )}

      <View style={[styles.card, { backgroundColor: bgColor }]}>
        {/* Title */}
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>

        {/* Body */}
        <Text style={[styles.body, { color: subTextColor }]}>{body}</Text>

        {/* Step Dots */}
        <View style={styles.dotsRow}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === stepIndex ? primaryColor : (isDark ? '#475569' : '#E2E8F0'),
                  width: i === stepIndex ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
            <Text style={[styles.skipText, { color: subTextColor }]}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onNext}
            style={[styles.nextButton, { backgroundColor: primaryColor }]}
          >
            <Text style={styles.nextText}>{isLast ? 'Done' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Arrow pointing down (when tooltip is above target) */}
      {position === 'above' && (
        <View style={[styles.arrowDown, { left: Math.max(20, Math.min(arrowX - 8, 280)) }]}>
          <View style={[styles.arrowDownInner, { borderTopColor: bgColor }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 320,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  nextButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  arrowUp: {
    position: 'absolute',
    top: -10,
    zIndex: 1,
  },
  arrowUpInner: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowDown: {
    position: 'absolute',
    bottom: -10,
    zIndex: 1,
  },
  arrowDownInner: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
