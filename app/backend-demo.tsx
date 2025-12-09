import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Product } from '../services/GeminiApiService';
import KipriBackendService, { ServiceStatus } from '../services/KipriBackendService';
import TestServices from '../services/TestServices';

export default function BackendDemoScreen() {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [testText, setTestText] = useState('Fresh Milk 1L Rs 45');
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    checkServices();
  }, []);

  const checkServices = async () => {
    setLoading(true);
    try {
      const result = await TestServices.testAllServices();
      setServiceStatus(result.serviceStatus);
      
      if (result.missingKeys.length > 0) {
        Alert.alert(
          'Missing API Keys',
          `Please add the following API keys to your .env file:\n\n${result.missingKeys.join('\n')}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error checking services:', error);
    } finally {
      setLoading(false);
    }
  };

  const testImageProcessing = async () => {
    setLoading(true);
    try {
      Alert.alert(
        'Image Processing',
        'This will open your camera/gallery to select an image for processing',
        [
          { text: 'Cancel' },
          {
            text: 'Gallery',
            onPress: async () => {
              const result = await KipriBackendService.pickAndProcessImage(false);
              if (result.success) {
                setProducts(result.products);
                Alert.alert('Success', `Extracted ${result.products.length} products from image`);
              } else {
                Alert.alert('Error', result.error || 'Failed to process image');
              }
              setLoading(false);
            }
          }
        ]
      );
    } catch {
      Alert.alert('Error', 'Failed to process image');
      setLoading(false);
    }
  };

  const testTextProcessing = async () => {
    if (!testText.trim()) return;
    
    setLoading(true);
    try {
      const result = await KipriBackendService.processText(testText);
      
      if (result.success) {
        const { categoryResult } = result;
        Alert.alert(
          'Text Analysis Result',
          `Is Food: ${categoryResult.isFood ? 'Yes' : 'No'}\nCategory: ${categoryResult.category}\nConfidence: ${Math.round(categoryResult.confidence * 100)}%\n\n${categoryResult.description}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to process text');
      }
    } catch {
      Alert.alert('Error', 'Failed to process text');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const result = await KipriBackendService.getProducts({ limit: 20 });
      if (result) {
        setProducts(result);
      }
    } catch {
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const searchProducts = async () => {
    if (!searchTerm.trim()) {
      loadProducts();
      return;
    }
    
    setLoading(true);
    try {
      const result = await KipriBackendService.searchProducts(searchTerm);
      if (result) {
        setProducts(result);
      }
    } catch {
      Alert.alert('Error', 'Failed to search products');
    } finally {
      setLoading(false);
    }
  };

  const populateSampleData = async () => {
    setLoading(true);
    try {
      await TestServices.populateSampleData();
      Alert.alert('Success', 'Sample data added to database');
      loadProducts();
    } catch {
      Alert.alert('Error', 'Failed to populate sample data');
      setLoading(false);
    }
  };

  const ServiceStatusIndicator = ({ service, status }: { service: string; status: boolean }) => (
    <View style={styles.statusRow}>
      <Text style={styles.serviceName}>{service}</Text>
      <View style={[styles.statusDot, { backgroundColor: status ? '#4CAF50' : '#F44336' }]} />
      <Text style={[styles.statusText, { color: status ? '#4CAF50' : '#F44336' }]}>
        {status ? 'Connected' : 'Disconnected'}
      </Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.kipriLogo}>Kipri</Text>
        <Text style={styles.title}>Backend Demo</Text>
      </View>
      
      {/* Service Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Status</Text>
        {serviceStatus ? (
          <View>
            <ServiceStatusIndicator service="Google Vision" status={serviceStatus.vision} />
            <ServiceStatusIndicator service="Gemini AI" status={serviceStatus.openai} />
            <ServiceStatusIndicator service="OpenAI Categorization" status={serviceStatus.openai_categorization} />
            <ServiceStatusIndicator service="Supabase" status={serviceStatus.supabase} />
          </View>
        ) : (
          <Text style={styles.loadingText}>Checking services...</Text>
        )}
        
        <TouchableOpacity style={styles.button} onPress={checkServices} disabled={loading}>
          <Text style={styles.buttonText}>Refresh Status</Text>
        </TouchableOpacity>
      </View>

      {/* Image Processing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Image Processing</Text>
        <Text style={styles.description}>
          Take a photo of a grocery flyer or product to extract information
        </Text>
        <TouchableOpacity style={styles.button} onPress={testImageProcessing} disabled={loading}>
          <Text style={styles.buttonText}>Process Image</Text>
        </TouchableOpacity>
      </View>

      {/* Text Processing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Text Analysis</Text>
        <Text style={styles.description}>
          Enter product text to analyze and categorize
        </Text>
        <TextInput
          style={styles.textInput}
          value={testText}
          onChangeText={setTestText}
          placeholder="Enter product text (e.g., Fresh Milk 1L Rs 45)"
          multiline
        />
        <TouchableOpacity style={styles.button} onPress={testTextProcessing} disabled={loading}>
          <Text style={styles.buttonText}>Analyze Text</Text>
        </TouchableOpacity>
      </View>

      {/* Database Operations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Database Operations</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.halfButton]} onPress={populateSampleData} disabled={loading}>
            <Text style={styles.buttonText}>Add Sample Data</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.halfButton]} onPress={loadProducts} disabled={loading}>
            <Text style={styles.buttonText}>Load Products</Text>
          </TouchableOpacity>
        </View>
        
        <TextInput
          style={styles.textInput}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Search products..."
          onSubmitEditing={searchProducts}
        />
        <TouchableOpacity style={styles.button} onPress={searchProducts} disabled={loading}>
          <Text style={styles.buttonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Products List */}
      {products.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Products ({products.length})</Text>
          {products.map((product, index) => (
            <View key={index} style={styles.productCard}>
              <Text style={styles.productName}>{product.product}</Text>
              <Text style={styles.productPrice}>{product.price}</Text>
              {product.category && <Text style={styles.productDetail}>Category: {product.category}</Text>}
              {product.size && <Text style={styles.productDetail}>Size: {product.size}</Text>}
              {product.discount && <Text style={styles.productDiscount}>Discount: {product.discount}</Text>}
            </View>
          ))}
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
    paddingTop: 40,
  },
  kipriLogo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 80,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfButton: {
    flex: 0.48,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    minHeight: 40,
    backgroundColor: '#fff',
  },
  productCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  productDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  productDiscount: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});