import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useOnboarding, TargetLayout } from '../../contexts/OnboardingContext';
import { ONBOARDING_STEPS } from './onboardingSteps';
import TooltipCard from './TooltipCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const OVERLAY_COLOR = 'rgba(0, 0, 0, 0.75)';
const HIGHLIGHT_PADDING = 6;
const HIGHLIGHT_BORDER = 2;
const PRIMARY_COLOR = '#6366F1';

const ANIM_DURATION = 350;
const FADE_OUT = 150;
const FADE_IN = 250;

export default function OnboardingOverlay() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const {
    isOnboardingActive,
    currentStep,
    shouldAutoStart,
    startOnboarding,
    nextStep,
    skipOnboarding,
    completeOnboarding,
    targets,
    hasProducts,
  } = useOnboarding();

  const [isReady, setIsReady] = useState(false);

  // Animated values for spotlight cutout
  const cutoutX = useSharedValue(SCREEN_WIDTH / 2 - 50);
  const cutoutY = useSharedValue(SCREEN_HEIGHT / 2 - 25);
  const cutoutW = useSharedValue(100);
  const cutoutH = useSharedValue(50);
  const overlayOpacity = useSharedValue(0);
  const tooltipOpacity = useSharedValue(0);

  // Filter out steps 1 & 2 (product card & bookmark) when no products
  const activeSteps = useMemo(() => {
    if (!hasProducts) {
      return ONBOARDING_STEPS.filter(s => s.id !== 1 && s.id !== 2);
    }
    return ONBOARDING_STEPS;
  }, [hasProducts]);

  const totalSteps = activeSteps.length;

  // Auto-start when ready
  useEffect(() => {
    if (shouldAutoStart && !isOnboardingActive && targets['categoriesSection']) {
      // Small delay to let the UI settle
      const timer = setTimeout(() => {
        startOnboarding();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoStart, isOnboardingActive, targets, startOnboarding]);

  // When onboarding becomes active, fade in overlay
  useEffect(() => {
    if (isOnboardingActive) {
      setIsReady(true);
      overlayOpacity.value = withTiming(1, { duration: 300 });
      animateToStep(0);
    } else {
      overlayOpacity.value = withTiming(0, { duration: 200 });
      tooltipOpacity.value = withTiming(0, { duration: 150 });
      const timer = setTimeout(() => setIsReady(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOnboardingActive]);

  // When step changes, animate cutout
  useEffect(() => {
    if (isOnboardingActive && currentStep > 0) {
      // Find the index in activeSteps
      animateToStep(currentStep);
    }
  }, [currentStep]);

  const animateToStep = useCallback(
    (stepIdx: number) => {
      if (stepIdx >= activeSteps.length) return;

      const step = activeSteps[stepIdx];
      const target = targets[step.targetKey];

      if (!target) {
        // If target not registered yet, skip to next or just show tooltip centered
        return;
      }

      const x = target.x - HIGHLIGHT_PADDING;
      const y = target.y - HIGHLIGHT_PADDING;
      const w = target.width + HIGHLIGHT_PADDING * 2;
      const h = target.height + HIGHLIGHT_PADDING * 2;

      // Fade out tooltip -> animate cutout -> fade in tooltip
      tooltipOpacity.value = withSequence(
        withTiming(0, { duration: FADE_OUT }),
        withDelay(
          ANIM_DURATION,
          withTiming(1, { duration: FADE_IN }),
        ),
      );

      const timingConfig = { duration: ANIM_DURATION, easing: Easing.bezier(0.25, 0.1, 0.25, 1) };
      cutoutX.value = withDelay(FADE_OUT, withTiming(x, timingConfig));
      cutoutY.value = withDelay(FADE_OUT, withTiming(y, timingConfig));
      cutoutW.value = withDelay(FADE_OUT, withTiming(w, timingConfig));
      cutoutH.value = withDelay(FADE_OUT, withTiming(h, timingConfig));
    },
    [activeSteps, targets],
  );

  const handleNext = useCallback(() => {
    if (currentStep >= activeSteps.length - 1) {
      completeOnboarding();
    } else {
      nextStep();
    }
  }, [currentStep, activeSteps.length, completeOnboarding, nextStep]);

  const handleSkip = useCallback(() => {
    skipOnboarding();
  }, [skipOnboarding]);

  // Animated styles for 4 overlay rectangles
  const topStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: Math.max(0, cutoutY.value),
    backgroundColor: OVERLAY_COLOR,
    opacity: overlayOpacity.value,
  }));

  const bottomStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: cutoutY.value + cutoutH.value,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: OVERLAY_COLOR,
    opacity: overlayOpacity.value,
  }));

  const leftStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: cutoutY.value,
    left: 0,
    width: Math.max(0, cutoutX.value),
    height: cutoutH.value,
    backgroundColor: OVERLAY_COLOR,
    opacity: overlayOpacity.value,
  }));

  const rightStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: cutoutY.value,
    left: cutoutX.value + cutoutW.value,
    right: 0,
    height: cutoutH.value,
    backgroundColor: OVERLAY_COLOR,
    opacity: overlayOpacity.value,
  }));

  // Highlight border around cutout
  const highlightStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: cutoutY.value - HIGHLIGHT_BORDER,
    left: cutoutX.value - HIGHLIGHT_BORDER,
    width: cutoutW.value + HIGHLIGHT_BORDER * 2,
    height: cutoutH.value + HIGHLIGHT_BORDER * 2,
    borderRadius: 12,
    borderWidth: HIGHLIGHT_BORDER,
    borderColor: PRIMARY_COLOR,
    opacity: overlayOpacity.value,
  }));

  // Tooltip container animated style
  const tooltipAnimStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.value,
  }));

  if (!isReady) return null;

  // Determine tooltip position for current step
  const currentActiveStep = activeSteps[currentStep] || activeSteps[0];
  const target = targets[currentActiveStep?.targetKey];

  let tooltipPosition: 'above' | 'below' = 'below';
  let tooltipTop = 0;
  let tooltipLeft = 0;
  let arrowX = 160;

  if (target) {
    const targetCenterY = target.y + target.height / 2;
    const targetCenterX = target.x + target.width / 2;

    // Show tooltip below if target is in top half, above if in bottom half
    if (targetCenterY < SCREEN_HEIGHT * 0.45) {
      tooltipPosition = 'below';
      tooltipTop = target.y + target.height + HIGHLIGHT_PADDING + 16;
    } else {
      tooltipPosition = 'above';
      tooltipTop = target.y - HIGHLIGHT_PADDING - 16; // Will be adjusted by card height
    }

    // Center horizontally on the target, clamped to screen
    tooltipLeft = Math.max(16, Math.min(targetCenterX - 160, SCREEN_WIDTH - 336));

    // Arrow points at target center relative to tooltip left
    arrowX = targetCenterX - tooltipLeft;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isOnboardingActive ? 'box-none' : 'none'}>
      {/* 4 overlay rectangles that create the cutout */}
      <Animated.View style={topStyle} pointerEvents="none" />
      <Animated.View style={bottomStyle} pointerEvents="none" />
      <Animated.View style={leftStyle} pointerEvents="none" />
      <Animated.View style={rightStyle} pointerEvents="none" />

      {/* Highlight border */}
      <Animated.View style={highlightStyle} pointerEvents="none" />

      {/* Touch catcher (blocks taps outside tooltip) */}
      {isOnboardingActive && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-only" onTouchEnd={handleNext} />
      )}

      {/* Tooltip */}
      {isOnboardingActive && currentActiveStep && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            {
              position: 'absolute',
              left: tooltipLeft,
              ...(tooltipPosition === 'below'
                ? { top: tooltipTop }
                : { bottom: SCREEN_HEIGHT - tooltipTop }),
            },
            tooltipAnimStyle,
          ]}
        >
          <View pointerEvents="auto">
            <TooltipCard
              stepIndex={currentStep}
              totalSteps={totalSteps}
              title={currentActiveStep.title}
              body={currentActiveStep.body}
              onNext={handleNext}
              onSkip={handleSkip}
              isLast={currentStep >= activeSteps.length - 1}
              position={tooltipPosition}
              arrowX={arrowX}
              isDark={isDark}
            />
          </View>
        </Animated.View>
      )}
    </View>
  );
}
