import * as ImagePicker from 'expo-image-picker';
import { ReviewedReceiptItem } from '../types';
import BackendReplicaService from './BackendReplicaService';
import { Product } from './GeminiApiService';
import ImageUploadService from './ImageUploadService';
import OpenAiService, { FoodCategoryResult } from './OpenAiService';
import SupabaseService from './SupabaseService';

export interface ProcessImageResult {
  success: boolean;
  products: Product[];
  error?: string;
}

export interface ProcessTextResult {
  success: boolean;
  categoryResult: FoodCategoryResult;
  error?: string;
}

export interface ServiceStatus {
  edgeFunctions: boolean;
  openai_categorization: boolean;
  supabase: boolean;
}

class KipriBackendService {
  private serviceStatus: ServiceStatus = {
    edgeFunctions: false,
    openai_categorization: false,
    supabase: false,
  };

  constructor() {
    this.initializeServices();
  }

  private async initializeServices() {
    if (__DEV__) console.log('Initializing Kipri Backend Services...');

    this.serviceStatus = {
      edgeFunctions: await BackendReplicaService.testConnection(),
      openai_categorization: await OpenAiService.testConnection(),
      supabase: await SupabaseService.testConnection(),
    };

    if (__DEV__) console.log('Service Status:', this.serviceStatus);
  }

  async getServiceStatus(): Promise<ServiceStatus> {
    return this.serviceStatus;
  }

  /**
   * Process image via secure Edge Function (BackendReplicaService)
   */
  async processImage(imageUri: string, saveToDatabase: boolean = true): Promise<ProcessImageResult> {
    try {
      if (__DEV__) console.log('Starting image processing via Edge Function...');

      const result = await BackendReplicaService.processImage(imageUri);

      if (!result.success || !result.data) {
        return {
          success: false,
          products: [],
          error: result.error || 'Failed to process image',
        };
      }

      // Convert BackendReplicaService response to Product format
      const product: Product = {
        product: result.data.product_name,
        brand: result.data.brand,
        price: result.data.price,
        size: result.data.size,
        store: result.data.store,
        categories: result.data.categories,
        imageSource: imageUri,
      };

      const products: Product[] = [product];

      // Save to Supabase if enabled
      if (saveToDatabase && this.serviceStatus.supabase && products.length > 0) {
        if (__DEV__) console.log('Saving to database...');
        try {
          const savedProducts = await SupabaseService.saveProducts(products);
          if (__DEV__ && savedProducts) {
            console.log(`Successfully saved ${savedProducts.length} products to database`);
          }
        } catch (error) {
          if (__DEV__) console.warn('Failed to save to database:', error);
        }
      }

      return {
        success: true,
        products,
      };

    } catch (error) {
      console.error('Image processing pipeline error:', error);
      return {
        success: false,
        products: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Process text to determine if it's a food item and categorize it
   */
  async processText(text: string): Promise<ProcessTextResult> {
    try {
      if (__DEV__) console.log('Processing text for food categorization...');

      // Use OpenAI for detailed analysis
      if (this.serviceStatus.openai_categorization) {
        const categoryResult = await OpenAiService.categorizeText(text);
        return {
          success: true,
          categoryResult,
        };
      }

      // Fallback to quick categorization
      const categoryResult = OpenAiService.quickCategorize(text);
      return {
        success: true,
        categoryResult,
      };

    } catch (error) {
      console.error('Text processing error:', error);
      return {
        success: false,
        categoryResult: {
          isFood: false,
          category: 'Unknown',
          confidence: 0,
          description: 'Processing failed',
        },
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Batch process multiple images
   */
  async processMultipleImages(imageUris: string[], saveToDatabase: boolean = true): Promise<ProcessImageResult[]> {
    const results: ProcessImageResult[] = [];
    
    for (const imageUri of imageUris) {
      if (__DEV__) console.log(`Processing image ${results.length + 1}/${imageUris.length}`);
      const result = await this.processImage(imageUri, saveToDatabase);
      results.push(result);
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  /**
   * Pick and process image from camera/gallery
   */
  async pickAndProcessImage(fromCamera: boolean = false): Promise<ProcessImageResult> {
    try {
      // Request permissions
      const { status } = fromCamera 
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        return {
          success: false,
          products: [],
          error: 'Permission denied for camera/gallery access',
        };
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (result.canceled) {
        return {
          success: false,
          products: [],
          error: 'Image selection cancelled',
        };
      }

      // Process the selected image
      return await this.processImage(result.assets[0].uri);

    } catch (error) {
      console.error('Pick and process image error:', error);
      return {
        success: false,
        products: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Batch save receipt products to Supabase
   */
  async batchSaveReceiptProducts(items: ReviewedReceiptItem[]): Promise<{ saved: number; updated: number; failed: number; errors: string[] }> {
    const result = { saved: 0, updated: 0, failed: 0, errors: [] as string[] };

    const includedItems = items.filter(item => item.included);

    if (includedItems.length === 0) {
      result.errors.push('No items to save');
      return result;
    }

    // Split into new items and existing items that need price updates
    const newItems = includedItems.filter(item => !item.isDuplicate);
    const updateItems = includedItems.filter(item => item.isDuplicate && item.existingProductId);

    // Batch INSERT new products
    if (newItems.length > 0) {
      const products: Product[] = newItems.map(item => ({
        product: (item.product_name || '').slice(0, 200).trim(),
        brand: (item.brand?.toUpperCase() || '').slice(0, 100).trim(),
        price: Math.max(0, parseFloat(item.price?.toString() || '0') || 0).toString(),
        size: (item.size || '').slice(0, 50).trim(),
        store: (item.store || '').slice(0, 100).trim(),
        categories: item.categories.length > 0 ? item.categories.map(c => c.slice(0, 50)) : ['miscellaneous'],
      }));

      try {
        const savedProducts = await SupabaseService.saveProducts(products);
        if (savedProducts) {
          result.saved = savedProducts.length;
        } else {
          result.failed += newItems.length;
          result.errors.push('Batch save returned null');
        }
      } catch (error) {
        result.failed += newItems.length;
        result.errors.push(error instanceof Error ? error.message : 'Error saving new products');
      }
    }

    // UPDATE existing products with new prices
    for (const item of updateItems) {
      try {
        const updated = await SupabaseService.updateProduct(item.existingProductId!, {
          price: item.price.toString(),
          brand: item.brand?.toUpperCase() || '',
          size: item.size || '',
          categories: item.categories.length > 0 ? item.categories : ['miscellaneous'],
        });
        if (updated) {
          result.updated++;
        } else {
          result.failed++;
          result.errors.push(`Failed to update ${item.product_name}`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Error updating ${item.product_name}`);
      }
    }

    return result;
  }

  // Database operations
  async getProducts(options: any = {}) {
    return await SupabaseService.getProducts(options);
  }

  async searchProducts(searchTerm: string, options: any = {}) {
    return await SupabaseService.searchProducts(searchTerm, options);
  }

  async getProductsByCategory(category: string, options: any = {}) {
    return await SupabaseService.getProductsByCategory(category, options);
  }

  async saveProduct(product: Product) {
    try {
      if (__DEV__) console.log('Saving product with image handling...');

      // Extract image URI if present
      const imageUri = product.imageSource || product.images;
      const productToSave = { ...product };

      // Remove image fields from product data (will be handled separately)
      delete productToSave.imageSource;
      delete productToSave.images;

      // Save product to database first
      const savedProduct = await SupabaseService.saveProduct(productToSave);

      if (!savedProduct) {
        console.error('Failed to save product to database');
        return null;
      }

      if (__DEV__) console.log('Product saved successfully, ID:', savedProduct.id);

      // If there's an image, upload it
      if (imageUri && savedProduct.id) {
        if (__DEV__) console.log('Uploading product image...');
        const imagePath = await ImageUploadService.uploadProductImage(imageUri, savedProduct.id.toString());

        if (imagePath) {
          if (__DEV__) console.log('Image uploaded successfully, updating product...');
          // Update product with image path
          const updatedProduct = await SupabaseService.updateProduct(savedProduct.id.toString(), {
            images: imagePath
          });

          if (updatedProduct) {
            if (__DEV__) console.log('Product updated with image path');
            return updatedProduct;
          }
        } else {
          if (__DEV__) console.warn('Image upload failed, but product was saved');
        }
      }

      return savedProduct;

    } catch (error) {
      console.error('Error in saveProduct with image handling:', error);
      return null;
    }
  }

  async updateProduct(id: string, updates: Partial<Product>) {
    try {
      if (__DEV__) console.log('Updating product with image handling...');

      // Extract image URI if present
      const imageUri = updates.imageSource || updates.images;
      const updatesToSave = { ...updates };

      // Remove image fields from updates (will be handled separately)
      delete updatesToSave.imageSource;
      delete updatesToSave.images;

      // If there's an image to upload
      if (imageUri) {
        if (__DEV__) console.log('Uploading updated product image...');
        const imagePath = await ImageUploadService.uploadProductImage(imageUri, id);

        if (imagePath) {
          if (__DEV__) console.log('Image uploaded successfully, adding to updates...');
          updatesToSave.images = imagePath;
        } else {
          if (__DEV__) console.warn('Image upload failed, proceeding without image update');
        }
      }

      // Update the product
      return await SupabaseService.updateProduct(id, updatesToSave);

    } catch (error) {
      console.error('Error in updateProduct with image handling:', error);
      return null;
    }
  }

  async deleteProduct(id: string) {
    return await SupabaseService.deleteProduct(id);
  }

  // Utility methods
  async testAllServices(): Promise<ServiceStatus> {
    if (__DEV__) console.log('Testing all services...');

    const status = {
      edgeFunctions: await BackendReplicaService.testConnection(),
      openai_categorization: await OpenAiService.testConnection(),
      supabase: await SupabaseService.testConnection(),
    };

    this.serviceStatus = status;
    if (__DEV__) console.log('Service test results:', status);

    return status;
  }

  getRequiredApiKeys(): string[] {
    const keys = [];
    if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
      keys.push('Supabase URL');
    }
    if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
      keys.push('Supabase Anon Key');
    }
    return keys;
  }
}

export default new KipriBackendService();