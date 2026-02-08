// EdgeFunctionService.ts
// This service calls Supabase Edge Functions instead of calling OpenAI directly
// The API keys are stored securely on Supabase's servers

import * as FileSystem from 'expo-file-system/legacy';

// Get Supabase URL from environment
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export interface ProductData {
  product_name: string;
  brand: string;
  price: string;
  size: string;
  store: string;
  categories: string[];
}

export interface ProcessImageResponse {
  success: boolean;
  data?: ProductData;
  error?: string;
}

export interface FoodCategoryResult {
  isFood: boolean;
  category: string;
  confidence: number;
  description?: string;
}

export interface Product {
  product: string;
  brand?: string;
  price: string;
  size: string;
  store: string;
  categories?: string[];
  unitPrice?: string;
  discount?: string;
}

class EdgeFunctionService {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor() {
    this.baseUrl = `${SUPABASE_URL}/functions/v1`;
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    };

    console.log('EdgeFunctionService initialized');
  }

  /**
   * Process image using GPT-4o Vision via Edge Function
   * The API key is stored securely on Supabase's servers
   */
  async processImage(imageUri: string): Promise<ProcessImageResponse> {
    try {
      console.log('Processing image via Edge Function...');

      // Read image as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
      });

      console.log('Image encoded, length:', base64.length);

      // Determine image type
      const imageType = imageUri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';

      // Call Edge Function
      const response = await fetch(`${this.baseUrl}/process-image`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          imageBase64: base64,
          imageType: imageType,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edge Function error:', errorText);
        return {
          success: false,
          error: 'Failed to process image',
        };
      }

      const result = await response.json();
      console.log('Edge Function response:', result);

      return result;

    } catch (error) {
      console.error('Error calling process-image Edge Function:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing error',
      };
    }
  }

  /**
   * Categorize a single text using Edge Function
   */
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
      return result.data;

    } catch (error) {
      console.error('Error categorizing text:', error);
      return {
        isFood: false,
        category: 'miscellaneous',
        confidence: 0.0,
        description: 'Failed to analyze',
      };
    }
  }

  /**
   * Batch categorize multiple texts using Edge Function
   */
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
      return result.data;

    } catch (error) {
      console.error('Error batch categorizing texts:', error);
      return texts.map(() => ({
        isFood: false,
        category: 'miscellaneous',
        confidence: 0.0,
        description: 'Failed to analyze',
      }));
    }
  }

  /**
   * Structure product data from OCR text using Edge Function
   */
  async structureProductData(rawText: string): Promise<Product | null> {
    try {
      const response = await fetch(`${this.baseUrl}/structure-text`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          rawText: rawText,
          action: 'structure',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to structure text');
      }

      const result = await response.json();
      return result.data;

    } catch (error) {
      console.error('Error structuring product data:', error);
      return null;
    }
  }

  /**
   * Filter useful text from OCR results using Edge Function
   */
  async filterUsefulText(rawText: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/structure-text`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          rawText: rawText,
          action: 'filter',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to filter text');
      }

      const result = await response.json();
      return result.data;

    } catch (error) {
      console.error('Error filtering text:', error);
      return null;
    }
  }

  /**
   * Test connection to Edge Functions
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing Edge Function connection...');

      // Simple test - categorize a known product
      const result = await this.categorizeText('milk');

      if (result.category && result.confidence > 0) {
        console.log('Edge Function connection OK');
        return true;
      }

      return false;

    } catch (error) {
      console.error('Edge Function connection test failed:', error);
      return false;
    }
  }

  // Quick offline categorization (no API call needed)
  quickCategorize(text: string): FoodCategoryResult {
    const lowerText = text.toLowerCase();

    const keywordMappings: { [key: string]: string } = {
      'vegetable': 'grown', 'vegetables': 'grown', 'potato': 'grown', 'tomato': 'grown',
      'onion': 'grown', 'carrot': 'grown', 'lettuce': 'grown', 'spinach': 'grown',
      'cucumber': 'grown', 'fruit': 'grown', 'fruits': 'grown', 'apple': 'grown',
      'banana': 'grown', 'orange': 'grown', 'grape': 'grown',
      'chicken': 'meat', 'beef': 'meat', 'pork': 'meat', 'lamb': 'meat',
      'fish': 'meat', 'seafood': 'meat', 'sausage': 'meat', 'bacon': 'meat',
      'milk': 'dairy', 'cheese': 'dairy', 'yogurt': 'dairy', 'butter': 'dairy',
      'cream': 'dairy', 'ice cream': 'dairy',
      'bread': 'wheat', 'pasta': 'wheat', 'rice': 'wheat', 'cereal': 'wheat',
      'oats': 'wheat', 'quinoa': 'wheat', 'flour': 'wheat', 'bakery': 'wheat',
      'juice': 'liquid', 'soda': 'liquid', 'water': 'liquid', 'coffee': 'liquid',
      'tea': 'liquid', 'wine': 'liquid', 'beer': 'liquid', 'beverage': 'liquid',
      'chips': 'snacks', 'crackers': 'snacks', 'nuts': 'snacks', 'candy': 'snacks',
      'chocolate': 'snacks', 'popcorn': 'snacks',
      'frozen': 'frozen', 'ice': 'frozen',
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

export default new EdgeFunctionService();
