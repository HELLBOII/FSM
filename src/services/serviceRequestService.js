import { supabase } from '@/lib/supabase';

/**
 * Service Request Service - CRUD operations for Service Requests
 */
export const serviceRequestService = {
  /**
   * Get all service requests
   * @param {string} orderBy - Column to order by (default: 'created_at')
   * @param {string} orderDirection - 'asc' or 'desc' (default: 'desc')
   * @param {number} limit - Maximum number of records to return
   * @returns {Promise<Array>}
   */
  async list(orderBy = 'created_at', orderDirection = 'desc', limit = null) {
    let query = supabase
      .from('service_requests')
      .select('*')
      .order(orderBy, { ascending: orderDirection === 'asc' });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single service request by ID
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new service request
   * @param {Object} requestData
   * @returns {Promise<Object>}
   */
  async create(requestData) {
    // Generate request number if not provided
    if (!requestData.request_number) {
      const timestamp = Date.now();
      requestData.request_number = `SR-${timestamp}`;
    }

    const { data, error } = await supabase
      .from('service_requests')
      .insert([requestData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an existing service request
   * @param {string} id
   * @param {Object} requestData
   * @returns {Promise<Object>}
   */
  async update(id, requestData) {
    const { data, error } = await supabase
      .from('service_requests')
      .update(requestData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a service request
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const { error } = await supabase
      .from('service_requests')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Get service requests by client ID
   * @param {string} clientId
   * @returns {Promise<Array>}
   */
  async getByClientId(clientId) {
    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get service requests by technician ID
   * @param {string} technicianId
   * @returns {Promise<Array>}
   */
  async getByTechnicianId(technicianId) {
    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('assigned_technician_id', technicianId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get service requests by status
   * @param {string} status
   * @returns {Promise<Array>}
   */
  async getByStatus(status) {
    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Filter service requests by multiple conditions
   * @param {Object} filters - Object with filter conditions
   * @returns {Promise<Array>}
   */
  async filter(filters) {
    let query = supabase.from('service_requests').select('*');

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
  },

  /**
   * Get a single service request (alias for getById for compatibility)
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async get(id) {
    return this.getById(id);
  }
};

