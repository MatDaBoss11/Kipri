import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Text, View, StyleSheet } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// Kipri branded header title component
const KipriHeaderTitle = ({ title, colorScheme }: { title: string; colorScheme: 'light' | 'dark' | null }) => {
  const colors = Colors[colorScheme ?? 'light'];
  return (
    <View style={headerStyles.headerTitleContainer}>
      <Text style={[headerStyles.kipriText, { color: colors.primary }]}>Kipri</Text>
      <Text style={[headerStyles.separatorText, { color: colors.text, opacity: 0.3 }]}> | </Text>
      <Text style={[headerStyles.screenTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
};

const headerStyles = StyleSheet.create({
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kipriText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  separatorText: {
    fontSize: 18,
    fontWeight: '300',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        headerShown: false, // Keep false - we handle headers in individual screens
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            height: 88, // Increased for iOS safe area
            paddingBottom: 28, // Account for iPhone home indicator
            paddingTop: 8,
            paddingHorizontal: 12,
            backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#ffffff',
            borderTopWidth: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -5 },
            shadowOpacity: 0.1,
            shadowRadius: 20,
            // NOTE: Removed position: 'absolute' - it was causing touch issues
            // The tab bar is naturally positioned at the bottom by React Navigation
          },
          default: {
            height: 70,
            paddingBottom: 8,
            paddingTop: 8,
            paddingHorizontal: 12,
            backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#ffffff',
            borderTopWidth: 0,
            elevation: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -5 },
            shadowOpacity: 0.1,
            shadowRadius: 20,
          }
        }),
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
