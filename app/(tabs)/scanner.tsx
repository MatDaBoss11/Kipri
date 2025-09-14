import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, STORES } from '../../constants/categories';
import BackendReplicaService from '../../services/BackendReplicaService';
import DataCacheService from '../../services/DataCacheService';
import KipriBackendService from '../../services/KipriBackendService';
import { AppMode } from '../../types';

const ScannerScreen = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const params = useLocalSearchParams();

  const [showModeSelection, setShowModeSelection] = useState(!params.mode);
  const [mode, setMode] = useState<AppMode>(
    params.mode === 'update' ? AppMode.UPDATE : AppMode.ADD
  );
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form states
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

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

  const selectMode = (selectedMode: AppMode) => {
    setMode(selectedMode);
    setShowModeSelection(false);
  };

  // Update pickReceiptImage to use the camera
  const pickReceiptImage = async () => {
    try {
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
    } catch (error) {
      console.error('Error capturing receipt image:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    }
  };

  // Update pickProductImage to use the camera
  const pickProductImage = async () => {
    try {
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
    } catch (error) {
      console.error('Error capturing product image:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    }
  };

  const handleScan = async () => {
    if (!receiptImage) {
      Alert.alert('Error', '📸 Please capture a receipt image first to scan the product details.');
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
          console.log('✅ Auto-filled product name:', product.product_name);
        }
        
        if (product.price) {
          setPrice(product.price);
          console.log('✅ Auto-filled price:', product.price);
        }
        
        if (product.size) {
          setSize(product.size);
          console.log('✅ Auto-filled size:', product.size);
        }
        
        // Reset store first
        setSelectedStore('');
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
                console.log(`✅ Auto-detected category: ${categoryMatch.displayName} (${confidence}% confidence)`);

                Alert.alert(
                  'Success',
                  `🎯 Scan complete! Auto-detected category: ${categoryMatch.displayName} (${confidence}% confidence). Please select a store before submitting.`
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
                  console.log(`✅ Mapped to category: ${fallbackCategory.displayName}`);

                  Alert.alert(
                    'Success',
                    `🎯 Scan complete! Detected similar category: ${fallbackCategory.displayName}. Please review and select a store before submitting.`
                  );
                } else {
                  Alert.alert(
                    'Success',
                    '🎯 Scan complete! Product details extracted. Please manually select a category and store before submitting.'
                  );
                }
              }
            } else {
              Alert.alert(
                'Success',
                '🎯 Scan complete! Product details extracted. Could not auto-detect category - please select manually along with a store.'
              );
            }
          } catch (categoryError) {
            console.error('Category detection failed:', categoryError);
            Alert.alert(
              'Success',
              '🎯 Scan complete! Product details extracted. Category auto-detection failed - please select manually along with a store.'
            );
          }
        } else {
          Alert.alert(
            'Success',
            '🎯 Scan complete! Some details extracted. Please review and select a category and store before submitting.'
          );
        }
      } else {
        Alert.alert('Info', '🔍 No clear product information found in the image. Please check the image quality and try again, or enter details manually.');
        
        // Log the error for debugging
        if (result.error) {
          console.error('BackendReplicaService error:', result.error);
        }
      }
    } catch (error: any) {
      console.error('Error processing image:', error);
      Alert.alert('Error', '🤖 AI processing failed. Please check the image quality or try again later.');
    } finally {
      setIsProcessing(false);
    }
  };


  const validateAndSubmit = async () => {
    // Validation
    if (!productName.trim() || !size.trim() || !price.trim() || !selectedStore || selectedCategories.length === 0) {
      Alert.alert('Error', '📝 Please complete all required fields: product name, size, price, store, and category.');
      return;
    }

    if (!isValidPrice(price)) {
      Alert.alert('Error', '💰 Invalid price format. Please enter a valid amount (e.g., "Rs 12.50" or "12,50").');
      return;
    }

    if (mode === AppMode.ADD && !productImage) {
      Alert.alert('Error', '🖼️ Product image is required for adding new products. Please upload an image.');
      return;
    }

    const priceValue = getPriceValue(price);
    if (priceValue > 1000) {
      Alert.alert('Error', '💰 Price exceeds Rs 1000 limit. Please verify the amount and enter a valid price.');
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
            `📝 "${productName.trim()}" already exists in ${selectedStore}. Would you like to update it instead of adding a duplicate?`,
            [
              {
                text: 'Cancel',
                style: 'cancel'
              },
              {
                text: 'Switch to Update Mode',
                onPress: () => {
                  setMode(AppMode.UPDATE);
                  Alert.alert('Mode Changed', '🔄 Switched to UPDATE mode. You can now modify the existing product.');
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
        price: price.trim(),
        size: size.trim(),
        store: selectedStore,
        category: selectedCategories[0] || 'miscellaneous',
        imageSource: productImage || undefined, // Image URI for upload
        timestamp: new Date().toISOString(),
      };
      
      // Use the integrated Supabase service - no server needed!
      const result = await KipriBackendService.saveProduct(product);
      
      if (result) {
        await cacheService.invalidateProducts();
        Alert.alert('Success', '🎉 Product added successfully! Your new product is now available in the price list.');
        clearForm();
      } else {
        Alert.alert('Error', '❌ Failed to add product. Please try again.');
      }
    } catch (error: any) {
      console.error('Error adding product:', error);
      Alert.alert('Error', '❌ Failed to add product. Please check your connection and try again.');
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
          price: price.trim(),
          size: size.trim(),
          store: selectedStore,
          category: selectedCategories[0] || 'miscellaneous',
          imageSource: productImage || undefined, // Image URI for upload
          created_at: new Date().toISOString(), // Use created_at as update timestamp
        };
        
        // Use the integrated Supabase service - no server needed!
        const result = await KipriBackendService.updateProduct(existingProduct.id!, updates);
        
        if (result) {
          await cacheService.invalidateProducts();
          Alert.alert('Success', '✅ Product updated successfully! The price list now reflects your changes.');
          clearForm();
        } else {
          Alert.alert('Error', '❌ Failed to update product. Please try again.');
        }
      } else {
        Alert.alert('Error', '🔍 Product not found. Please check the product name spelling or use ADD to create a new product.');
      }
    } catch (error: any) {
      console.error('Error updating product:', error);
      Alert.alert('Error', '❌ Failed to update product. Please check your connection and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Note: Error handling is now integrated into the individual functions above

  const clearForm = () => {
    setReceiptImage(null);
    setProductImage(null);
    setProductName('');
    setSize('');
    setPrice('');
    setSelectedStore('');
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
        '⚠️ High Price Alert',
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
        // If already selected, deselect it (single select)
        return [];
      } else {
        // Select this category and deselect all others (single select)
        return [categoryName];
      }
    });
  };

  if (showModeSelection) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Animated.View style={[
          styles.modeSelectionContainer,
          { 
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}>
          <View style={styles.iconContainer}>
            <Text style={styles.scannerIcon}>📱</Text>
          </View>
          
          <Text style={[styles.modeTitle, { color: colors.text }]}>Product Scanner</Text>
          
          <View style={styles.modeButtonsContainer}>
            <TouchableOpacity
              style={[styles.modeButton, { backgroundColor: colors.primary }]}
              onPress={() => selectMode(AppMode.ADD)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, colors.primary + 'DD']}
                style={styles.modeButtonGradient}
              >
                <Text style={styles.modeButtonText}>ADD PRODUCT</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modeButton, { backgroundColor: colors.background }]}
              onPress={() => selectMode(AppMode.UPDATE)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#f59e0b', '#d97706']}
                style={styles.modeButtonGradient}
              >
                <Text style={styles.modeButtonText}>UPDATE PRODUCT</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <BlurView style={styles.header} tint={colorScheme || 'light'} intensity={80}>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowModeSelection(true)}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {mode === AppMode.ADD ? 'Add Product' : 'Update Product'}
        </Text>
        <View style={styles.headerSpacer} />
      </BlurView>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Receipt Image Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.imagePickerContainer, { borderColor: colors.border }]}
            onPress={pickReceiptImage}
          >
            {receiptImage ? (
              <Image source={{ uri: receiptImage }} style={styles.pickedImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.cameraIcon}>📷</Text>
                <Text style={[styles.imagePlaceholderText, { color: colors.text }]}>
                  Tap to capture price tag
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.scanButton,
              { 
                backgroundColor: isProcessing ? colors.background : colors.primary,
                opacity: isProcessing ? 0.6 : 1
              }
            ]}
            onPress={handleScan}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.scanButtonText}>SCAN & DETECT</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Product Name</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              value={productName}
              onChangeText={setProductName}
              placeholder="Enter product name"
              placeholderTextColor={colors.text + '80'}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Size</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              value={size}
              onChangeText={setSize}
              placeholder="KG, G, L, ML, X6, X12"
              placeholderTextColor={colors.text + '80'}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Price</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              value={price}
              onChangeText={setPrice}
              placeholder="Rs 12,50 or 12.50"
              placeholderTextColor={colors.text + '80'}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Store</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storeSelector}>
              {STORES.map((store) => (
                <TouchableOpacity
                  key={store}
                  style={[
                    styles.storeChip,
                    {
                      backgroundColor: selectedStore === store ? colors.primary : colors.card,
                      borderColor: selectedStore === store ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => setSelectedStore(store)}
                >
                  <Text style={[
                    styles.storeChipText,
                    {
                      color: selectedStore === store ? 'white' : colors.text,
                    }
                  ]}>
                    {store}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={[styles.inputGroup, styles.categoriesInputGroup]}>
            <View style={styles.categoriesHeader}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Categories</Text>
            </View>

            <View style={styles.categoriesContainer}>
              {CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.name}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: selectedCategories.includes(category.name) ? colors.primary : colors.card,
                      borderColor: selectedCategories.includes(category.name) ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => toggleCategory(category.name)}
                >
                  <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                  <Text style={[
                    styles.categoryChipText,
                    {
                      color: selectedCategories.includes(category.name) ? 'white' : colors.text,
                    }
                  ]}>
                    {category.displayName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Product Image Section (only for ADD mode) */}
          {mode === AppMode.ADD && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Product Image</Text>
              <TouchableOpacity 
                style={[styles.productImageContainer, { borderColor: colors.border }]}
                onPress={pickProductImage}
              >
                {productImage ? (
                  <Image source={{ uri: productImage }} style={styles.productImagePreview} />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Text style={styles.addImageIcon}>🖼️</Text>
                    <Text style={[styles.addImageText, { color: colors.text }]}>
                      Tap to upload product image
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.submitButton,
              { 
                backgroundColor: isProcessing ? colors.background : colors.primary,
                opacity: isProcessing ? 0.6 : 1
              }
            ]}
            onPress={validateAndSubmit}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>SUBMIT</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modeSelectionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    marginBottom: 40,
  },
  scannerIcon: {
    fontSize: 100,
  },
  modeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 60,
    textAlign: 'center',
  },
  modeButtonsContainer: {
    width: '100%',
    gap: 20,
  },
  modeButton: {
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modeButtonGradient: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  modeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
});

export default ScannerScreen;