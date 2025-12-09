import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function NotFoundScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <>
      <Stack.Screen options={{ title: 'Kipri - Page Not Found' }} />
      <ThemedView style={styles.container}>
        <View style={styles.brandContainer}>
          <Text style={[styles.kipriLogo, { color: colors.primary }]}>Kipri</Text>
        </View>
        <Text style={styles.emoji}>404</Text>
        <ThemedText type="title">Page not found</ThemedText>
        <ThemedText style={styles.subtitle}>
          Oops! This page seems to have wandered off.
        </ThemedText>
        <Link href="/" style={styles.link}>
          <View style={[styles.linkButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.linkButtonText}>Back to Kipri</Text>
          </View>
        </Link>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  brandContainer: {
    marginBottom: 20,
  },
  kipriLogo: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.6,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 8,
    textAlign: 'center',
  },
  link: {
    marginTop: 24,
  },
  linkButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  linkButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
