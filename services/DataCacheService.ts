import { supabase } from '../config/supabase';

interface Product {
  id: string;
  product: string;
  brand?: string;
  size?: string;
  price: number;
  store: string;
  categories?: string[];
  images?: string;
  created_at: string;
}

interface Promotion {
  id: string;
  product_name: string;
  new_price: number;
  previous_price?: number;
  size?: string;
  store_name: string;
  categories?: string[];
  timestamp: string;
  isPromotion: boolean;
}

class DataCacheService {
  private static instance: DataCacheService;
  private products: Product[] | null = null;
  private promotions: Promotion[] | null = null;
  private imageUrls: { [key: string]: string } = {};
  private isProductsCached = false;
  private isPromotionsCached = false;
  private lastProductsUpdate: Date | null = null;
  private lastPromotionsUpdate: Date | null = null;
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): DataCacheService {
    if (!DataCacheService.instance) {
      DataCacheService.instance = new DataCacheService();
    }
    return DataCacheService.instance;
  }

  private isProductsCacheExpired(): boolean {
    return !this.lastProductsUpdate || 
           (Date.now() - this.lastProductsUpdate.getTime()) > this.cacheTimeout;
  }

  private isPromotionsCacheExpired(): boolean {
    return !this.lastPromotionsUpdate || 
           (Date.now() - this.lastPromotionsUpdate.getTime()) > this.cacheTimeout;
  }

  public get isProductsCacheValid(): boolean {
    return this.isProductsCached && !this.isProductsCacheExpired();
  }

  public get isPromotionsCacheValid(): boolean {
    return this.isPromotionsCached && !this.isPromotionsCacheExpired();
  }

  public get cachedProducts(): Product[] | null {
    return this.products;
  }

  public get cachedPromotions(): Promotion[] | null {
    return this.promotions;
  }

  public async getProducts(forceRefresh = false): Promise<Product[]> {
    if (!forceRefresh && this.isProductsCacheValid && this.products) {
      console.log('📦 Using cached products', this.products.length, 'items');
      return this.products;
    }

    try {
      console.log('🔄 Fetching products from database...');
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.products = data || [];
      this.isProductsCached = true;
      this.lastProductsUpdate = new Date();

      // Auto-detect database reset: if database is empty but we have cached images, clear everything
      if (this.products.length === 0 && Object.keys(this.imageUrls).length > 0) {
        console.log('🔍 Database appears to be reset (0 products but cached images exist)');
        await this.clearAllCacheForReset();
        this.products = []; // Keep it empty after clearing cache
        this.isProductsCached = true;
        this.lastProductsUpdate = new Date();
      }

      console.log('✅ Products cached successfully', this.products.length, 'items');
      return this.products;
    } catch (error) {
      console.error('❌ Error fetching products:', error);
      throw error;
    }
  }

  public async getPromotions(forceRefresh = false): Promise<Promotion[]> {
    if (!forceRefresh && this.isPromotionsCacheValid && this.promotions) {
      console.log('🎯 Using cached promotions', this.promotions.length, 'items');
      return this.promotions;
    }

    try {
      console.log('🔄 Fetching promotions from database...');

      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Map database results to Promotion interface
      const allPromotions: Promotion[] = (data || []).map(item => {
        // Handle both old 'category' field and new 'categories' JSONB array
        let categories: string[] | undefined;
        if (item.categories && Array.isArray(item.categories)) {
          categories = item.categories;
        } else if (item.category) {
          categories = [item.category];
        }

        return {
          id: item.id,
          product_name: item.product_name,
          new_price: item.new_price,
          previous_price: item.previous_price,
          size: item.size,
          store_name: item.store, // Map 'store' from database to 'store_name' in interface
          categories: categories,
          timestamp: item.timestamp,
          isPromotion: item.is_promotion !== undefined ? item.is_promotion : true
        };
      });

      this.promotions = allPromotions;
      this.isPromotionsCached = true;
      this.lastPromotionsUpdate = new Date();

      console.log('✅ Promotions cached successfully', this.promotions.length, 'items');
      return this.promotions;
    } catch (error) {
      console.error('❌ Error fetching promotions:', error);
      throw error;
    }
  }

  public async getSignedImageUrl(productId: string, imageFilename?: string, forceRefresh = false): Promise<string | null> {
    // Convert productId to string if it's a number
    const productIdStr = String(productId);

    console.log('🔄 Attempting to get image URL for productId:', productIdStr);

    const cacheKey = productIdStr;

    if (!forceRefresh && this.imageUrls[cacheKey]) {
      console.log('🖼️ Using cached image URL for product', productIdStr);
      return this.imageUrls[cacheKey];
    }

    try {
      // Use imageFilename if provided, otherwise fall back to productId
      // No cache-busting - let expo-image handle disk caching
      const filename = imageFilename || productIdStr;
      const publicUrl = `https://reuhsokiceymokjwgwjg.supabase.co/storage/v1/object/public/product-images/${filename}.jpg`;

      this.imageUrls[cacheKey] = publicUrl;
      return publicUrl;
    } catch (error) {
      console.error('❌ Error generating public URL for product', productIdStr, ':', error);
      return null;
    }
  }

  /**
   * Fast synchronous URL generator - no async overhead
   * Use this for on-demand image loading in components
   */
  public getImageUrl(productId: string, imageFilename?: string): string {
    const filename = imageFilename || String(productId);
    return `https://reuhsokiceymokjwgwjg.supabase.co/storage/v1/object/public/product-images/${filename}.jpg`;
  }

  public async invalidateCache(): Promise<void> {
    console.log('🗑️ Invalidating all cache data...');
    this.products = null;
    this.promotions = null;
    this.imageUrls = {};
    this.isProductsCached = false;
    this.isPromotionsCached = false;
    this.lastProductsUpdate = null;
    this.lastPromotionsUpdate = null;
    console.log('✅ All cache data cleared successfully');
  }

  public async invalidateProducts(): Promise<void> {
    console.log('🗑️ Invalidating products cache...');
    this.products = null;
    this.isProductsCached = false;
    this.lastProductsUpdate = null;
    // Also clear image cache when products are invalidated
    this.imageUrls = {};
    console.log('✅ Products cache and image cache cleared successfully');
  }

  public async invalidatePromotions(): Promise<void> {
    console.log('🗑️ Invalidating promotions cache...');
    this.promotions = null;
    this.isPromotionsCached = false;
    this.lastPromotionsUpdate = null;
    console.log('✅ Promotions cache cleared successfully');
  }

  public async invalidateImageCache(): Promise<void> {
    console.log('🗑️ Clearing image URL cache...');
    const imageCount = Object.keys(this.imageUrls).length;
    this.imageUrls = {};
    console.log(`✅ Image cache cleared successfully (removed ${imageCount} cached URLs)`);
  }

  public async clearAllCacheForReset(): Promise<void> {
    console.log('🔄 Database reset detected - clearing all cache...');
    await this.invalidateCache();
    console.log('✅ All cache cleared for database reset');
  }

  /**
   * Developer command to clear all cache data
   * This is intended for developer use only and should not be exposed in the UI
   * Usage: window.clearKipriCache()
   */
  public async developerClearCache(): Promise<void> {
    console.log('🛠️ Developer command: Clearing all cache...');
    await this.invalidateCache();
    console.log('✅ Developer cache clear completed successfully');
  }

  /**
   * Fetch all data at once for preloading during splash screen
   * This method forces a refresh to ensure fresh data on app startup
   */
  public async preloadAllData(): Promise<{ products: Product[]; promotions: Promotion[] }> {
    console.log('🚀 Preloading all data...');
    const [products, promotions] = await Promise.all([
      this.getProducts(true),
      this.getPromotions(true)
    ]);
    console.log(`✅ Preloaded ${products.length} products and ${promotions.length} promotions`);
    return { products, promotions };
  }

  /**
   * Fetch data filtered by store names for preloading
   * Only loads products and promotions from the specified stores
   * @param storeNames Array of store names to filter by
   */
  public async preloadDataForStores(storeNames: string[]): Promise<{ products: Product[]; promotions: Promotion[] }> {
    console.log('🚀 Preloading data for stores:', storeNames);

    try {
      // Fetch products filtered by store names
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .in('store', storeNames)
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      const products = productsData || [];

      // Fetch promotions filtered by store names
      const { data: promotionsData, error: promotionsError } = await supabase
        .from('promotions')
        .select('*')
        .in('store', storeNames)
        .order('timestamp', { ascending: false });

      if (promotionsError) throw promotionsError;

      // Map database results to Promotion interface
      const allPromotions: Promotion[] = (promotionsData || []).map(item => {
        // Handle both old 'category' field and new 'categories' JSONB array
        let categories: string[] | undefined;
        if (item.categories && Array.isArray(item.categories)) {
          categories = item.categories;
        } else if (item.category) {
          categories = [item.category];
        }

        return {
          id: item.id,
          product_name: item.product_name,
          new_price: item.new_price,
          previous_price: item.previous_price,
          size: item.size,
          store_name: item.store, // Map 'store' from database to 'store_name' in interface
          categories: categories,
          timestamp: item.timestamp,
          isPromotion: item.is_promotion !== undefined ? item.is_promotion : true
        };
      });

      // Update cache with filtered data
      this.products = products;
      this.promotions = allPromotions;
      this.isProductsCached = true;
      this.isPromotionsCached = true;
      this.lastProductsUpdate = new Date();
      this.lastPromotionsUpdate = new Date();

      console.log(`✅ Preloaded ${products.length} products and ${allPromotions.length} promotions from ${storeNames.length} stores`);
      return { products, promotions: allPromotions };
    } catch (error) {
      console.error('❌ Error preloading data for stores:', error);
      throw error;
    }
  }

  /**
   * Preload all image URLs in parallel with batching to avoid overwhelming the network
   * @param productImageInfo Array of objects with id and optional images filename
   * @returns Object mapping product IDs to their image URLs
   */
  public async preloadAllImageUrls(productImageInfo: { id: string; images?: string }[]): Promise<{ [key: string]: string | null }> {
    console.log(`🖼️ Preloading ${productImageInfo.length} image URLs...`);
    const imageUrls: { [key: string]: string | null } = {};
    const batchSize = 10;

    for (let i = 0; i < productImageInfo.length; i += batchSize) {
      const batch = productImageInfo.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (info) => ({
          id: info.id,
          url: await this.getSignedImageUrl(info.id, info.images)
        }))
      );
      results.forEach(r => { imageUrls[r.id] = r.url; });

      // Log progress for debugging
      const progress = Math.min(i + batchSize, productImageInfo.length);
      console.log(`📸 Image URL progress: ${progress}/${productImageInfo.length}`);
    }

    console.log(`✅ Preloaded ${Object.keys(imageUrls).length} image URLs`);
    return imageUrls;
  }
}

export default DataCacheService;