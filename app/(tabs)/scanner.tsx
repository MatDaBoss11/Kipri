import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePostHog } from 'posthog-react-native';
import { CATEGORIES } from '../../constants/categories';
import BackendReplicaService from '../../services/BackendReplicaService';

import DataCacheService from '../../services/DataCacheService';
import KipriBackendService from '../../services/KipriBackendService';
import OpenAiService from '../../services/OpenAiService';
import StoreMatchingService from '../../services/StoreMatchingService';
import StoreService from '../../services/StoreService';
import { useStorePreferences } from '../../contexts/StorePreferencesContext';
import { useActiveStore } from '../../contexts/ActiveStoreContext';
import CameraScannerView from '../../components/CameraScannerView';
import ScannerTipOverlay from '../../components/onboarding/ScannerTipOverlay';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { AppMode, ReviewedReceiptItem, Store } from '../../types';

interface StoreComparison {
  storeName: string;
  total: number;
  matchedItems: number;
}

interface SavingsComparison {
  userStore: string;
  userTotal: number;
  itemCount: number;
  comparisons: StoreComparison[];
  savedCount?: number;
  updatedCount?: number;
}

const ScannerScreen = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const posthog = usePostHog();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const params = useLocalSearchParams();
  const navigation = useNavigation();

  const [showModeSelection, setShowModeSelection] = useState(!params.mode);
  const [mode, setMode] = useState<AppMode>(
    params.mode === 'update' ? AppMode.UPDATE : AppMode.ADD
  );
  const [isProcessing, setIsProcessing] = useState(false);

  // Scanner onboarding tip
  const { hasSeenScannerTip, markScannerTipSeen } = useOnboarding();
  const [showScannerTip, setShowScannerTip] = useState(false);
  const [pendingMode, setPendingMode] = useState<AppMode | null>(null);

  // Form states (ADD/UPDATE mode)
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Receipt mode states
  const [receiptPhotoUris, setReceiptPhotoUris] = useState<string[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewedReceiptItem[]>([]);
  const [receiptStore, setReceiptStore] = useState<string>('');
  const [showReceiptReview, setShowReceiptReview] = useState(false);
  const [scanProgress, setScanProgress] = useState<string>('');
  const [showOtherStores, setShowOtherStores] = useState(false);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [savingsData, setSavingsData] = useState<SavingsComparison | null>(null);

  // User's preferred stores from context
  const { selectedStores: userPreferredStores } = useStorePreferences();

  // Active store session (sticky store for 30 min)
  const { activeStoreName, setActiveStore } = useActiveStore();
  const [storeAutoFilled, setStoreAutoFilled] = useState(false);

  // Get the user's preferred store names
  const preferredStoreNames = userPreferredStores && userPreferredStores.length > 0
    ? userPreferredStores.map(s => s.name)
    : ['Winners', 'Kingsavers', 'Super U'];

  // Load all stores when "Other" is tapped
  const loadAllStores = async () => {
    if (allStores.length > 0) {
      setShowOtherStores(true);
      return;
    }
    try {
      const stores = await StoreService.getInstance().getAllStores();
      setAllStores(stores);
      setShowOtherStores(true);
    } catch (error) {
      console.error('Failed to load stores:', error);
      Alert.alert('Error', 'Failed to load stores. Please try again.');
    }
  };

  const cacheService = DataCacheService.getInstance();

  const startAnimations = React.useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  React.useEffect(() => {
    startAnimations();
  }, [startAnimations]);

  // Hide tab bar when in camera/scanner mode, show on mode selection
  useLayoutEffect(() => {
    navigation.setOptions({
      tabBarStyle: showModeSelection ? undefined : { display: 'none' },
    });
  }, [showModeSelection, navigation]);

  // Pre-fill form when coming from navigation
  useEffect(() => {
    if (params.mode === 'update') {
      setProductName(params.productName as string || '');
      setSize(params.size as string || '');
      setPrice(params.currentPrice as string || '');
      setSelectedStore(params.store as string || '');

      const category = params.category as string;
      if (category) {
        setSelectedCategories([category.toLowerCase()]);
      }
    }
  }, [params.mode, params.productName, params.size, params.currentPrice, params.store, params.category]);

  // Auto-fill store from active session (sticky store)
  useEffect(() => {
    if (!activeStoreName) return;
    // Don't override if already set by navigation params or OCR
    if (!selectedStore && !params.store) {
      setSelectedStore(activeStoreName);
      setStoreAutoFilled(true);
    }
  }, [activeStoreName, showModeSelection]);

  const selectMode = (selectedMode: AppMode) => {
    posthog.capture('scanner_mode_selected', { mode: selectedMode });

    // Show scanner tip if user hasn't seen it for this mode
    if (!hasSeenScannerTip(selectedMode)) {
      setPendingMode(selectedMode);
      setShowScannerTip(true);
      return;
    }

    setMode(selectedMode);
    setShowModeSelection(false);
  };

  const handleScannerTipDismiss = () => {
    if (pendingMode) {
      markScannerTipSeen(pendingMode);
      setMode(pendingMode);
      setShowScannerTip(false);
      setShowModeSelection(false);
      setPendingMode(null);
    }
  };

  // Legacy image picker functions (kept for backwards compatibility)
  const pickReceiptImage = async () => {
    try {
      // On emulator or if user prefers, show options for camera or gallery
      Alert.alert(
        'Select Image Source',
        'Choose where to pick your image from:',
        [
          {
            text: 'Camera',
            onPress: async () => {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission needed', 'Camera permission is required to capture images.');
                return;
              }

              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
              });

              if (!result.canceled && result.assets[0]) {
                setReceiptImage(result.assets[0].uri);
              }
            }
          },
          {
            text: 'Photo Library',
            onPress: async () => {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission needed', 'Gallery permission is required to select images.');
                return;
              }

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
              });

              if (!result.canceled && result.assets[0]) {
                setReceiptImage(result.assets[0].uri);
              }
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('Error selecting receipt image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // Pick receipt photo (for RECEIPT mode - appends to array for multi-photo receipts)
  const pickReceiptPhoto = async () => {
    try {
      Alert.alert(
        'Add Receipt Photo',
        receiptPhotoUris.length > 0
          ? `You have ${receiptPhotoUris.length} photo(s). Add another section of the receipt:`
          : 'Choose where to pick your receipt from:',
        [
          {
            text: 'Camera',
            onPress: async () => {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission needed', 'Camera permission is required to capture images.');
                return;
              }

              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.9,
              });

              if (!result.canceled && result.assets[0]) {
                setReceiptPhotoUris(prev => [...prev, result.assets[0].uri]);
              }
            }
          },
          {
            text: 'Photo Library',
            onPress: async () => {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission needed', 'Gallery permission is required to select images.');
                return;
              }

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.9,
              });

              if (!result.canceled && result.assets[0]) {
                setReceiptPhotoUris(prev => [...prev, result.assets[0].uri]);
              }
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('Error selecting receipt photo:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const removeReceiptPhoto = (index: number) => {
    setReceiptPhotoUris(prev => prev.filter((_, i) => i !== index));
  };

  // Update pickProductImage to allow both camera and gallery selection
  const pickProductImage = async () => {
    try {
      // On emulator or if user prefers, show options for camera or gallery
      Alert.alert(
        'Select Image Source',
        'Choose where to pick your image from:',
        [
          {
            text: 'Camera',
            onPress: async () => {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission needed', 'Camera permission is required to capture images.');
                return;
              }

              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
              });

              if (!result.canceled && result.assets[0]) {
                setProductImage(result.assets[0].uri);
              }
            }
          },
          {
            text: 'Photo Library',
            onPress: async () => {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission needed', 'Gallery permission is required to select images.');
                return;
              }

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
              });

              if (!result.canceled && result.assets[0]) {
                setProductImage(result.assets[0].uri);
              }
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('Error selecting product image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleScan = async () => {
    if (!receiptImage) {
      Alert.alert('Error', 'Please capture a receipt image first to scan the product details.');
      return;
    }

    setIsProcessing(true);

    try {
      console.log('Processing image with Backend Replica Service (matching Python backend)...');

      // Use the Backend Replica Service that exactly matches the Python backend flow
      const result = await BackendReplicaService.processImage(receiptImage);

      if (result.success && result.data) {
        const product = result.data;

        // Auto-fill the form fields with the extracted data (matching backend response)
        if (product.product_name) {
          setProductName(product.product_name);
          console.log('Auto-filled product name:', product.product_name);
        }

        if (product.brand) {
          setBrand(product.brand.toUpperCase());
          console.log('Auto-filled brand:', product.brand);
        }

        if (product.price) {
          setPrice(product.price);
          console.log('Auto-filled price:', product.price);
        }

        if (product.size) {
          setSize(product.size);
          console.log('Auto-filled size:', product.size);
        }

        // Keep active store if available, otherwise reset
        if (activeStoreName) {
          setSelectedStore(activeStoreName);
          setStoreAutoFilled(true);
        } else {
          setSelectedStore('');
        }
        setSelectedCategories([]);

        // Automatically detect category if we have a product name
        if (product.product_name && product.product_name.trim()) {
          console.log('Auto-detecting category for:', product.product_name);

          try {
            // Use the integrated backend service for category detection
            const categoryResult = await KipriBackendService.processText(product.product_name.trim());

            if (categoryResult.success && categoryResult.categoryResult.isFood) {
              const detectedCategory = categoryResult.categoryResult.category;

              // Map the AI category to our local categories
              const categoryMatch = CATEGORIES.find(cat =>
                cat.displayName.toLowerCase() === detectedCategory.toLowerCase() ||
                cat.name.toLowerCase() === detectedCategory.toLowerCase()
              );

              if (categoryMatch) {
                setSelectedCategories([categoryMatch.name]);
                const confidence = Math.round(categoryResult.categoryResult.confidence * 100);
                console.log(`Auto-detected category: ${categoryMatch.displayName} (${confidence}% confidence)`);

                Alert.alert(
                  'Success',
                  `Scan complete! Auto-detected category: ${categoryMatch.displayName} (${confidence}% confidence). Please select a store before submitting.`
                );
              } else {
                // If no exact match, try to find a similar category
                let bestMatch = 'miscellaneous';
                const categoryLower = detectedCategory.toLowerCase();

                // Simple mapping for common categories
                if (categoryLower.includes('meat') || categoryLower.includes('chicken') || categoryLower.includes('fish')) {
                  bestMatch = 'meat';
                } else if (categoryLower.includes('dairy') || categoryLower.includes('milk') || categoryLower.includes('cheese')) {
                  bestMatch = 'dairy';
                } else if (categoryLower.includes('vegetable')) {
                  bestMatch = 'vegetables';
                } else if (categoryLower.includes('fruit')) {
                  bestMatch = 'fruits';
                } else if (categoryLower.includes('bread') || categoryLower.includes('bakery')) {
                  bestMatch = 'bread';
                }

                const fallbackCategory = CATEGORIES.find(cat => cat.name === bestMatch);
                if (fallbackCategory) {
                  setSelectedCategories([fallbackCategory.name]);
                  console.log(`Mapped to category: ${fallbackCategory.displayName}`);

                  Alert.alert(
                    'Success',
                    `Scan complete! Detected similar category: ${fallbackCategory.displayName}. Please review and select a store before submitting.`
                  );
                } else {
                  Alert.alert(
                    'Success',
                    'Scan complete! Product details extracted. Please manually select a category and store before submitting.'
                  );
                }
              }
            } else {
              Alert.alert(
                'Success',
                'Scan complete! Product details extracted. Could not auto-detect category - please select manually along with a store.'
              );
            }
          } catch (categoryError) {
            console.error('Category detection failed:', categoryError);
            Alert.alert(
              'Success',
              'Scan complete! Product details extracted. Category auto-detection failed - please select manually along with a store.'
            );
          }
        } else {
          Alert.alert(
            'Success',
            'Scan complete! Some details extracted. Please review and select a category and store before submitting.'
          );
        }
      } else {
        Alert.alert('Info', 'No clear product information found in the image. Please check the image quality and try again, or enter details manually.');

        // Log the error for debugging
        if (result.error) {
          console.error('BackendReplicaService error:', result.error);
        }
      }
    } catch (error: any) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'AI processing failed. Please check the image quality or try again later.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ==================== PRICE COMPARISON LOGIC ====================

  const buildSavingsComparison = async (
    savedItems: ReviewedReceiptItem[],
    shoppedStore: string
  ): Promise<SavingsComparison> => {
    const userTotal = savedItems.reduce((sum, item) => sum + item.price, 0);
    const baseSavings: SavingsComparison = {
      userStore: shoppedStore,
      userTotal,
      itemCount: savedItems.length,
      comparisons: [],
    };

    try {
      // Get the other preferred stores (excluding where the user shopped)
      const otherStores = preferredStoreNames.filter(s => s !== shoppedStore);
      if (otherStores.length === 0) return baseSavings;

      // Fetch products from each other store for comparison
      const storeComparisons: StoreComparison[] = [];

      for (const otherStore of otherStores) {
        let otherStoreProducts: any[] = [];
        try {
          const products = await KipriBackendService.getProducts({
            filters: { store: otherStore },
            limit: 500,
          });
          otherStoreProducts = products || [];
        } catch (err) {
          console.warn(`Failed to fetch products for ${otherStore}:`, err);
          continue;
        }

        let otherStoreTotal = 0;
        let matchedCount = 0;

        for (const item of savedItems) {
          const match = otherStoreProducts.find(
            (p: any) => p.product?.toLowerCase() === item.product_name.toLowerCase()
          );
          if (match && match.price) {
            otherStoreTotal += match.price;
            matchedCount++;
          }
        }

        if (matchedCount > 0) {
          storeComparisons.push({
            storeName: otherStore,
            total: otherStoreTotal,
            matchedItems: matchedCount,
          });
        }
      }

      return {
        ...baseSavings,
        comparisons: storeComparisons,
      };
    } catch (error) {
      console.error('Error building savings comparison:', error);
      return baseSavings;
    }
  };

  const dismissSavingsModal = () => {
    setShowSavingsModal(false);
    setSavingsData(null);
    setReviewItems([]);
    setReceiptPhotoUris([]);
    // Keep active store if available
    if (activeStoreName) {
      setReceiptStore(activeStoreName);
      setStoreAutoFilled(true);
    } else {
      setReceiptStore('');
    }
    setShowReceiptReview(false);
    setShowModeSelection(true);
  };

  // ==================== RECEIPT MODE HANDLERS ====================

  const handleReceiptScan = async () => {
    if (receiptPhotoUris.length === 0) {
      Alert.alert('Error', 'Please capture or select at least one receipt image first.');
      return;
    }

    setIsProcessing(true);
    setScanProgress('');

    try {
      console.log(`Processing ${receiptPhotoUris.length} receipt photo(s)...`);

      // Step 1: Process each photo and collect all items
      const allItems: { product_name: string; abbreviated_name: string; brand: string; price: number; quantity: number; size: string }[] = [];
      let detectedStoreName = '';

      for (let i = 0; i < receiptPhotoUris.length; i++) {
        setScanProgress(`Scanning photo ${i + 1} of ${receiptPhotoUris.length}...`);
        console.log(`Processing photo ${i + 1}/${receiptPhotoUris.length}`);

        const result = await BackendReplicaService.processReceipt(receiptPhotoUris[i]);

        if (result.success && result.data) {
          // Use store name from whichever photo detects it first
          if (!detectedStoreName && result.data.store_name) {
            detectedStoreName = result.data.store_name;
          }
          allItems.push(...result.data.items);
          console.log(`Photo ${i + 1}: extracted ${result.data.items.length} items`);
        } else {
          console.warn(`Photo ${i + 1} failed:`, result.error);
        }
      }

      if (allItems.length === 0) {
        Alert.alert('Error', 'No items could be extracted from any of the receipt photos. Please try again with clearer images.');
        setIsProcessing(false);
        setScanProgress('');
        return;
      }

      // Step 2: Deduplicate across photos (same product appearing in overlapping sections)
      setScanProgress('Removing duplicates across photos...');
      const uniqueItems: typeof allItems = [];
      const seenNames = new Set<string>();

      for (const item of allItems) {
        const normalizedName = item.product_name.trim().toLowerCase();
        if (!seenNames.has(normalizedName)) {
          seenNames.add(normalizedName);
          uniqueItems.push(item);
        } else {
          console.log(`Cross-photo duplicate removed: ${item.product_name}`);
        }
      }

      console.log(`${allItems.length} total items -> ${uniqueItems.length} unique after cross-photo dedup`);

      // Step 3: Match store name (OCR > active store > empty)
      const storeMatch = StoreMatchingService.matchStoreName(detectedStoreName);
      if (storeMatch.matched) {
        setReceiptStore(storeMatch.storeName);
        setStoreAutoFilled(false);
        console.log(`Store matched: ${storeMatch.storeName} (${storeMatch.confidence})`);
      } else if (activeStoreName) {
        setReceiptStore(activeStoreName);
        setStoreAutoFilled(true);
        console.log(`Store auto-filled from active session: ${activeStoreName}`);
      } else {
        setReceiptStore('');
        console.log('Store not matched, user must select manually');
      }

      // Step 4: Batch categorize all product names
      setScanProgress('Categorizing items...');
      const productNames = uniqueItems.map(item => item.product_name);
      let categoryResults;
      try {
        categoryResults = await OpenAiService.batchCategorizeTexts(productNames);
      } catch (catError) {
        console.error('Batch categorization failed:', catError);
        categoryResults = productNames.map(() => OpenAiService.quickCategorize(''));
      }

      // Step 5: Check for duplicates against database
      setScanProgress('Checking for existing products...');
      let existingProducts: any[] = [];
      if (storeMatch.matched) {
        try {
          const storeProducts = await KipriBackendService.getProducts({
            filters: { store: storeMatch.storeName },
            limit: 500,
          });
          existingProducts = storeProducts || [];
        } catch (err) {
          console.error('Failed to fetch existing products:', err);
        }
      }

      // Step 6: Build ReviewedReceiptItem[] with categories, duplicate flags
      const reviewed: ReviewedReceiptItem[] = uniqueItems.map((item, index) => {
        const catResult = categoryResults[index];
        const categoryName = catResult?.isFood && catResult.confidence > 0.5
          ? catResult.category
          : 'miscellaneous';

        // Map to our local category names
        const matchedCat = CATEGORIES.find(cat =>
          cat.name.toLowerCase() === categoryName.toLowerCase() ||
          cat.displayName.toLowerCase() === categoryName.toLowerCase()
        );

        // Check for duplicates in database
        const duplicate = existingProducts.find(p =>
          p.product?.toLowerCase() === item.product_name.toLowerCase()
        );

        return {
          product_name: item.product_name,
          abbreviated_name: item.abbreviated_name,
          brand: item.brand,
          price: item.price,
          quantity: item.quantity,
          size: item.size,
          included: true, // Include all items — duplicates will update existing prices
          categories: [matchedCat?.name || 'miscellaneous'],
          store: storeMatch.matched ? storeMatch.storeName : '',
          isDuplicate: !!duplicate,
          existingProductId: duplicate?.id,
        };
      });

      setReviewItems(reviewed);
      setShowReceiptReview(true);
      setScanProgress('');

      const crossPhotoDupes = allItems.length - uniqueItems.length;
      const dbDupes = reviewed.filter(i => i.isDuplicate).length;
      posthog.capture('receipt_scanned', { items_count: reviewed.length, photos_count: receiptPhotoUris.length, store: receiptStore, duplicates: dbDupes });
      console.log(`Receipt review ready: ${reviewed.length} items, ${crossPhotoDupes} cross-photo dupes removed, ${dbDupes} existing in database`);

    } catch (error: any) {
      console.error('Error processing receipt:', error);
      Alert.alert('Error', 'Failed to process receipt. Please try again.');
    } finally {
      setIsProcessing(false);
      setScanProgress('');
    }
  };

  const updateReviewItem = (index: number, updates: Partial<ReviewedReceiptItem>) => {
    setReviewItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const toggleAllItems = () => {
    const allIncluded = reviewItems.every(item => item.included);
    setReviewItems(prev => prev.map(item => ({ ...item, included: !allIncluded })));
  };

  const handleBatchSave = async () => {
    if (!receiptStore) {
      Alert.alert('Error', 'Please select a store before saving.');
      return;
    }

    const includedItems = reviewItems.filter(i => i.included);

    if (includedItems.length === 0) {
      Alert.alert('Error', 'No items selected to save. Please include at least one item.');
      return;
    }

    // Validate all included items have valid prices
    const invalidItems = includedItems.filter(i => !i.price || i.price <= 0);
    if (invalidItems.length > 0) {
      Alert.alert('Error', `${invalidItems.length} item(s) have invalid prices. Please fix them before saving.`);
      return;
    }

    // Assign the selected store to all items
    const itemsToSave = includedItems.map(item => ({
      ...item,
      store: receiptStore,
    }));

    setIsProcessing(true);

    try {
      const result = await KipriBackendService.batchSaveReceiptProducts(itemsToSave);

      const totalSuccess = result.saved + result.updated;
      if (totalSuccess > 0) {
        await cacheService.invalidateProducts();

        // Build savings comparison before resetting items
        setScanProgress('Comparing prices across stores...');
        const savings = await buildSavingsComparison(itemsToSave, receiptStore);

        // Attach save/update counts to savings data for the modal
        savings.savedCount = result.saved;
        savings.updatedCount = result.updated;

        posthog.capture('receipt_products_saved', { saved: result.saved, updated: result.updated, store: receiptStore });
        // Always show the summary modal
        setSavingsData(savings);
        setShowSavingsModal(true);
      } else {
        Alert.alert('Error', `Failed to save products. ${result.errors.join(', ')}`);
      }
    } catch (error: any) {
      console.error('Batch save error:', error);
      Alert.alert('Error', 'Failed to save products. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ==================== END RECEIPT MODE HANDLERS ====================

  const validateAndSubmit = async () => {
    // Validation
    if (!productName.trim() || !brand.trim() || !size.trim() || !price.trim() || !selectedStore || selectedCategories.length === 0) {
      Alert.alert('Error', 'Please complete all required fields: product name, brand, size, price, store, and category.');
      return;
    }

    if (!isValidPrice(price)) {
      Alert.alert('Error', 'Invalid price format. Please enter a valid amount (e.g., "Rs 12.50" or "12,50").');
      return;
    }

    if (mode === AppMode.ADD && !productImage) {
      Alert.alert('Error', 'Product image is required for adding new products. Please upload an image.');
      return;
    }

    const priceValue = getPriceValue(price);
    if (priceValue > 1000) {
      Alert.alert('Error', 'Price exceeds Rs 1000 limit. Please verify the amount and enter a valid price.');
      return;
    }

    if (priceValue > 600) {
      const confirmed = await showPriceConfirmation(priceValue);
      if (!confirmed) return;
    }

    // Submit
    if (mode === AppMode.ADD) {
      await handleAddProduct();
    } else {
      await handleUpdateProduct();
    }
  };

  const handleAddProduct = async () => {
    setIsProcessing(true);

    try {
      console.log('Adding product with integrated backend...');

      // First, check if a product with the same name and store already exists
      console.log('Checking for duplicates...');
      try {
        const existingProducts = await KipriBackendService.searchProducts(productName.trim());
        const duplicateProduct = existingProducts?.find(p =>
          p.product?.toLowerCase() === productName.trim().toLowerCase() &&
          p.store?.toLowerCase() === selectedStore.toLowerCase()
        );

        if (duplicateProduct) {
          // True duplicate found (same product name + same store) - show update suggestion
          Alert.alert(
            'Duplicate Product Found',
            `"${productName.trim()}" already exists in ${selectedStore}. Would you like to update it instead of adding a duplicate?`,
            [
              {
                text: 'Cancel',
                style: 'cancel'
              },
              {
                text: 'Switch to Update Mode',
                onPress: () => {
                  setMode(AppMode.UPDATE);
                  Alert.alert('Mode Changed', 'Switched to UPDATE mode. You can now modify the existing product.');
                }
              }
            ]
          );
          setIsProcessing(false);
          return; // Exit without saving
        }

        console.log('No duplicates found, proceeding with save...');
      } catch (searchError) {
        console.log('Duplicate check failed, proceeding with save:', searchError);
        // Continue with save attempt if duplicate check fails
      }

      // Create product object for the integrated backend
      const product = {
        product: productName.trim(),
        brand: brand.trim().toUpperCase(), // Brand in CAPITALS
        price: price.trim(),
        size: size.trim(),
        store: selectedStore,
        categories: selectedCategories.length > 0 ? selectedCategories : ['miscellaneous'],
        imageSource: productImage || undefined, // Image URI for upload
        timestamp: new Date().toISOString(),
      };

      // Use the integrated Supabase service - no server needed!
      const result = await KipriBackendService.saveProduct(product);

      if (result) {
        await cacheService.invalidateProducts();
        posthog.capture('product_added', { product: productName.trim(), store: selectedStore, price: price.trim(), categories: selectedCategories });
        Alert.alert('Success', 'Product added successfully! Your new product is now available in the price list.');
        clearForm();
      } else {
        Alert.alert('Error', 'Failed to add product. Please try again.');
      }
    } catch (error: any) {
      console.error('Error adding product:', error);
      Alert.alert('Error', 'Failed to add product. Please check your connection and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateProduct = async () => {
    setIsProcessing(true);

    try {
      console.log('Updating product with integrated backend...');

      // First, search for the existing product to get its ID
      const searchResults = await KipriBackendService.searchProducts(productName.trim());

      if (searchResults && searchResults.length > 0) {
        // Update the first matching product
        const existingProduct = searchResults[0];
        const updates = {
          product: productName.trim(),
          brand: brand.trim().toUpperCase(), // Brand in CAPITALS
          price: price.trim(),
          size: size.trim(),
          store: selectedStore,
          categories: selectedCategories.length > 0 ? selectedCategories : ['miscellaneous'],
          imageSource: productImage || undefined, // Image URI for upload
          created_at: new Date().toISOString(), // Use created_at as update timestamp
        };

        // Use the integrated Supabase service - no server needed!
        const result = await KipriBackendService.updateProduct(existingProduct.id!, updates);

        if (result) {
          await cacheService.invalidateProducts();
          posthog.capture('product_updated', { product: productName.trim(), store: selectedStore, price: price.trim() });
          Alert.alert('Success', 'Product updated successfully! The price list now reflects your changes.');
          clearForm();
        } else {
          Alert.alert('Error', 'Failed to update product. Please try again.');
        }
      } else {
        Alert.alert('Error', 'Product not found. Please check the product name spelling or use ADD to create a new product.');
      }
    } catch (error: any) {
      console.error('Error updating product:', error);
      Alert.alert('Error', 'Failed to update product. Please check your connection and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearForm = () => {
    setReceiptImage(null);
    setProductImage(null);
    setProductName('');
    setBrand('');
    setSize('');
    setPrice('');
    // Keep active store if available
    if (activeStoreName) {
      setSelectedStore(activeStoreName);
      setStoreAutoFilled(true);
    } else {
      setSelectedStore('');
    }
    setSelectedCategories([]);
  };

  const isValidPrice = (priceText: string): boolean => {
    if (!priceText) return false;
    // Remove currency symbols and spaces, but keep decimal separators
    const cleanPrice = priceText.replace(/[Rs\s]/gi, '');
    // Allow digits, single comma, or single dot as decimal separator
    return /^[\d]+([.,][\d]+)?$/.test(cleanPrice);
  };

  const getPriceValue = (priceText: string): number => {
    // Remove currency symbols and spaces, then normalize decimal separator
    const cleanPrice = priceText.replace(/[Rs\s]/gi, '').replace(',', '.');
    return parseFloat(cleanPrice) || 0;
  };

  const showPriceConfirmation = (priceValue: number): Promise<boolean> => {
    return new Promise((resolve) => {
      Alert.alert(
        'High Price Alert',
        `The entered price is Rs ${priceValue.toFixed(2)}.\n\nThis seems quite high. Please double-check the amount.\n\nIs this price correct?`,
        [
          {
            text: 'Let me check again',
            onPress: () => resolve(false),
            style: 'cancel',
          },
          {
            text: "Yes, it's correct",
            onPress: () => resolve(true),
          },
        ]
      );
    });
  };

  const toggleCategory = (categoryName: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryName)) {
        // If already selected, deselect it
        return prev.filter(c => c !== categoryName);
      } else {
        // Add this category to the selection (multi-select)
        return [...prev, categoryName];
      }
    });
  };

  // ==================== CAMERA SCANNER CALLBACKS ====================

  const handleCameraProductComplete = async (data: {
    productName: string;
    brand: string;
    size: string;
    price: string;
    categories: string[];
    priceTagImage: string;
    productImage?: string;
    store: string;
  }): Promise<boolean> => {
    try {
      if (mode === AppMode.ADD) {
        // Validate price
        if (!isValidPrice(data.price)) return false;

        const product = {
          product: data.productName.trim(),
          brand: data.brand.trim().toUpperCase(),
          price: data.price.trim(),
          size: data.size.trim(),
          store: data.store,
          categories: data.categories.length > 0 ? data.categories : ['miscellaneous'],
          imageSource: data.productImage || undefined,
          timestamp: new Date().toISOString(),
        };

        const result = await KipriBackendService.saveProduct(product);
        if (result) {
          await cacheService.invalidateProducts();
          posthog.capture('product_added', {
            product: data.productName.trim(),
            store: data.store,
            price: data.price.trim(),
            categories: data.categories,
          });
          return true;
        }
      } else if (mode === AppMode.UPDATE) {
        // Search for existing product to update
        const searchResults = await KipriBackendService.searchProducts(data.productName.trim());
        if (searchResults && searchResults.length > 0) {
          const existingProduct = searchResults[0];
          const updates = {
            product: data.productName.trim(),
            brand: data.brand.trim().toUpperCase(),
            price: data.price.trim(),
            size: data.size.trim(),
            store: data.store,
            categories: data.categories.length > 0 ? data.categories : ['miscellaneous'],
            created_at: new Date().toISOString(),
          };

          const result = await KipriBackendService.updateProduct(existingProduct.id!, updates);
          if (result) {
            await cacheService.invalidateProducts();
            posthog.capture('product_updated', {
              product: data.productName.trim(),
              store: data.store,
              price: data.price.trim(),
            });
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Camera product save error:', error);
      return false;
    }
  };

  const handleCameraReceiptPhotosReady = (photoUris: string[]) => {
    // Set the receipt photos and trigger processing
    setReceiptPhotoUris(photoUris);
    // Immediately trigger the receipt scan process
    handleReceiptScanFromCamera(photoUris);
  };

  const handleReceiptScanFromCamera = async (photoUris: string[]) => {
    setIsProcessing(true);
    setScanProgress('');

    try {
      const allItems: { product_name: string; abbreviated_name: string; brand: string; price: number; quantity: number; size: string }[] = [];
      let detectedStoreName = '';

      for (let i = 0; i < photoUris.length; i++) {
        setScanProgress(`Scanning photo ${i + 1} of ${photoUris.length}...`);
        const result = await BackendReplicaService.processReceipt(photoUris[i]);
        if (result.success && result.data) {
          if (!detectedStoreName && result.data.store_name) {
            detectedStoreName = result.data.store_name;
          }
          allItems.push(...result.data.items);
        }
      }

      if (allItems.length === 0) {
        Alert.alert('Error', 'No items could be extracted. Please try again with clearer images.');
        setIsProcessing(false);
        setScanProgress('');
        setShowModeSelection(true);
        return;
      }

      // Deduplicate
      setScanProgress('Removing duplicates...');
      const uniqueItems: typeof allItems = [];
      const seenNames = new Set<string>();
      for (const item of allItems) {
        const norm = item.product_name.trim().toLowerCase();
        if (!seenNames.has(norm)) {
          seenNames.add(norm);
          uniqueItems.push(item);
        }
      }

      // Match store
      const storeMatch = StoreMatchingService.matchStoreName(detectedStoreName);
      if (storeMatch.matched) {
        setReceiptStore(storeMatch.storeName);
        setStoreAutoFilled(false);
      } else if (activeStoreName) {
        setReceiptStore(activeStoreName);
        setStoreAutoFilled(true);
      } else {
        setReceiptStore('');
      }

      // Categorize
      setScanProgress('Categorizing items...');
      const productNames = uniqueItems.map(item => item.product_name);
      let categoryResults;
      try {
        categoryResults = await OpenAiService.batchCategorizeTexts(productNames);
      } catch {
        categoryResults = productNames.map(() => OpenAiService.quickCategorize(''));
      }

      // Check duplicates
      setScanProgress('Checking for existing products...');
      let existingProducts: any[] = [];
      if (storeMatch.matched) {
        try {
          const storeProducts = await KipriBackendService.getProducts({
            filters: { store: storeMatch.storeName },
            limit: 500,
          });
          existingProducts = storeProducts || [];
        } catch {}
      }

      // Build review items
      const reviewed: ReviewedReceiptItem[] = uniqueItems.map((item, index) => {
        const catResult = categoryResults[index];
        const categoryName = catResult?.isFood && catResult.confidence > 0.5
          ? catResult.category : 'miscellaneous';
        const matchedCat = CATEGORIES.find(cat =>
          cat.name.toLowerCase() === categoryName.toLowerCase() ||
          cat.displayName.toLowerCase() === categoryName.toLowerCase(),
        );
        const duplicate = existingProducts.find(p =>
          p.product?.toLowerCase() === item.product_name.toLowerCase(),
        );

        return {
          product_name: item.product_name,
          abbreviated_name: item.abbreviated_name,
          brand: item.brand,
          price: item.price,
          quantity: item.quantity,
          size: item.size,
          included: true,
          categories: [matchedCat?.name || 'miscellaneous'],
          store: storeMatch.matched ? storeMatch.storeName : '',
          isDuplicate: !!duplicate,
          existingProductId: duplicate?.id,
        };
      });

      setReviewItems(reviewed);
      setShowReceiptReview(true);
      setScanProgress('');
      posthog.capture('receipt_scanned', {
        items_count: reviewed.length,
        photos_count: photoUris.length,
        store: receiptStore,
        duplicates: reviewed.filter(i => i.isDuplicate).length,
      });
    } catch (error) {
      console.error('Error processing receipt:', error);
      Alert.alert('Error', 'Failed to process receipt. Please try again.');
      setShowModeSelection(true);
    } finally {
      setIsProcessing(false);
      setScanProgress('');
    }
  };

  const handleCameraCancel = () => {
    setShowModeSelection(true);
  };

  // ==================== SAVINGS COMPARISON MODAL ====================
  const renderSavingsModal = () => {
    if (!savingsData) return null;

    const hasComparisons = savingsData.comparisons.length > 0;
    const newCount = savingsData.savedCount || 0;
    const updatedCount = savingsData.updatedCount || 0;

    // Find cheapest other store
    const cheapestOther = hasComparisons
      ? savingsData.comparisons.reduce((best, c) => c.total < best.total ? c : best, savingsData.comparisons[0])
      : null;

    // Find most expensive other store
    const mostExpensiveOther = hasComparisons
      ? savingsData.comparisons.reduce((worst, c) => c.total > worst.total ? c : worst, savingsData.comparisons[0])
      : null;

    // Calculate savings score (0-100)
    // 100 = you got the absolute best deal, 0 = you overpaid the most
    let savingsScore = 50; // default when no comparisons
    let userDidBest = true;
    let savingsAmount = 0;

    if (hasComparisons && cheapestOther && mostExpensiveOther) {
      const allTotals = [savingsData.userTotal, ...savingsData.comparisons.map(c => c.total)];
      const minTotal = Math.min(...allTotals);
      const maxTotal = Math.max(...allTotals);
      const range = maxTotal - minTotal;

      if (range > 0) {
        // Score: 100 if user got cheapest, 0 if most expensive
        savingsScore = Math.round(((maxTotal - savingsData.userTotal) / range) * 100);
      } else {
        savingsScore = 100; // all prices are the same
      }

      userDidBest = savingsData.userTotal <= cheapestOther.total;
      savingsAmount = Math.abs(savingsData.userTotal - cheapestOther.total);
    }

    // Score label and color
    const getScoreLabel = (score: number) => {
      if (score >= 90) return 'Excellent';
      if (score >= 70) return 'Great';
      if (score >= 50) return 'Good';
      if (score >= 30) return 'Fair';
      return 'Needs Improvement';
    };

    const getScoreColor = (score: number) => {
      if (score >= 70) return '#10b981';
      if (score >= 40) return '#f59e0b';
      return '#ef4444';
    };

    const scoreColor = getScoreColor(savingsScore);
    const headerColor = !hasComparisons ? '#10b981' : scoreColor;

    return (
      <Modal
        visible={showSavingsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={dismissSavingsModal}
      >
        <View style={savingsStyles.overlay}>
          <View style={[savingsStyles.container, { backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF' }]}>
            {/* Header */}
            <View style={[savingsStyles.header, { backgroundColor: headerColor }]}>
              {hasComparisons ? (
                <>
                  <Text style={savingsStyles.headerEmoji}>
                    {savingsScore >= 70 ? '🎉' : (savingsScore >= 40 ? '👍' : '💡')}
                  </Text>
                  <Text style={savingsStyles.headerTitle}>
                    {getScoreLabel(savingsScore)}!
                  </Text>
                  <Text style={savingsStyles.headerSubtitle}>
                    {userDidBest
                      ? `You picked the best store and saved Rs ${savingsAmount.toFixed(2)}!`
                      : `You could have saved Rs ${savingsAmount.toFixed(2)} at ${cheapestOther!.storeName}`
                    }
                  </Text>
                </>
              ) : (
                <>
                  <Text style={savingsStyles.headerEmoji}>✅</Text>
                  <Text style={savingsStyles.headerTitle}>Products Saved!</Text>
                  <Text style={savingsStyles.headerSubtitle}>
                    {savingsData.itemCount} item{savingsData.itemCount !== 1 ? 's' : ''} processed at {savingsData.userStore}
                  </Text>
                </>
              )}
            </View>

            <ScrollView style={savingsStyles.body} showsVerticalScrollIndicator={false}>
              {/* Save/Update summary */}
              <View style={[savingsStyles.actionSummary, {
                backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#F8FAFC',
                borderColor: colors.border,
              }]}>
                {newCount > 0 && (
                  <View style={savingsStyles.actionRow}>
                    <Text style={savingsStyles.actionIcon}>🆕</Text>
                    <Text style={[savingsStyles.actionText, { color: colors.text }]}>
                      {newCount} new product{newCount !== 1 ? 's' : ''} added
                    </Text>
                  </View>
                )}
                {updatedCount > 0 && (
                  <View style={savingsStyles.actionRow}>
                    <Text style={savingsStyles.actionIcon}>🔄</Text>
                    <Text style={[savingsStyles.actionText, { color: colors.text }]}>
                      {updatedCount} price{updatedCount !== 1 ? 's' : ''} updated
                    </Text>
                  </View>
                )}
              </View>

              {/* Savings Score — only when comparisons exist */}
              {hasComparisons && (
                <View style={[savingsStyles.scoreContainer, {
                  backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#FFFFFF',
                  borderColor: scoreColor,
                }]}>
                  <Text style={[savingsStyles.scoreLabel, { color: colors.text + '80' }]}>SAVINGS SCORE</Text>
                  <Text style={[savingsStyles.scoreNumber, { color: scoreColor }]}>{savingsScore}</Text>
                  <Text style={[savingsStyles.scoreOutOf, { color: colors.text + '60' }]}>/100</Text>
                  <View style={savingsStyles.scoreBarBackground}>
                    <View style={[savingsStyles.scoreBarFill, {
                      width: `${savingsScore}%`,
                      backgroundColor: scoreColor,
                    }]} />
                  </View>
                </View>
              )}

              {/* Your store card */}
              <View style={[savingsStyles.storeCard, savingsStyles.userStoreCard, {
                borderColor: headerColor,
                backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#F0FDF4',
              }]}>
                <View style={savingsStyles.storeCardHeader}>
                  <Text style={[savingsStyles.storeName, { color: colors.text }]}>
                    {savingsData.userStore}
                  </Text>
                  <View style={[savingsStyles.youBadge, { backgroundColor: headerColor }]}>
                    <Text style={savingsStyles.youBadgeText}>You shopped here</Text>
                  </View>
                </View>
                <Text style={[savingsStyles.storeTotal, { color: colors.text }]}>
                  Rs {savingsData.userTotal.toFixed(2)}
                </Text>
                <Text style={[savingsStyles.storeItemCount, { color: colors.text + '80' }]}>
                  {savingsData.itemCount} item{savingsData.itemCount !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Comparison stores */}
              {hasComparisons && (
                <>
                  <Text style={[savingsStyles.comparisonTitle, { color: colors.text + '99' }]}>
                    SAME ITEMS AT OTHER STORES
                  </Text>

                  {savingsData.comparisons
                    .sort((a, b) => a.total - b.total)
                    .map((comp) => {
                      const diff = savingsData.userTotal - comp.total;
                      const isMoreExpensive = diff < 0;
                      const isCheaper = diff > 0;

                      return (
                        <View
                          key={comp.storeName}
                          style={[savingsStyles.storeCard, {
                            borderColor: isCheaper ? '#10b981' : (isMoreExpensive ? '#ef4444' : colors.border),
                            backgroundColor: colorScheme === 'dark' ? '#0F172A' : '#FFFFFF',
                          }]}
                        >
                          <View style={savingsStyles.storeCardHeader}>
                            <Text style={[savingsStyles.storeName, { color: colors.text }]}>
                              {comp.storeName}
                            </Text>
                            {isCheaper && (
                              <View style={[savingsStyles.diffBadge, { backgroundColor: '#DCFCE7' }]}>
                                <Text style={[savingsStyles.diffBadgeText, { color: '#166534' }]}>
                                  Rs {Math.abs(diff).toFixed(2)} cheaper
                                </Text>
                              </View>
                            )}
                            {isMoreExpensive && (
                              <View style={[savingsStyles.diffBadge, { backgroundColor: '#FEE2E2' }]}>
                                <Text style={[savingsStyles.diffBadgeText, { color: '#991B1B' }]}>
                                  Rs {Math.abs(diff).toFixed(2)} more
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[savingsStyles.storeTotal, { color: colors.text }]}>
                            Rs {comp.total.toFixed(2)}
                          </Text>
                          <Text style={[savingsStyles.storeItemCount, { color: colors.text + '80' }]}>
                            {comp.matchedItems} of {savingsData.itemCount} items matched
                          </Text>
                        </View>
                      );
                    })}

                  {/* Verdict */}
                  <View style={[savingsStyles.verdictCard, {
                    backgroundColor: savingsScore >= 50
                      ? (colorScheme === 'dark' ? '#064E3B' : '#ECFDF5')
                      : (colorScheme === 'dark' ? '#78350F' : '#FFFBEB'),
                  }]}>
                    <Text style={[savingsStyles.verdictText, {
                      color: savingsScore >= 50
                        ? (colorScheme === 'dark' ? '#A7F3D0' : '#065F46')
                        : (colorScheme === 'dark' ? '#FDE68A' : '#92400E'),
                    }]}>
                      {userDidBest
                        ? `${savingsData.userStore} was the cheapest option for your basket. Keep shopping here to save!`
                        : `Next time, try ${cheapestOther!.storeName} for these items — you'd save Rs ${savingsAmount.toFixed(2)} (${cheapestOther!.matchedItems} items compared).`
                      }
                    </Text>
                  </View>
                </>
              )}

              {/* No comparisons tip */}
              {!hasComparisons && (
                <View style={[savingsStyles.verdictCard, {
                  backgroundColor: colorScheme === 'dark' ? '#1E3A5F' : '#EFF6FF',
                }]}>
                  <Text style={[savingsStyles.verdictText, {
                    color: colorScheme === 'dark' ? '#93C5FD' : '#1E40AF',
                  }]}>
                    Scan receipts from your other stores too — Kipri will compare prices and score your savings!
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Dismiss button */}
            <TouchableOpacity
              ph-label="Savings Dismiss"
              style={[savingsStyles.dismissButton, { backgroundColor: headerColor }]}
              onPress={dismissSavingsModal}
            >
              <Text style={savingsStyles.dismissButtonText}>GOT IT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ==================== MODE SELECTION SCREEN ====================
  if (showModeSelection) {
    return (
      <LinearGradient
        colors={colorScheme === 'dark' ? ['#0F172A', '#1E293B', '#334155'] : ['#f5f5f5', '#f2f2f2', '#f3f3f3']}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        <Animated.View style={[
          styles.modeSelectionContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}>
          {/* Header */}
          <View style={styles.modeTitleContainer}>
            <Text style={[styles.kipriLogoLarge, { color: colors.primary }]}>Kipri</Text>
            <Text style={[styles.modeTitle, { color: colors.text }]}>Scanner</Text>
          </View>

          {/* Hero: Scan Receipt */}
          <TouchableOpacity
            ph-label="Scan Receipt Mode"
            style={styles.heroReceiptButton}
            onPress={() => selectMode(AppMode.RECEIPT)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={styles.heroReceiptGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.heroReceiptIcon}>🧾</Text>
              <Text style={styles.heroReceiptTitle}>SCAN RECEIPT</Text>
              <Text style={styles.heroReceiptSubtitle}>
                Photograph your receipt and add all products at once
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Secondary: Add & Update */}
          <View style={styles.secondaryButtonsRow}>
            <TouchableOpacity
              ph-label="Add Product Mode"
              style={styles.secondaryButton}
              onPress={() => selectMode(AppMode.ADD)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, colors.primary + 'DD']}
                style={styles.secondaryButtonGradient}
              >
                <Text style={styles.secondaryButtonIcon}>+</Text>
                <Text style={styles.secondaryButtonText}>ADD</Text>
                <Text style={[styles.secondaryButtonSub, { color: 'rgba(255,255,255,0.7)' }]}>Single item</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              ph-label="Update Product Mode"
              style={styles.secondaryButton}
              onPress={() => selectMode(AppMode.UPDATE)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#f59e0b', '#d97706']}
                style={styles.secondaryButtonGradient}
              >
                <Text style={styles.secondaryButtonIcon}>↻</Text>
                <Text style={styles.secondaryButtonText}>UPDATE</Text>
                <Text style={[styles.secondaryButtonSub, { color: 'rgba(255,255,255,0.7)' }]}>Edit price</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Scanner onboarding tip overlay */}
        {showScannerTip && pendingMode && (
          <ScannerTipOverlay
            mode={pendingMode}
            onDismiss={handleScannerTipDismiss}
          />
        )}
      </LinearGradient>
    );
  }

  // ==================== RECEIPT REVIEW SCREEN ====================
  if (mode === AppMode.RECEIPT && showReceiptReview) {
    const includedCount = reviewItems.filter(i => i.included && !i.isDuplicate).length;
    const totalCount = reviewItems.length;

    return (
      <LinearGradient
        colors={colorScheme === 'dark' ? ['#0F172A', '#1E293B', '#334155'] : ['#f5f5f5', '#f2f2f2', '#f3f3f3']}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        {renderSavingsModal()}
        <BlurView style={styles.header} tint={colorScheme || 'light'} intensity={80}>
          <TouchableOpacity
            ph-label="Back From Review"
            style={[styles.backButton, { backgroundColor: '#10b981' }]}
            onPress={() => {
              setShowReceiptReview(false);
              setReviewItems([]);
            }}
          >
            <Text style={styles.backButtonText}>{"<"}</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.kipriHeaderLogo, { color: '#10b981' }]}>Kipri</Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Review Receipt</Text>
          </View>
          <View style={styles.headerSpacer} />
        </BlurView>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Store Selection */}
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Store</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storeSelector}>
                {preferredStoreNames.map((store) => (
                  <TouchableOpacity
                    key={store}
                    ph-label="Receipt Store Select"
                    style={[
                      styles.storeChip,
                      {
                        backgroundColor: receiptStore === store ? '#10b981' : colors.card,
                        borderColor: receiptStore === store ? '#10b981' : colors.border,
                      }
                    ]}
                    onPress={() => { setReceiptStore(store); setActiveStore(store); setStoreAutoFilled(false); setShowOtherStores(false); }}
                  >
                    <Text style={[
                      styles.storeChipText,
                      {
                        color: receiptStore === store ? 'white' : colors.text,
                      }
                    ]}>
                      {store}
                    </Text>
                  </TouchableOpacity>
                ))}
                {/* Other button */}
                <TouchableOpacity
                  ph-label="Show Other Stores"
                  style={[
                    styles.storeChip,
                    {
                      backgroundColor: showOtherStores && !preferredStoreNames.includes(receiptStore) && receiptStore
                        ? '#10b981' : colors.card,
                      borderColor: showOtherStores ? '#10b981' : colors.border,
                      borderStyle: 'dashed' as any,
                    }
                  ]}
                  onPress={loadAllStores}
                >
                  <Text style={[
                    styles.storeChipText,
                    {
                      color: showOtherStores && !preferredStoreNames.includes(receiptStore) && receiptStore
                        ? 'white' : colors.text,
                    }
                  ]}>
                    Other...
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Expanded "Other" store list */}
              {showOtherStores && (
                <View style={[styles.otherStoresContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.otherStoresTitle, { color: colors.text }]}>All stores</Text>
                  <View style={styles.otherStoresGrid}>
                    {allStores
                      .filter(s => !preferredStoreNames.includes(s.name))
                      .map((store) => (
                        <TouchableOpacity
                          key={store.id}
                          ph-label="Select Other Store"
                          style={[
                            styles.otherStoreChip,
                            {
                              backgroundColor: receiptStore === store.name ? '#10b981' : 'transparent',
                              borderColor: receiptStore === store.name ? '#10b981' : colors.border,
                            }
                          ]}
                          onPress={() => { setReceiptStore(store.name); setActiveStore(store.name); setStoreAutoFilled(false); }}
                        >
                          <Text style={[
                            styles.otherStoreChipText,
                            { color: receiptStore === store.name ? 'white' : colors.text }
                          ]}>
                            {store.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>
              )}

              {/* Subtle auto-selected indicator */}
              {storeAutoFilled && receiptStore && (
                <Text style={[styles.autoFilledHint, { color: colors.text + '60' }]}>
                  Auto-selected from your current session
                </Text>
              )}
            </View>

            {/* Summary Bar */}
            <View style={[styles.summaryBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.summaryText, { color: colors.text }]}>
                {includedCount} of {totalCount} items selected
              </Text>
              <TouchableOpacity ph-label="Toggle All Items" onPress={toggleAllItems}>
                <Text style={[styles.toggleAllText, { color: '#10b981' }]}>
                  {reviewItems.every(i => i.included) ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Item Cards */}
            {reviewItems.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.receiptItemCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: item.isDuplicate ? '#f59e0b' : (item.included ? '#10b981' : colors.border),
                    opacity: item.included ? 1 : 0.6,
                  }
                ]}
              >
                {/* Top Row: Checkbox + Product Name */}
                <View style={styles.receiptItemHeader}>
                  <TouchableOpacity
                    ph-label="Receipt Item Toggle"
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: item.included ? '#10b981' : 'transparent',
                        borderColor: item.included ? '#10b981' : colors.border,
                      }
                    ]}
                    onPress={() => updateReviewItem(index, { included: !item.included })}
                  >
                    {item.included && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>

                  <View style={styles.receiptItemNameContainer}>
                    <TextInput
                      style={[styles.receiptItemNameInput, { color: colors.text, borderColor: colors.border }]}
                      value={item.product_name}
                      onChangeText={(text) => updateReviewItem(index, { product_name: text })}
                    />
                    {item.abbreviated_name !== item.product_name && (
                      <Text style={[styles.abbreviatedName, { color: colors.text + '80' }]}>
                        Receipt: {item.abbreviated_name}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Duplicate — will update existing price */}
                {item.isDuplicate && (
                  <View style={[styles.duplicateBadge, { backgroundColor: '#DBEAFE' }]}>
                    <Text style={[styles.duplicateBadgeText, { color: '#1E40AF' }]}>Will update price</Text>
                  </View>
                )}

                {/* Fields Row: Price, Brand, Size */}
                <View style={styles.receiptFieldsRow}>
                  <View style={styles.receiptFieldSmall}>
                    <Text style={[styles.receiptFieldLabel, { color: colors.text + '80' }]}>Price</Text>
                    <TextInput
                      style={[styles.receiptFieldInput, { color: colors.text, borderColor: colors.border }]}
                      value={item.price.toString()}
                      onChangeText={(text) => updateReviewItem(index, { price: parseFloat(text) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.receiptFieldSmall}>
                    <Text style={[styles.receiptFieldLabel, { color: colors.text + '80' }]}>Brand</Text>
                    <TextInput
                      style={[styles.receiptFieldInput, { color: colors.text, borderColor: colors.border }]}
                      value={item.brand}
                      onChangeText={(text) => updateReviewItem(index, { brand: text.toUpperCase() })}
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={styles.receiptFieldSmall}>
                    <Text style={[styles.receiptFieldLabel, { color: colors.text + '80' }]}>Size</Text>
                    <TextInput
                      style={[styles.receiptFieldInput, { color: colors.text, borderColor: colors.border }]}
                      value={item.size}
                      onChangeText={(text) => updateReviewItem(index, { size: text })}
                    />
                  </View>
                </View>

                {/* Category Chip */}
                <View style={styles.receiptCategoryRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat.name}
                        ph-label="Receipt Item Category"
                        style={[
                          styles.receiptCategoryChip,
                          {
                            backgroundColor: item.categories.includes(cat.name) ? '#10b981' : 'transparent',
                            borderColor: item.categories.includes(cat.name) ? '#10b981' : colors.border,
                          }
                        ]}
                        onPress={() => updateReviewItem(index, { categories: [cat.name] })}
                      >
                        <Text style={styles.receiptCategoryEmoji}>{cat.emoji}</Text>
                        <Text style={[
                          styles.receiptCategoryText,
                          { color: item.categories.includes(cat.name) ? 'white' : colors.text }
                        ]}>
                          {cat.displayName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            ))}
            {/* Save Button */}
            <TouchableOpacity
              ph-label="Save Receipt Items"
              style={[
                styles.batchSaveButton,
                {
                  backgroundColor: isProcessing || !receiptStore || includedCount === 0 ? '#9CA3AF' : '#10b981',
                  opacity: isProcessing ? 0.6 : 1,
                }
              ]}
              onPress={handleBatchSave}
              disabled={isProcessing || !receiptStore || includedCount === 0}
            >
              {isProcessing ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.batchSaveButtonText}>
                  SAVE {includedCount} ITEM{includedCount !== 1 ? 'S' : ''} TO KIPRI
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    );
  }

  // ==================== RECEIPT CAPTURE → CAMERA UI ====================
  if (mode === AppMode.RECEIPT && !showReceiptReview) {
    // Show processing screen while receipt is being analyzed
    if (isProcessing) {
      return (
        <LinearGradient
          colors={colorScheme === 'dark' ? ['#0F172A', '#1E293B', '#334155'] : ['#f5f5f5', '#f2f2f2', '#f3f3f3']}
          style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}
        >
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.processingText, { color: colors.text, marginTop: 16 }]}>
            {scanProgress || 'Processing receipt...'}
          </Text>
        </LinearGradient>
      );
    }

    return (
      <CameraScannerView
        mode={AppMode.RECEIPT}
        activeStoreName={activeStoreName}
        setActiveStore={setActiveStore}
        preferredStoreNames={preferredStoreNames}
        onProductComplete={handleCameraProductComplete}
        onReceiptPhotosReady={handleCameraReceiptPhotosReady}
        onCancel={handleCameraCancel}
        colors={colors}
        colorScheme={colorScheme}
      />
    );
  }

  // ==================== ADD/UPDATE → CAMERA UI ====================
  return (
    <CameraScannerView
      mode={mode}
      activeStoreName={activeStoreName}
      setActiveStore={setActiveStore}
      preferredStoreNames={preferredStoreNames}
      onProductComplete={handleCameraProductComplete}
      onReceiptPhotosReady={handleCameraReceiptPhotosReady}
      onCancel={handleCameraCancel}
      colors={colors}
      colorScheme={colorScheme}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modeSelectionContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  modeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 32,
  },
  kipriLogoLarge: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  modeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  heroReceiptButton: {
    width: '100%',
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    marginBottom: 24,
  },
  heroReceiptGradient: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: 'center',
  },
  heroReceiptIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  heroReceiptTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 8,
  },
  heroReceiptSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  secondaryButtonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 14,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  secondaryButtonGradient: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryButtonIcon: {
    color: 'white',
    fontSize: 28,
    fontWeight: '300',
    marginBottom: 8,
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  secondaryButtonSub: {
    fontSize: 11,
    marginTop: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  backButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  kipriHeaderLogo: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.8,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  imagePickerContainer: {
    width: 120,
    height: 120,
    borderRadius: 120,
    borderWidth: Platform.OS === 'android' ? 0 : 3,
    borderColor: 'transparent',
    borderStyle: Platform.OS === 'android' ? 'solid' : 'dashed',
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: Platform.OS === 'android' ? 0 : 4,
    ...(Platform.OS === 'android' && {
      needsOffscreenAlphaCompositing: false,
    }),
  },
  pickedImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  imagePlaceholderText: {
    fontSize: 12,
    textAlign: 'center',
  },
  scanButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  scanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  categoriesInputGroup: {
    marginTop: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  storeSelector: {
    flexDirection: 'row',
  },
  storeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  storeChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  autoFilledHint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 6,
    paddingLeft: 4,
  },
  categoriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  productImageContainer: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  productImagePreview: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  addImageText: {
    fontSize: 14,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  // ==================== RECEIPT MODE STYLES ====================
  receiptCaptureScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: 'center',
    flexGrow: 1,
  },
  receiptImagePicker: {
    width: '100%',
    height: 350,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 30,
  },
  receiptPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  receiptPlaceholderIcon: {
    fontSize: 80,
    marginBottom: 16,
  },
  receiptPlaceholderText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  receiptPlaceholderSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  photoCountLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
    marginBottom: 12,
  },
  photoThumbnailWrapper: {
    width: 100,
    height: 130,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  photoNumberBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#10b981',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoNumberText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  photoRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  addMorePhotoButton: {
    width: 100,
    height: 130,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMorePhotoIcon: {
    fontSize: 32,
    color: '#10b981',
    fontWeight: '300',
  },
  addMorePhotoText: {
    fontSize: 11,
    marginTop: 4,
  },
  multiPhotoHint: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  scanReceiptButton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  scanReceiptButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  processingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Receipt Review Styles
  otherStoresContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  otherStoresTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  otherStoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  otherStoreChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  otherStoreChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  toggleAllText: {
    fontSize: 14,
    fontWeight: '700',
  },
  receiptItemCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  receiptItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  receiptItemNameContainer: {
    flex: 1,
  },
  receiptItemNameInput: {
    fontSize: 15,
    fontWeight: '600',
    borderBottomWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  abbreviatedName: {
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
  duplicateBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginLeft: 36,
  },
  duplicateBadgeText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '600',
  },
  receiptFieldsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    marginLeft: 36,
  },
  receiptFieldSmall: {
    flex: 1,
  },
  receiptFieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  receiptFieldInput: {
    fontSize: 13,
    borderBottomWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  receiptCategoryRow: {
    marginLeft: 36,
  },
  receiptCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 6,
  },
  receiptCategoryEmoji: {
    fontSize: 12,
    marginRight: 3,
  },
  receiptCategoryText: {
    fontSize: 10,
    fontWeight: '500',
  },
  batchSaveButton: {
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  batchSaveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

const savingsStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  header: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  body: {
    padding: 20,
  },
  storeCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 12,
  },
  userStoreCard: {
    borderWidth: 2,
  },
  storeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  storeName: {
    fontSize: 17,
    fontWeight: '700',
  },
  youBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  youBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  diffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  diffBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  storeTotal: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 2,
  },
  storeItemCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  comparisonTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 12,
  },
  verdictCard: {
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  verdictText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  dismissButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  dismissButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  actionSummary: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  scoreContainer: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  scoreNumber: {
    fontSize: 56,
    fontWeight: '900',
    lineHeight: 62,
  },
  scoreOutOf: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  scoreBarBackground: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});

export default ScannerScreen;
