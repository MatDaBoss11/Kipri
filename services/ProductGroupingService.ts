import { Product, Promotion } from '../types';

export interface ProductGroup {
  id: string;
  products: (Product | Promotion)[];
  maxSize: 3;
  priceComparison?: PriceComparison;
}

// Store priority for image selection: Winners > Super U > King Savers
const STORE_PRIORITY: { [key: string]: number } = {
  'winners': 1,
  'super u': 2,
  'kingsavers': 3,
  'king savers': 3,
};

export interface CombinedProduct {
  id: string;
  name: string;
  brand?: string;
  size?: string;
  categories?: string[];
  products: (Product | Promotion)[];
  primaryProduct: Product | Promotion;
  primaryImageProductId: string;
}

export interface PriceComparison {
  lowest: number;
  middle?: number;
  highest: number;
  lowestIndex: number;
  middleIndex?: number;
  highestIndex: number;
}

export enum PriceLevel {
  LOWEST = 'lowest',
  MIDDLE = 'middle',
  HIGHEST = 'highest',
  NEUTRAL = 'neutral'
}

// Normalized size for comparison
interface NormalizedSize {
  value: number;
  unit: string;
  type: 'weight' | 'volume' | 'count' | 'unknown';
  original: string;
}

class ProductGroupingService {
  private static instance: ProductGroupingService;

  private constructor() {}

  public static getInstance(): ProductGroupingService {
    if (!ProductGroupingService.instance) {
      ProductGroupingService.instance = new ProductGroupingService();
    }
    return ProductGroupingService.instance;
  }

  // Main grouping function - NEW HIERARCHICAL APPROACH
  public groupProducts(items: (Product | Promotion)[]): ProductGroup[] {
    console.log(`[ProductGrouping] Starting to group ${items.length} items`);
    const groups: ProductGroup[] = [];
    const usedItems = new Set<string>();

    // Step 1: Group by NORMALIZED SIZE first
    const sizeGroups = this.groupByNormalizedSize(items);
    console.log(`[ProductGrouping] Size groups: ${sizeGroups.size}`);

    for (const [sizeKey, sizeItems] of sizeGroups) {
      console.log(`[ProductGrouping] Processing size "${sizeKey}" with ${sizeItems.length} items`);

      // Step 2: Within each size group, group by BRAND
      const brandGroups = this.groupByBrand(sizeItems);
      console.log(`[ProductGrouping] Brand groups for size "${sizeKey}": ${brandGroups.size}`);

      for (const [brand, brandItems] of brandGroups) {
        console.log(`[ProductGrouping] Processing brand "${brand}" with ${brandItems.length} items`);

        // Step 3: Within each brand group, match by PRODUCT NAME similarity
        const productGroups = this.matchByProductName(brandItems, usedItems);
        console.log(`[ProductGrouping] Created ${productGroups.length} product groups for brand "${brand}"`);

        groups.push(...productGroups);
      }
    }

    // Add remaining individual items as single-item groups
    const remainingItems = items.filter(item => !usedItems.has(item.id));
    console.log(`[ProductGrouping] ${remainingItems.length} items remaining (not grouped with others)`);
    remainingItems.forEach((item, index) => {
      const group: ProductGroup = {
        id: `single_${item.id}_${Date.now()}_${index}`,
        products: [item],
        maxSize: 3
      };
      groups.push(group);
    });

    console.log(`[ProductGrouping] Total groups created: ${groups.length} (${groups.filter(g => g.products.length > 1).length} multi-item, ${groups.filter(g => g.products.length === 1).length} single-item)`);
    return groups;
  }

  // Step 1: Group by normalized size (EXACT MATCH REQUIRED)
  private groupByNormalizedSize(items: (Product | Promotion)[]): Map<string, (Product | Promotion)[]> {
    const sizeMap = new Map<string, (Product | Promotion)[]>();

    items.forEach(item => {
      const size = this.getItemSize(item);
      const normalizedSizeKey = this.getNormalizedSizeKey(size);

      if (!sizeMap.has(normalizedSizeKey)) {
        sizeMap.set(normalizedSizeKey, []);
      }
      sizeMap.get(normalizedSizeKey)!.push(item);
    });

    return sizeMap;
  }

  // Normalize size to a consistent key for exact matching
  private getNormalizedSizeKey(size?: string): string {
    if (!size || size.trim() === '') {
      return 'NO_SIZE';
    }

    const normalized = this.normalizeSize(size);

    if (normalized.type === 'unknown') {
      // For unknown formats, use cleaned original string
      return size.toLowerCase().replace(/\s+/g, '').trim();
    }

    // Convert to base unit for comparison
    // Weight: convert to grams
    // Volume: convert to milliliters
    // Count: keep as is
    let baseValue = normalized.value;
    let baseUnit = normalized.unit;

    if (normalized.type === 'weight') {
      // Convert everything to grams
      if (normalized.unit === 'kg') {
        baseValue = normalized.value * 1000;
      }
      baseUnit = 'g';
    } else if (normalized.type === 'volume') {
      // Convert everything to milliliters
      if (normalized.unit === 'l') {
        baseValue = normalized.value * 1000;
      }
      baseUnit = 'ml';
    }

    return `${baseValue}${baseUnit}`;
  }

  // Parse and normalize size string
  private normalizeSize(size: string): NormalizedSize {
    const cleaned = size.toLowerCase().trim();

    // Handle count formats: x12, x6, 12pcs, 6 pieces, etc.
    const countMatch = cleaned.match(/^x?(\d+)\s*(pcs|pieces|pc|pack|eggs?)?$/i) ||
                       cleaned.match(/^(\d+)\s*x\s*(\d+)?/i);
    if (countMatch) {
      const count = parseInt(countMatch[1]);
      return { value: count, unit: 'x', type: 'count', original: size };
    }

    // Handle weight: g, gm, gram, grams, kg, kilogram
    const weightMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*(g|gm|gms|gram|grams|kg|kilogram|kilograms)$/i);
    if (weightMatch) {
      const value = parseFloat(weightMatch[1]);
      let unit = weightMatch[2].toLowerCase();

      // Normalize unit names
      if (['g', 'gm', 'gms', 'gram', 'grams'].includes(unit)) {
        unit = 'g';
      } else if (['kg', 'kilogram', 'kilograms'].includes(unit)) {
        unit = 'kg';
      }

      return { value, unit, type: 'weight', original: size };
    }

    // Handle volume: ml, l, liter, litre
    const volumeMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*(ml|milliliter|millilitre|l|liter|litre|litres|liters)$/i);
    if (volumeMatch) {
      const value = parseFloat(volumeMatch[1]);
      let unit = volumeMatch[2].toLowerCase();

      // Normalize unit names
      if (['ml', 'milliliter', 'millilitre'].includes(unit)) {
        unit = 'ml';
      } else if (['l', 'liter', 'litre', 'litres', 'liters'].includes(unit)) {
        unit = 'l';
      }

      return { value, unit, type: 'volume', original: size };
    }

    // Unknown format
    return { value: 0, unit: '', type: 'unknown', original: size };
  }

  // Step 2: Group by brand (EXACT MATCH REQUIRED)
  private groupByBrand(items: (Product | Promotion)[]): Map<string, (Product | Promotion)[]> {
    const brandMap = new Map<string, (Product | Promotion)[]>();

    items.forEach(item => {
      const brand = this.getItemBrand(item);
      // Normalize brand: uppercase, trim whitespace
      const normalizedBrand = brand ? brand.toUpperCase().trim() : 'NO_BRAND';

      if (!brandMap.has(normalizedBrand)) {
        brandMap.set(normalizedBrand, []);
      }
      brandMap.get(normalizedBrand)!.push(item);
    });

    return brandMap;
  }

  // Step 3: Match by product name similarity within same size + brand group
  private matchByProductName(
    items: (Product | Promotion)[],
    usedItems: Set<string>
  ): ProductGroup[] {
    const groups: ProductGroup[] = [];
    const availableItems = items.filter(item => !usedItems.has(item.id));

    if (availableItems.length === 0) return groups;

    // Build similarity matrix for product names
    const similarityMatrix = this.buildNameSimilarityMatrix(availableItems);

    // Find optimal groupings based on name similarity
    const optimalGroups = this.findOptimalGroupings(availableItems, similarityMatrix);

    optimalGroups.forEach((groupItems, index) => {
      if (this.hasStoreDiversity(groupItems)) {
        // Optional: Price sanity check (warn if price difference > 50 rupees)
        const prices = groupItems.map(item => this.getItemPrice(item));
        const maxPrice = Math.max(...prices);
        const minPrice = Math.min(...prices);
        if (maxPrice - minPrice > 100) {
          console.log(`[ProductGrouping] WARNING: Large price difference (${maxPrice - minPrice} Rs) in group - may be mismatched products`);
        }

        // Sort products by price: highest first (left), lowest last (right)
        const sortedItems = [...groupItems].sort((a, b) => {
          const priceA = this.getItemPrice(a);
          const priceB = this.getItemPrice(b);
          return priceB - priceA;
        });

        const group: ProductGroup = {
          id: `group_${groupItems.length}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`,
          products: sortedItems,
          maxSize: 3,
          priceComparison: this.calculatePriceComparison(sortedItems)
        };
        groups.push(group);

        // Mark items as used
        groupItems.forEach(item => usedItems.add(item.id));
      }
    });

    return groups;
  }

  // Build similarity matrix based only on product NAME (size and brand already matched)
  private buildNameSimilarityMatrix(items: (Product | Promotion)[]): number[][] {
    const matrix: number[][] = [];

    for (let i = 0; i < items.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < items.length; j++) {
        if (i === j) {
          matrix[i][j] = 0;
        } else {
          const name1 = this.getItemName(items[i]);
          const name2 = this.getItemName(items[j]);
          matrix[i][j] = this.calculateNameSimilarity(name1, name2);
        }
      }
    }

    return matrix;
  }

  // Calculate similarity between two product names
  private calculateNameSimilarity(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;

    const clean1 = this.cleanProductName(name1);
    const clean2 = this.cleanProductName(name2);

    if (clean1 === clean2) return 1;

    // Word-based similarity
    const words1 = clean1.split(/\s+/).filter(w => w.length > 1);
    const words2 = clean2.split(/\s+/).filter(w => w.length > 1);

    if (words1.length === 0 || words2.length === 0) return 0;

    // Calculate Jaccard similarity on significant words
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    const jaccardSimilarity = intersection.size / union.size;

    // Also calculate word overlap ratio
    let matchCount = 0;
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1 === word2) {
          matchCount += 1;
          break;
        } else if (this.areSimilarWords(word1, word2)) {
          matchCount += 0.8;
          break;
        }
      }
    }
    const overlapRatio = matchCount / Math.max(words1.length, words2.length);

    // Levenshtein similarity as fallback
    const levenshteinSim = this.calculateLevenshteinSimilarity(clean1, clean2);

    // Combined score (favor word-based matching)
    return Math.max(jaccardSimilarity, overlapRatio, levenshteinSim * 0.7);
  }

  // Clean product name: remove brand, size, extra info
  private cleanProductName(name: string): string {
    let cleaned = name.toLowerCase().trim();

    // Remove common size patterns that might be in the name
    cleaned = cleaned.replace(/\d+\s*(g|gm|kg|ml|l|pcs|x\d+)/gi, '');

    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  // Check if two words are similar
  private areSimilarWords(word1: string, word2: string): boolean {
    if (word1 === word2) return true;
    if (word1.includes(word2) || word2.includes(word1)) return true;

    // Levenshtein similarity for typos/variations
    const distance = this.levenshteinDistance(word1, word2);
    const maxLength = Math.max(word1.length, word2.length);
    const similarity = 1 - (distance / maxLength);

    return similarity >= 0.75;
  }

  // Find optimal groupings (groups of 2-3 from different stores)
  private findOptimalGroupings(items: (Product | Promotion)[], similarityMatrix: number[][]): (Product | Promotion)[][] {
    const groups: (Product | Promotion)[][] = [];
    const used = new Set<number>();
    const threshold = 0.5; // 50% name similarity required (higher since brand+size already match)

    for (let i = 0; i < items.length; i++) {
      if (used.has(i)) continue;

      const candidates = [];
      for (let j = 0; j < items.length; j++) {
        if (i !== j && !used.has(j) && similarityMatrix[i][j] >= threshold) {
          candidates.push({ index: j, similarity: similarityMatrix[i][j] });
        }
      }

      // Sort by similarity (highest first)
      candidates.sort((a, b) => b.similarity - a.similarity);

      // Try to form groups of 3, then 2
      if (candidates.length >= 2) {
        const group = [items[i], items[candidates[0].index], items[candidates[1].index]];
        if (this.hasStoreDiversity(group)) {
          groups.push(group);
          used.add(i);
          used.add(candidates[0].index);
          used.add(candidates[1].index);
          continue;
        }
      }

      if (candidates.length >= 1) {
        const group = [items[i], items[candidates[0].index]];
        if (this.hasStoreDiversity(group)) {
          groups.push(group);
          used.add(i);
          used.add(candidates[0].index);
        }
      }
    }

    return groups;
  }

  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);

    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private hasStoreDiversity(items: (Product | Promotion)[]): boolean {
    const stores = new Set(items.map(item => this.getItemStore(item).toLowerCase()));
    return stores.size === items.length;
  }

  private calculatePriceComparison(items: (Product | Promotion)[]): PriceComparison {
    const prices = items.map(item => this.getItemPrice(item));

    if (prices.length === 3) {
      return {
        lowest: prices[2],
        middle: prices[1],
        highest: prices[0],
        lowestIndex: 2,
        middleIndex: 1,
        highestIndex: 0
      };
    } else if (prices.length === 2) {
      return {
        lowest: prices[1],
        highest: prices[0],
        lowestIndex: 1,
        highestIndex: 0
      };
    } else {
      return {
        lowest: prices[0],
        highest: prices[0],
        lowestIndex: 0,
        highestIndex: 0
      };
    }
  }

  // Helper methods to handle both Product and Promotion types
  private getItemName(item: Product | Promotion): string {
    return 'product' in item ? item.product : item.product_name || '';
  }

  private getItemBrand(item: Product | Promotion): string | undefined {
    return item.brand;
  }

  private getItemSize(item: Product | Promotion): string | undefined {
    return item.size;
  }

  private getItemPrice(item: Product | Promotion): number {
    return 'price' in item ? item.price : item.new_price;
  }

  private getItemStore(item: Product | Promotion): string {
    return 'store' in item ? item.store : item.store_name;
  }

  private getItemCategories(item: Product | Promotion): string[] | undefined {
    return item.categories;
  }

  // Get price level for styling
  public getPriceLevel(group: ProductGroup, itemIndex: number): PriceLevel {
    if (!group.priceComparison || group.products.length === 1) {
      return PriceLevel.NEUTRAL;
    }

    const { lowestIndex, middleIndex, highestIndex } = group.priceComparison;

    if (itemIndex === lowestIndex) return PriceLevel.LOWEST;
    if (middleIndex !== undefined && itemIndex === middleIndex) return PriceLevel.MIDDLE;
    if (itemIndex === highestIndex) return PriceLevel.HIGHEST;

    return PriceLevel.NEUTRAL;
  }

  // Convert product groups to combined products for the new card design
  public createCombinedProducts(groups: ProductGroup[]): CombinedProduct[] {
    return groups.map((group, index) => {
      const products = group.products;

      // Find the primary product based on store priority
      const sortedByPriority = [...products].sort((a, b) => {
        const storeA = this.getItemStore(a).toLowerCase();
        const storeB = this.getItemStore(b).toLowerCase();
        const priorityA = this.getStorePriority(storeA);
        const priorityB = this.getStorePriority(storeB);
        return priorityA - priorityB;
      });

      const primaryProduct = sortedByPriority[0];
      const primaryProductId = primaryProduct.id;

      const name = this.getItemName(primaryProduct);
      const brand = this.getItemBrand(primaryProduct);
      const size = this.getItemSize(primaryProduct);
      const categories = this.getItemCategories(primaryProduct);

      // Sort products by price (lowest first for display)
      const sortedByPrice = [...products].sort((a, b) => {
        return this.getItemPrice(a) - this.getItemPrice(b);
      });

      return {
        id: `combined_${group.id}_${index}`,
        name,
        brand,
        size,
        categories,
        products: sortedByPrice,
        primaryProduct,
        primaryImageProductId: primaryProductId,
      };
    });
  }

  // Get store priority for image selection
  private getStorePriority(storeName: string): number {
    const normalized = storeName.toLowerCase();
    if (normalized.includes('winner')) return STORE_PRIORITY['winners'];
    if (normalized.includes('super') || normalized.includes(' u')) return STORE_PRIORITY['super u'];
    if (normalized.includes('king') || normalized.includes('saver')) return STORE_PRIORITY['kingsavers'];
    return 99;
  }
}

export default ProductGroupingService;
