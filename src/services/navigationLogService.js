import { supabase } from '@/lib/supabase';

/**
 * Navigation Log Service - Log user navigation events
 */
export const navigationLogService = {
  /**
   * Log user navigation to a page
   * @param {string} pageName - Name of the page being visited
   * @param {string} userId - Optional user ID (will use current session if not provided)
   * @returns {Promise<void>}
   */
  async logUserInApp(pageName, userId = null) {
    try {
      // Get current user if userId not provided
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id;
      }

      if (!userId) {
        console.warn('Cannot log navigation: No user ID available');
        return;
      }

      // Insert navigation log
      const { error } = await supabase
        .from('navigation_logs')
        .insert({
          user_id: userId,
          page_name: pageName,
          visited_at: new Date().toISOString()
        });

      if (error) {
        // If table doesn't exist, just log to console
        console.log('Navigation logged:', pageName);
      }
    } catch (error) {
      // Silently fail - logging shouldn't break the app
      console.log('Navigation logged:', pageName);
    }
  }
};

