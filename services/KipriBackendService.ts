import * as ImagePicker from 'expo-image-picker';
import { ReviewedReceiptItem } from '../types';
import GeminiApiService, { Product } from './GeminiApiService';
import ImageUploadService from './ImageUploadService';
import OpenAiService, { FoodCategoryResult } from './OpenAiService';
import SupabaseService from './SupabaseService';
import VisionApiService, { OCRResult } from './VisionApiService';

export interface ProcessImageResult {
  success: boolean;
  products: Product[];
  error?: string;
  ocrResult?: OCRResult;
}

export interface ProcessTextResult {
  success: boolean;
  categoryResult: FoodCategoryResult;
  error?: string;
}

export interface ServiceStatus {
  vision: boolean;
  openai: boolean;
  openai_categorization: boolean;
  supabase: boolean;
}

class KipriBackendService {
  private serviceStatus: ServiceStatus = {
    vision: false,
    openai: false,
    openai_categorization: false,
    supabase: false,
  };

  constructor() {
    this.initializeServices();
  }

  private async initializeServices() {
    console.log('Initializing Kipri Backend Services...');

    // Test all services
    const openaiTest = await GeminiApiService.testConnection();
    this.serviceStatus = {
      vision: await VisionApiService.testConnection(),
      openai: openaiTest,
      openai_categorization: await OpenAiService.testConnection(),
      supabase: await SupabaseService.testConnection(),
    };

    console.log('Service Status:', this.serviceStatus);
  }

  async getServiceStatus(): Promise<ServiceStatus> {
    return this.serviceStatus;
  }

  /**
   * Complete image processing pipeline:
   * 1. OCR with Google Vision
   * 2. Text filtering and structuring with Gemini
   * 3. Optional categorization with OpenAI
   * 4. Save to Supabase
   */
  async processImage(imageUri: string, saveToDatabase: boolean = true): Promise<ProcessImageResult> {
    try {
      console.log('Starting image processing pipeline...');

      // Step 1: OCR Processing
      console.log('Step 1: Extracting text with OCR...');
      const ocrResult = await VisionApiService.extractTextFromImage(imageUri);
      
      if (!ocrResult) {
        return {
          success: false,
          products: [],
          error: 'Failed to extract text from image',
        };
      }

      console.log(`OCR extracted ${ocrResult.blocks.length} text blocks`);

      // Step 2: Filter and structure with OpenAI
      console.log('Step 2: Processing text with OpenAI...');
      const filteredText = await GeminiApiService.filterUsefulText(ocrResult.fullText);

      if (!filteredText) {
        return {
          success: false,
          products: [],
          error: 'No useful product information found in image',
          ocrResult,
        };
      }

      // Step 3: Extract structured products
      console.log('Step 3: Structuring product data...');
      const products: Product[] = [];

      // Process each text block as a potential product
      for (const block of ocrResult.blocks) {
        if (block.text.trim().length > 5) { // Skip very short text
          const product = await GeminiApiService.structureProductData(block.text);
          if (product && product.product !== 'Unknown') {
            product.imageSource = imageUri;
            products.push(product);
          }
        }
      }

      console.log(`Extracted ${products.length} products`);

      // Step 4: Enhanced categorization with OpenAI (if available)
      if (this.serviceStatus.openai_categorization && products.length > 0) {
        console.log('Step 4: Enhancing categories with OpenAI...');
        try {
          const productTexts = products.map(p => {
            const existingCategories = p.categories?.join(' ') || '';
            return `${p.product} ${existingCategories}`.trim();
          });
          const categoryResults = await OpenAiService.batchCategorizeTexts(productTexts);

          // Update products with OpenAI categorization
          products.forEach((product, index) => {
            const categoryResult = categoryResults[index];
            if (categoryResult && categoryResult.isFood && categoryResult.confidence > 0.7) {
              // Add the category to the categories array if not already present
              const existingCategories = product.categories || [];
              if (!existingCategories.includes(categoryResult.category)) {
                product.categories = [...existingCategories, categoryResult.category];
              }
            }
          });
        } catch (error) {
          console.warn('OpenAI categorization failed, using default categories:', error);
        }
      }

      // Step 5: Save to Supabase (if enabled)
      if (saveToDatabase && this.serviceStatus.supabase && products.length > 0) {
        console.log('Step 5: Saving to database...');
        try {
          const savedProducts = await SupabaseService.saveProducts(products);
          if (savedProducts) {
            console.log(`Successfully saved ${savedProducts.length} products to database`);
          }
        } catch (error) {
          console.warn('Failed to save to database:', error);
        }
      }

      return {
        success: true,
        products,
        ocrResult,
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
      console.log('Processing text for food categorization...');

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
      console.log(`Processing image ${results.length + 1}/${imageUris.length}`);
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
        product: item.product_name,
        brand: item.brand?.toUpperCase() || '',
        price: item.price.toString(),
        size: item.size || '',
        store: item.store,
        categories: item.categories.length > 0 ? item.categories : ['miscellaneous'],
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
      console.log('Saving product with image handling...');

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

      console.log('Product saved successfully, ID:', savedProduct.id);

      // If there's an image, upload it
      if (imageUri && savedProduct.id) {
        console.log('Uploading product image...');
        const imagePath = await ImageUploadService.uploadProductImage(imageUri, savedProduct.id.toString());

        if (imagePath) {
          console.log('Image uploaded successfully, updating product...');
          // Update product with image path
          const updatedProduct = await SupabaseService.updateProduct(savedProduct.id.toString(), {
            images: imagePath
          });

          if (updatedProduct) {
            console.log('Product updated with image path');
            return updatedProduct;
          }
        } else {
          console.warn('Image upload failed, but product was saved');
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
      console.log('Updating product with image handling...');

      // Extract image URI if present
      const imageUri = updates.imageSource || updates.images;
      const updatesToSave = { ...updates };

      // Remove image fields from updates (will be handled separately)
      delete updatesToSave.imageSource;
      delete updatesToSave.images;

      // If there's an image to upload
      if (imageUri) {
        console.log('Uploading updated product image...');
        const imagePath = await ImageUploadService.uploadProductImage(imageUri, id);

        if (imagePath) {
          console.log('Image uploaded successfully, adding to updates...');
          updatesToSave.images = imagePath;
        } else {
          console.warn('Image upload failed, proceeding without image update');
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
    console.log('Testing all services...');

    const openaiTest = await GeminiApiService.testConnection();
    const status = {
      vision: await VisionApiService.testConnection(),
      openai: openaiTest,
      openai_categorization: await OpenAiService.testConnection(),
      supabase: await SupabaseService.testConnection(),
    };

    this.serviceStatus = status;
    console.log('Service test results:', status);

    return status;
  }

  getRequiredApiKeys(): string[] {
    const keys = [];
    if (!process.env.EXPO_PUBLIC_GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.EXPO_PUBLIC_GOOGLE_APPLICATION_CREDENTIALS_JSON.includes('your_')) {
      keys.push('Google Cloud Service Account Credentials');
    }
    if (!process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY.includes('your_')) {
      keys.push('OpenAI API Key');
    }
    return keys;
  }
}

export default new KipriBackendService();