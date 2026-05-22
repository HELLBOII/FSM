import { supabase } from '@/lib/supabase';

/**
 * Current Supabase session (includes JWT access_token and refresh_token).
 * The access token is sent automatically on every supabase.from().select() etc.
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}

/**
 * JWT access token for the signed-in user (Bearer) — use only for Edge Functions
 * or custom HTTP APIs; never log or persist in plain text.
 */
export async function getAccessToken() {
  const session = await getSession();
  return session?.access_token ?? null;
}

/**
 * Decode JWT payload without verification (client-side inspection only).
 * Authorization decisions must use RLS / server verification.
 */
export function decodeJwtPayload(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') return null;
  const parts = accessToken.split('.');
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
