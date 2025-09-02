import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { CATEGORIES, STORES, BACKEND_URL } from '../../constants/categories';
import { AppMode } from '../../types';
import DataCacheService from '../../services/DataCacheService';

const ScannerScreen = () => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const [showModeSelection, setShowModeSelection] = useState(true);
  const [mode, setMode] = useState<AppMode>(AppMode.ADD);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  
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

  const selectMode = (selectedMode: AppMode) => {
    setMode(selectedMode);
    setShowModeSelection(false);
  };

  const pickReceiptImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera roll permission is required to select images.');
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
    } catch (error) {
      console.error('Error picking receipt image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const pickProductImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera roll permission is required to select images.');
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
    } catch (error) {
      console.error('Error picking product image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleScan = async () => {
    if (!receiptImage) {
      Alert.alert('Error', '📸 Please capture a receipt image first to scan the product details.');
      return;
    }

    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: receiptImage,
        type: 'image/jpeg',
        name: 'image.jpg',
      } as any);

      const response = await fetch(`${BACKEND_URL}/process-image`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProductName(data.product_name || '');
        setPrice(data.price || '');
        setSize(data.size || '');
        
        Alert.alert('Success', '🎯 Receipt scanned successfully! Please verify the details and select a store before submitting.');
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', '🤖 AI processing failed. Please check the image quality or try again later.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoDetect = async () => {
    if (!productName.trim()) {
      Alert.alert('Error', '✏️ Please enter a product name first to auto-detect its category.');
      return;
    }

    setIsAutoDetecting(true);

    try {
      const response = await fetch(`${BACKEND_URL}/categorize-product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_name: productName,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const detectedCategory = data.category;
        
        if (CATEGORIES.find(cat => cat.name === detectedCategory.toLowerCase())) {
          setSelectedCategories([detectedCategory.toLowerCase()]);
          Alert.alert('Success', `🎯 Auto-detected category: ${detectedCategory.toLowerCase()}`);
        } else {
          setSelectedCategories(['miscellaneous']);
          Alert.alert('Notice', `🤔 Unknown category "${detectedCategory}" detected. Set to miscellaneous for now.`);
        }
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error) {
      console.error('Error auto-detecting category:', error);
      setSelectedCategories(['miscellaneous']);
      Alert.alert('Notice', '⚠️ Auto-detect service unavailable. Category set to miscellaneous.');
    } finally {
      setIsAutoDetecting(false);
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
      const formData = new FormData();
      formData.append('product_name', productName.trim());
      formData.append('size', size.trim());
      formData.append('price', price.trim());
      formData.append('store', selectedStore);
      formData.append('categories', JSON.stringify(selectedCategories));

      if (productImage) {
        formData.append('product_image', {
          uri: productImage,
          type: 'image/jpeg',
          name: 'product_image.jpg',
        } as any);
      }

      const response = await fetch(`${BACKEND_URL}/add-product`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.ok || response.status === 201) {
        await cacheService.invalidateProducts();
        Alert.alert('Success', '🎉 Product added successfully! Your new product is now available in the price list.');
        clearForm();
      } else {
        const errorText = await response.text();
        handleError(response.status, errorText, 'add');
      }
    } catch (error) {
      console.error('Network error in add product:', error);
      Alert.alert('Error', '🌐 Network error. Please check your connection and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateProduct = async () => {
    setIsProcessing(true);

    try {
      const response = await fetch(`${BACKEND_URL}/update-product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_name: productName.trim(),
          size: size.trim(),
          price: price.trim(),
          store: selectedStore,
          categories: selectedCategories,
        }),
      });

      if (response.ok) {
        await cacheService.invalidateProducts();
        Alert.alert('Success', '✅ Product updated successfully! The price list now reflects your changes.');
        clearForm();
      } else {
        const errorText = await response.text();
        handleError(response.status, errorText, 'update');
      }
    } catch (error) {
      console.error('Network error in update product:', error);
      Alert.alert('Error', '🌐 Network error. Please check your connection and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleError = (statusCode: number, responseBody: string, operation: 'add' | 'update') => {
    const errorBody = responseBody.toLowerCase();
    
    switch (statusCode) {
      case 400:
        if (errorBody.includes('duplicate') || errorBody.includes('already exists')) {
          Alert.alert('Error', '🔄 This exact product already exists in our database. Try updating it instead!');
        } else if (errorBody.includes('not found') && operation === 'update') {
          Alert.alert('Error', '🔍 Product not found. You can only update existing products. Use ADD to create new products.');
        } else {
          Alert.alert('Error', '⚠️ Invalid product data. Please check all fields and try again.');
        }
        break;
      case 404:
        Alert.alert('Error', '🔍 Product not found. Please check the product name spelling or use ADD to create a new product.');
        break;
      case 409:
        Alert.alert('Error', '🔄 This product already exists in our database. Please check the details or use UPDATE.');
        break;
      default:
        Alert.alert('Error', `❌ Server error (${statusCode}). Please try again later.`);
        break;
    }
  };

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
    const cleanPrice = priceText.replace(/[Rs\.\s]/gi, '');
    return /^[\d,]*$/.test(cleanPrice) && !cleanPrice.endsWith(',');
  };

  const getPriceValue = (priceText: string): number => {
    const cleanPrice = priceText.replace(/[Rs\.\s]/gi, '').replace(',', '.');
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
        return prev.filter(cat => cat !== categoryName);
      } else {
        return [...prev, categoryName];
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
                  Tap to capture receipt
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
              <Text style={styles.scanButtonText}>SCAN</Text>
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

          <View style={styles.inputGroup}>
            <View style={styles.categoriesHeader}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Categories</Text>
              <TouchableOpacity
                style={[
                  styles.autoDetectButton,
                  { 
                    backgroundColor: isAutoDetecting ? colors.background : colors.primary,
                    opacity: isAutoDetecting ? 0.6 : 1
                  }
                ]}
                onPress={handleAutoDetect}
                disabled={isAutoDetecting}
              >
                {isAutoDetecting ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.autoDetectButtonText}>Auto-Detect</Text>
                )}
              </TouchableOpacity>
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
    borderRadius: 60,
    borderWidth: 3,
    borderStyle: 'dashed',
    marginBottom: 20,
    overflow: 'hidden',
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
    elevation: 2,
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
  autoDetectButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  autoDetectButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
    elevation: 2,
    marginTop: 20,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

export default ScannerScreen;