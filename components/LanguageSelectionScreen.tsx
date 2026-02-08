import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Language } from '../translations';

// Brand color - matches app.config.js backgroundColor
const KIPRI_RED = '#D02919';

interface LanguageSelectionScreenProps {
  onLanguageSelected: (lang: Language) => void;
}

const LanguageSelectionScreen: React.FC<LanguageSelectionScreenProps> = ({
  onLanguageSelected,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const buttonFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Initial fade in and scale for logo
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

    // Delayed animation for buttons
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(buttonFadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }, 400);
  }, [fadeAnim, scaleAnim, slideAnim, buttonFadeAnim]);

  const handleSelectEnglish = () => {
    onLanguageSelected('en');
  };

  const handleSelectFrench = () => {
    onLanguageSelected('fr');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Logo Section */}
      <Animated.View
        style={[
          styles.logoSection,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/icon.jpg')}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>
        <Text style={styles.brandName}>Kipri</Text>
      </Animated.View>

      {/* Language Selection Section */}
      <Animated.View
        style={[
          styles.selectionSection,
          {
            opacity: buttonFadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.titleText}>Choose your language</Text>
        <Text style={styles.subtitleText}>Choisissez votre langue</Text>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.languageButton}
            onPress={handleSelectEnglish}
            activeOpacity={0.8}
          >
            <Text style={styles.flagEmoji}>GB</Text>
            <Text style={styles.languageButtonText}>English</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.languageButton}
            onPress={handleSelectFrench}
            activeOpacity={0.8}
          >
            <Text style={styles.flagEmoji}>FR</Text>
            <Text style={styles.languageButtonText}>Francais</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: KIPRI_RED,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 60,
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
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  selectionSection: {
    alignItems: 'center',
    width: '100%',
  },
  titleText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonsContainer: {
    width: '100%',
    gap: 16,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    gap: 12,
  },
  flagEmoji: {
    fontSize: 24,
    fontWeight: '700',
    color: KIPRI_RED,
  },
  languageButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
});

export default LanguageSelectionScreen;
