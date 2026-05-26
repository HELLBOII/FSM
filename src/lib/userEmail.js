/** Sign-in email domain appended to usernames (Supabase auth stores full email). */
export const USER_EMAIL_DOMAIN = '@robertsqifsm.com';

/**
 * Build the auth email stored in Supabase from a username or partial identifier.
 * Accepts `1234`, `abcd123`, or `1234@robertsqifsm.com` and normalizes to full email.
 */
export function toAuthEmail(identifier) {
  const trimmed = identifier?.trim() ?? '';
  if (!trimmed) return '';
  // const localPart = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
  // return `${localPart}${USER_EMAIL_DOMAIN}`;
  return `${trimmed}${USER_EMAIL_DOMAIN}`;
}

/**
 * Display-only username from a stored auth email or username field.
 */
export function toDisplayUsername(emailOrUsername) {
  if (!emailOrUsername) return '';
  const value = String(emailOrUsername).trim();
  const suffix = USER_EMAIL_DOMAIN.toLowerCase();
  if (value.toLowerCase().endsWith(suffix)) {
    return value.slice(0, -USER_EMAIL_DOMAIN.length);
  }
  const at = value.indexOf('@');
  if (at > 0) return value.slice(0, at);
  return value;
}
