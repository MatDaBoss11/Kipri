import OpenAI from 'openai';

export interface Product {
  product: string; // Database field name
  brand?: string; // Brand name in CAPITALS (e.g., "NESTLE", "DINA")
  price: string; // Will be converted to numeric(6,2) for database
  size: string; // Required field
  store: string; // Required field
  categories?: string[]; // Array of categories (stored as JSONB in database)
  images?: string;
  created_at?: string; // Database field
  unitPrice?: string; // Not in database, kept for compatibility
  discount?: string; // Not in database, kept for compatibility
  imageSource?: string; // Not in database, kept for compatibility
  rawText?: string; // Not in database, kept for compatibility
  timestamp?: string; // Not in database, kept for compatibility
}

class GeminiApiService {
  private openai: OpenAI | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    try {
      const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

      if (!apiKey) {
        console.error('OpenAI API key not configured');
        return;
      }

      this.openai = new OpenAI({
        apiKey: apiKey,
      });

      console.log('OpenAI API client (GeminiApiService) initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenAI API client:', error);
    }
  }

  async structureProductData(rawText: string): Promise<Product | null> {
    try {
      if (!this.openai) {
        throw new Error('OpenAI API client not initialized');
      }

      const prompt = `
        You are analyzing OCR text from a grocery store promotional flyer.
        Extract structured product information from the following text.

        OCR Text: "${rawText}"

        Extract the following information (return null if not found):
        - Product name
        - Price (with currency)
        - Unit price (if available, e.g., "Rs 45/kg")
        - Size/weight (e.g., "500g", "1L")
        - Brand name
        - Category (infer if possible: dairy, meat, vegetables, etc.)
        - Discount percentage (if mentioned)

        Return ONLY a JSON object with these fields. No additional text.
        Example format:
        {
          "name": "Fresh Milk",
          "price": "Rs 45",
          "size": "1L",
          "store": "Super U",
          "category": "Dairy",
          "discount": "20%"
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.1,
      });

      let resultText = response.choices[0].message.content?.trim() || "";

      // Clean up the response
      if (resultText.startsWith('```json')) {
        resultText = resultText.slice(7);
      }
      if (resultText.endsWith('```')) {
        resultText = resultText.slice(0, -3);
      }
      resultText = resultText.trim();

      // Parse JSON
      const productData = JSON.parse(resultText);

      // Create Product object
      return {
        product: productData.name || 'Unknown', // Map to database field
        price: productData.price || '0',
        size: productData.size || 'N/A',
        store: productData.store || 'Unknown Store', // Required field
        unitPrice: productData.unit_price,
        categories: productData.category ? [productData.category] : undefined,
        discount: productData.discount,
        rawText: rawText,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      console.error('OpenAI processing error:', error);
      return null;
    }
  }

  async filterUsefulText(rawText: string): Promise<string | null> {
    try {
      if (!this.openai) {
        throw new Error('OpenAI API client not initialized');
      }

      const prompt = `
        You are analyzing OCR text from a grocery store promotional image.
        Extract only the useful product information and filter out noise, headers, and irrelevant text.

        OCR Text: "${rawText}"

        Keep only:
        - Product names
        - Prices and price-related information
        - Brand names
        - Product sizes/weights
        - Discount information
        - Categories if mentioned

        Remove:
        - Store names and logos
        - Page numbers
        - General promotional text
        - Navigation elements
        - Decorative text
        - Repeated headers

        Return the cleaned text, organized by product. If no useful product information is found, return "NO_PRODUCTS_FOUND".
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.1,
      });

      const cleanedText = response.choices[0].message.content?.trim() || "";

      return cleanedText === 'NO_PRODUCTS_FOUND' ? null : cleanedText;

    } catch (error) {
      console.error('OpenAI filtering error:', error);
      return null;
    }
  }

  async categorizeProducts(products: Product[]): Promise<Product[]> {
    try {
      if (!this.openai || products.length === 0) {
        return products;
      }

      const productList = products.map(p => `${p.product} - ${p.price}`).join('\n');

      const prompt = `
        Categorize the following grocery products into appropriate categories.

        Products:
        ${productList}

        Available categories: Dairy, Meat, Vegetables, Fruits, Bakery, Beverages, Snacks, Personal Care, Household, Other

        Return a JSON array with each product and its category:
        [
          {"name": "Product Name", "category": "Category"},
          ...
        ]
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      });

      let resultText = response.choices[0].message.content?.trim() || "";

      // Clean up the response
      if (resultText.startsWith('```json')) {
        resultText = resultText.slice(7);
      }
      if (resultText.endsWith('```')) {
        resultText = resultText.slice(0, -3);
      }

      const categorizedProducts = JSON.parse(resultText);

      // Update products with categories
      return products.map(product => {
        const categorized = categorizedProducts.find(
          (cp: any) => cp.product.toLowerCase().includes(product.product.toLowerCase()) ||
                      product.product.toLowerCase().includes(cp.product.toLowerCase())
        );

        const newCategory = categorized?.category || 'Other';
        const existingCategories = product.categories || [];

        return {
          ...product,
          categories: existingCategories.length > 0 ? existingCategories : [newCategory]
        };
      });

    } catch (error) {
      console.error('OpenAI categorization error:', error);
      return products;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.openai) {
        return false;
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: "Say 'API test successful' if you can read this." }
        ],
        max_tokens: 50,
      });

      const text = response.choices[0].message.content || "";

      console.log('OpenAI test response:', text);
      return text.includes('API test successful');

    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      return false;
    }
  }
}

export default new GeminiApiService();