import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CombinedProduct } from '../components/CombinedProductCard';
import { findPromotionForProduct } from '../constants/mainProductList';
import ShoppingListService from '../services/ShoppingListService';
import { Product, Promotion, SavedItem } from '../types';

interface SavedItemsContextType {
  savedItems: SavedItem[];
  isLoading: boolean;
  totalCost: number;
  saveLowestPriceProduct: (combinedProduct: CombinedProduct, promotions: Promotion[]) => Promise<void>;
  saveSpecificProduct: (product: Product | Promotion, promotions: Promotion[]) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  isProductSaved: (productId: string, store: string) => boolean;
  clearAll: () => Promise<void>;
  refreshItems: () => Promise<void>;
}

const SavedItemsContext = createContext<SavedItemsContextType | undefined>(undefined);

export const SavedItemsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const shoppingListService = ShoppingListService.getInstance();

  const loadItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const items = await shoppingListService.loadItems();
      setSavedItems(items);
    } catch (error) {
      console.error('Error loading saved items:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Initial load
    loadItems();

    // 2. Subscribe to service updates (e.g. from cloud sync)
    const unsubscribe = shoppingListService.subscribe(() => {
      console.log('[SavedItemsContext] Shopping list updated via service event');
      const items = shoppingListService.getCachedItems();
      setSavedItems([...items]);
    });

    return () => unsubscribe();
  }, [loadItems, shoppingListService]);

  const getStoreName = (item: Product | Promotion): string => {
    return 'store' in item ? item.store : item.store_name;
  };

  const getProductName = (item: Product | Promotion): string => {
    return 'product' in item ? item.product : item.product_name;
  };

  const getPrice = (item: Product | Promotion): number => {
    return 'price' in item ? item.price : item.new_price;
  };

  const getEffectivePrice = (item: Product | Promotion, promotions: Promotion[]): number => {
    // If it's already a promotion item, return its price
    if ('isPromotion' in item) {
      return getPrice(item);
    }
    // Check if there's a promotion for this product
    const promo = findPromotionForProduct(item as Product, promotions);
    if (promo) {
      return promo.new_price;
    }
    return getPrice(item);
  };

  const saveLowestPriceProduct = useCallback(async (combinedProduct: CombinedProduct, promotions: Promotion[]) => {
    try {
      // Find the product with the lowest effective price
      let lowestPrice = Infinity;
      let cheapestProduct: Product | Promotion | null = null;

      for (const product of combinedProduct.products) {
        const effectivePrice = getEffectivePrice(product, promotions);
        if (effectivePrice < lowestPrice) {
          lowestPrice = effectivePrice;
          cheapestProduct = product;
        }
      }

      if (!cheapestProduct) return;

      const store = getStoreName(cheapestProduct);
      const savedItem: SavedItem = {
        id: `${cheapestProduct.id}_${store}`,
        productId: cheapestProduct.id,
        productName: combinedProduct.name,
        size: combinedProduct.size,
        price: lowestPrice,
        store: store,
        categories: combinedProduct.categories,
        savedAt: new Date().toISOString(),
      };

      await shoppingListService.saveItem(savedItem);
      const items = shoppingListService.getCachedItems();
      setSavedItems([...items]);
    } catch (error) {
      console.error('Error saving lowest price product:', error);
      throw error;
    }
  }, []);

  const saveSpecificProduct = useCallback(async (product: Product | Promotion, promotions: Promotion[]) => {
    try {
      const store = getStoreName(product);
      const productName = getProductName(product);
      const effectivePrice = getEffectivePrice(product, promotions);

      const savedItem: SavedItem = {
        id: `${product.id}_${store}`,
        productId: product.id,
        productName: productName,
        size: 'size' in product ? product.size : undefined,
        price: effectivePrice,
        store: store,
        categories: 'categories' in product ? product.categories : undefined,
        savedAt: new Date().toISOString(),
      };

      await shoppingListService.saveItem(savedItem);
      const items = shoppingListService.getCachedItems();
      setSavedItems([...items]);
    } catch (error) {
      console.error('Error saving specific product:', error);
      throw error;
    }
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    try {
      await shoppingListService.removeItem(itemId);
      const items = shoppingListService.getCachedItems();
      setSavedItems([...items]);
    } catch (error) {
      console.error('Error removing item:', error);
      throw error;
    }
  }, []);

  const isProductSaved = useCallback((productId: string, store: string): boolean => {
    return shoppingListService.isItemSaved(productId, store);
  }, [savedItems]); // Depend on savedItems to re-check when items change

  const clearAll = useCallback(async () => {
    try {
      await shoppingListService.clearAll();
      setSavedItems([]);
    } catch (error) {
      console.error('Error clearing all items:', error);
      throw error;
    }
  }, []);

  const refreshItems = useCallback(async () => {
    await loadItems();
  }, [loadItems]);

  const totalCost = useMemo(() => {
    return savedItems.reduce((sum, item) => sum + item.price, 0);
  }, [savedItems]);

  const value: SavedItemsContextType = {
    savedItems,
    isLoading,
    totalCost,
    saveLowestPriceProduct,
    saveSpecificProduct,
    removeItem,
    isProductSaved,
    clearAll,
    refreshItems,
  };

  return (
    <SavedItemsContext.Provider value={value}>
      {children}
    </SavedItemsContext.Provider>
  );
};

export const useSavedItems = (): SavedItemsContextType => {
  const context = useContext(SavedItemsContext);
  if (context === undefined) {
    throw new Error('useSavedItems must be used within a SavedItemsProvider');
  }
  return context;
};
