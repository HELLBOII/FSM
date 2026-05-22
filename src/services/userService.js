import { supabase } from '@/lib/supabase';
import { toAuthEmail } from '@/lib/userEmail';

/**
 * Admin user listing via list_auth_users RPC (reads auth.users).
 * Run supabase_list_auth_users.sql in Supabase SQL Editor.
 */
export const userService = {
  /**
   * @param {Object} opts
   * @param {number} [opts.page=1]
   * @param {number} [opts.pageSize=10]
   * @param {string} [opts.search='']
   * @returns {Promise<{ data: Array, total: number }>}
   */
  async listPaged({ page = 1, pageSize = 10, search = '' } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeSize = Math.min(100, Math.max(1, Number(pageSize) || 10));

    const { data, error } = await supabase.rpc('list_auth_users', {
      search: search?.trim() || '',
      page_size: safeSize,
      page: safePage,
    });

    if (error) {
      if (
        error.message?.includes('Could not find the function') ||
        error.message?.includes('schema cache')
      ) {
        const enhancedError = new Error(
          'User list function not found. Run supabase_list_auth_users.sql in your Supabase SQL Editor.'
        );
        enhancedError.originalError = error;
        throw enhancedError;
      }
      if (error.message?.includes('Only administrators')) {
        const enhancedError = new Error('Only administrators can list users.');
        enhancedError.originalError = error;
        throw enhancedError;
      }
      throw error;
    }

    const payload = data ?? {};
    return {
      data: Array.isArray(payload.data) ? payload.data : [],
      total: Number(payload.total) || 0,
    };
  },

  /**
   * Admin-only: update another user's sign-in password.
   * Requires admin_update_auth_user_password RPC (supabase_list_auth_users.sql).
   * @param {string} userId - auth.users id
   * @param {string} newPassword
   */
  async updatePassword(userId, newPassword) {
    const { data, error } = await supabase.rpc('admin_update_auth_user_password', {
      target_user_id: userId,
      new_password: newPassword,
    });

    if (error) {
      if (
        error.message?.includes('Could not find the function') ||
        error.message?.includes('schema cache')
      ) {
        const enhancedError = new Error(
          'Password update function not found. Run supabase_list_auth_users.sql in your Supabase SQL Editor.'
        );
        enhancedError.originalError = error;
        throw enhancedError;
      }
      if (error.message?.includes('Only administrators')) {
        const enhancedError = new Error('Only administrators can update user passwords.');
        enhancedError.originalError = error;
        throw enhancedError;
      }
      throw error;
    }

    return data;
  },

  /**
   * Resolve auth.users id for a technician sign-in username (full email).
   * @param {string} username
   * @returns {Promise<string|null>}
   */
  async findAuthUserIdByUsername(username) {
    const email = toAuthEmail(username);
    if (!email) return null;

    const { data: rpcId, error: rpcError } = await supabase.rpc(
      'get_auth_user_id_by_email',
      { target_email: email }
    );

    if (!rpcError && rpcId) {
      return rpcId;
    }

    if (
      rpcError &&
      !rpcError.message?.includes('Could not find the function') &&
      !rpcError.message?.includes('schema cache')
    ) {
      throw rpcError;
    }

    const { data } = await this.listPaged({ search: email, pageSize: 50, page: 1 });
    const match = data.find(
      (row) => (row.username ?? '').toLowerCase() === email.toLowerCase()
    );
    return match?.id ?? null;
  },

  /**
   * Resolve auth.users id from technician.user_id or sign-in username.
   * @param {Object} [technician]
   * @param {string} [username]
   * @returns {Promise<string|null>}
   */
  async resolveAuthUserIdForTechnician(technician, username) {
    const storedId = technician?.user_id?.trim();
    if (storedId) return storedId;
    const name = username?.trim() || technician?.username?.trim();
    if (!name) return null;
    return this.findAuthUserIdByUsername(name);
  },

  /**
   * Enable or disable sign-in for an auth user.
   * When disabled: sets banned_until, revokes all refresh tokens, and deletes all sessions
   * (terminates active logins on every device; existing JWTs work only until they expire).
   * @param {string} userId
   * @param {boolean} enableLogin — true = unban, false = ban + kill sessions
   */
  async setLoginAccess(userId, enableLogin) {
    const { data, error } = await supabase.rpc('admin_set_auth_user_login_access', {
      target_user_id: userId,
      enable_login: enableLogin,
    });

    if (error) {
      if (
        error.message?.includes('Could not find the function') ||
        error.message?.includes('schema cache')
      ) {
        const enhancedError = new Error(
          'Login access function not found. Run supabase_list_auth_users.sql in your Supabase SQL Editor.'
        );
        enhancedError.originalError = error;
        throw enhancedError;
      }
      if (error.message?.includes('Only administrators')) {
        const enhancedError = new Error(
          'Only administrators can update user login access.'
        );
        enhancedError.originalError = error;
        throw enhancedError;
      }
      throw error;
    }

    return data;
  },

  /**
   * Sync auth ban state with technician active/inactive status.
   * @returns {Promise<{ synced: boolean, userId?: string }>}
   */
  async syncTechnicianLoginAccess({ technician, username, status, authUserId }) {
    const userId =
      authUserId?.trim() ||
      (await this.resolveAuthUserIdForTechnician(technician, username));
    if (!userId) {
      return { synced: false };
    }
    await this.setLoginAccess(userId, status === 'active');
    return { synced: true, userId };
  },
};
