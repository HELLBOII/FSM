import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        // If error is not a missing session, log it
        if (error.message !== 'Invalid Refresh Token: Refresh Token Not Found') {
          console.error('User auth check failed:', error);
        }
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        return;
      }
      
      if (user) {
        setUser(user);
        setIsAuthenticated(true);
        setAuthError(null);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('Unexpected auth error:', error);
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    // Check initial session
    checkUserAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            setUser(session.user);
            setIsAuthenticated(true);
            setAuthError(null);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthenticated(false);
        }
        setIsLoadingAuth(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [checkUserAuth]);

  const login = async (email, password) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      // Validate inputs
      if (!email || !password) {
        const error = new Error('Email and password are required');
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

      // Attempt login with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
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
        setUser(data.user);
        setIsAuthenticated(true);
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

  const signup = async (email, password, metadata = {}) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      // Validate inputs
      if (!email || !password) {
        const error = new Error('Email and password are required');
        setAuthError({
          type: 'signup_error',
          message: error.message
        });
        setIsLoadingAuth(false);
        throw error;
      }

      if (password.length < 6) {
        const error = new Error('Password must be at least 6 characters long');
        setAuthError({
          type: 'signup_error',
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

      // Attempt signup with Supabase
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: metadata,
          emailRedirectTo: "https://fsm-nine.vercel.app"
        }
      });

      console.log(data);

      if (error) {
        // Handle specific Supabase errors
        let errorMessage = 'Sign up failed. Please try again.';
        
        if (error.message) {
          errorMessage = error.message;
        } else if (error.status === 400) {
          errorMessage = 'Invalid email or password format.';
        } else if (error.status === 422) {
          errorMessage = 'This email is already registered. Please sign in instead.';
        } else if (error.status === 429) {
          errorMessage = 'Too many signup attempts. Please try again later.';
        }

        setAuthError({
          type: 'signup_error',
          message: errorMessage
        });
        setIsLoadingAuth(false);
        throw error;
      }

      // Only set user as authenticated when we have a session (email confirmation may be required)
      if (data?.user && data?.session) {
        setUser(data.user);
        setIsAuthenticated(true);
        setAuthError(null);
      }
      // If user exists but no session, email confirmation is pending - do not set authenticated
      
      setIsLoadingAuth(false);
      return data;
    } catch (error) {
      setIsLoadingAuth(false);
      
      // If it's not already handled, set a generic error
      if (!authError) {
        setAuthError({
          type: 'signup_error',
          message: error.message || 'An unexpected error occurred during signup.'
        });
      }
      
      throw error;
    }
  };

  const resendVerificationEmail = async (emailAddress) => {
    try {
      setAuthError(null);
      if (!emailAddress?.trim()) {
        throw new Error('Email is required to resend verification.');
      }
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email: emailAddress.trim()
      });
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      const message = error.message || 'Failed to resend verification email.';
      setAuthError({ type: 'resend_error', message });
      throw error;
    }
  };

  const resetPasswordForEmail = async (emailAddress) => {
    try {
      setAuthError(null);
      if (!emailAddress?.trim()) {
        throw new Error('Email is required to reset password.');
      }
      const origin = import.meta.env.VITE_URL;
      const redirectTo = `${origin}/reset-password`;
      const { data, error } = await supabase.auth.resetPasswordForEmail(emailAddress.trim(), {
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
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);

      if (shouldRedirect) {
        // Redirect to login page
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear local state even if signOut fails
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const navigateToLogin = () => {
    // Redirect to login page
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authError,
      login,
      signup,
      resendVerificationEmail,
      resetPasswordForEmail,
      updatePassword,
      logout,
      navigateToLogin,
      checkUserAuth
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
