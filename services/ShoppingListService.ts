import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedItem } from '../types';

const STORAGE_KEY = '@kipri_shopping_list';

class ShoppingListService {
  private static instance: ShoppingListService;
  private items: SavedItem[] = [];
  private isLoaded = false;

  private constructor() {}

  public static getInstance(): ShoppingListService {
    if (!ShoppingListService.instance) {
      ShoppingListService.instance = new ShoppingListService();
    }
    return ShoppingListService.instance;
  }

  public async loadItems(): Promise<SavedItem[]> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.items = JSON.parse(stored);
      } else {
        this.items = [];
      }
      this.isLoaded = true;
      console.log('Shopping list loaded:', this.items.length, 'items');
      return this.items;
    } catch (error) {
      console.error('Error loading shopping list:', error);
      this.items = [];
      this.isLoaded = true;
      return this.items;
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
      console.log('Item saved to shopping list:', item.productName);
    } catch (error) {
      console.error('Error saving item to shopping list:', error);
      throw error;
    }
  }

  public async removeItem(itemId: string): Promise<void> {
    try {
      this.items = this.items.filter(item => item.id !== itemId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
      console.log('Item removed from shopping list:', itemId);
    } catch (error) {
      console.error('Error removing item from shopping list:', error);
      throw error;
    }
  }

  public async clearAll(): Promise<void> {
    try {
      this.items = [];
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('Shopping list cleared');
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
