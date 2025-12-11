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
  size?: string;
  category?: string;
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

class ProductGroupingService {
  private static instance: ProductGroupingService;

  private constructor() {}

  public static getInstance(): ProductGroupingService {
    if (!ProductGroupingService.instance) {
      ProductGroupingService.instance = new ProductGroupingService();
    }
    return ProductGroupingService.instance;
  }

  // Main grouping function
  public groupProducts(items: (Product | Promotion)[]): ProductGroup[] {
    console.log(`[ProductGrouping] Starting to group ${items.length} items`);
    const groups: ProductGroup[] = [];
    const usedItems = new Set<string>();

    // Group by category first
    const categorizedItems = this.groupByCategory(items);
    console.log(`[ProductGrouping] Categories found: ${Array.from(categorizedItems.keys()).join(', ')}`);

    for (const [category, categoryItems] of categorizedItems) {
      console.log(`[ProductGrouping] Processing category "${category}" with ${categoryItems.length} items`);
      const categoryGroups = this.createGroupsForCategory(categoryItems, usedItems);
      console.log(`[ProductGrouping] Created ${categoryGroups.length} groups for category "${category}"`);
      groups.push(...categoryGroups);
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

  private groupByCategory(items: (Product | Promotion)[]): Map<string, (Product | Promotion)[]> {
    const categoryMap = new Map<string, (Product | Promotion)[]>();

    items.forEach(item => {
      // Normalize category to lowercase for consistent grouping
      const category = (this.getItemCategory(item) || 'miscellaneous').toLowerCase().trim();

      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(item);
    });

    return categoryMap;
  }

  private createGroupsForCategory(
    categoryItems: (Product | Promotion)[],
    usedItems: Set<string>
  ): ProductGroup[] {
    const groups: ProductGroup[] = [];
    const availableItems = categoryItems.filter(item => !usedItems.has(item.id));

    if (availableItems.length === 0) return groups;

    // Log available items for debugging
    console.log(`[ProductGrouping] Available items in category:`);
    availableItems.forEach(item => {
      const name = this.getItemName(item);
      const store = this.getItemStore(item);
      console.log(`  - "${name}" from ${store}`);
    });

    // Step 1: Build a global similarity matrix for all items in this category
    const similarityMatrix = this.buildSimilarityMatrix(availableItems);

    // Step 2: Find optimal groupings using global analysis
    const optimalGroups = this.findOptimalGroupings(availableItems, similarityMatrix);
    console.log(`[ProductGrouping] Found ${optimalGroups.length} optimal groups`);

    // Step 3: Create ProductGroup objects from optimal groupings
    optimalGroups.forEach((groupItems, index) => {
      const stores = groupItems.map(item => this.getItemStore(item));
      const hasDiv = this.hasStoreDiversity(groupItems);
      console.log(`[ProductGrouping] Optimal group ${index}: ${groupItems.length} items, stores: [${stores.join(', ')}], hasStoreDiversity: ${hasDiv}`);

      if (hasDiv) {
        // Sort products by price: highest first (left), lowest last (right)
        const sortedItems = [...groupItems].sort((a, b) => {
          const priceA = this.getItemPrice(a);
          const priceB = this.getItemPrice(b);
          return priceB - priceA; // Descending order (highest to lowest)
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

  // Build similarity matrix for global analysis
  private buildSimilarityMatrix(items: (Product | Promotion)[]): number[][] {
    const matrix: number[][] = [];
    
    for (let i = 0; i < items.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < items.length; j++) {
        if (i === j) {
          matrix[i][j] = 0; // No self-similarity
        } else {
          matrix[i][j] = this.calculateSimilarityScore(items[i], items[j]);
        }
      }
    }
    
    return matrix;
  }

  // Find optimal groupings using global analysis
  private findOptimalGroupings(items: (Product | Promotion)[], similarityMatrix: number[][]): (Product | Promotion)[][] {
    const groups: (Product | Promotion)[][] = [];
    const used = new Set<number>();
    const threshold = 0.4; // Lower threshold for more lenient matching

    // Step 1: Find all potential groups of 3
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

  private findSimilarProducts(
    targetItem: Product | Promotion,
    candidateItems: (Product | Promotion)[],
    maxResults: number
  ): (Product | Promotion)[] {
    const scoredItems = candidateItems.map(item => ({
      item,
      score: this.calculateSimilarityScore(targetItem, item)
    }));

    // Filter by minimum similarity threshold and sort by score
    return scoredItems
      .filter(scored => scored.score >= 0.6) // 60% similarity threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(scored => scored.item);
  }

  private calculateSimilarityScore(item1: Product | Promotion, item2: Product | Promotion): number {
    // Must be same category (case-insensitive comparison)
    const cat1 = (this.getItemCategory(item1) || '').toLowerCase().trim();
    const cat2 = (this.getItemCategory(item2) || '').toLowerCase().trim();
    if (cat1 !== cat2) {
      return 0;
    }

    const name1 = this.getItemName(item1);
    const name2 = this.getItemName(item2);
    const size1 = this.getItemSize(item1);
    const size2 = this.getItemSize(item2);

    // Calculate name similarity
    const nameSimilarity = this.calculateTextSimilarity(name1, name2);
    
    // Calculate size similarity
    const sizeSimilarity = this.calculateSizeSimilarity(size1, size2);

    // Weighted combination (name is more important than size)
    return nameSimilarity * 0.7 + sizeSimilarity * 0.3;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;

    const clean1 = text1.toLowerCase().trim();
    const clean2 = text2.toLowerCase().trim();

    if (clean1 === clean2) return 1;

    // Extract brand/product names for better matching
    const brand1 = this.extractBrandName(clean1);
    const brand2 = this.extractBrandName(clean2);

    // If both have the same brand, boost similarity
    let brandBonus = 0;
    if (brand1 && brand2 && (brand1 === brand2 || this.areSimilarWords(brand1, brand2))) {
      brandBonus = 0.4; // Significant bonus for matching brands
    }

    // Calculate enhanced word overlap
    const words1 = clean1.split(/\s+/);
    const words2 = clean2.split(/\s+/);
    const enhancedWordOverlap = this.calculateEnhancedWordOverlap(words1, words2);

    // Calculate Levenshtein distance
    const levenshteinSimilarity = this.calculateLevenshteinSimilarity(clean1, clean2);

    // Combine metrics with brand bonus
    const baseSimilarity = Math.max(enhancedWordOverlap, levenshteinSimilarity * 0.7);
    return Math.min(1, baseSimilarity + brandBonus);
  }

  // Extract brand names from product text
  private extractBrandName(text: string): string | null {
    const commonBrands = [
      'nutella', 'coca', 'pepsi', 'nestle', 'unilever', 'danone', 'kraft', 
      'kellogs', 'mars', 'ferrero', 'chocolat', 'cadbury', 'lindt', 'oreo',
      'pringles', 'lays', 'doritos', 'snickers', 'twix', 'kitkat', 'bounty',
      'milka', 'toblerone', 'haribo', 'mentos', 'tic', 'tac', 'smarties',
      'nutri', 'protein', 'bio', 'organic', 'natural', 'fresh', 'pure'
    ];
    
    const words = text.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      for (const brand of commonBrands) {
        if (word.includes(brand) || brand.includes(word)) {
          return brand;
        }
      }
    }
    
    // If no common brand found, return the first significant word
    const significantWords = words.filter(word => word.length > 3);
    return significantWords.length > 0 ? significantWords[0] : null;
  }

  // Check if two words are similar (handles variations)
  private areSimilarWords(word1: string, word2: string): boolean {
    if (word1 === word2) return true;
    if (word1.includes(word2) || word2.includes(word1)) return true;
    
    // Check Levenshtein distance for similar words
    const distance = this.levenshteinDistance(word1, word2);
    const maxLength = Math.max(word1.length, word2.length);
    const similarity = 1 - (distance / maxLength);
    
    return similarity >= 0.7; // 70% similarity threshold
  }

  private calculateEnhancedWordOverlap(words1: string[], words2: string[]): number {
    const significantWords1 = words1.filter(word => word.length > 2);
    const significantWords2 = words2.filter(word => word.length > 2);
    
    if (significantWords1.length === 0 || significantWords2.length === 0) return 0;

    let matches = 0;
    let totalComparisons = 0;

    // Enhanced matching: check for exact matches and similar words
    for (const word1 of significantWords1) {
      for (const word2 of significantWords2) {
        totalComparisons++;
        if (word1 === word2) {
          matches += 1; // Perfect match
        } else if (this.areSimilarWords(word1, word2)) {
          matches += 0.8; // Similar match
        } else if (word1.includes(word2) || word2.includes(word1)) {
          matches += 0.6; // Partial match
        }
      }
    }

    // Normalize by the maximum possible matches
    const maxPossibleMatches = Math.min(significantWords1.length, significantWords2.length);
    return maxPossibleMatches === 0 ? 0 : matches / maxPossibleMatches;
  }

  private calculateWordOverlap(words1: string[], words2: string[]): number {
    // Keep the old method for backward compatibility
    return this.calculateEnhancedWordOverlap(words1, words2);
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
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculateSizeSimilarity(size1?: string, size2?: string): number {
    if (!size1 || !size2) {
      return (!size1 && !size2) ? 1 : 0.5; // Both empty = similar, one empty = partial
    }

    const normalized1 = this.normalizeSize(size1);
    const normalized2 = this.normalizeSize(size2);

    if (normalized1.value === normalized2.value && normalized1.unit === normalized2.unit) {
      return 1;
    }

    // Check if they can be converted to same unit
    const comparable = this.convertToComparableUnits(normalized1, normalized2);
    if (comparable && Math.abs(comparable.value1 - comparable.value2) < 0.1) {
      return 0.9; // Very similar sizes
    }

    return 0;
  }

  private normalizeSize(size: string): { value: number; unit: string; original: string } {
    const cleaned = size.toLowerCase().trim();
    
    // Match patterns like: 1kg, 1 kg, 1000g, 1.5l, 500ml, etc.
    const match = cleaned.match(/(\d+(?:\.\d+)?)\s*([a-z]+)/);
    
    if (!match) {
      return { value: 0, unit: '', original: size };
    }

    const value = parseFloat(match[1]);
    const unit = match[2];

    return { value, unit, original: size };
  }

  private convertToComparableUnits(
    size1: { value: number; unit: string; original: string },
    size2: { value: number; unit: string; original: string }
  ): { value1: number; value2: number } | null {
    // Weight conversions
    const weightUnits = new Map([
      ['g', 1],
      ['kg', 1000],
      ['gram', 1],
      ['kilogram', 1000]
    ]);

    // Volume conversions
    const volumeUnits = new Map([
      ['ml', 1],
      ['l', 1000],
      ['liter', 1000],
      ['milliliter', 1]
    ]);

    if (weightUnits.has(size1.unit) && weightUnits.has(size2.unit)) {
      return {
        value1: size1.value * weightUnits.get(size1.unit)!,
        value2: size2.value * weightUnits.get(size2.unit)!
      };
    }

    if (volumeUnits.has(size1.unit) && volumeUnits.has(size2.unit)) {
      return {
        value1: size1.value * volumeUnits.get(size1.unit)!,
        value2: size2.value * volumeUnits.get(size2.unit)!
      };
    }

    return null;
  }

  private hasStoreDiversity(items: (Product | Promotion)[]): boolean {
    const stores = new Set(items.map(item => this.getItemStore(item)));
    return stores.size === items.length; // Each item must be from different store
  }

  private calculatePriceComparison(items: (Product | Promotion)[]): PriceComparison {
    // Since items are already sorted by price (highest to lowest), we can directly map indices
    const prices = items.map(item => this.getItemPrice(item));

    if (prices.length === 3) {
      return {
        lowest: prices[2],      // Last item (rightmost) has lowest price
        middle: prices[1],      // Middle item has middle price
        highest: prices[0],     // First item (leftmost) has highest price
        lowestIndex: 2,         // Index 2 is rightmost (lowest price)
        middleIndex: 1,         // Index 1 is middle
        highestIndex: 0         // Index 0 is leftmost (highest price)
      };
    } else if (prices.length === 2) {
      return {
        lowest: prices[1],      // Second item (rightmost) has lowest price
        highest: prices[0],     // First item (leftmost) has highest price
        lowestIndex: 1,         // Index 1 is rightmost (lowest price)
        highestIndex: 0         // Index 0 is leftmost (highest price)
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

  private getItemSize(item: Product | Promotion): string | undefined {
    return item.size;
  }

  private getItemPrice(item: Product | Promotion): number {
    return 'price' in item ? item.price : item.new_price;
  }

  private getItemStore(item: Product | Promotion): string {
    return 'store' in item ? item.store : item.store_name;
  }

  private getItemCategory(item: Product | Promotion): string | undefined {
    return item.category;
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

      // Find the primary product based on store priority (Winners > Super U > King Savers)
      const sortedByPriority = [...products].sort((a, b) => {
        const storeA = this.getItemStore(a).toLowerCase();
        const storeB = this.getItemStore(b).toLowerCase();
        const priorityA = this.getStorePriority(storeA);
        const priorityB = this.getStorePriority(storeB);
        return priorityA - priorityB;
      });

      const primaryProduct = sortedByPriority[0];
      const primaryProductId = primaryProduct.id;

      // Get name from primary product
      const name = this.getItemName(primaryProduct);
      const size = this.getItemSize(primaryProduct);
      const category = this.getItemCategory(primaryProduct);

      // Sort products by price (lowest first for display)
      const sortedByPrice = [...products].sort((a, b) => {
        return this.getItemPrice(a) - this.getItemPrice(b);
      });

      return {
        id: `combined_${group.id}_${index}`,
        name,
        size,
        category,
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
    return 99; // Default priority for unknown stores
  }
}

export default ProductGroupingService;