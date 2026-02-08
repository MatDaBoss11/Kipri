import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { Platform, StyleSheet, View } from 'react-native';

const styles = StyleSheet.create({
  activeTabBackground: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366F1',
    opacity: 0.15,
  },
  tabContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
    minWidth: 48,
  },
  pressable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
});

export function HapticTab(props: BottomTabBarButtonProps) {
  const isActive = props.accessibilityState?.selected ?? false;

  // iOS: Don't wrap in View - just return PlatformPressable directly to avoid touch issues
  if (Platform.OS === 'ios') {
    return (
      <PlatformPressable
        {...props}
        style={[props.style, styles.pressable]}
        onPressIn={(ev) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          props.onPressIn?.(ev);
        }}
      >
        {isActive && <View style={styles.activeTabBackground} />}
        {props.children}
      </PlatformPressable>
    );
  }

  // Android: Keep the View wrapper with background
  return (
    <View style={styles.tabContainer}>
      {isActive && <View style={styles.activeTabBackground} />}
      <PlatformPressable
        {...props}
        style={[props.style, styles.pressable]}
        onPressIn={(ev) => {
          props.onPressIn?.(ev);
        }}
      />
    </View>
  );
}
