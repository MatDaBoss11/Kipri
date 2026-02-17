export interface Product {
  id: string;
  product: string;
  brand?: string;   // Brand name in CAPITALS (e.g., "NESTLE", "WINNERS")
  size?: string;
  price: number;
  store: string;
  categories?: string[];
  images?: string;  // Image filename like "IMG_3024"
  created_at: string;
}

export interface Promotion {
  id: string;
  product_name: string;
  brand?: string;   // Brand name in CAPITALS
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
  UPDATE = 'update',
  RECEIPT = 'receipt'
}

export interface ReceiptItem {
  product_name: string;
  abbreviated_name: string;
  brand: string;
  price: number;
  quantity: number;
  size: string;
}

export interface ReceiptScanResult {
  store_name: string;
  date: string;
  items: ReceiptItem[];
  total: number;
  currency: string;
}

export interface ReviewedReceiptItem extends ReceiptItem {
  included: boolean;
  categories: string[];
  store: string;
  isDuplicate: boolean;
  existingProductId?: string;
}

export interface ProcessReceiptResponse {
  success: boolean;
  data?: ReceiptScanResult;
  error?: string;
}

export interface SavedItem {
  id: string;                    // Format: "productId_storeName"
  productId: string;
  productName: string;
  brand?: string;                // Brand name in CAPITALS
  size?: string;
  price: number;
  store: string;
  categories?: string[];
  savedAt: string;               // ISO timestamp
}

export interface Store {
  id: string;
  name: string;                  // Full store name like "Winners Pereybere"
  chain: string | null;          // Brand like "Winners"
  location: string | null;       // Place like "Pereybere"
  icon: string;                  // Emoji, default would be "🏪"
  color: string;                 // Hex color like "#4CAF50"
  is_active: boolean;
  created_at: string;
  latitude: number | null;       // GPS latitude (WGS 84)
  longitude: number | null;      // GPS longitude (WGS 84)
}

export interface UserStorePreference {
  id: string;
  user_id: string;
  store_id: string;
  priority: number;              // 1, 2, or 3
  created_at: string;
}