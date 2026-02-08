// Get Supabase URL from environment
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export interface FoodCategoryResult {
  isFood: boolean;
  category: string;
  confidence: number;
  subCategory?: string;
  description?: string;
}

export interface FoodCategories {
  [key: string]: string[];
}

/**
 * OpenAI Service - Now uses Supabase Edge Functions for secure API access
 * API keys are stored securely on the server, not in the app
 */
class OpenAiService {
  private baseUrl: string;
  private headers: Record<string, string>;

  // App's allowed categories - ChatGPT must only use these exact values
  private readonly allowedCategories = [
    'grown', 'meat', 'wheat', 'dairy', 'liquid', 'frozen', 'snacks', 'miscellaneous'
  ];

  constructor() {
    this.baseUrl = `${SUPABASE_URL}/functions/v1`;
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    };
    console.log('OpenAI Service - Using secure Edge Functions');
  }

  async categorizeText(text: string): Promise<FoodCategoryResult> {
    try {
      const response = await fetch(`${this.baseUrl}/categorize-products`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          texts: text,
          mode: 'single',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to categorize text');
      }

      const result = await response.json();

      if (result.success && result.data) {
        return result.data;
      }

      // Fallback to quick categorization
      return this.quickCategorize(text);

    } catch (error) {
      console.error('Categorization error:', error);
      return this.quickCategorize(text);
    }
  }

  async batchCategorizeTexts(texts: string[]): Promise<FoodCategoryResult[]> {
    try {
      const response = await fetch(`${this.baseUrl}/categorize-products`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          texts: texts,
          mode: 'batch',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to categorize texts');
      }

      const result = await response.json();

      if (result.success && result.data) {
        return result.data;
      }

      // Fallback to quick categorization
      return texts.map(text => this.quickCategorize(text));

    } catch (error) {
      console.error('Batch categorization error:', error);
      return texts.map(text => this.quickCategorize(text));
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/categorize-products`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          texts: 'milk',
          mode: 'single',
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Edge Function test response:', result);
        return result.success === true;
      }

      return false;

    } catch (error) {
      console.error('Edge Function connection test failed:', error);
      return false;
    }
  }

  // Quick categorization without API call (for offline use)
  quickCategorize(text: string): FoodCategoryResult {
    const lowerText = text.toLowerCase();

    // Simple keyword mappings to allowed categories
    const keywordMappings: { [key: string]: string } = {
      // grown
      'vegetable': 'grown', 'vegetables': 'grown', 'potato': 'grown', 'tomato': 'grown',
      'onion': 'grown', 'carrot': 'grown', 'lettuce': 'grown', 'spinach': 'grown',
      'cucumber': 'grown', 'fruit': 'grown', 'fruits': 'grown', 'apple': 'grown',
      'banana': 'grown', 'orange': 'grown', 'grape': 'grown',

      // meat
      'chicken': 'meat', 'beef': 'meat', 'pork': 'meat', 'lamb': 'meat',
      'fish': 'meat', 'seafood': 'meat', 'sausage': 'meat', 'bacon': 'meat',

      // dairy
      'milk': 'dairy', 'cheese': 'dairy', 'yogurt': 'dairy', 'butter': 'dairy',
      'cream': 'dairy', 'ice cream': 'dairy',

      // wheat
      'bread': 'wheat', 'pasta': 'wheat', 'rice': 'wheat', 'cereal': 'wheat',
      'oats': 'wheat', 'quinoa': 'wheat', 'flour': 'wheat', 'bakery': 'wheat',

      // liquid
      'juice': 'liquid', 'soda': 'liquid', 'water': 'liquid', 'coffee': 'liquid',
      'tea': 'liquid', 'wine': 'liquid', 'beer': 'liquid', 'beverage': 'liquid',

      // snacks
      'chips': 'snacks', 'crackers': 'snacks', 'nuts': 'snacks', 'candy': 'snacks',
      'chocolate': 'snacks', 'popcorn': 'snacks',

      // frozen
      'frozen': 'frozen', 'ice': 'frozen',

      // miscellaneous
      'misc': 'miscellaneous'
    };

    for (const [keyword, category] of Object.entries(keywordMappings)) {
      if (lowerText.includes(keyword)) {
        return {
          isFood: true,
          category: category,
          confidence: 0.8,
          description: `Matched keyword: ${keyword}`,
        };
      }
    }

    return {
      isFood: false,
      category: 'miscellaneous',
      confidence: 0.1,
      description: 'No specific food keywords detected',
    };
  }
}

export default new OpenAiService();