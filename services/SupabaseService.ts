import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system';
import { Product } from './GeminiApiService';

export interface DatabaseProduct extends Product {
  id?: string;
  created_at?: string;
  // Note: updated_at field not used in this table schema
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  ascending?: boolean;
  filters?: { [key: string]: any };
}

class SupabaseService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase configuration missing');
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('Supabase client initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.supabase) {
        return false;
      }

      // Try to query a simple table or perform a basic operation
      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .limit(1);

      if (error && error.code !== 'PGRST116') { // PGRST116 is "relation does not exist"
        console.error('Supabase connection test failed:', error);
        return false;
      }

      console.log('Supabase connection test successful');
      return true;

    } catch (error) {
      console.error('Supabase connection test error:', error);
      return false;
    }
  }

  // Product operations
  async saveProducts(products: Product[]): Promise<DatabaseProduct[] | null> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const productsToInsert = products.map(product => ({
        product: product.product, // Map name to product field
        price: parseFloat(product.price.replace(/[Rs\s]/gi, '').replace(',', '.')) || 0, // Convert to numeric
        size: product.size,
        store: product.store,
        category: product.category,
        images: product.images,
        // created_at is handled by database default
      }));

      const { data, error } = await this.supabase
        .from('products')
        .insert(productsToInsert)
        .select();

      if (error) {
        console.error('Error saving products to Supabase:', error);
        return null;
      }

      console.log(`Successfully saved ${data.length} products to Supabase`);
      return data as DatabaseProduct[];

    } catch (error) {
      console.error('Supabase save products error:', error);
      return null;
    }
  }

  async saveProduct(product: Product): Promise<DatabaseProduct | null> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const productToInsert = {
        product: product.product, // Map name to product field
        price: parseFloat(product.price.replace(/[Rs\s]/gi, '').replace(',', '.')) || 0, // Convert to numeric
        size: product.size,
        store: product.store,
        category: product.category,
        images: product.images,
        // created_at is handled by database default
      };

      const { data, error } = await this.supabase
        .from('products')
        .insert([productToInsert])
        .select()
        .single();

      if (error) {
        console.error('Error saving product to Supabase:', error);
        return null;
      }

      console.log('Successfully saved product to Supabase:', data.product);
      return data as DatabaseProduct;

    } catch (error) {
      console.error('Supabase save product error:', error);
      return null;
    }
  }

  async getProducts(options: QueryOptions = {}): Promise<DatabaseProduct[] | null> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      let query = this.supabase.from('products').select('*');

      // Apply filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            query = query.eq(key, value);
          }
        });
      }

      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending ?? true });
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching products from Supabase:', error);
        return null;
      }

      return data as DatabaseProduct[];

    } catch (error) {
      console.error('Supabase get products error:', error);
      return null;
    }
  }

  async getProductById(id: string): Promise<DatabaseProduct | null> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching product from Supabase:', error);
        return null;
      }

      return data as DatabaseProduct;

    } catch (error) {
      console.error('Supabase get product by ID error:', error);
      return null;
    }
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<DatabaseProduct | null> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      // Map fields to database schema
      const updateData: any = {};

      if (updates.product !== undefined) updateData.product = updates.product;
      if (updates.price !== undefined) updateData.price = parseFloat(updates.price.replace(/[Rs\s]/gi, '').replace(',', '.')) || 0;
      if (updates.size !== undefined) updateData.size = updates.size;
      if (updates.store !== undefined) updateData.store = updates.store;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.images !== undefined) updateData.images = updates.images;

      // Update created_at to current timestamp (used as "last updated")
      updateData.created_at = new Date().toISOString();

      const { data, error } = await this.supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating product in Supabase:', error);
        return null;
      }

      console.log('Successfully updated product in Supabase:', data.product);
      return data as DatabaseProduct;

    } catch (error) {
      console.error('Supabase update product error:', error);
      return null;
    }
  }

  async deleteProduct(id: string): Promise<boolean> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { error } = await this.supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting product from Supabase:', error);
        return false;
      }

      console.log('Successfully deleted product from Supabase');
      return true;

    } catch (error) {
      console.error('Supabase delete product error:', error);
      return false;
    }
  }

  // Search operations
  async searchProducts(searchTerm: string, options: QueryOptions = {}): Promise<DatabaseProduct[] | null> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      let query = this.supabase
        .from('products')
        .select('*')
        .or(`product.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,store.ilike.%${searchTerm}%`);

      // Apply additional filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            query = query.eq(key, value);
          }
        });
      }

      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending ?? true });
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error searching products in Supabase:', error);
        return null;
      }

      return data as DatabaseProduct[];

    } catch (error) {
      console.error('Supabase search products error:', error);
      return null;
    }
  }

  async getProductsByCategory(category: string, options: QueryOptions = {}): Promise<DatabaseProduct[] | null> {
    return this.getProducts({
      ...options,
      filters: { ...options.filters, category },
    });
  }

  // Analytics operations
  async getProductStats(): Promise<any> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      // Get total product count (group functionality removed for compatibility)
      const { data, error } = await this.supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('Error fetching product stats from Supabase:', error);
        return null;
      }

      return { totalProducts: data };

    } catch (error) {
      console.error('Supabase get product stats error:', error);
      return null;
    }
  }

  // Generic table operations
  async insertData(tableName: string, data: any[]): Promise<any[] | null> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data: result, error } = await this.supabase
        .from(tableName)
        .insert(data)
        .select();

      if (error) {
        console.error(`Error inserting data into ${tableName}:`, error);
        return null;
      }

      return result;

    } catch (error) {
      console.error(`Supabase insert data error for ${tableName}:`, error);
      return null;
    }
  }

  async fetchData(tableName: string, columns: string = '*', options: QueryOptions = {}): Promise<any[] | null> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      let query = this.supabase.from(tableName).select(columns);

      // Apply filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            query = query.eq(key, value);
          }
        });
      }

      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending ?? true });
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching data from ${tableName}:`, error);
        return null;
      }

      return data;

    } catch (error) {
      console.error(`Supabase fetch data error for ${tableName}:`, error);
      return null;
    }
  }

  // Image upload methods
  async uploadProductImage(imageUri: string, productId: string): Promise<string | null> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      console.log('Uploading product image for ID:', productId);
      console.log('Image URI:', imageUri);

      // Validate image URI
      if (!imageUri || typeof imageUri !== 'string') {
        console.error('Invalid image URI provided');
        return null;
      }

      // For React Native/Expo, always use FileSystem to read the image
      // This is more reliable than fetch() for local file URIs
      try {
        console.log('Reading image with Expo FileSystem...');
        
        // Read the image as base64
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        console.log('Base64 data length:', base64.length);
        
        if (!base64 || base64.length === 0) {
          console.error('Failed to read image as base64');
          return null;
        }
        
        // Decode base64 string to Uint8Array
        const decodeBase64 = (base64String: string): Uint8Array => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
          let bufferLength = base64String.length * 0.75;
          let p = 0;
          let encoded1: number, encoded2: number, encoded3: number, encoded4: number;
          
          if (base64String[base64String.length - 1] === '=') {
            bufferLength--;
            if (base64String[base64String.length - 2] === '=') {
              bufferLength--;
            }
          }
          
          const bytes = new Uint8Array(bufferLength);
          
          for (let i = 0; i < base64String.length; i += 4) {
            encoded1 = chars.indexOf(base64String[i]);
            encoded2 = chars.indexOf(base64String[i + 1]);
            encoded3 = chars.indexOf(base64String[i + 2]);
            encoded4 = chars.indexOf(base64String[i + 3]);
            
            bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
            if (encoded3 !== 64) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
            if (encoded4 !== 64) bytes[p++] = ((encoded3 & 3) << 6) | encoded4;
          }
          
          return bytes;
        };
        
        // Try to decode the base64 string
        let uint8Array: Uint8Array;
        try {
          uint8Array = decodeBase64(base64);
          console.log('Decoded array size:', uint8Array.length);
        } catch (decodeError) {
          console.error('Failed to decode base64:', decodeError);
          return null;
        }
        
        // Create a blob from the Uint8Array
        const blob = new Blob([uint8Array], { type: 'image/jpeg' });
        console.log('Created blob size:', blob.size, 'bytes');
        
        if (blob.size === 0) {
          console.error('Blob is empty after conversion');
          return null;
        }
        
        // Upload the blob to Supabase
        const fileName = `${productId}.jpg`;
        const filePath = fileName;
        
        console.log('Uploading blob to Supabase...');
        const { data, error } = await this.supabase.storage
          .from('product-images')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            upsert: true
          });
        
        if (error) {
          console.error('Error uploading image to Supabase storage:', error);
          
          // Try alternative: upload base64 directly using decode function
          console.log('Trying alternative upload method...');
          const { data: altData, error: altError } = await this.supabase.storage
            .from('product-images')
            .upload(filePath, new Blob([uint8Array], { type: 'image/jpeg' }), {
              contentType: 'image/jpeg',
              upsert: true
            });
          
          if (altError) {
            console.error('Alternative upload also failed:', altError);
            return null;
          }
          
          console.log('Successfully uploaded via alternative method:', altData.path);
          return altData.path;
        }
        
        console.log('Successfully uploaded image:', data.path);
        return data.path;
        
      } catch (error) {
        console.error('Error processing image:', error);
        return null;
      }

    } catch (error) {
      console.error('Supabase image upload error:', error);
      return null;
    }
  }

  async getImageUrl(imagePath: string): Promise<string | null> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data } = this.supabase.storage
        .from('product-images')
        .getPublicUrl(imagePath);

      return data.publicUrl;

    } catch (error) {
      console.error('Error getting image URL:', error);
      return null;
    }
  }

  async deleteProductImage(imagePath: string): Promise<boolean> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { error } = await this.supabase.storage
        .from('product-images')
        .remove([imagePath]);

      if (error) {
        console.error('Error deleting image from Supabase storage:', error);
        return false;
      }

      console.log('Successfully deleted image:', imagePath);
      return true;

    } catch (error) {
      console.error('Supabase image delete error:', error);
      return false;
    }
  }
}

export default new SupabaseService();