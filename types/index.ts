export interface Product {
  id: string;
  product: string;
  size?: string;
  price: number;
  store: string;
  categories?: string[];
  created_at: string;
}

export interface Promotion {
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

export interface CategoryInfo {
  name: string;
  emoji: string;
  displayName: string;
}

export enum AppMode {
  ADD = 'add',
  UPDATE = 'update'
}

export interface SavedItem {
  id: string;                    // Format: "productId_storeName"
  productId: string;
  productName: string;
  size?: string;
  price: number;
  store: string;
  categories?: string[];
  savedAt: string;               // ISO timestamp
}