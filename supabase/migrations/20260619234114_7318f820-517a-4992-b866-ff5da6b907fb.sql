-- Fix mutable search_path on tg_enforce_pilot_writable
ALTER FUNCTION public.tg_enforce_pilot_writable() SET search_path = public;

-- Safe SECURITY DEFINER helper: look up a user id by email in auth.users.
-- Used by edge functions instead of fetching all auth users.
CREATE OR REPLACE FUNCTION public.auth_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.auth_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_id_by_email(text) TO service_role;

-- Count of super admins, callable by anyone (returns only a number, no rows).
-- Used by the /super/claim bootstrap UI so the count is correct regardless of RLS.
CREATE OR REPLACE FUNCTION public.super_admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'super_admin');
$$;
GRANT EXECUTE ON FUNCTION public.super_admin_exists() TO anon, authenticated, service_role;