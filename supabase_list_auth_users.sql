-- List sign-in accounts from auth.users for the admin Create Users page.
-- Run in Supabase SQL Editor AFTER supabase_rls_jwt_security.sql (needs public.app_user_role()).
--
-- Optional cleanup if app_users was created earlier:
-- DROP TABLE IF EXISTS public.app_users CASCADE;

CREATE OR REPLACE FUNCTION public.list_auth_users(
  search text DEFAULT '',
  page_size integer DEFAULT 10,
  page integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
  v_page integer;
  v_size integer;
  v_offset integer;
  v_total bigint;
  v_search text;
  v_rows jsonb;
BEGIN
  v_role := public.app_user_role();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only administrators can list users';
  END IF;

  v_page := GREATEST(1, COALESCE(page, 1));
  v_size := LEAST(100, GREATEST(1, COALESCE(page_size, 10)));
  v_offset := (v_page - 1) * v_size;
  v_search := NULLIF(TRIM(COALESCE(search, '')), '');

  SELECT COUNT(*)::bigint INTO v_total
  FROM auth.users u
  WHERE (
    v_search IS NULL
    OR u.email ILIKE '%' || v_search || '%'
    OR (u.raw_user_meta_data ->> 'user_role') ILIKE '%' || v_search || '%'
    OR (u.raw_user_meta_data ->> 'full_name') ILIKE '%' || v_search || '%'
  );

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      u.id,
      u.email::text AS username,
      u.raw_user_meta_data ->> 'user_role' AS user_role,
      COALESCE(u.raw_user_meta_data ->> 'full_name', u.email::text) AS full_name,
      u.created_at
    FROM auth.users u
    WHERE (
      v_search IS NULL
      OR u.email ILIKE '%' || v_search || '%'
      OR (u.raw_user_meta_data ->> 'user_role') ILIKE '%' || v_search || '%'
      OR (u.raw_user_meta_data ->> 'full_name') ILIKE '%' || v_search || '%'
    )
    ORDER BY u.created_at DESC
    LIMIT v_size
    OFFSET v_offset
  ) t;

  RETURN jsonb_build_object('data', v_rows, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.list_auth_users(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_auth_users(text, integer, integer) TO authenticated;

COMMENT ON FUNCTION public.list_auth_users IS
  'Admin-only paginated list of auth.users (email as username, user_role from raw_user_meta_data).';

-- Admin-only password reset for an existing auth user (Create Users edit).
CREATE OR REPLACE FUNCTION public.admin_update_auth_user_password(
  target_user_id uuid,
  new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.app_user_role();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only administrators can update user passwords';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  IF new_password IS NULL OR length(trim(new_password)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(trim(new_password), extensions.gen_salt('bf')),
    updated_at = now()
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', target_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_auth_user_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_auth_user_password(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.admin_update_auth_user_password IS
  'Admin-only: set a new password for an auth.users row by id.';

-- Admin-only: enable/disable sign-in (maps to auth.users.banned_until; unban = NULL).
CREATE OR REPLACE FUNCTION public.admin_set_auth_user_login_access(
  target_user_id uuid,
  enable_login boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public.app_user_role();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only administrators can update user login access';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF COALESCE(enable_login, false) THEN
    UPDATE auth.users
    SET banned_until = NULL, updated_at = now()
    WHERE id = target_user_id;
  ELSE
    -- Indefinite ban (equivalent to admin API ban_duration "876000h" / far-future banned_until).
    UPDATE auth.users
    SET banned_until = '2099-12-31 23:59:59+00'::timestamptz, updated_at = now()
    WHERE id = target_user_id;

    -- Global sign-out: revoke refresh tokens and remove sessions (same effect as signOut scope=global).
    -- Cast user_id (varchar in some Supabase versions) to uuid for comparison.
    UPDATE auth.refresh_tokens
    SET revoked = true, updated_at = now()
    WHERE user_id::uuid = target_user_id
      AND revoked = false;

    DELETE FROM auth.sessions
    WHERE user_id::uuid = target_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'enable_login', COALESCE(enable_login, false),
    'sessions_terminated', NOT COALESCE(enable_login, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_auth_user_login_access(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_auth_user_login_access(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.admin_set_auth_user_login_access IS
  'Admin-only: disable login (ban + revoke refresh tokens + delete sessions) or re-enable (clear ban).';

-- Fast exact email lookup (avoids paginated list_auth_users scan).
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(target_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
  v_email text;
  v_id uuid;
BEGIN
  v_role := public.app_user_role();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only administrators can look up users';
  END IF;

  v_email := lower(trim(COALESCE(target_email, '')));
  IF v_email = '' THEN
    RETURN NULL;
  END IF;

  SELECT u.id INTO v_id
  FROM auth.users u
  WHERE lower(u.email::text) = v_email
  LIMIT 1;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(text) TO authenticated;
