import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

export default function BlurTabBarBackground() {
  return (
    <BlurView
      // System chrome material automatically adapts to the system's theme
      // and matches the native tab bar appearance on iOS.
      tint="systemChromeMaterial"
      intensity={100}
      style={[StyleSheet.absoluteFill, styles.blurView]}
    />
  );
}

const styles = StyleSheet.create({
  blurView: {
    // CRITICAL: Allow touches to pass through to the tab buttons underneath
    pointerEvents: 'none',
  },
});

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
