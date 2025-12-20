import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import AuthScreen from '../components/AuthScreen';
import { AppDataProvider } from '../contexts/AppDataContext';
import { SavedItemsProvider } from '../contexts/SavedItemsContext';
import AuthService from '../services/AuthService';
import DataCacheService from '../services/DataCacheService';
import ShoppingListService from '../services/ShoppingListService';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Custom theme based on our color palette
const KipriLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.primary,
    background: Colors.light.background,
    card: Colors.light.card,
    text: Colors.light.text,
    border: Colors.light.border,
  },
};

const KipriDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.border,
  },
};

// Brand color - matches app.config.js backgroundColor
const KIPRI_RED = '#D02919';
const KIPRI_RED_DARK = '#B82318';
const KIPRI_RED_LIGHT = '#E53935';

// Kipri Loading Screen Component
interface KipriLoadingScreenProps {
  loadingMessage?: string;
}

function KipriLoadingScreen({ loadingMessage = 'Loading your savings...' }: KipriLoadingScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Initial fade in and scale
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle pulse animation for the logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Shimmer animation for loading indicator
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  }, [fadeAnim, scaleAnim, pulseAnim, shimmerAnim]);

  // Use the red brand color for consistency with native splash screen
  const backgroundColor = KIPRI_RED;
  const textColor = '#FFFFFF';

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1, 0.3],
  });

  return (
    <View style={[loadingStyles.container, { backgroundColor }]}>
      <StatusBar style="light" />
      <Animated.View
        style={[
          loadingStyles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }],
          },
        ]}
      >
        <View style={loadingStyles.logoContainer}>
          <Image
            source={require('../assets/images/icon.jpg')}
            style={loadingStyles.logoImage}
            resizeMode="cover"
          />
        </View>
        <Text style={[loadingStyles.brandName, { color: textColor }]}>Kipri</Text>
        <Text style={[loadingStyles.tagline, { color: textColor }]}>
          Smart Shopping, Better Prices
        </Text>
      </Animated.View>
      <Animated.View style={[loadingStyles.loaderContainer, { opacity: fadeAnim }]}>
        <View style={loadingStyles.loaderWrapper}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
        <Animated.Text
          style={[
            loadingStyles.loadingText,
            { color: textColor, opacity: shimmerOpacity }
          ]}
        >
          {loadingMessage}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
    overflow: 'hidden',
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 30,
  },
  brandName: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: 0.5,
    opacity: 0.9,
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
  },
  loaderWrapper: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const [dataIsReady, setDataIsReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading your savings...');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Handle when data is ready - enforce minimum 3 second splash
  const handleDataReady = useCallback(async () => {
    const elapsed = Date.now() - startTimeRef.current;
    const MIN_SPLASH_TIME = 3000; // 3 seconds minimum

    if (elapsed < MIN_SPLASH_TIME) {
      // Wait remaining time to ensure at least 3 seconds total
      const remainingTime = MIN_SPLASH_TIME - elapsed;
      console.log(`[RootLayout] Data ready in ${elapsed}ms, waiting additional ${remainingTime}ms`);
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }

    console.log('[RootLayout] Data preload complete, app is now ready');
    setDataIsReady(true);
  }, []);

  // Check authentication session on start
  useEffect(() => {
    async function checkAuth() {
      try {
        const user = await AuthService.getCurrentUser();
        setIsAuthenticated(!!user);

        // If authenticated, pre-load their cloud wishlist
        if (user) {
          console.log('[RootLayout] User authenticated, syncing wishlist...');
          await ShoppingListService.getInstance().loadItems();
        }
      } catch (e) {
        console.error('[RootLayout] Auth check error:', e);
        setIsAuthenticated(false);
      }
    }

    if (appIsReady) {
      checkAuth();
    }
  }, [appIsReady]);

  // Handle successful authentication
  const handleAuthSuccess = useCallback(async () => {
    setIsAuthenticated(true);
    // Refresh items to pull from cloud
    await ShoppingListService.getInstance().loadItems();
  }, []);

  // Prepare app resources (fonts only - data is loaded by AppDataProvider)
  useEffect(() => {
    async function prepare() {
      try {
        // Record start time for minimum splash duration
        startTimeRef.current = Date.now();
        console.log('[RootLayout] Starting app preparation...');
      } catch (e) {
        console.warn('Error during app initialization:', e);
      } finally {
        // Fonts are loaded, mark app as ready to show custom splash
        setAppIsReady(true);
      }
    }

    if (loaded) {
      prepare();
    }
  }, [loaded]);

  // Set up developer command for clearing cache
  useEffect(() => {
    // Only expose in development environment
    if (__DEV__) {
      const cacheService = DataCacheService.getInstance();

      // Expose global method for developers
      (global as any).clearKipriCache = async () => {
        console.log('Developer command triggered: clearKipriCache()');
        await cacheService.developerClearCache();
        console.log('Cache cleared! App data will be refreshed on next load.');
      };

      console.log('Developer tools loaded. Use clearKipriCache() to clear cache.');
    }
  }, []);

  // Hide the native splash screen once data is ready
  const onLayoutRootView = useCallback(async () => {
    if (dataIsReady) {
      // This tells the splash screen to hide immediately
      await SplashScreen.hideAsync();
    }
  }, [dataIsReady]);

  // Show the custom loading screen while fonts are loading
  if (!loaded || !appIsReady) {
    return <KipriLoadingScreen loadingMessage={loadingMessage} />;
  }

  // Show the custom loading screen while data is preloading
  if (!dataIsReady) {
    return (
      <AppDataProvider
        onReady={handleDataReady}
        onLoadingMessage={setLoadingMessage}
      >
        <KipriLoadingScreen loadingMessage={loadingMessage} />
      </AppDataProvider>
    );
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <AppDataProvider>
        <SavedItemsProvider>
          <ThemeProvider value={colorScheme === 'dark' ? KipriDarkTheme : KipriLightTheme}>
            {isAuthenticated === null ? (
              <KipriLoadingScreen loadingMessage="Checking session..." />
            ) : !isAuthenticated ? (
              <AuthScreen onAuthSuccess={handleAuthSuccess} />
            ) : (
              <>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="+not-found" />
                </Stack>
                <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
              </>
            )}
          </ThemeProvider>
        </SavedItemsProvider>
      </AppDataProvider>
    </View>
  );
}
