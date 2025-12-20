import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedItem } from '../types';
import { supabase } from './AuthService';

const STORAGE_KEY = '@kipri_shopping_list';

class ShoppingListService {
  private static instance: ShoppingListService;
  private items: SavedItem[] = [];
  private isLoaded = false;
  private listeners: Set<() => void> = new Set();

  private constructor() { }

  public static getInstance(): ShoppingListService {
    if (!ShoppingListService.instance) {
      ShoppingListService.instance = new ShoppingListService();
    }
    return ShoppingListService.instance;
  }

  /**
   * Subscribe to changes in the shopping list
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  public async loadItems(): Promise<SavedItem[]> {
    try {
      // 1. Load from local storage first for immediate UI response
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.items = JSON.parse(stored);
      } else {
        this.items = [];
      }
      this.isLoaded = true;
      console.log('Local shopping list loaded:', this.items.length, 'items');
      this.notifyListeners();

      // 2. If user is logged in, sync from Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await this.syncDownFromCloud(user.id);
      }

      return this.items;
    } catch (error) {
      console.error('Error loading shopping list:', error);
      this.items = [];
      this.isLoaded = true;
      this.notifyListeners();
      return this.items;
    }
  }

  /**
   * Fetches the wishlist from Supabase and updates local storage
   */
  public async syncDownFromCloud(userId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('user_wishlists')
        .select('items')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is no rows found
        console.error('Error syncing down from cloud:', error);
        return;
      }

      if (data && data.items) {
        const cloudItems = data.items as SavedItem[];
        // Simple overwrite policy: Cloud is the source of truth if we are logged in
        this.items = cloudItems;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
        console.log('Synced down from cloud:', this.items.length, 'items');
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Sync down failed:', error);
    }
  }

  /**
   * Uploads the current local wishlist to Supabase
   */
  public async syncUpToCloud(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // Not logged in, no need to sync up

      const { error } = await supabase
        .from('user_wishlists')
        .upsert({
          user_id: user.id,
          items: this.items,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error syncing up to cloud:', error);
      } else {
        console.log('Successfully synced up to cloud');
      }
    } catch (error) {
      console.error('Sync up failed:', error);
    }
  }

  public async saveItem(item: SavedItem): Promise<void> {
    try {
      // Check if item already exists
      const existingIndex = this.items.findIndex(i => i.id === item.id);
      if (existingIndex >= 0) {
        // Update existing item
        this.items[existingIndex] = item;
      } else {
        // Add new item
        this.items.push(item);
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
      console.log('Item saved to local shopping list:', item.productName);
      this.notifyListeners();

      // Sync to cloud if possible
      await this.syncUpToCloud();
    } catch (error) {
      console.error('Error saving item:', error);
      throw error;
    }
  }

  public async removeItem(itemId: string): Promise<void> {
    try {
      this.items = this.items.filter(item => item.id !== itemId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
      console.log('Item removed from local list:', itemId);
      this.notifyListeners();

      // Sync to cloud
      await this.syncUpToCloud();
    } catch (error) {
      console.error('Error removing item:', error);
      throw error;
    }
  }

  public async clearAll(): Promise<void> {
    try {
      this.items = [];
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('Local shopping list cleared');
      this.notifyListeners();

      // Sync to cloud
      await this.syncUpToCloud();
    } catch (error) {
      console.error('Error clearing shopping list:', error);
      throw error;
    }
  }

  public isItemSaved(productId: string, store: string): boolean {
    const itemId = `${productId}_${store}`;
    return this.items.some(item => item.id === itemId);
  }

  public getCachedItems(): SavedItem[] {
    return this.items;
  }
}

export default ShoppingListService;
