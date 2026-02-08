import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

// Disable BlurView on iOS to fix touch interaction issues
// The solid background color from tabBarStyle will be used instead
export default undefined;

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
