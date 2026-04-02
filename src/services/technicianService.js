import { supabase } from '@/lib/supabase';

/**
 * Technician Service - CRUD operations for Technicians
 */
export const technicianService = {
  /**
   * Get all technicians
   * @param {string} orderBy - Column to order by (default: 'created_at')
   * @param {string} orderDirection - 'asc' or 'desc' (default: 'desc')
   * @returns {Promise<Array>}
   */
  async list(orderBy = 'created_at', orderDirection = 'desc') {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .order(orderBy, { ascending: orderDirection === 'asc' });

    if (error) throw error;
    return data || [];
  },

  /**
   * Paginated list with optional search and status filter (server-side).
   * @param {Object} opts
   * @param {number} [opts.page=1]
   * @param {number} [opts.pageSize=12]
   * @param {string} [opts.search=''] — matches name, employee_id, phone (ilike)
   * @param {string} [opts.status='all'] — 'all' | 'active' | 'inactive'
   * @returns {Promise<{ data: Array, total: number }>}
   */
  async listPaged({
    page = 1,
    pageSize = 12,
    search = '',
    status = 'all'
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeSize = Math.min(100, Math.max(1, Number(pageSize) || 12));
    const from = (safePage - 1) * safeSize;
    const to = from + safeSize - 1;

    let query = supabase.from('technicians').select('*', { count: 'exact' });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const q = search?.trim();
    if (q) {
      const esc = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or(
        `name.ilike.%${esc}%,employee_id.ilike.%${esc}%,phone.ilike.%${esc}%`
      );
    }

    query = query
      .order('name', { ascending: true })
      .order('employee_id', { ascending: true })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) {
      if (error.message?.includes('schema cache') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        const enhancedError = new Error(
          'Database table not found. Please run the migration script (supabase_migration.sql) in your Supabase SQL Editor to create the required tables.'
        );
        enhancedError.originalError = error;
        throw enhancedError;
      }
      throw error;
    }

    return { data: data || [], total: count ?? 0 };
  },

  /**
   * Get a single technician by ID
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get technician by user ID
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getByUserId(userId) {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  async getByEmail(email) {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .eq('email', email)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new technician
   * @param {Object} technicianData
   * @returns {Promise<Object>}
   */
  async create(technicianData) {
    const { data, error } = await supabase
      .from('technicians')
      .insert([technicianData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an existing technician
   * @param {string} id
   * @param {Object} technicianData
   * @returns {Promise<Object>}
   */
  async update(id, technicianData) {
    const { data, error } = await supabase
      .from('technicians')
      .update(technicianData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a technician
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const { error } = await supabase
      .from('technicians')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Get technicians by availability status
   * @param {string} status
   * @returns {Promise<Array>}
   */
  async getByAvailabilityStatus(status) {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .eq('availability_status', status)
      .eq('status', 'active');

    if (error) throw error;
    return data || [];
  },

  /**
   * Update technician location
   * @param {string} id
   * @param {Object} location - { lat, lng }
   * @returns {Promise<Object>}
   */
  async updateLocation(id, location) {
    const { data, error } = await supabase
      .from('technicians')
      .update({
        current_location: {
          ...location,
          updated_at: new Date().toISOString()
        }
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Filter technicians by multiple conditions
   * @param {Object} filters - Object with filter conditions
   * @returns {Promise<Array>}
   */
  async filter(filters) {
    let query = supabase.from('technicians').select('*');

    // Apply filters
    Object.keys(filters).forEach(key => {
      const value = filters[key];
      if (Array.isArray(value)) {
        // Handle array values (IN query)
        query = query.in(key, value);
      } else {
        query = query.eq(key, value);
      }
    });

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
};

