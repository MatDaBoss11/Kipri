// Simple test file for BackendReplicaService
// This file can be used to test the service manually or with testing frameworks

import BackendReplicaService from './BackendReplicaService';

export async function testBackendReplicaService() {
  console.log('🧪 Testing Backend Replica Service...');
  
  try {
    // Test connection
    const connectionOk = await BackendReplicaService.testConnection();
    console.log('Connection test:', connectionOk ? '✅ PASS' : '❌ FAIL');
    
    if (!connectionOk) {
      console.error('Backend Replica Service connection failed. Check your API keys in .env file:');
      console.error('- EXPO_PUBLIC_GEMINI_API_KEY');
      console.error('- EXPO_PUBLIC_GOOGLE_VISION_API_KEY or EXPO_PUBLIC_GOOGLE_APPLICATION_CREDENTIALS_JSON');
      return false;
    }
    
    console.log('✅ Backend Replica Service is working correctly!');
    console.log('📋 Ready to process images with the same logic as the Python backend');
    
    return true;
    
  } catch (error) {
    console.error('❌ Backend Replica Service test failed:', error);
    return false;
  }
}

// Export for use in other components
export { BackendReplicaService };