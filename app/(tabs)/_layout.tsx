import { Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/useColorScheme';

// Custom Tab Bar Component
function CustomTabBar({ state, descriptors, navigation }: any) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const tabs = [
    { name: 'index', icon: 'shopping-bag', iconOutline: 'shopping-bag' },
    { name: 'promotions', icon: 'local-offer', iconOutline: 'local-offer' },
    { name: 'scanner', icon: 'add', iconOutline: 'add', isCenter: true },
    { name: 'shoppinglist', icon: 'shopping-cart', iconOutline: 'shopping-cart' },
    { name: 'settings', icon: 'settings', iconOutline: 'settings' },
  ];

  return (
    <View style={[
      styles.tabBarContainer,
      {
        bottom: Math.max(insets.bottom, 16),
        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
      }
    ]}>
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;
        const tab = tabs.find(t => t.name === route.name) || tabs[0];

        const onPress = () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        // Center raised + button
        if (tab.isCenter) {
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.centerTabButton}
            >
              <View style={[
                styles.centerButtonCircle,
                { backgroundColor: '#10b981' }
              ]}>
                <MaterialIcons
                  name="add"
                  size={32}
                  color="#FFFFFF"
                />
              </View>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tabButton}
          >
            <View style={styles.iconWrapper}>
              <MaterialIcons
                name={tab.icon as any}
                size={24}
                color={isFocused
                  ? (isDark ? '#FFFFFF' : '#000000')
                  : (isDark ? '#8E8E93' : '#8E8E93')
                }
              />
              {isFocused && (
                <View style={[
                  styles.activeIndicator,
                  { backgroundColor: isDark ? '#FFFFFF' : '#000000' }
                ]} />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 70,
    borderRadius: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  centerTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    marginTop: -30,
  },
  centerButtonCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    width: 20,
    height: 3,
    borderRadius: 2,
    marginTop: 5,
  },
});

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        sceneContainerStyle: {
          backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#f3f3f3',
          paddingBottom: 100,
        },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="promotions" />
      <Tabs.Screen name="scanner" />
      <Tabs.Screen name="shoppinglist" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
