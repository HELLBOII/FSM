import { supabase } from '@/lib/supabase';

/**
 * Equipment Service - CRUD operations for Equipment
 */
export const equipmentService = {
  /**
   * Get all equipment
   * @param {string} orderBy - Column to order by (default: 'created_at')
   * @param {string} orderDirection - 'asc' or 'desc' (default: 'desc')
   * @returns {Promise<Array>}
   */
  async list(orderBy = 'created_at', orderDirection = 'desc') {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .order(orderBy, { ascending: orderDirection === 'asc' });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single equipment by ID
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new equipment
   * @param {Object} equipmentData
   * @returns {Promise<Object>}
   */
  async create(equipmentData) {
    // Calculate status based on stock levels
    if (equipmentData.stock_quantity !== undefined && equipmentData.min_stock_level !== undefined) {
      if (equipmentData.stock_quantity === 0) {
        equipmentData.status = 'out_of_stock';
      } else if (equipmentData.stock_quantity <= equipmentData.min_stock_level) {
        equipmentData.status = 'low_stock';
      } else {
        equipmentData.status = 'in_stock';
      }
    }

    const { data, error } = await supabase
      .from('equipment')
      .insert([equipmentData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an existing equipment
   * @param {string} id
   * @param {Object} equipmentData
   * @returns {Promise<Object>}
   */
  async update(id, equipmentData) {
    // Recalculate status if stock quantity or min level changed
    if (equipmentData.stock_quantity !== undefined || equipmentData.min_stock_level !== undefined) {
      // Get current equipment to check stock levels
      const current = await this.getById(id);
      const stockQty = equipmentData.stock_quantity ?? current.stock_quantity;
      const minLevel = equipmentData.min_stock_level ?? current.min_stock_level;

      if (stockQty === 0) {
        equipmentData.status = 'out_of_stock';
      } else if (stockQty <= minLevel) {
        equipmentData.status = 'low_stock';
      } else {
        equipmentData.status = 'in_stock';
      }
    }

    const { data, error } = await supabase
      .from('equipment')
      .update(equipmentData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete an equipment
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const { error } = await supabase
      .from('equipment')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Get equipment by category
   * @param {string} category
   * @returns {Promise<Array>}
   */
  async getByCategory(category) {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .eq('category', category)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get equipment by status
   * @param {string} status
   * @returns {Promise<Array>}
   */
  async getByStatus(status) {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .eq('status', status)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get low stock equipment
   * @returns {Promise<Array>}
   */
  async getLowStock() {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .in('status', ['low_stock', 'out_of_stock'])
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }
};

