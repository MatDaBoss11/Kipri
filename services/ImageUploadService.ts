import { supabase } from '@/config/supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

class ImageUploadService {
  /**
   * Upload product image to Supabase Storage
   * Handles React Native/Expo image URIs properly
   */
  async uploadProductImage(imageUri: string, productId: string): Promise<string | null> {
    try {
      console.log('📸 Starting image upload for product:', productId);
      console.log('📸 Image URI:', imageUri);

      // Validate inputs
      if (!imageUri || !productId) {
        console.error('❌ Invalid inputs: imageUri or productId missing');
        return null;
      }

      // Ensure the image URI is valid
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) {
        console.error('❌ Image file does not exist at URI:', imageUri);
        return null;
      }

      console.log('✅ File exists, size:', fileInfo.size, 'bytes');

      // Resize image to reduce file size if needed (max 1024x1024)
      const manipulatedImage = await manipulateAsync(
        imageUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: SaveFormat.JPEG }
      );

      console.log('✅ Image processed, new URI:', manipulatedImage.uri);

      // Read the processed image as base64
      const base64 = await FileSystem.readAsStringAsync(manipulatedImage.uri, {
        encoding: 'base64',
      });

      if (!base64) {
        console.error('❌ Failed to read image as base64');
        return null;
      }

      console.log('✅ Base64 string length:', base64.length);

      // Upload to Supabase
      const fileName = `${productId}.jpg`;
      console.log('📤 Uploading as:', fileName);

      // Convert base64 to ArrayBuffer for Supabase
      // Use base64-arraybuffer package which works in React Native
      const arrayBuffer = decode(base64);
      console.log('✅ Converted to ArrayBuffer, size:', arrayBuffer.byteLength);

      // Upload the ArrayBuffer to Supabase
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.error('❌ Supabase upload error:', error);
        
        // Try alternative approach with FormData
        console.log('🔄 Trying FormData approach...');
        const formData = new FormData();
        const file = {
          uri: manipulatedImage.uri,
          type: 'image/jpeg',
          name: fileName,
        } as any;
        
        formData.append('file', file);
        
        // Direct API call to Supabase Storage
        const storageUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/product-images/${fileName}`;
        const response = await fetch(storageUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: formData,
        });

        if (!response.ok) {
          console.error('❌ FormData upload also failed:', await response.text());
          return null;
        }

        console.log('✅ Successfully uploaded via FormData');
        return fileName;
      }

      console.log('✅ Successfully uploaded image:', data.path);
      return data.path;

    } catch (error) {
      console.error('❌ Image upload error:', error);
      return null;
    }
  }

  /**
   * Get public URL for a product image
   */
  getImageUrl(imagePath: string): string {
    const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    return `${baseUrl}/storage/v1/object/public/product-images/${imagePath}`;
  }
}

export default new ImageUploadService();
