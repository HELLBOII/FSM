import { supabase } from '@/lib/supabase';

/**
 * Specializations Service - CRUD operations for Specializations
 */
export const specializationsService = {
  /**
   * Get all specializations
   * @returns {Promise<Array>}
   */
  async list() {
    const { data, error } = await supabase
      .from('specializations')
      .select('*')
      .order('specializations', { ascending: true });

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        const enhancedError = new Error(
          'Database table not found. Please run the migration script to create the specializations table.'
        );
        enhancedError.originalError = error;
        throw enhancedError;
      }
      throw error;
    }
    return data || [];
  },

  /**
   * Create a new specialization
   * @param {Object} specialization - { specializations: string }
   * @returns {Promise<Object>}
   */
  async create(specialization) {
    const { data, error } = await supabase
      .from('specializations')
      .insert([specialization])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get specialization by name
   * @param {string} name
   * @returns {Promise<Object|null>}
   */
  async getByName(name) {
    const { data, error } = await supabase
      .from('specializations')
      .select('*')
      .eq('specializations', name)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
    return data;
  }
};

