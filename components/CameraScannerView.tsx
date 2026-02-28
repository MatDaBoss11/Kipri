import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppMode, Store } from '../types';
import BackendReplicaService from '../services/BackendReplicaService';
import KipriBackendService from '../services/KipriBackendService';
import StoreService from '../services/StoreService';
import { CATEGORIES } from '../constants/categories';

// ---------- Types ----------

type CameraStep =
  | 'capture_price_tag'
  | 'processing'
  | 'show_results'
  | 'capture_product'
  | 'submitting'
  | 'success'
  | 'capture_receipt';

interface ExtractedData {
  productName: string;
  brand: string;
  size: string;
  price: string;
  categories: string[];
}

interface CameraScannerViewProps {
  mode: AppMode;
  activeStoreName: string | null;
  setActiveStore: (name: string) => void;
  preferredStoreNames: string[];
  onProductComplete: (data: {
    productName: string;
    brand: string;
    size: string;
    price: string;
    categories: string[];
    priceTagImage: string;
    productImage?: string;
    store: string;
  }) => Promise<boolean>;
  onReceiptPhotosReady: (photoUris: string[]) => void;
  onCancel: () => void;
  colors: any;
  colorScheme: string | null | undefined;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Frame dimensions
const PRICE_TAG_FRAME = { width: SCREEN_W * 0.82, height: SCREEN_W * 0.42 }; // landscape rectangle
const PRODUCT_FRAME = { width: SCREEN_W * 0.7, height: SCREEN_W * 0.7 }; // large square
const RECEIPT_FRAME = { width: SCREEN_W * 0.72, height: SCREEN_H * 0.52 }; // tall portrait rectangle

// ---------- Component ----------

const CameraScannerView: React.FC<CameraScannerViewProps> = ({
  mode,
  activeStoreName,
  setActiveStore,
  preferredStoreNames,
  onProductComplete,
  onReceiptPhotosReady,
  onCancel,
  colors,
  colorScheme,
}) => {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);

  // State machine
  const initialStep: CameraStep =
    mode === AppMode.RECEIPT ? 'capture_receipt' : 'capture_price_tag';
  const [step, setStep] = useState<CameraStep>(initialStep);

  // Extracted product data
  const [extracted, setExtracted] = useState<ExtractedData>({
    productName: '',
    brand: '',
    size: '',
    price: '',
    categories: [],
  });
  const [editingField, setEditingField] = useState<string | null>(null);

  // Image URIs
  const [priceTagUri, setPriceTagUri] = useState<string | null>(null);

  // Receipt mode
  const [receiptPhotos, setReceiptPhotos] = useState<string[]>([]);

  // Processing state
  const [processingText, setProcessingText] = useState('Processing...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Capture lock to prevent double-tap
  const [capturing, setCapturing] = useState(false);

  // Store picker (shown when no active store is set)
  const [showStorePicker, setShowStorePicker] = useState(!activeStoreName);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [showAllStores, setShowAllStores] = useState(false);

  // Success animation
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  // Camera preview layout
  const [previewLayout, setPreviewLayout] = useState({ width: SCREEN_W, height: SCREEN_H });

  // ---------- Success animation (must be before any returns) ----------

  const showSuccess = useCallback(() => {
    setStep('success');
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.timing(successOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => onCancel());
    }, 1500);
  }, [successScale, successOpacity, onCancel]);

  // ---------- Permissions ----------

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) {
    return (
      <View style={[styles.fullScreen, { backgroundColor: '#000' }]}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.fullScreen, styles.centered, { backgroundColor: '#000' }]}>
        <Text style={styles.permissionText}>Camera access is needed to scan products</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
          <Text style={styles.cancelLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------- Capture & Crop ----------

  const captureAndCrop = async (
    frameW: number,
    frameH: number,
  ): Promise<string | null> => {
    if (!cameraRef.current || !cameraReady || capturing) return null;
    setCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) return null;

      // Calculate crop region
      const pW = previewLayout.width;
      const pH = previewLayout.height;

      // Frame is centered
      const frameLeft = (pW - frameW) / 2;
      const frameTop = (pH - frameH) / 2;

      // Scale from preview to photo
      const scaleX = photo.width / pW;
      const scaleY = photo.height / pH;

      const pad = 20 * scaleX; // 20px padding scaled to image

      const originX = Math.max(0, frameLeft * scaleX - pad);
      const originY = Math.max(0, frameTop * scaleY - pad);
      const cropW = Math.min(photo.width - originX, frameW * scaleX + 2 * pad);
      const cropH = Math.min(photo.height - originY, frameH * scaleY + 2 * pad);

      const cropped = await manipulateAsync(
        photo.uri,
        [{ crop: { originX, originY, width: cropW, height: cropH } }],
        { compress: 0.85, format: SaveFormat.JPEG },
      );

      return cropped.uri;
    } catch (e) {
      console.error('Capture/crop error:', e);
      return null;
    } finally {
      setCapturing(false);
    }
  };

  const captureFullPhoto = async (): Promise<string | null> => {
    if (!cameraRef.current || !cameraReady || capturing) return null;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      return photo?.uri || null;
    } catch (e) {
      console.error('Capture error:', e);
      return null;
    } finally {
      setCapturing(false);
    }
  };

  // ---------- Store picker ----------

  const handleStoreSelect = (storeName: string) => {
    setActiveStore(storeName);
    setShowStorePicker(false);
    setShowAllStores(false);
  };

  const handleLoadAllStores = async () => {
    if (allStores.length > 0) {
      setShowAllStores(true);
      return;
    }
    try {
      const stores = await StoreService.getInstance().getAllStores();
      setAllStores(stores);
      setShowAllStores(true);
    } catch {
      // Silently fail — user can still pick from preferred stores
    }
  };

  // ---------- Price tag flow ----------

  const handlePriceTagCapture = async () => {
    setErrorMessage(null);
    const uri = await captureAndCrop(PRICE_TAG_FRAME.width, PRICE_TAG_FRAME.height);
    if (!uri) {
      setErrorMessage('Failed to capture image. Please try again.');
      return;
    }

    setPriceTagUri(uri);
    setStep('processing');
    setProcessingText('Reading price tag...');

    try {
      // OCR extraction
      const result = await BackendReplicaService.processImage(uri);
      if (!result.success || !result.data) {
        setErrorMessage('Could not read the price tag. Please try again.');
        setStep('capture_price_tag');
        return;
      }

      const { product_name, brand, price, size } = result.data;

      // Category detection
      setProcessingText('Detecting category...');
      let detectedCategories: string[] = ['miscellaneous'];

      if (product_name?.trim()) {
        try {
          const catResult = await KipriBackendService.processText(product_name.trim());
          if (catResult.success && catResult.categoryResult.isFood && catResult.categoryResult.confidence > 0.5) {
            const cat = catResult.categoryResult.category;
            const match = CATEGORIES.find(
              c => c.name.toLowerCase() === cat.toLowerCase() || c.displayName.toLowerCase() === cat.toLowerCase(),
            );
            if (match) {
              detectedCategories = [match.name];
            }
          }
        } catch {
          // Keep default 'miscellaneous'
        }
      }

      setExtracted({
        productName: product_name || '',
        brand: (brand || '').toUpperCase(),
        size: size || '',
        price: price || '',
        categories: detectedCategories,
      });

      setStep('show_results');
    } catch (err) {
      console.error('AI processing error:', err);
      setErrorMessage('Processing failed. Please try again.');
      setStep('capture_price_tag');
    }
  };

  // ---------- Product photo flow (ADD only) ----------

  const handleProductCapture = async () => {
    setErrorMessage(null);
    const uri = await captureFullPhoto();
    if (!uri) {
      setErrorMessage('Failed to capture image. Please try again.');
      return;
    }

    // Auto-submit
    setStep('submitting');
    setProcessingText('Saving product...');

    const store = activeStoreName || preferredStoreNames[0] || '';
    if (store && !activeStoreName) {
      setActiveStore(store);
    }

    const success = await onProductComplete({
      productName: extracted.productName,
      brand: extracted.brand,
      size: extracted.size,
      price: extracted.price,
      categories: extracted.categories,
      priceTagImage: priceTagUri!,
      productImage: uri,
      store,
    });

    if (success) {
      showSuccess();
    } else {
      setErrorMessage('Failed to save product. Please try again.');
      setStep('show_results');
    }
  };

  // ---------- Update confirm ----------

  const handleUpdateConfirm = async () => {
    setStep('submitting');
    setProcessingText('Updating price...');

    const store = activeStoreName || preferredStoreNames[0] || '';
    if (store && !activeStoreName) {
      setActiveStore(store);
    }

    const success = await onProductComplete({
      productName: extracted.productName,
      brand: extracted.brand,
      size: extracted.size,
      price: extracted.price,
      categories: extracted.categories,
      priceTagImage: priceTagUri!,
      store,
    });

    if (success) {
      showSuccess();
    } else {
      setErrorMessage('Failed to update. Please try again.');
      setStep('show_results');
    }
  };

  // ---------- Receipt flow ----------

  const handleReceiptCapture = async () => {
    setErrorMessage(null);
    const uri = await captureAndCrop(RECEIPT_FRAME.width, RECEIPT_FRAME.height);
    if (!uri) {
      setErrorMessage('Failed to capture image. Please try again.');
      return;
    }
    setReceiptPhotos(prev => [...prev, uri]);
  };

  const handleReceiptDone = () => {
    if (receiptPhotos.length === 0) return;
    onReceiptPhotosReady(receiptPhotos);
  };

  // ---------- Render helpers ----------

  const renderFrame = (fw: number, fh: number, borderRadius = 12) => (
    <View
      pointerEvents="none"
      style={[
        styles.frameOverlay,
        {
          width: fw,
          height: fh,
          borderRadius,
          top: (previewLayout.height - fh) / 2,
          left: (previewLayout.width - fw) / 2,
        },
      ]}
    />
  );

  const renderCaptureButton = (onPress: () => void) => (
    <TouchableOpacity
      style={styles.captureButton}
      onPress={onPress}
      disabled={capturing || !cameraReady}
      activeOpacity={0.7}
    >
      <View style={[styles.captureOuter, capturing && { opacity: 0.5 }]}>
        <View style={styles.captureInner} />
      </View>
    </TouchableOpacity>
  );

  const renderBackButton = () => (
    <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={onCancel}>
      <Text style={styles.backBtnText}>{'<'}</Text>
    </TouchableOpacity>
  );

  const renderError = () =>
    errorMessage ? (
      <View style={styles.errorBanner}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity onPress={() => setErrorMessage(null)}>
          <Text style={styles.errorDismiss}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    ) : null;

  // ---------- Editable inline field ----------

  const renderInlineEdit = (
    key: keyof ExtractedData,
    style: any,
    prefix?: string,
    keyboardType: 'default' | 'numeric' = 'default',
  ) => {
    const value = extracted[key] as string;
    const isEditing = editingField === key;

    if (isEditing) {
      return (
        <TextInput
          key={key}
          style={[style, styles.compactInput]}
          value={value}
          onChangeText={text =>
            setExtracted(prev => ({ ...prev, [key]: key === 'brand' ? text.toUpperCase() : text }))
          }
          onBlur={() => setEditingField(null)}
          autoFocus
          selectTextOnFocus
          keyboardType={keyboardType}
          returnKeyType="done"
          onSubmitEditing={() => setEditingField(null)}
        />
      );
    }

    return (
      <TouchableOpacity key={key} onPress={() => setEditingField(key)} activeOpacity={0.6}>
        <Text style={style}>
          {prefix}{value || '—'}
        </Text>
      </TouchableOpacity>
    );
  };

  // ---------- RENDER: Single camera, overlays on top ----------

  const isAdd = mode === AppMode.ADD;
  const isShowResults = step === 'show_results';
  const isProcessing = step === 'processing' || step === 'submitting';
  const isSuccess = step === 'success';
  const isReceipt = step === 'capture_receipt';
  const isPriceTag = step === 'capture_price_tag';
  const isProductCapture = step === 'capture_product';

  return (
    <View style={styles.fullScreen}>
      {/* Camera is ALWAYS mounted */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={() => setCameraReady(true)}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          setPreviewLayout({ width, height });
        }}
      >
        {/* ---- Price tag capture overlay ---- */}
        {isPriceTag && (
          <>
            <View style={[styles.instructionBar, { paddingTop: insets.top + 12 }]}>
              <Text style={styles.instructionText}>Take a photo of the price tag</Text>
            </View>
            {renderFrame(PRICE_TAG_FRAME.width, PRICE_TAG_FRAME.height)}
            <View style={styles.bottomBar}>
              {renderCaptureButton(handlePriceTagCapture)}
            </View>
          </>
        )}

        {/* ---- Receipt capture overlay ---- */}
        {isReceipt && (
          <>
            <View style={[styles.instructionBar, { paddingTop: insets.top + 12 }]}>
              <Text style={styles.instructionText}>Take a photo of your receipt</Text>
            </View>
            {renderFrame(RECEIPT_FRAME.width, RECEIPT_FRAME.height, 8)}
            <View style={styles.bottomBar}>
              {receiptPhotos.length > 0 && (
                <View style={styles.photoCountBadge}>
                  <Text style={styles.photoCountText}>{receiptPhotos.length}</Text>
                </View>
              )}
              {renderCaptureButton(handleReceiptCapture)}
              {receiptPhotos.length > 0 && (
                <TouchableOpacity style={styles.doneButton} onPress={handleReceiptDone}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* ---- Show Results overlay (compact card) ---- */}
        {isShowResults && (
          <>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[styles.compactResultsOverlay, { top: insets.top + 56 }]}
              pointerEvents="box-none"
            >
              <View style={styles.compactCard}>
                {/* Row 1: Price (large) */}
                <View style={styles.compactPriceRow}>
                  {renderInlineEdit('price', styles.compactPrice, 'Rs ', 'numeric')}
                </View>

                {/* Row 2: Name */}
                <View style={styles.compactNameRow}>
                  {renderInlineEdit('productName', styles.compactName)}
                </View>

                {/* Row 3: Brand · Size */}
                <View style={styles.compactDetailRow}>
                  {renderInlineEdit('brand', styles.compactDetail)}
                  <Text style={styles.compactDot}> · </Text>
                  {renderInlineEdit('size', styles.compactDetail)}
                </View>

                {/* Row 4: Category pill + Store */}
                <View style={styles.compactMetaRow}>
                  <View style={styles.compactCategoryPill}>
                    <Text style={styles.compactCategoryText}>
                      {CATEGORIES.find(c => c.name === extracted.categories[0])?.emoji || '🧺'}{' '}
                      {CATEGORIES.find(c => c.name === extracted.categories[0])?.displayName || 'Misc'}
                    </Text>
                  </View>
                  {activeStoreName && (
                    <Text style={styles.compactStore}>@ {activeStoreName}</Text>
                  )}
                </View>
              </View>

              {isAdd ? (
                <Text style={styles.compactInstruction}>
                  Now take a photo of the product
                </Text>
              ) : null}
            </KeyboardAvoidingView>

            {isAdd ? (
              <>
                {renderFrame(PRODUCT_FRAME.width, PRODUCT_FRAME.height, 16)}
                <View style={styles.bottomBar}>
                  {renderCaptureButton(handleProductCapture)}
                </View>
              </>
            ) : (
              <View style={styles.bottomBar}>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleUpdateConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmButtonText}>Confirm & Update</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* ---- Processing / Submitting overlay ---- */}
        {isProcessing && (
          <View style={[styles.overlayFull, styles.centered]}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.processingLabel}>{processingText}</Text>
          </View>
        )}

        {/* ---- Success overlay ---- */}
        {isSuccess && (
          <View style={[styles.overlayFull, styles.centered]}>
            <Animated.View
              style={[
                styles.successCircle,
                { transform: [{ scale: successScale }], opacity: successOpacity },
              ]}
            >
              <Text style={styles.successTick}>✓</Text>
            </Animated.View>
            <Animated.Text style={[styles.successText, { opacity: successOpacity }]}>
              {mode === AppMode.UPDATE ? 'Price updated!' : 'Product added!'}
            </Animated.Text>
          </View>
        )}

        {/* ---- Store picker overlay ---- */}
        {showStorePicker && (
          <View style={[styles.overlayFull, styles.centered, { zIndex: 50 }]}>
            <View style={styles.storePickerCard}>
              <Text style={styles.storePickerTitle}>Which store are you in?</Text>
              <Text style={styles.storePickerSubtitle}>We&apos;ll remember for your shopping trip</Text>

              <View style={styles.storePickerChips}>
                {preferredStoreNames.map(name => (
                  <TouchableOpacity
                    key={name}
                    style={styles.storePickerChip}
                    onPress={() => handleStoreSelect(name)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.storePickerChipText}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {!showAllStores ? (
                <TouchableOpacity onPress={handleLoadAllStores} style={styles.storePickerOther}>
                  <Text style={styles.storePickerOtherText}>Other store...</Text>
                </TouchableOpacity>
              ) : (
                <ScrollView style={styles.allStoresList} showsVerticalScrollIndicator={false}>
                  <View style={styles.allStoresGrid}>
                    {allStores
                      .filter(s => !preferredStoreNames.includes(s.name))
                      .map(store => (
                        <TouchableOpacity
                          key={store.id}
                          style={styles.allStoreChip}
                          onPress={() => handleStoreSelect(store.name)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.allStoreChipText}>{store.name}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        )}
      </CameraView>

      {renderError()}
      {renderBackButton()}
    </View>
  );
};

// ---------- Styles ----------

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
  },
  overlayFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 20,
  },

  // Permission
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 40,
  },
  permissionButton: {
    backgroundColor: '#D02919',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelLink: {
    marginTop: 20,
  },
  cancelLinkText: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.7,
  },

  // Instructions
  instructionBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  instructionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  // Frame overlay
  frameOverlay: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.85)',
    borderStyle: 'solid',
    zIndex: 5,
  },

  // Back button
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 10,
  },

  // Capture button (red circle)
  captureButton: {
    alignSelf: 'center',
  },
  captureOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D02919',
  },

  // Compact results card
  compactResultsOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 15,
  },
  compactCard: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  compactPriceRow: {
    marginBottom: 2,
  },
  compactPrice: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  compactNameRow: {
    marginBottom: 2,
  },
  compactName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  compactDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  compactDetail: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
  compactDot: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactCategoryPill: {
    backgroundColor: 'rgba(16,185,129,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  compactCategoryText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600',
  },
  compactStore: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '500',
  },
  compactInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#D02919',
    paddingVertical: 1,
    minWidth: 40,
  },
  compactInstruction: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 10,
    opacity: 0.8,
  },

  // Confirm button (UPDATE mode)
  confirmButton: {
    backgroundColor: '#D02919',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Receipt mode
  photoCountBadge: {
    position: 'absolute',
    left: 30,
    backgroundColor: '#D02919',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCountText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  doneButton: {
    position: 'absolute',
    right: 24,
    backgroundColor: '#10b981',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Error
  errorBanner: {
    position: 'absolute',
    bottom: 130,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(220,38,38,0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 30,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  errorDismiss: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 12,
    textDecorationLine: 'underline',
  },

  // Processing
  processingLabel: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
    fontWeight: '500',
  },

  // Success
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTick: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
  },
  successText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },

  // Store picker
  storePickerCard: {
    backgroundColor: 'rgba(20,20,20,0.92)',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    marginHorizontal: 24,
    alignItems: 'center',
    width: SCREEN_W - 48,
  },
  storePickerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  storePickerSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  storePickerChips: {
    width: '100%',
    gap: 10,
  },
  storePickerChip: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  storePickerChipText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  storePickerOther: {
    marginTop: 16,
    paddingVertical: 8,
  },
  storePickerOtherText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  allStoresList: {
    maxHeight: 180,
    width: '100%',
    marginTop: 12,
  },
  allStoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  allStoreChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  allStoreChipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default CameraScannerView;
