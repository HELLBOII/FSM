import { supabase } from '@/lib/supabase';

/**
 * Irrigation Systems Service - CRUD operations for Irrigation Systems
 */
export const irrigationSystemsService = {
  /**
   * Get all irrigation systems
   * @returns {Promise<Array>}
   */
  async list() {
    const { data, error } = await supabase
      .from('irrigation_systems')
      .select('*')
      .order('irrigation_systems', { ascending: true });

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        const enhancedError = new Error(
          'Database table not found. Please run the migration script to create the irrigation_systems table.'
        );
        enhancedError.originalError = error;
        throw enhancedError;
      }
      throw error;
    }
    return data || [];
  },

  /**
   * Create a new irrigation system
   * @param {Object} irrigationSystem - { irrigation_systems: string }
   * @returns {Promise<Object>}
   */
  async create(irrigationSystem) {
    const { data, error } = await supabase
      .from('irrigation_systems')
      .insert([irrigationSystem])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get irrigation system by name
   * @param {string} name
   * @returns {Promise<Object|null>}
   */
  async getByName(name) {
    const { data, error } = await supabase
      .from('irrigation_systems')
      .select('*')
      .eq('irrigation_systems', name)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
    return data;
  }
};
