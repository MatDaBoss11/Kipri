import { Product, Promotion } from '../types';

/**
 * Main Product List for Kipri
 *
 * This list contains the verified top products that are tracked in the app.
 * Promotions will be filtered to only show products that match items in this list.
 *
 * The matching is case-insensitive and uses partial matching to handle variations
 * in product names (e.g., "Basmati Rice 1kg" will match "Basmati Rice").
 */

export const MAIN_PRODUCT_LIST: string[] = [
  // Price-controlled staples (First Schedule) - English
  'Long Grain White Rice',
  'Basmati Rice',
  'White Flour',
  'Vegetable Oil',
  'White Sugar',
  'Full Cream Powder Milk',
  'Bread',
  'Whole Frozen Chicken',
  'Butter',
  'Margarine',
  'Cheddar Cheese',
  'Onions',
  'Sardines in Oil',
  'Sardines',

  // Price-controlled items (20% max markup) - English
  'Corned Beef',

  // Price-controlled items (added 2021) - English
  'Red Lentils',
  'Lentils',
  'Yellow Split Peas',
  'Split Peas',
  'Dholl',

  // High consumption staples - English
  'Eggs',
  'Potatoes',
  'Macaroni',
  'Tea',

  // Popular products (newly added) - English
  'Milo',
  'Apollo Noodle Curry',
  'Apollo Noodle Chicken',
  'Apollo Noodle',
  'Sunquick',
  'WetaBix',
  'Weetabix',

  // Common variations and related items - English
  'Rice',
  'Flour',
  'Oil',
  'Sugar',
  'Milk',
  'Chicken',
  'Cheese',
  'Noodle',
  'Noodles',
  'Beef',
  'Peas',
  'Lentil',
  'Beverage',
  'Cereal',

  // ============================================
  // French Translations (Traductions Françaises)
  // ============================================

  // Price-controlled staples (First Schedule) - French
  'Riz Long Blanc',
  'Riz Basmati',
  'Farine Blanche',
  'Huile Végétale',
  'Sucre Blanc',
  'Lait en Poudre Crème Entière',
  'Pain',
  'Poulet Congelé Entier',
  'Beurre',
  'Margarine',
  'Fromage Cheddar',
  'Oignons',
  'Sardines à l\'Huile',
  'Sardines',

  // Price-controlled items (20% max markup) - French
  'Corned Beef',

  // Price-controlled items (added 2021) - French
  'Lentilles Rouges',
  'Lentilles',
  'Pois Cassés Jaunes',
  'Pois Cassés',
  'Dholl',

  // High consumption staples - French
  'Œufs',
  'Pommes de Terre',
  'Macaroni',
  'Thé',

  // Popular products (newly added) - French
  'Milo',
  'Nouilles Apollo Curry',
  'Nouilles Apollo Poulet',
  'Nouilles Apollo',
  'Sunquick',
  'WetaBix',
  'Weetabix',

  // Common variations and related items - French
  'Riz',
  'Farine',
  'Huile',
  'Sucre',
  'Lait',
  'Poulet',
  'Fromage',
  'Nouille',
  'Nouilles',
  'Boeuf',
  'Pois',
  'Lentille',
  'Boisson',
  'Céréale',
];

/**
 * Check if a product name matches any item in the main product list.
 * Uses case-insensitive partial matching.
 *
 * @param productName - The product name to check
 * @returns true if the product matches an item in the main list
 */
export const isProductInMainList = (productName: string | undefined | null): boolean => {
  if (!productName) return false;

  const normalizedProductName = productName.toLowerCase().trim();

  return MAIN_PRODUCT_LIST.some(mainProduct => {
    const normalizedMainProduct = mainProduct.toLowerCase().trim();
    // Check if the product name contains the main product keyword
    // or if the main product keyword contains the product name
    return normalizedProductName.includes(normalizedMainProduct) ||
           normalizedMainProduct.includes(normalizedProductName);
  });
};

/**
 * Filter an array of promotions to only include products from the main list.
 *
 * @param promotions - Array of promotion objects with product_name property
 * @returns Filtered array containing only promotions for main list products
 */
export const filterPromotionsByMainList = <T extends { product_name?: string }>(
  promotions: T[]
): T[] => {
  return promotions.filter(promotion => isProductInMainList(promotion.product_name));
};

/**
 * Normalize store names for comparison.
 * Handles variations like "Winners", "winners", "Winner" etc.
 */
export const normalizeStoreName = (storeName: string): string => {
  const lower = storeName.toLowerCase().trim();
  if (lower.includes('winner')) return 'winners';
  if (lower.includes('king') || lower.includes('saver')) return 'kingsavers';
  if (lower.includes('super') || lower.includes('u')) return 'super u';
  return lower;
};

/**
 * Check if a product name matches a promotion name.
 * Uses case-insensitive partial matching.
 */
export const productNamesMatch = (productName: string, promotionName: string): boolean => {
  const normalizedProduct = productName.toLowerCase().trim();
  const normalizedPromo = promotionName.toLowerCase().trim();
  return normalizedProduct.includes(normalizedPromo) ||
         normalizedPromo.includes(normalizedProduct);
};

/**
 * Find a promotion that matches a specific product.
 * Matches by both product name AND store to ensure store-specific promotions.
 *
 * @param product - The product to find a promotion for
 * @param promotions - Array of all promotions
 * @returns The matching promotion or null if none found
 */
export const findPromotionForProduct = (
  product: Product,
  promotions: Promotion[]
): Promotion | null => {
  const productStore = normalizeStoreName(product.store);
  return promotions.find(promo => {
    const promoStore = normalizeStoreName(promo.store_name);
    return productStore === promoStore &&
           productNamesMatch(product.product, promo.product_name);
  }) || null;
};
