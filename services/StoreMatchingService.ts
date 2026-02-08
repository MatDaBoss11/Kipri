export interface StoreMatchResult {
  matched: boolean;
  storeName: string;
  confidence: 'exact' | 'alias' | 'partial' | 'none';
}

const KNOWN_STORES = ['Winners', 'Kingsavers', 'Super U'];

const STORE_ALIASES: Record<string, string[]> = {
  'Winners': [
    'winners', 'winners supermarket', 'winners super', 'winner',
    'winners pereybere', 'winners grand baie', 'winners triolet',
    'winners goodlands',
  ],
  'Kingsavers': [
    'kingsavers', 'king savers', 'king saver', 'kingsaver',
    'king savers supermarket', 'kingsavers supermarket',
  ],
  'Super U': [
    'super u', 'superu', 'hyper u', 'hyperu', 'super u market',
    'super u hypermarket',
  ],
};

class StoreMatchingService {
  matchStoreName(receiptStoreName: string): StoreMatchResult {
    if (!receiptStoreName || !receiptStoreName.trim()) {
      return { matched: false, storeName: '', confidence: 'none' };
    }

    const input = receiptStoreName.trim().toLowerCase();

    // Tier 1: Exact match (case-insensitive)
    for (const store of KNOWN_STORES) {
      if (input === store.toLowerCase()) {
        return { matched: true, storeName: store, confidence: 'exact' };
      }
    }

    // Tier 2: Alias match
    for (const [store, aliases] of Object.entries(STORE_ALIASES)) {
      for (const alias of aliases) {
        if (input === alias) {
          return { matched: true, storeName: store, confidence: 'alias' };
        }
      }
    }

    // Tier 3: Substring/contains match
    for (const [store, aliases] of Object.entries(STORE_ALIASES)) {
      // Check if input contains any alias
      for (const alias of aliases) {
        if (input.includes(alias) || alias.includes(input)) {
          return { matched: true, storeName: store, confidence: 'partial' };
        }
      }
    }

    return { matched: false, storeName: '', confidence: 'none' };
  }
}

export default new StoreMatchingService();
