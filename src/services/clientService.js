import { supabase } from '@/lib/supabase';

/**
 * Client Service - CRUD operations for Clients
 */
export const clientService = {
  /**
   * Get all clients
   * @param {string} orderBy - Column to order by (default: 'created_at')
   * @param {string} orderDirection - 'asc' or 'desc' (default: 'desc')
   * @returns {Promise<Array>}
   */
  async list(orderBy = 'created_at', orderDirection = 'desc') {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order(orderBy, { ascending: orderDirection === 'asc' });

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
  }
};

