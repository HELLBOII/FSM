import { supabase } from '@/lib/supabase';
import { normalizeNotesHistory, newNoteEntry } from '@/utils/clientNotesHistory';

/**
 * Client Service - CRUD operations for Clients
 */
export const clientService = {
  /**
   * Get all clients (default: ascending by name, then farm_name)
   * @param {string} [orderBy] - If set, single column to order by
   * @param {string} [orderDirection='asc'] - 'asc' or 'desc'
   * @returns {Promise<Array>}
   */
  async list(orderBy, orderDirection = 'asc') {
    let query = supabase.from('clients').select('*');
    if (orderBy) {
      query = query.order(orderBy, { ascending: orderDirection === 'asc' });
    } else {
      query = query
        .order('name', { ascending: true })
        .order('farm_name', { ascending: true });
    }
    const { data, error } = await query;

    if (error) {
      // Provide more helpful error messages
      if (error.message?.includes('schema cache') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        const enhancedError = new Error(
          'Database table not found. Please run the migration script (supabase_migration.sql) in your Supabase SQL Editor to create the required tables.'
        );
        enhancedError.originalError = error;
        throw enhancedError;
      }
      throw error;
    }
    return data || [];
  },

  /**
   * Paginated list with optional search and status filter (server-side).
   * @param {Object} opts
   * @param {number} [opts.page=1] — 1-based page index
   * @param {number} [opts.pageSize=12]
   * @param {string} [opts.search=''] — matches name, farm_name, phone (ilike)
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

    let query = supabase.from('clients').select('*', { count: 'exact' });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const q = search?.trim();
    if (q) {
      const esc = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or(
        `name.ilike.%${esc}%,farm_name.ilike.%${esc}%,phone.ilike.%${esc}%`
      );
    }

    query = query
      .order('name', { ascending: true })
      .order('farm_name', { ascending: true })
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
   * Get a single client by ID
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new client
   * @param {Object} clientData
   * @returns {Promise<Object>}
   */
  async create(clientData) {
    const { data, error } = await supabase
      .from('clients')
      .insert([clientData])
      .select()
      .single();

    if (error) {
      // Provide more helpful error messages
      if (error.message?.includes('schema cache') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        const enhancedError = new Error(
          'Database table not found. Please run the migration script (supabase_migration.sql) in your Supabase SQL Editor to create the required tables.'
        );
        enhancedError.originalError = error;
        throw enhancedError;
      }
      throw error;
    }
    return data;
  },

  /**
   * Update an existing client
   * @param {string} id
   * @param {Object} clientData
   * @returns {Promise<Object>}
   */
  async update(id, clientData) {
    const { data, error } = await supabase
      .from('clients')
      .update(clientData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Provide more helpful error messages
      if (error.message?.includes('schema cache') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        const enhancedError = new Error(
          'Database table not found. Please run the migration script (supabase_migration.sql) in your Supabase SQL Editor to create the required tables.'
        );
        enhancedError.originalError = error;
        throw enhancedError;
      }
      throw error;
    }
    return data;
  },

  /**
   * Delete a client
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Search clients by query
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async search(query) {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .or(`name.ilike.%${query}%,farm_name.ilike.%${query}%,phone.ilike.%${query}%`);

    if (error) throw error;
    return data || [];
  },

  /**
   * Append an entry to client notes_history (newest first).
   * @param {string} clientId
   * @param {string} text
   */
  async appendNotesHistoryEntry(clientId, text) {
    const t = String(text ?? '').trim();
    if (!t) throw new Error('Note text is required');
    const client = await this.getById(clientId);
    const current = normalizeNotesHistory(client.notes_history);
    const next = [newNoteEntry(t), ...current];
    return this.update(clientId, { notes_history: next });
  }
};

