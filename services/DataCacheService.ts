import { supabase } from '../config/supabase';

interface Product {
  id: string;
  product: string;
  size?: string;
  price: number;
  store: string;
  category?: string;
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
  category?: string;
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
      const allPromotions: Promotion[] = [];

      await this.fetchPromotionsFromStore('winners_promotions', 'Winners', allPromotions);
      await this.fetchPromotionsFromStore('super_u_promotions', 'Super U', allPromotions);
      await this.fetchPromotionsFromStore('kingsavers_promotions', 'Kingsavers', allPromotions);

      allPromotions.sort((a, b) => {
        const aTime = a.timestamp || '';
        const bTime = b.timestamp || '';
        return bTime.localeCompare(aTime);
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

  private async fetchPromotionsFromStore(
    tableName: string,
    storeName: string,
    allPromotions: Promotion[]
  ): Promise<void> {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      if (data) {
        for (const item of data) {
          const category = item.categories || item.category;
          allPromotions.push({
            ...item,
            store_name: storeName,
            isPromotion: true,
            category: category // Keep original case, filtering will handle normalization
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching ${tableName}:`, error);
    }
  }

  public async getSignedImageUrl(productId: string, forceRefresh = false): Promise<string | null> {
    // Convert productId to string if it's a number
    const productIdStr = String(productId);
    
    console.log('🔄 Attempting to get image URL for productId:', productIdStr);

    const cacheKey = productIdStr;

    if (!forceRefresh && this.imageUrls[cacheKey]) {
      console.log('🖼️ Using cached image URL for product', productIdStr);
      return this.imageUrls[cacheKey];
    }

    try {
      // Add cache-busting parameter with current timestamp to force fresh image load
      const timestamp = Date.now();
      const publicUrl = `https://reuhsokiceymokjwgwjg.supabase.co/storage/v1/object/public/product-images/${productIdStr}.jpg?v=${timestamp}`;
      
      console.log('🔄 Generated cache-busting URL for product', productIdStr, ':', publicUrl);
      
      this.imageUrls[cacheKey] = publicUrl;
      console.log('✅ Image URL cached for product', productIdStr);
      return publicUrl;
    } catch (error) {
      console.error('❌ Error generating public URL for product', productIdStr, ':', error);
      return null;
    }
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
}

export default DataCacheService;