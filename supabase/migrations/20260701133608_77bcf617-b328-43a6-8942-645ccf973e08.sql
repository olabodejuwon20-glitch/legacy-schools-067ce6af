
-- Allow super admins to view and manage AI quotas across all schools
CREATE POLICY "Super admins view all quotas"
ON public.school_ai_quotas FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins insert quotas"
ON public.school_ai_quotas FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins update quotas"
ON public.school_ai_quotas FOR UPDATE
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Summary view of quota usage across schools (super-admin readable via RPC)
CREATE OR REPLACE FUNCTION public.super_list_ai_quotas()
RETURNS TABLE(
  school_id uuid,
  school_name text,
  school_slug text,
  plan text,
  enabled boolean,
  monthly_token_cap bigint,
  monthly_cost_cap_usd numeric,
  tokens_used bigint,
  cost_used_usd numeric,
  period_start date,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    s.slug,
    s.plan,
    COALESCE(q.enabled, true),
    COALESCE(q.monthly_token_cap, 5000000),
    COALESCE(q.monthly_cost_cap_usd, 25.00),
    COALESCE(q.tokens_used, 0),
    COALESCE(q.cost_used_usd, 0),
    COALESCE(q.period_start, date_trunc('month', now())::date),
    COALESCE(q.updated_at, s.created_at)
  FROM public.schools s
  LEFT JOIN public.school_ai_quotas q ON q.school_id = s.id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY COALESCE(q.tokens_used, 0) DESC, s.name;
$$;

-- Super admin sets quota (upsert)
CREATE OR REPLACE FUNCTION public.super_set_ai_quota(
  _school_id uuid,
  _token_cap bigint,
  _cost_cap numeric,
  _enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.school_ai_quotas(school_id, monthly_token_cap, monthly_cost_cap_usd, enabled)
  VALUES (_school_id, _token_cap, _cost_cap, _enabled)
  ON CONFLICT (school_id) DO UPDATE
    SET monthly_token_cap = EXCLUDED.monthly_token_cap,
        monthly_cost_cap_usd = EXCLUDED.monthly_cost_cap_usd,
        enabled = EXCLUDED.enabled,
        updated_at = now();
END;
$$;

-- Super admin resets a school's monthly counters mid-period
CREATE OR REPLACE FUNCTION public.super_reset_ai_quota(_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.school_ai_quotas
     SET tokens_used = 0,
         cost_used_usd = 0,
         period_start = date_trunc('month', now())::date,
         updated_at = now()
   WHERE school_id = _school_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_list_ai_quotas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_set_ai_quota(uuid, bigint, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_reset_ai_quota(uuid) TO authenticated;
