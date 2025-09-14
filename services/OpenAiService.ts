import OpenAI from 'openai';

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

class OpenAiService {
  private openai: OpenAI | null = null;
  
  // App's allowed categories - ChatGPT must only use these exact values
  private readonly allowedCategories = [
    'grown', 'meat', 'wheat', 'dairy', 'liquid', 'frozen', 'snacks', 'miscellaneous'
  ];

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
      
      console.log('OpenAI client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenAI client:', error);
    }
  }

  async categorizeText(text: string): Promise<FoodCategoryResult> {
    try {
      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      const prompt = `
        Analyze the following text and determine if it describes a food or grocery item.
        If it is a food item, categorize it using ONLY one of these exact categories.

        Text: "${text}"

        ALLOWED CATEGORIES (use ONLY these exact values):
        ${this.allowedCategories.join(', ')}

        CRITICAL: You MUST choose one of the exact categories above. Do not create new categories or modify these names.

        Respond with a JSON object containing:
        - isFood: boolean (true if this is a food/grocery item)
        - category: string (MUST be exactly one of: ${this.allowedCategories.join(', ')})
        - confidence: number (0.0 to 1.0)
        - description: string (brief explanation)

        Example responses:
        {
          "isFood": true,
          "category": "dairy",
          "confidence": 0.95,
          "description": "Fresh dairy milk product"
        }

        {
          "isFood": true,
          "category": "meat",
          "confidence": 0.90,
          "description": "Fresh chicken meat"
        }

        {
          "isFood": true,
          "category": "grown",
          "confidence": 0.85,
          "description": "Fresh vegetables"
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

      const result = response.choices[0].message.content;
      
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      let parsedResult;
      try {
        // Clean up the response if it has markdown formatting
        let cleanResult = result.trim();
        if (cleanResult.startsWith('```json')) {
          cleanResult = cleanResult.slice(7);
        }
        if (cleanResult.endsWith('```')) {
          cleanResult = cleanResult.slice(0, -3);
        }
        
        parsedResult = JSON.parse(cleanResult.trim());
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', result);
        throw new Error('Invalid JSON response from OpenAI');
      }

      // Validate that the category is one of the allowed categories
      const category = parsedResult.category || 'miscellaneous';
      const validatedCategory = this.allowedCategories.includes(category) ? category : 'miscellaneous';

      return {
        isFood: parsedResult.isFood || false,
        category: validatedCategory,
        confidence: parsedResult.confidence || 0.5,
        description: parsedResult.description,
      };

    } catch (error) {
      console.error('OpenAI categorization error:', error);
      return {
        isFood: false,
        category: 'Unknown',
        confidence: 0.0,
        description: 'Failed to analyze',
      };
    }
  }

  async batchCategorizeTexts(texts: string[]): Promise<FoodCategoryResult[]> {
    try {
      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      const textList = texts.map((text, index) => `${index + 1}. "${text}"`).join('\n');

      const prompt = `
        Analyze the following list of texts and determine if each describes a food or grocery item.
        If it is a food item, categorize it using ONLY the allowed categories below.

        Texts:
        ${textList}

        ALLOWED CATEGORIES (use ONLY these exact values):
        ${this.allowedCategories.join(', ')}

        CRITICAL: You MUST choose one of the exact categories above. Do not create new categories or modify these names.

        Respond with a JSON array where each object contains:
        - index: number (corresponding to input order)
        - isFood: boolean (true if this is a food/grocery item)
        - category: string (MUST be exactly one of: ${this.allowedCategories.join(', ')})
        - confidence: number (0.0 to 1.0)
        - description: string (brief explanation)

        Return ONLY the JSON array, no additional text.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      });

      const result = response.choices[0].message.content;
      
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      let parsedResult;
      try {
        // Clean up the response
        let cleanResult = result.trim();
        if (cleanResult.startsWith('```json')) {
          cleanResult = cleanResult.slice(7);
        }
        if (cleanResult.endsWith('```')) {
          cleanResult = cleanResult.slice(0, -3);
        }
        
        parsedResult = JSON.parse(cleanResult.trim());
      } catch (parseError) {
        console.error('Failed to parse OpenAI batch response:', result);
        // Fallback to individual processing
        return await Promise.all(texts.map(text => this.categorizeText(text)));
      }

            // Ensure we have results for all inputs
      const results: FoodCategoryResult[] = new Array(texts.length);

      for (const item of parsedResult) {
        const index = (item.index || 1) - 1;
        if (index >= 0 && index < texts.length) {
          // Validate that the category is one of the allowed categories
          const category = item.category || 'miscellaneous';
          const validatedCategory = this.allowedCategories.includes(category) ? category : 'miscellaneous';

          results[index] = {
            isFood: item.isFood || false,
            category: validatedCategory,
            confidence: item.confidence || 0.5,
            description: item.description,
          };
        }
      }

      // Fill any missing results
      for (let i = 0; i < results.length; i++) {
        if (!results[i]) {
          results[i] = {
            isFood: false,
            category: 'Unknown',
            confidence: 0.0,
            description: 'Failed to analyze',
          };
        }
      }

      return results;

    } catch (error) {
      console.error('OpenAI batch categorization error:', error);
      // Fallback to individual processing
      return await Promise.all(texts.map(text => this.categorizeText(text)));
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
          { role: 'user', content: 'Say "OpenAI connection successful" if you can read this message.' }
        ],
        max_tokens: 50,
      });

      const result = response.choices[0].message.content;
      console.log('OpenAI test response:', result);
      
      return result?.includes('connection successful') || false;
      
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
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