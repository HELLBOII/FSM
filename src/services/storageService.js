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
   * @param {{ keepOriginalName?: boolean }} [options] - When keepOriginalName is true, stores using the attached file name
   * @returns {Promise<{file_url: string, path: string, file_name: string}>}
   */
  async uploadFile(file, bucket = 'uploads', folder = '', options = {}) {
    try {
      const keepOriginalName = Boolean(options?.keepOriginalName);
      const fileExt = file.name?.split('.').pop() || 'jpg';
      const originalName = String(file.name || `file.${fileExt}`)
        .replace(/[/\\]/g, '_')
        .replace(/\0/g, '')
        .trim();
      const fileName = keepOriginalName && originalName
        ? originalName
        : `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: keepOriginalName
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return {
        file_url: urlData.publicUrl,
        path: filePath,
        file_name: fileName
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

