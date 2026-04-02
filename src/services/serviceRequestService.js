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
   * Counts for tab badges (All / Active / Pending / Closed) — not affected by search/filters.
   */
  async getTabCounts() {
    const from = () => supabase.from('service_requests');
    const [allRes, activeRes, pendingRes, closedRes] = await Promise.all([
      from().select('*', { count: 'exact', head: true }),
      from()
        .select('*', { count: 'exact', head: true })
        .in('status', ['new', 'scheduled', 'assigned', 'in_progress']),
      from().select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      from()
        .select('*', { count: 'exact', head: true })
        .in('status', ['approved', 'closed'])
    ]);

    if (allRes.error) throw allRes.error;
    if (activeRes.error) throw activeRes.error;
    if (pendingRes.error) throw pendingRes.error;
    if (closedRes.error) throw closedRes.error;

    return {
      all: allRes.count ?? 0,
      active: activeRes.count ?? 0,
      pending: pendingRes.count ?? 0,
      closed: closedRes.count ?? 0
    };
  },

  /**
   * Paginated list with optional search, filters, and tab (server-side).
   * @param {Object} opts
   * @param {number} [opts.page=1]
   * @param {number} [opts.pageSize=12]
   * @param {string} [opts.search=''] — ilike client_name, farm_name, request_number, description
   * @param {string} [opts.status='all']
   * @param {string} [opts.priority='all']
   * @param {string} [opts.irrigation='all']
   * @param {string} [opts.activeTab='all'] — 'all' | 'active' | 'pending' | 'closed'
   * @returns {Promise<{ data: Array, total: number }>}
   */
  async listPaged({
    page = 1,
    pageSize = 12,
    search = '',
    status = 'all',
    priority = 'all',
    irrigation = 'all',
    activeTab = 'all'
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeSize = Math.min(100, Math.max(1, Number(pageSize) || 12));
    const fromIdx = (safePage - 1) * safeSize;
    const toIdx = fromIdx + safeSize - 1;

    let query = supabase.from('service_requests').select('*', { count: 'exact' });

    if (activeTab === 'active') {
      query = query.in('status', ['new', 'scheduled', 'assigned', 'in_progress']);
    } else if (activeTab === 'pending') {
      query = query.eq('status', 'completed');
    } else if (activeTab === 'closed') {
      query = query.in('status', ['approved', 'closed']);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
    }
    if (irrigation && irrigation !== 'all') {
      query = query.eq('irrigation_type', irrigation);
    }

    const q = search?.trim();
    if (q) {
      const esc = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or(
        `client_name.ilike.%${esc}%,farm_name.ilike.%${esc}%,request_number.ilike.%${esc}%,description.ilike.%${esc}%`
      );
    }

    query = query.order('created_at', { ascending: false }).range(fromIdx, toIdx);

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

