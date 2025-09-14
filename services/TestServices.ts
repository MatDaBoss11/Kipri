import { Product } from './GeminiApiService';
import KipriBackendService from './KipriBackendService';

export class TestServices {
  static async testAllServices() {
    console.log('=== Testing Kipri Backend Services ===');
    
    // Test service connections
    const status = await KipriBackendService.testAllServices();
    console.log('Service Status:', status);
    
    // Check API keys
    const missingKeys = KipriBackendService.getRequiredApiKeys();
    if (missingKeys.length > 0) {
      console.warn('Missing API Keys:', missingKeys);
      console.warn('Please update your .env file with the required API keys');
    }
    
    return {
      serviceStatus: status,
      missingKeys,
      readyToUse: Object.values(status).some(s => s) && missingKeys.length === 0
    };
  }
  
  static async testTextProcessing() {
    console.log('=== Testing Text Processing ===');
    
    const testTexts = [
      'Fresh Milk 1L Rs 45',
      'Chicken Breast 500g Rs 120',
      'Coca Cola 2L Rs 65',
      'Random non-food text',
    ];
    
    for (const text of testTexts) {
      console.log(`\nTesting: "${text}"`);
      const result = await KipriBackendService.processText(text);
      console.log('Result:', result);
    }
  }
  
  static async testDatabaseOperations() {
    console.log('=== Testing Database Operations ===');
    
    // Test product creation
    const testProduct: Product = {
      product: 'Test Product',
      price: 'Rs 50',
      size: '1L',
      store: 'Test Store',
      category: 'Dairy',
      timestamp: new Date().toISOString(),
    };
    
    try {
      // Save product
      console.log('Saving test product...');
      const savedProduct = await KipriBackendService.saveProduct(testProduct);
      console.log('Saved:', savedProduct);
      
      // Fetch products
      console.log('Fetching products...');
      const products = await KipriBackendService.getProducts({ limit: 10 });
      console.log('Fetched products:', products?.length || 0);
      
      // Search products
      console.log('Searching for "test"...');
      const searchResults = await KipriBackendService.searchProducts('test');
      console.log('Search results:', searchResults?.length || 0);
      
      return true;
    } catch (error) {
      console.error('Database test error:', error);
      return false;
    }
  }
  
  static createSampleData(): Product[] {
    return [
      {
        product: 'Fresh Milk',
        price: 'Rs 45',
        size: '1L',
        store: 'Super U',
        category: 'Dairy',
        unitPrice: 'Rs 45/L',
        timestamp: new Date().toISOString(),
      },
      {
        product: 'Chicken Breast',
        price: 'Rs 120',
        size: '500g',
        store: 'Super U',
        category: 'Meat',
        unitPrice: 'Rs 240/kg',
        timestamp: new Date().toISOString(),
      },
      {
        product: 'Coca Cola',
        price: 'Rs 65',
        size: '2L',
        store: 'Super U',
        category: 'Beverages',
        unitPrice: 'Rs 32.5/L',
        discount: '10%',
        timestamp: new Date().toISOString(),
      },
    ];
  }
  
  static async populateSampleData() {
    console.log('=== Populating Sample Data ===');
    
    const sampleProducts = this.createSampleData();
    
    try {
      const results = [];
      for (const product of sampleProducts) {
        const result = await KipriBackendService.saveProduct(product);
        results.push(result);
        console.log(`Saved: ${product.product}`);
      }
      
      console.log(`Successfully saved ${results.filter(r => r).length}/${sampleProducts.length} products`);
      return results;
    } catch (error) {
      console.error('Error populating sample data:', error);
      return null;
    }
  }
}

export default TestServices;