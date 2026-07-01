
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_role text,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  reason text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at timestamptz,
  end_reason text,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.impersonation_sessions TO authenticated;
GRANT ALL ON public.impersonation_sessions TO service_role;

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins manage impersonation" ON public.impersonation_sessions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "target user sees own impersonation" ON public.impersonation_sessions
  FOR SELECT TO authenticated
  USING (target_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_impersonation_active
  ON public.impersonation_sessions(super_admin_id, ended_at)
  WHERE ended_at IS NULL;

CREATE OR REPLACE FUNCTION public.start_impersonation(
  _target_user uuid,
  _school_id uuid,
  _reason text,
  _duration_minutes int DEFAULT 30
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id uuid;
  _role text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'reason required';
  END IF;
  IF _duration_minutes < 1 OR _duration_minutes > 240 THEN
    RAISE EXCEPTION 'invalid duration';
  END IF;

  SELECT role INTO _role FROM public.memberships
    WHERE user_id = _target_user AND (school_id = _school_id OR _school_id IS NULL)
    LIMIT 1;

  INSERT INTO public.impersonation_sessions
    (super_admin_id, target_user_id, target_role, school_id, reason, expires_at)
  VALUES
    (auth.uid(), _target_user, _role, _school_id, _reason,
     now() + make_interval(mins => _duration_minutes))
  RETURNING id INTO _id;

  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.end_impersonation(_session_id uuid, _reason text DEFAULT 'manual')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.impersonation_sessions
    SET ended_at = now(), end_reason = _reason
    WHERE id = _session_id
      AND (super_admin_id = auth.uid() OR public.is_super_admin(auth.uid()))
      AND ended_at IS NULL;
END $$;

CREATE OR REPLACE FUNCTION public.log_impersonation_action(_session_id uuid, _action jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.impersonation_sessions
    SET actions = actions || jsonb_build_array(jsonb_build_object('at', now(), 'a', _action))
    WHERE id = _session_id AND ended_at IS NULL;
END $$;
