import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          height: 70,
          paddingBottom: Platform.OS === 'ios' ? 10 : 8,
          paddingTop: 8,
          paddingHorizontal: 12,
          backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#ffffff',
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -5 },
          shadowOpacity: 0.1,
          shadowRadius: 20,
        },
        // Disable animations on Android for instant tab switching
        animationEnabled: Platform.OS === 'ios',
      }}>
      <Tabs.Screen
        name="promotions"
        options={{
          title: 'Promotions',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={24}
              name="tag.fill"
              color={focused ? '#6366F1' : (colorScheme === 'dark' ? '#9CA3AF' : '#6B7280')}
            />
          ),
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          }
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Prices',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={24}
              name="bag.fill"
              color={focused ? '#6366F1' : (colorScheme === 'dark' ? '#9CA3AF' : '#6B7280')}
            />
          ),
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          }
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={24}
              name="qrcode"
              color={focused ? '#6366F1' : (colorScheme === 'dark' ? '#9CA3AF' : '#6B7280')}
            />
          ),
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          }
        }}
      />
    </Tabs>
  );
}
