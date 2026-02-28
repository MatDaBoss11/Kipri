import { supabase } from '@/config/supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

class ImageUploadService {
  /**
   * Upload product image to Supabase Storage
   * Handles React Native/Expo image URIs properly
   */
  async uploadProductImage(imageUri: string, productId: string): Promise<string | null> {
    try {
      if (__DEV__) console.log('📸 Starting image upload for product:', productId);
      if (__DEV__) console.log('📸 Image URI:', imageUri);

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

      if (__DEV__) console.log('✅ File exists, size:', fileInfo.size, 'bytes');

      // Validate file size (max 20MB raw before compression)
      const MAX_FILE_SIZE = 20 * 1024 * 1024;
      if (fileInfo.size && fileInfo.size > MAX_FILE_SIZE) {
        console.error('❌ Image file too large:', fileInfo.size, 'bytes (max 20MB)');
        return null;
      }

      // Validate file extension
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.heic', '.webp'];
      const ext = imageUri.split('.').pop()?.toLowerCase();
      if (ext && !allowedExtensions.includes(`.${ext}`)) {
        console.error('❌ Invalid file type:', ext);
        return null;
      }

      // Resize image to reduce file size if needed (max 1024x1024)
      const manipulatedImage = await manipulateAsync(
        imageUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: SaveFormat.JPEG }
      );

      if (__DEV__) console.log('✅ Image processed, new URI:', manipulatedImage.uri);

      // Read the processed image as base64
      const base64 = await FileSystem.readAsStringAsync(manipulatedImage.uri, {
        encoding: 'base64',
      });

      if (!base64) {
        console.error('❌ Failed to read image as base64');
        return null;
      }

      if (__DEV__) console.log('✅ Base64 string length:', base64.length);

      // Validate compressed size (max 5MB after compression)
      const MAX_COMPRESSED_SIZE = 5 * 1024 * 1024;
      if (base64.length * 0.75 > MAX_COMPRESSED_SIZE) {
        console.error('❌ Compressed image still too large');
        return null;
      }

      // Sanitize productId to prevent path traversal
      const safeProductId = productId.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeProductId) {
        console.error('❌ Invalid product ID');
        return null;
      }

      // Upload to Supabase
      const fileName = `IMG_${safeProductId}.jpg`;
      if (__DEV__) console.log('📤 Uploading as:', fileName);

      // Convert base64 to ArrayBuffer for Supabase
      // Use base64-arraybuffer package which works in React Native
      const arrayBuffer = decode(base64);
      if (__DEV__) console.log('✅ Converted to ArrayBuffer, size:', arrayBuffer.byteLength);

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
        if (__DEV__) console.log('🔄 Trying FormData approach...');
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

        if (__DEV__) console.log('✅ Successfully uploaded via FormData');
        return fileName.replace('.jpg', '');
      }

      if (__DEV__) console.log('✅ Successfully uploaded image:', data.path);
      return data.path.replace('.jpg', '');

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
