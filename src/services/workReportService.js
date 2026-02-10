import { supabase } from '@/lib/supabase';

/**
 * Work Report Service - CRUD operations for Work Reports
 */
export const workReportService = {
  /**
   * Get all work reports
   * @param {string} orderBy - Column to order by (default: 'created_at')
   * @param {string} orderDirection - 'asc' or 'desc' (default: 'desc')
   * @returns {Promise<Array>}
   */
  async list(orderBy = 'created_at', orderDirection = 'desc') {
    const { data, error } = await supabase
      .from('work_reports')
      .select('*')
      .order(orderBy, { ascending: orderDirection === 'asc' });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single work report by ID
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('work_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new work report
   * @param {Object} reportData
   * @returns {Promise<Object>}
   */
  async create(reportData) {
    const { data, error } = await supabase
      .from('work_reports')
      .insert([reportData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an existing work report
   * @param {string} id
   * @param {Object} reportData
   * @returns {Promise<Object>}
   */
  async update(id, reportData) {
    const { data, error } = await supabase
      .from('work_reports')
      .update(reportData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a work report
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const { error } = await supabase
      .from('work_reports')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Get work reports by service request ID
   * @param {string} serviceRequestId
   * @returns {Promise<Array>}
   */
  async getByServiceRequestId(serviceRequestId) {
    const { data, error } = await supabase
      .from('work_reports')
      .select('*')
      .eq('service_request_id', serviceRequestId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get work reports by technician ID
   * @param {string} technicianId
   * @returns {Promise<Array>}
   */
  async getByTechnicianId(technicianId) {
    const { data, error } = await supabase
      .from('work_reports')
      .select('*')
      .eq('technician_id', technicianId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get work reports by status
   * @param {string} status
   * @returns {Promise<Array>}
   */
  async getByStatus(status) {
    const { data, error } = await supabase
      .from('work_reports')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Approve a work report
   * @param {string} id
   * @param {string} approvedBy
   * @returns {Promise<Object>}
   */
  async approve(id, approvedBy) {
    const { data, error } = await supabase
      .from('work_reports')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Reject a work report
   * @param {string} id
   * @param {string} rejectionReason
   * @returns {Promise<Object>}
   */
  async reject(id, rejectionReason) {
    const { data, error } = await supabase
      .from('work_reports')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Filter work reports by multiple conditions
   * @param {Object} filters - Object with filter conditions
   * @returns {Promise<Array>}
   */
  async filter(filters) {
    let query = supabase.from('work_reports').select('*');

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

