import { supabase } from '@/lib/supabase';

/**
 * Storage Service - File upload operations using Supabase Storage
 */
export const storageService = {
  /**
   * Upload a file to Supabase Storage
   * @param {File|Blob} file - The file to upload
   * @param {string} bucket - The storage bucket name (default: 'uploads')
   * @param {string} folder - Optional folder path within the bucket
   * @returns {Promise<{file_url: string, path: string}>}
   */
  async uploadFile(file, bucket = 'uploads', folder = '') {
    try {
      // Generate a unique filename
      const fileExt = file.name?.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return {
        file_url: urlData.publicUrl,
        path: filePath
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },

  /**
   * Delete a file from Supabase Storage
   * @param {string} path - The file path in storage
   * @param {string} bucket - The storage bucket name (default: 'uploads')
   * @returns {Promise<void>}
   */
  async deleteFile(path, bucket = 'uploads') {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) throw error;
  },

  /**
   * Get public URL for a file
   * @param {string} path - The file path in storage
   * @param {string} bucket - The storage bucket name (default: 'uploads')
   * @returns {string} Public URL
   */
  getPublicUrl(path, bucket = 'uploads') {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    return data.publicUrl;
  }
};

