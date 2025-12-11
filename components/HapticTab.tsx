import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

const styles = StyleSheet.create({
  activeTabBackground: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366F1',
    opacity: 0.15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export function HapticTab(props: BottomTabBarButtonProps) {
  const isActive = props.accessibilityState?.selected ?? false;

  return (
    <View style={styles.tabContainer}>
      {isActive && <View style={styles.activeTabBackground} />}
      <PlatformPressable
        {...props}
        onPressIn={(ev) => {
          if (process.env.EXPO_OS === 'ios') {
            // Add a soft haptic feedback when pressing down on the tabs.
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          props.onPressIn?.(ev);
        }}
      />
    </View>
  );
}
