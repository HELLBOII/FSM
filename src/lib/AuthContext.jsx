import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toAuthEmail, toDisplayUsername } from '@/lib/userEmail';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  /** While admin creates a user, signUp briefly signs in the new account — ignore that session. */
  const preservingAdminUserIdRef = useRef(null);

  const applySession = useCallback((nextSession) => {
    setSession(nextSession ?? null);
    setUser(nextSession?.user ?? null);
    setIsAuthenticated(!!nextSession?.user);
  }, []);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        // If error is not a missing session, log it
        if (error.message !== 'Invalid Refresh Token: Refresh Token Not Found') {
          console.error('User auth check failed:', error);
        }
        applySession(null);
        setIsLoadingAuth(false);
        return;
      }
      
      if (user) {
        const { data: { session: s } } = await supabase.auth.getSession();
        applySession(s);
        setAuthError(null);
      } else {
        applySession(null);
      }
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('Unexpected auth error:', error);
      applySession(null);
      setIsLoadingAuth(false);
    }
  }, [applySession]);

  const getAccessToken = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    // Check initial session
    checkUserAuth();

    // Listen for auth state changes (JWT refresh, sign-in, sign-out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        if (event === 'INITIAL_SESSION') {
          applySession(nextSession);
          setIsLoadingAuth(false);
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          const preservedAdminId = preservingAdminUserIdRef.current;
          if (
            preservedAdminId &&
            nextSession?.user?.id &&
            nextSession.user.id !== preservedAdminId
          ) {
            return;
          }
          applySession(nextSession);
          setAuthError(null);
        } else if (event === 'SIGNED_OUT') {
          applySession(null);
        }
        setIsLoadingAuth(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [checkUserAuth, applySession]);

  const login = async (username, password) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      // Validate inputs
      if (!username || !password) {
        const error = new Error('Username and password are required');
        setAuthError({
          type: 'login_error',
          message: error.message
        });
        setIsLoadingAuth(false);
        throw error;
      }

      // Validate Supabase configuration
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        const error = new Error('Supabase is not configured. Please check your environment variables.');
        setAuthError({
          type: 'config_error',
          message: error.message
        });
        setIsLoadingAuth(false);
        throw error;
      }

      const email = toAuthEmail(username);

      // Attempt login with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: password
      });

      if (error) {
        // Handle specific Supabase errors
        let errorMessage = 'Login failed. Please check your credentials.';
        
        // Check for email not confirmed error
        if (error.code === 'email_not_confirmed' || error.message?.includes('Email not confirmed')) {
          errorMessage = 'Please verify your email address before signing in. Check your inbox for the confirmation email and click the verification link.';
        } else if (error.message) {
          errorMessage = error.message;
        } else if (error.status === 400) {
          errorMessage = 'Invalid email or password format.';
        } else if (error.status === 401) {
          errorMessage = 'Invalid email or password.';
        } else if (error.status === 429) {
          errorMessage = 'Too many login attempts. Please try again later.';
        }

        setAuthError({
          type: 'login_error',
          message: errorMessage,
          code: error.code
        });
        setIsLoadingAuth(false);
        // Preserve error code when throwing
        const errorToThrow = new Error(errorMessage);
        errorToThrow.code = error.code;
        errorToThrow.status = error.status;
        throw errorToThrow;
      }

      if (data?.user) {
        const sess =
          data.session ?? (await supabase.auth.getSession()).data.session ?? null;
        if (sess) {
          applySession(sess);
        } else {
          setSession(null);
          setUser(data.user);
          setIsAuthenticated(true);
        }
        setAuthError(null);
      } else {
        throw new Error('Login successful but no user data received');
      }
      
      setIsLoadingAuth(false);
      return data;
    } catch (error) {
      setIsLoadingAuth(false);
      
      // If it's not already handled, set a generic error
      if (!authError) {
        setAuthError({
          type: 'login_error',
          message: error.message || 'An unexpected error occurred during login.'
        });
      }
      
      throw error;
    }
  };

  const createUser = async (username, password, metadata = {}) => {
    try {
      setAuthError(null);

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const role = currentUser?.user_metadata?.user_role;
      if (role !== 'admin') {
        const error = new Error('Only administrators can create users.');
        setAuthError({ type: 'create_user_error', message: error.message });
        throw error;
      }

      if (!username || !password) {
        const error = new Error('Username and password are required');
        setAuthError({ type: 'create_user_error', message: error.message });
        throw error;
      }

      if (password.length < 6) {
        const error = new Error('Password must be at least 6 characters long');
        setAuthError({ type: 'create_user_error', message: error.message });
        throw error;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        const error = new Error('Supabase is not configured. Please check your environment variables.');
        setAuthError({ type: 'config_error', message: error.message });
        throw error;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const adminSession = sessionData?.session;
      const adminUserId = adminSession?.user?.id;

      if (!adminSession || !adminUserId) {
        const error = new Error('Admin session not found. Please sign in again.');
        setAuthError({ type: 'create_user_error', message: error.message });
        throw error;
      }

      const email = toAuthEmail(username);
      const displayName = toDisplayUsername(email);

      preservingAdminUserIdRef.current = adminUserId;
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              ...metadata,
              full_name: metadata.full_name
                ? toDisplayUsername(String(metadata.full_name))
                : displayName,
            },
          },
        });

        if (error) {
          let errorMessage = 'Failed to create user. Please try again.';
          if (error.message) {
            errorMessage = error.message;
          } else if (error.status === 422) {
            errorMessage = 'This username is already registered.';
          }
          setAuthError({ type: 'create_user_error', message: errorMessage });
          throw error;
        }

        const { data: restored, error: restoreError } = await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });

        if (restoreError) {
          setAuthError({ type: 'create_user_error', message: restoreError.message });
          throw restoreError;
        }

        applySession(restored.session ?? adminSession);

        return data;
      } finally {
        preservingAdminUserIdRef.current = null;
      }
    } catch (error) {
      if (!authError) {
        setAuthError({
          type: 'create_user_error',
          message: error.message || 'An unexpected error occurred while creating the user.',
        });
      }
      throw error;
    }
  };

  const resendVerificationEmail = async (usernameOrEmail) => {
    try {
      setAuthError(null);
      if (!usernameOrEmail?.trim()) {
        throw new Error('Username is required to resend verification.');
      }
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email: toAuthEmail(usernameOrEmail)
      });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      const message = error.message || 'Failed to resend verification email.';
      setAuthError({ type: 'resend_error', message });
      throw error;
    }
  };

  const resetPasswordForEmail = async (usernameOrEmail) => {
    try {
      setAuthError(null);
      if (!usernameOrEmail?.trim()) {
        throw new Error('Username is required to reset password.');
      }
      const origin = import.meta.env.VITE_URL;
      const redirectTo = `${origin}/reset-password`;
      const { data, error } = await supabase.auth.resetPasswordForEmail(toAuthEmail(usernameOrEmail), {
        redirectTo
      });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      const message = error.message || 'Failed to send password reset email.';
      setAuthError({ type: 'reset_password_error', message });
      throw error;
    }
  };

  const updatePassword = async (newPassword) => {
    try {
      setAuthError(null);
      if (!newPassword || newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return { data };
    } catch (error) {
      const message = error.message || 'Failed to update password.';
      setAuthError({ type: 'update_password_error', message });
      throw error;
    }
  };

  const logout = async (shouldRedirect = true) => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      applySession(null);
      setAuthError(null);

      if (shouldRedirect) {
        // Redirect to login page
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear local state even if signOut fails
      applySession(null);
    }
  };

  const navigateToLogin = () => {
    // Redirect to login page
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAuthenticated,
      isLoadingAuth,
      authError,
      login,
      createUser,
      resendVerificationEmail,
      resetPasswordForEmail,
      updatePassword,
      logout,
      navigateToLogin,
      checkUserAuth,
      getAccessToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
