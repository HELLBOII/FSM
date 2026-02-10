import { supabase } from '@/lib/supabase';

/**
 * Chat Message Service - CRUD operations for Chat Messages
 */
export const chatMessageService = {
  /**
   * Get all messages for a conversation
   * @param {string} conversationId
   * @param {string} orderBy - Column to order by (default: 'created_at')
   * @param {string} orderDirection - 'asc' or 'desc' (default: 'asc')
   * @returns {Promise<Array>}
   */
  async getByConversationId(conversationId, orderBy = 'created_at', orderDirection = 'asc') {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order(orderBy, { ascending: orderDirection === 'asc' });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get all messages for a service request
   * @param {string} serviceRequestId
   * @returns {Promise<Array>}
   */
  async getByServiceRequestId(serviceRequestId) {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('service_request_id', serviceRequestId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single message by ID
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new message
   * @param {Object} messageData
   * @returns {Promise<Object>}
   */
  async create(messageData) {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([messageData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an existing message
   * @param {string} id
   * @param {Object} messageData
   * @returns {Promise<Object>}
   */
  async update(id, messageData) {
    const { data, error } = await supabase
      .from('chat_messages')
      .update(messageData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a message
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Mark message as read
   * @param {string} id
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async markAsRead(id, userId) {
    // Get current message
    const message = await this.getById(id);
    const readBy = message.read_by || [];

    // Add user to read_by array if not already present
    if (!readBy.includes(userId)) {
      readBy.push(userId);
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .update({ read_by: readBy })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get unread message count for a user
   * @param {string} userId
   * @param {string} conversationId - Optional conversation filter
   * @returns {Promise<number>}
   */
  async getUnreadCount(userId, conversationId = null) {
    let query = supabase
      .from('chat_messages')
      .select('id', { count: 'exact' })
      .neq('sender_user_id', userId);

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Filter messages where user is not in read_by array
    const unreadMessages = (data || []).filter(
      (msg) => !msg.read_by || !msg.read_by.includes(userId)
    );

    return unreadMessages.length;
  }
};

