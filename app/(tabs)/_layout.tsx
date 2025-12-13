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
        sceneContainerStyle: {
          paddingBottom: 104, // Space for floating tab bar
          backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#f3f3f3',
        },
        tabBarStyle: Platform.select({
          ios: {
            height: 80,
            paddingBottom: 12,
            paddingTop: 20,
            paddingHorizontal: 16,
            marginHorizontal: 16,
            marginBottom: 12,
            backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#ffffff',
            borderTopWidth: 0,
            borderRadius: 30,
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
          },
          default: {
            height: 80,
            paddingBottom: 12,
            paddingTop: 20,
            paddingHorizontal: 16,
            marginHorizontal: 16,
            marginBottom: 12,
            backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#ffffff',
            borderTopWidth: 0,
            borderRadius: 30,
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            elevation: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
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
              size={32}
              name="tag.fill"
              color={focused ? '#6366F1' : (colorScheme === 'dark' ? '#9CA3AF' : '#6B7280')}
            />
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Prices',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={32}
              name="bag.fill"
              color={focused ? '#6366F1' : (colorScheme === 'dark' ? '#9CA3AF' : '#6B7280')}
            />
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="shoppinglist"
        options={{
          title: 'Shopping List',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={32}
              name="bookmark.fill"
              color={focused ? '#6366F1' : (colorScheme === 'dark' ? '#9CA3AF' : '#6B7280')}
            />
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={32}
              name="photo.camera.fill"
              color={focused ? '#6366F1' : (colorScheme === 'dark' ? '#9CA3AF' : '#6B7280')}
            />
          ),
          tabBarLabel: () => null,
        }}
      />
    </Tabs>
  );
}
