import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Product, Promotion } from '../types';
import DataCacheService from '../services/DataCacheService';
import ProductGroupingService, { CombinedProduct } from '../services/ProductGroupingService';

interface AppDataContextType {
  products: Product[];
  promotions: Promotion[];
  combinedProducts: CombinedProduct[];
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  loadingMessage: string;
  refresh: () => Promise<void>;
  reloadForStores: (storeNames: string[]) => Promise<void>;
  getImageUrl: (productId: string, imageFilename?: string) => string;
}

interface AppDataProviderProps {
  children: React.ReactNode;
  onReady?: () => void;
  onLoadingMessage?: (message: string) => void;
  selectedStoreNames?: string[] | null;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<AppDataProviderProps> = ({
  children,
  onReady,
  onLoadingMessage,
  selectedStoreNames = null
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [combinedProducts, setCombinedProducts] = useState<CombinedProduct[]>([]);
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

  // Fast synchronous image URL generator - no preloading needed!
  const getImageUrl = useCallback((productId: string, imageFilename?: string): string => {
    return cacheService.getImageUrl(productId, imageFilename);
  }, [cacheService]);

  const preloadData = useCallback(async (storeNames?: string[] | null) => {
    try {
      setIsLoading(true);
      setError(null);

      // Step 1: Fetch products and promotions
      updateLoadingMessage('Fetching products...');
      console.log('[AppDataContext] Starting data preload...');

      let fetchedProducts: Product[];
      let fetchedPromotions: Promotion[];

      // If store names are provided, only load data for those stores
      if (storeNames && storeNames.length > 0) {
        console.log(`[AppDataContext] Loading data for ${storeNames.length} selected stores:`, storeNames);
        const result = await cacheService.preloadDataForStores(storeNames);
        fetchedProducts = result.products;
        fetchedPromotions = result.promotions;
      } else {
        console.log('[AppDataContext] Loading all data (no store filter)');
        const result = await cacheService.preloadAllData();
        fetchedProducts = result.products;
        fetchedPromotions = result.promotions;
      }

      console.log(`[AppDataContext] Fetched ${fetchedProducts.length} products, ${fetchedPromotions.length} promotions`);

      setProducts(fetchedProducts);
      setPromotions(fetchedPromotions);

      // Step 2: Group products into combined products
      updateLoadingMessage('Organizing products...');
      console.log('[AppDataContext] Grouping products...');

      const groups = groupingService.groupProducts(fetchedProducts);
      const combined = groupingService.createCombinedProducts(groups);

      console.log(`[AppDataContext] Created ${combined.length} combined products`);
      setCombinedProducts(combined);

      // NO IMAGE PRELOADING! Images load on-demand via expo-image with disk caching
      // This is what makes the app fast - we show the UI immediately

      updateLoadingMessage('Ready!');
      console.log('[AppDataContext] Data preload complete! (Images will load on-demand)');

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
      setIsReady(true);

      if (onReady) {
        onReady();
      }
    } finally {
      setIsLoading(false);
    }
  }, [cacheService, groupingService, onReady, updateLoadingMessage]);

  const reloadForStores = useCallback(async (storeNames: string[]) => {
    try {
      console.log('[AppDataContext] Reloading data for new stores:', storeNames);
      setIsLoading(true);
      setError(null);

      // Clear old cached data
      updateLoadingMessage('Clearing old data...');
      await cacheService.invalidateCache();

      // Clear state
      setProducts([]);
      setPromotions([]);
      setCombinedProducts([]);

      // Reload data for new stores
      await preloadData(storeNames);

      console.log('[AppDataContext] Store data reload complete');
    } catch (err) {
      console.error('[AppDataContext] Error reloading data for stores:', err);
      setError(err instanceof Error ? err.message : 'Failed to reload data');
      throw err;
    }
  }, [cacheService, preloadData, updateLoadingMessage]);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[AppDataContext] Refreshing data...');

      // Force refresh data - use store filter if available
      let fetchedProducts: Product[];
      let fetchedPromotions: Promotion[];

      if (selectedStoreNames && selectedStoreNames.length > 0) {
        console.log(`[AppDataContext] Refreshing data for ${selectedStoreNames.length} selected stores`);
        const result = await cacheService.preloadDataForStores(selectedStoreNames);
        fetchedProducts = result.products;
        fetchedPromotions = result.promotions;
      } else {
        console.log('[AppDataContext] Refreshing all data (no store filter)');
        const result = await cacheService.preloadAllData();
        fetchedProducts = result.products;
        fetchedPromotions = result.promotions;
      }

      setProducts(fetchedProducts);
      setPromotions(fetchedPromotions);

      // Re-group products
      const groups = groupingService.groupProducts(fetchedProducts);
      const combined = groupingService.createCombinedProducts(groups);
      setCombinedProducts(combined);

      // No image preloading - expo-image handles caching automatically

      console.log('[AppDataContext] Data refresh complete!');
    } catch (err) {
      console.error('[AppDataContext] Error refreshing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [cacheService, groupingService, selectedStoreNames]);

  // Initial data load on mount
  useEffect(() => {
    preloadData(selectedStoreNames || undefined);
  }, [selectedStoreNames]);

  const value: AppDataContextType = useMemo(() => ({
    products,
    promotions,
    combinedProducts,
    isLoading,
    isReady,
    error,
    loadingMessage,
    refresh,
    reloadForStores,
    getImageUrl,
  }), [products, promotions, combinedProducts, isLoading, isReady, error, loadingMessage, refresh, reloadForStores, getImageUrl]);

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
