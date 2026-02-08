import * as FileSystem from 'expo-file-system/legacy';
import { ProcessReceiptResponse, ReceiptScanResult } from '../types';

// Get Supabase URL from environment
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Types matching the backend's ProductData model
export interface ProductData {
  product_name: string;
  brand: string;      // Brand name extracted from OCR
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
 * Service that performs OCR and product data extraction using GPT-4o Vision
 * Now uses Supabase Edge Functions to keep API keys secure on the server
 */
class BackendReplicaService {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor() {
    this.baseUrl = `${SUPABASE_URL}/functions/v1`;
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    };
    console.log('Backend Replica Service - Using secure Edge Functions');
  }

  /**
   * Main processing function - uses Edge Function for secure GPT-4o Vision processing
   */
  async processImage(imageUri: string): Promise<ProcessImageResponse> {
    try {
      console.log('Processing image via secure Edge Function...');

      // Read image as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
      });

      console.log('Image encoded, length:', base64.length);

      // Determine image type
      const imageType = imageUri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';

      // Call Edge Function (API key is stored securely on server)
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
      console.error('Error processing image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Internal processing error'
      };
    }
  }

  /**
   * Process a receipt image - extracts all line items via GPT-4o Vision
   */
  async processReceipt(imageUri: string): Promise<ProcessReceiptResponse> {
    try {
      console.log('Processing receipt via secure Edge Function...');

      // Read image as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
      });

      console.log('Receipt image encoded, length:', base64.length);

      // Determine image type
      const imageType = imageUri.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';

      // Call Edge Function
      const response = await fetch(`${this.baseUrl}/process-receipt`, {
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
          error: 'Failed to process receipt',
        };
      }

      const result = await response.json();
      console.log('Receipt Edge Function response:', result);

      return result;

    } catch (error) {
      console.error('Error processing receipt:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Internal processing error'
      };
    }
  }

  /**
   * Test connection to Edge Function
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing Edge Function connection...');

      // Simple health check - try to call the function with minimal data
      const response = await fetch(`${this.baseUrl}/categorize-products`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          texts: 'milk',
          mode: 'single',
        }),
      });

      if (response.ok) {
        console.log('Edge Function connection OK');
        return true;
      }

      console.error('Edge Function test failed');
      return false;

    } catch (error) {
      console.error('Edge Function connection test failed:', error);
      return false;
    }
  }
}

export default new BackendReplicaService();