import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Image } from 'react-native';
import { Product, Promotion } from '../types';
import DataCacheService from '../services/DataCacheService';
import ProductGroupingService, { CombinedProduct } from '../services/ProductGroupingService';

interface AppDataContextType {
  products: Product[];
  promotions: Promotion[];
  combinedProducts: CombinedProduct[];
  imageUrls: { [key: string]: string | null };
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  loadingMessage: string;
  refresh: () => Promise<void>;
}

interface AppDataProviderProps {
  children: React.ReactNode;
  onReady?: () => void;
  onLoadingMessage?: (message: string) => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<AppDataProviderProps> = ({
  children,
  onReady,
  onLoadingMessage
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [combinedProducts, setCombinedProducts] = useState<CombinedProduct[]>([]);
  const [imageUrls, setImageUrls] = useState<{ [key: string]: string | null }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Loading your savings...');

  const cacheService = DataCacheService.getInstance();
  const groupingService = ProductGroupingService.getInstance();

  const updateLoadingMessage = useCallback((message: string) => {
    setLoadingMessage(message);
    if (onLoadingMessage) {
      onLoadingMessage(message);
    }
  }, [onLoadingMessage]);

  const preloadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Step 1: Fetch products and promotions
      updateLoadingMessage('Fetching products...');
      console.log('[AppDataContext] Starting data preload...');

      const { products: fetchedProducts, promotions: fetchedPromotions } =
        await cacheService.preloadAllData();

      console.log(`[AppDataContext] Fetched ${fetchedProducts.length} products, ${fetchedPromotions.length} promotions`);

      setProducts(fetchedProducts);
      setPromotions(fetchedPromotions);

      // Step 2: Group products into combined products
      updateLoadingMessage('Processing products...');
      console.log('[AppDataContext] Grouping products...');

      const groups = groupingService.groupProducts(fetchedProducts);
      const combined = groupingService.createCombinedProducts(groups);

      console.log(`[AppDataContext] Created ${combined.length} combined products`);
      setCombinedProducts(combined);

      // Step 3: Preload all image URLs
      updateLoadingMessage('Loading images...');
      console.log('[AppDataContext] Preloading image URLs...');

      const productIds = combined.map(cp => cp.primaryImageProductId);
      const preloadedImageUrls = await cacheService.preloadAllImageUrls(productIds);

      console.log(`[AppDataContext] Preloaded ${Object.keys(preloadedImageUrls).length} image URLs`);
      setImageUrls(preloadedImageUrls);

      // Step 4: Prefetch actual images into memory/cache
      updateLoadingMessage('Caching images...');
      console.log('[AppDataContext] Prefetching images into memory...');

      const validUrls = Object.values(preloadedImageUrls).filter((url): url is string => url !== null);

      // Prefetch images in batches to avoid overwhelming the network
      const imageBatchSize = 5;
      for (let i = 0; i < validUrls.length; i += imageBatchSize) {
        const batch = validUrls.slice(i, i + imageBatchSize);
        await Promise.all(
          batch.map(url =>
            Image.prefetch(url).catch(err => {
              console.log('[AppDataContext] Failed to prefetch image:', err);
              return false;
            })
          )
        );
        const progress = Math.min(i + imageBatchSize, validUrls.length);
        console.log(`[AppDataContext] Image prefetch progress: ${progress}/${validUrls.length}`);
      }

      console.log('[AppDataContext] Image prefetch complete!');
      updateLoadingMessage('Ready!');
      console.log('[AppDataContext] Data preload complete!');

      setIsReady(true);
      if (onReady) {
        onReady();
      }
    } catch (err) {
      console.error('[AppDataContext] Error preloading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');

      // Proceed with empty data on error
      setProducts([]);
      setPromotions([]);
      setCombinedProducts([]);
      setImageUrls({});
      setIsReady(true);

      if (onReady) {
        onReady();
      }
    } finally {
      setIsLoading(false);
    }
  }, [cacheService, groupingService, onReady, updateLoadingMessage]);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[AppDataContext] Refreshing data...');

      // Force refresh all data
      const { products: fetchedProducts, promotions: fetchedPromotions } =
        await cacheService.preloadAllData();

      setProducts(fetchedProducts);
      setPromotions(fetchedPromotions);

      // Re-group products
      const groups = groupingService.groupProducts(fetchedProducts);
      const combined = groupingService.createCombinedProducts(groups);
      setCombinedProducts(combined);

      // Re-preload image URLs with force refresh
      const productIds = combined.map(cp => cp.primaryImageProductId);
      const preloadedImageUrls: { [key: string]: string | null } = {};

      // Use batch preloading
      const batchSize = 10;
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (id) => ({
            id,
            url: await cacheService.getSignedImageUrl(id, true)
          }))
        );
        results.forEach(r => { preloadedImageUrls[r.id] = r.url; });
      }

      setImageUrls(preloadedImageUrls);

      // Prefetch images into memory cache
      const validUrls = Object.values(preloadedImageUrls).filter((url): url is string => url !== null);
      const imageBatchSize = 5;
      for (let i = 0; i < validUrls.length; i += imageBatchSize) {
        const batch = validUrls.slice(i, i + imageBatchSize);
        await Promise.all(
          batch.map(url => Image.prefetch(url).catch(() => false))
        );
      }

      console.log('[AppDataContext] Data refresh complete!');
    } catch (err) {
      console.error('[AppDataContext] Error refreshing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [cacheService, groupingService]);

  // Initial data load on mount
  useEffect(() => {
    preloadData();
  }, []);

  const value: AppDataContextType = useMemo(() => ({
    products,
    promotions,
    combinedProducts,
    imageUrls,
    isLoading,
    isReady,
    error,
    loadingMessage,
    refresh,
  }), [products, promotions, combinedProducts, imageUrls, isLoading, isReady, error, loadingMessage, refresh]);

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = (): AppDataContextType => {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};
