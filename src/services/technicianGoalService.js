import { supabase } from '@/lib/supabase';

/**
 * Technician Goal Service - CRUD operations for Technician Goals
 */
export const technicianGoalService = {
  /**
   * Get all goals for a technician
   * @param {string} technicianId
   * @param {string} orderBy - Column to order by (default: 'created_at')
   * @param {string} orderDirection - 'asc' or 'desc' (default: 'desc')
   * @returns {Promise<Array>}
   */
  async getByTechnicianId(technicianId, orderBy = 'created_at', orderDirection = 'desc') {
    const { data, error } = await supabase
      .from('technician_goals')
      .select('*')
      .eq('technician_id', technicianId)
      .order(orderBy, { ascending: orderDirection === 'asc' });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single goal by ID
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('technician_goals')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new goal
   * @param {Object} goalData
   * @returns {Promise<Object>}
   */
  async create(goalData) {
    const { data, error } = await supabase
      .from('technician_goals')
      .insert([goalData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an existing goal
   * @param {string} id
   * @param {Object} goalData
   * @returns {Promise<Object>}
   */
  async update(id, goalData) {
    const { data, error } = await supabase
      .from('technician_goals')
      .update(goalData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a goal
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const { error } = await supabase
      .from('technician_goals')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Get active goals for a technician
   * @param {string} technicianId
   * @returns {Promise<Array>}
   */
  async getActiveGoals(technicianId) {
    const { data, error } = await supabase
      .from('technician_goals')
      .select('*')
      .eq('technician_id', technicianId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};

