import { supabase } from '@/lib/supabase';

/**
 * Tasks Service - CRUD for default job execution tasks (template)
 */
export const tasksService = {
  /**
   * List all tasks ordered by sort_order
   * @returns {Promise<Array<{ id: string, label: string, sort_order: number }>>}
   */
  async list() {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, label, sort_order')
      .order('sort_order', { ascending: true });

    if (error) {
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        const enhancedError = new Error(
          'Database table not found. Please run the migration script to create the tasks table.'
        );
        enhancedError.originalError = error;
        throw enhancedError;
      }
      throw error;
    }
    return data || [];
  },

  /**
   * Create a new task (saved as default for future jobs)
   * @param {Object} payload - { label: string, sort_order?: number }
   * @returns {Promise<Object>}
   */
  async create(payload) {
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ label: payload.label, sort_order: payload.sort_order ?? 0 }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
