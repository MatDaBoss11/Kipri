import * as FileSystem from 'expo-file-system';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Types matching the backend's ProductData model
export interface ProductData {
  product_name: string;
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

/**
 * Service that replicates the backend's exact OCR + Gemini workflow
 * Follows the same pattern as the Python backend in back_end/server.py
 */
class BackendReplicaService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    this.initializeGemini();
  }

  private initializeGemini() {
    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      
      if (!apiKey) {
        console.error('Gemini API key not configured');
        return;
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
      
      console.log('Backend Replica Service - Gemini API client initialized');
    } catch (error) {
      console.error('Failed to initialize Gemini API client:', error);
    }
  }

  /**
   * OCR function that replicates extract_text_from_bytes() from backend
   * Uses Google Vision API directly like the backend does
   */
  private async extractTextFromBytes(imageUri: string): Promise<string> {
    console.log('🔍 Performing Google Vision API OCR (Backend Replica)...');

    try {
      // Read image as base64 (matching backend's image_bytes handling)
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('📸 Image encoded to base64, length:', base64.length);

      // Get API key from environment
      let visionApiKey = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY;

      if (!visionApiKey) {
        // Try to get from credentials JSON like the backend does
        const credentialsJson = process.env.EXPO_PUBLIC_GOOGLE_APPLICATION_CREDENTIALS_JSON;
        if (credentialsJson) {
          try {
            const parsedCredentials = JSON.parse(credentialsJson);
            visionApiKey = parsedCredentials.api_key || parsedCredentials.key;
          } catch (parseError) {
            console.error('Failed to parse Google credentials JSON:', parseError);
          }
        }
      }

      if (!visionApiKey) {
        throw new Error('Google Vision API key not found');
      }

      // Prepare the request payload (matching backend's structure)
      const requestPayload = {
        requests: [
          {
            image: {
              content: base64
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 50
              }
            ]
          }
        ]
      };

      console.log('📤 Sending request to Google Vision API...');

      // Make the API request (matching backend's approach)
      const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Vision API error:', response.status, errorText);
        throw new Error(`Vision API request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Google Vision API response received');

      // Extract text from response (matching backend's logic)
      if (!data.responses || data.responses.length === 0) {
        throw new Error('No responses in Vision API result');
      }

      const visionResponse = data.responses[0];
      if (visionResponse.error) {
        throw new Error(`Vision API error: ${visionResponse.error.message}`);
      }

      if (!visionResponse.textAnnotations || visionResponse.textAnnotations.length === 0) {
        throw new Error('No text detected in the image');
      }

      // Return the full text (first annotation contains all detected text)
      const extractedText = visionResponse.textAnnotations[0].description || '';
      console.log('✅ OCR extracted text length:', extractedText.length);
      
      return extractedText;

    } catch (error) {
      console.error('❌ Google Vision OCR error:', error);
      throw error;
    }
  }

  /**
   * Preprocessing function that replicates preprocess_ocr_text() from backend
   */
  private preprocessOcrText(ocrText: string): { filtered_price: string; filtered_product_name: string } {
    // Find all prices with Rs, R.S, or R.P (case-insensitive) - matching backend regex
    const pricePattern = /(?:RS|R\.S|R\.P)[\s:]*([0-9]+[\.,][0-9]{2})/gi;
    const prices: string[] = [];
    let match;
    
    while ((match = pricePattern.exec(ocrText)) !== null) {
      prices.push(match[1]);
    }

    // Convert to float for comparison, replace comma with dot if needed
    const priceValues: number[] = [];
    for (const p of prices) {
      try {
        priceValues.push(parseFloat(p.replace(",", ".")));
      } catch {
        continue;
      }
    }
    
    const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : null;

    // Find candidate product name lines
    const lines = ocrText.split("\n").map(l => l.strip()).filter(l => l.length > 0);
    
    // Exclude lines with unwanted words/numbers (matching backend blacklist)
    const blacklist = ["MARKETING", "CO", "LTD", "CDT", "IMPORTS", "FOODS", "WING&CO", "COMPANY", "DISTRIBUTORS", "MANUFACTURERS", "&", "LTD.", "CO."];
    
    const isValidTitle = (line: string): boolean => {
      const upperLine = line.toUpperCase();
      
      if (blacklist.some(word => upperLine.includes(word))) {
        return false;
      }
      
      if (/\d{4,}/.test(line)) { // many numbers
        return false;
      }
      
      if (/\d{2,}/.test(line) && line.split(' ').length <= 2) {
        return false;
      }
      
      return true;
    };

    const validLines = lines.filter(isValidTitle);
    
    // Pick the longest valid line (matching backend logic)
    const productName = validLines.length > 0 ? validLines.reduce((a, b) => a.length > b.length ? a : b) : "";
    
    return {
      filtered_price: minPrice !== null ? `Rs ${minPrice.toFixed(2).replace('.', ',')}` : "",
      filtered_product_name: productName.toUpperCase()
    };
  }

  /**
   * Gemini API call that replicates call_gemini_api() from backend
   */
  private async callGeminiApi(ocrText: string): Promise<ProductData> {
    if (!this.model) {
      throw new Error('Gemini API client not initialized');
    }

    // Preprocess OCR text for best candidates (matching backend)
    const filtered = this.preprocessOcrText(ocrText);
    
    // Use the exact same prompt as the backend
    const prompt = `
You are a data extraction assistant. Your task is to extract structured product information from OCR'd grocery price tag text.

Extract product information from this grocery price tag OCR text and return ONLY a JSON object with these exact fields:

OCR Text: "${ocrText}"

IMPORTANT RULES:
1. If you find more than one price with Rs, R.S, or R.P, always pick the smallest one. If you see a price, always format it as Rs XX,XX (use a comma as decimal separator).

2. For the product name, use this as a strong hint: "${filtered.filtered_product_name}". The product name should be the longest line of text, in all capital letters, and must not include words like marketing, co, ltd, cdt, &, many numbers, or any manufacturer-like words. Only use this line if it looks like a real product name a customer would say in a store.

3. CRITICAL: The product name should NEVER include size information. Extract size information separately and put it in the "size" field. Common size indicators to look for and extract:
   - Weight: kg, g, lb, oz, etc.
   - Volume: L, ml, fl oz, etc.
   - Count: pieces, pcs, units, etc.
   - Dimensions: cm, inches, etc.
   - Any numbers followed by units of measurement

4. Examples of proper separation:
   - "COCA COLA 2L" → product_name: "COCA COLA", size: "2L"
   - "MILK 1L" → product_name: "MILK", size: "1L"
   - "BREAD 500G" → product_name: "BREAD", size: "500G"
   - "CHIPS 100G" → product_name: "CHIPS", size: "100G"

Return format (respond with ONLY valid JSON, no other text):
{
  "product_name": "extracted product name (without size)",
  "price": "extracted price with currency",
  "size": "extracted size/quantity"
}

If any field can't be identified confidently, return an empty string "". Do not include any explanation or text outside of the JSON.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let content = response.text().trim();
      
      console.log('Raw Gemini response:', content);
      
      // Clean markdown formatting (matching backend logic)
      if (content.startsWith("```json")) {
        content = content.substring(7);
      } else if (content.startsWith("```")) {
        content = content.substring(3);
      }
      
      if (content.endsWith("```")) {
        content = content.substring(0, content.length - 3);
      }
      
      content = content.trim();
      
      // Try to parse JSON
      try {
        const parsedData = JSON.parse(content);
        console.log('Successfully parsed JSON:', parsedData);
        
        // Return in the format expected by the frontend (matching ProductData interface)
        return {
          product_name: parsedData.product_name || "",
          price: parsedData.price || "",
          size: parsedData.size || "",
          store: "", // Will be filled in by frontend
          categories: [] // Will be filled in by frontend
        };
        
      } catch (jsonError) {
        console.error('JSON decode error:', jsonError);
        console.error('Content that failed to parse:', content);
        
        // Try to extract JSON using regex (matching backend fallback)
        const jsonPattern = /{[^{}]*(?:{[^{}]*}[^{}]*)*}/;
        const match = content.match(jsonPattern);
        
        if (match) {
          try {
            const parsedData = JSON.parse(match[0]);
            console.log('Successfully extracted JSON from regex:', parsedData);
            return {
              product_name: parsedData.product_name || "",
              price: parsedData.price || "",
              size: parsedData.size || "",
              store: "",
              categories: []
            };
          } catch (regexError) {
            console.error('Regex JSON parse failed:', regexError);
          }
        }
        
        // Return empty structure if all else fails (matching backend)
        console.warn('Could not parse any JSON from Gemini response, returning empty structure');
        return {
          product_name: "",
          price: "",
          size: "",
          store: "",
          categories: []
        };
      }
      
    } catch (error) {
      console.error('Error in call_gemini_api:', error);
      throw new Error(`Gemini API error: ${error}`);
    }
  }

  /**
   * Main processing function that replicates the backend's /process-image endpoint
   */
  async processImage(imageUri: string): Promise<ProcessImageResponse> {
    try {
      console.log('Backend Replica - Processing image...');
      
      // Step 1: OCR via Google Vision (replicating backend step 2)
      console.log('Step 1: OCR via Google Vision');
      const ocrText = await this.extractTextFromBytes(imageUri);
      console.log('OCR extracted text preview:', ocrText.substring(0, 200) + (ocrText.length > 200 ? '...' : ''));
      
      if (!ocrText) {
        return {
          success: false,
          error: 'No text detected in the image'
        };
      }
      
      // Step 2: Parse structured data via Gemini (replicating backend step 3)
      console.log('Step 2: Parse structured data via Gemini');
      const productData = await this.callGeminiApi(ocrText);
      console.log('Gemini response:', productData);
      
      return {
        success: true,
        data: productData
      };
      
    } catch (error) {
      console.error('Backend Replica - Error processing image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Internal processing error'
      };
    }
  }

  /**
   * Test connection to both Google Vision and Gemini APIs
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing Backend Replica Service connections...');
      
      // Test Gemini
      if (!this.model) {
        console.error('Gemini API client not initialized');
        return false;
      }

      const testResult = await this.model.generateContent("Say 'test successful' if you can read this.");
      const testResponse = await testResult.response;
      const testText = testResponse.text();
      
      if (!testText.toLowerCase().includes('test successful')) {
        console.error('Gemini API test failed');
        return false;
      }
      
      // Test Vision API key availability
      const visionApiKey = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY;
      if (!visionApiKey) {
        const credentialsJson = process.env.EXPO_PUBLIC_GOOGLE_APPLICATION_CREDENTIALS_JSON;
        if (!credentialsJson) {
          console.error('Google Vision API credentials not found');
          return false;
        }
      }
      
      console.log('✅ Backend Replica Service connections OK');
      return true;
      
    } catch (error) {
      console.error('Backend Replica Service connection test failed:', error);
      return false;
    }
  }
}

// Add String.prototype.strip if not available (matching Python's strip())
declare global {
  interface String {
    strip(): string;
  }
}

if (!String.prototype.strip) {
  String.prototype.strip = function() {
    return this.trim();
  };
}

export default new BackendReplicaService();