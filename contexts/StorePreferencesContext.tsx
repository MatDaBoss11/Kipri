import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import StoreService from '../services/StoreService';
import AuthService from '../services/AuthService';
import { Store } from '../types';

interface StorePreferencesContextType {
  selectedStores: Store[] | null;
  hasSelectedStores: boolean;
  isLoading: boolean;
  loadUserStores: () => Promise<void>;
  saveStorePreferences: (storeIds: string[]) => Promise<boolean>;
  clearStorePreferences: () => Promise<void>;
}

const StorePreferencesContext = createContext<StorePreferencesContextType | undefined>(undefined);

export const StorePreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedStores, setSelectedStores] = useState<Store[] | null>(null);
  const [hasSelectedStores, setHasSelectedStores] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const storeService = StoreService.getInstance();
  const authService = AuthService;

  const loadUserStores = useCallback(async () => {
    try {
      console.log('🏪 [StorePreferencesContext] Loading user store preferences...');
      setIsLoading(true);

      const user = await authService.getCurrentUser();
      if (!user) {
        console.log('🏪 [StorePreferencesContext] No user logged in, skipping store load');
        setSelectedStores(null);
        setHasSelectedStores(false);
        return;
      }

      const stores = await storeService.getUserStorePreferences(user.id);

      setSelectedStores(stores);
      setHasSelectedStores(stores.length > 0);

      console.log('🏪 ✅ [StorePreferencesContext] User stores loaded successfully:', stores.length, 'stores');
    } catch (error) {
      console.error('🏪 ❌ [StorePreferencesContext] Error loading user stores:', error);
      setSelectedStores(null);
      setHasSelectedStores(false);
    } finally {
      setIsLoading(false);
    }
  }, [authService, storeService]);

  useEffect(() => {
    // On mount, check if user is logged in and load their stores
    const initializeStores = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          console.log('🏪 [StorePreferencesContext] User is logged in, loading stores...');
          await loadUserStores();
        } else {
          console.log('🏪 [StorePreferencesContext] No user logged in on mount');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('🏪 ❌ [StorePreferencesContext] Error initializing stores:', error);
        setIsLoading(false);
      }
    };

    initializeStores();
  }, [loadUserStores, authService]);

  const saveStorePreferences = useCallback(async (storeIds: string[]): Promise<boolean> => {
    try {
      console.log('🏪 💾 [StorePreferencesContext] Saving store preferences...', storeIds);

      // Validate exactly 3 stores
      if (storeIds.length !== 3) {
        console.error('🏪 ❌ [StorePreferencesContext] Must provide exactly 3 store IDs, got:', storeIds.length);
        return false;
      }

      const user = await authService.getCurrentUser();
      if (!user) {
        console.error('🏪 ❌ [StorePreferencesContext] Cannot save preferences: user not logged in');
        return false;
      }

      const success = await storeService.saveUserStorePreferences(user.id, storeIds);

      if (success) {
        console.log('🏪 ✅ [StorePreferencesContext] Store preferences saved successfully, reloading...');
        // Reload stores after saving
        await loadUserStores();
      } else {
        console.error('🏪 ❌ [StorePreferencesContext] Failed to save store preferences');
      }

      return success;
    } catch (error) {
      console.error('🏪 ❌ [StorePreferencesContext] Error saving store preferences:', error);
      return false;
    }
  }, [authService, storeService, loadUserStores]);

  const clearStorePreferences = useCallback(async () => {
    try {
      console.log('🏪 🗑️ [StorePreferencesContext] Clearing store preferences...');

      setSelectedStores(null);
      setHasSelectedStores(false);

      console.log('🏪 ✅ [StorePreferencesContext] Store preferences cleared');
    } catch (error) {
      console.error('🏪 ❌ [StorePreferencesContext] Error clearing store preferences:', error);
    }
  }, []);

  const value: StorePreferencesContextType = {
    selectedStores,
    hasSelectedStores,
    isLoading,
    loadUserStores,
    saveStorePreferences,
    clearStorePreferences,
  };

  return (
    <StorePreferencesContext.Provider value={value}>
      {children}
    </StorePreferencesContext.Provider>
  );
};

export const useStorePreferences = (): StorePreferencesContextType => {
  const context = useContext(StorePreferencesContext);
  if (context === undefined) {
    throw new Error('useStorePreferences must be used within a StorePreferencesProvider');
  }
  return context;
};
