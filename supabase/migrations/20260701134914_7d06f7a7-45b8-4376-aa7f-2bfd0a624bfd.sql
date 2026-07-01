
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  default_enabled boolean NOT NULL DEFAULT false,
  default_rollout_percent integer NOT NULL DEFAULT 0 CHECK (default_rollout_percent BETWEEN 0 AND 100),
  is_kill_switch boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL    ON public.feature_flags TO service_role;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags read by authenticated"
  ON public.feature_flags FOR SELECT TO authenticated USING (true);

CREATE POLICY "feature_flags write by super admin"
  ON public.feature_flags FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER feature_flags_set_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.school_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  flag_key text NOT NULL REFERENCES public.feature_flags(key) ON UPDATE CASCADE ON DELETE CASCADE,
  enabled boolean,
  rollout_percent integer CHECK (rollout_percent BETWEEN 0 AND 100),
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, flag_key)
);

CREATE INDEX school_feature_flags_school_idx ON public.school_feature_flags(school_id);

GRANT SELECT ON public.school_feature_flags TO authenticated;
GRANT ALL    ON public.school_feature_flags TO service_role;

ALTER TABLE public.school_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sff read by school members"
  ON public.school_feature_flags FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.school_id = school_feature_flags.school_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "sff write by super admin"
  ON public.school_feature_flags FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER school_feature_flags_set_updated_at
  BEFORE UPDATE ON public.school_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_feature_enabled(_school_id uuid, _key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f public.feature_flags%ROWTYPE;
  o public.school_feature_flags%ROWTYPE;
  eff_enabled boolean;
  eff_pct integer;
  bucket integer;
BEGIN
  SELECT * INTO f FROM public.feature_flags WHERE key = _key;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT * INTO o FROM public.school_feature_flags
    WHERE school_id = _school_id AND flag_key = _key;

  eff_enabled := COALESCE(o.enabled, f.default_enabled);
  eff_pct     := COALESCE(o.rollout_percent, f.default_rollout_percent);

  IF NOT eff_enabled THEN RETURN false; END IF;
  IF eff_pct >= 100 THEN RETURN true; END IF;
  IF eff_pct <= 0   THEN RETURN false; END IF;

  bucket := (('x' || substr(md5(_school_id::text || ':' || _key), 1, 8))::bit(32)::int) & 2147483647;
  RETURN (bucket % 100) < eff_pct;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_feature_enabled(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.super_list_feature_flags()
RETURNS TABLE (
  id uuid, key text, name text, description text, category text,
  default_enabled boolean, default_rollout_percent integer, is_kill_switch boolean,
  overrides_count bigint, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id, f.key, f.name, f.description, f.category,
         f.default_enabled, f.default_rollout_percent, f.is_kill_switch,
         (SELECT count(*) FROM public.school_feature_flags s WHERE s.flag_key = f.key),
         f.created_at, f.updated_at
  FROM public.feature_flags f
  WHERE public.is_super_admin(auth.uid())
  ORDER BY f.category, f.name;
$$;

GRANT EXECUTE ON FUNCTION public.super_list_feature_flags() TO authenticated;

CREATE OR REPLACE FUNCTION public.super_upsert_feature_flag(
  _key text, _name text, _description text, _category text,
  _default_enabled boolean, _default_rollout_percent integer, _is_kill_switch boolean
) RETURNS public.feature_flags
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.feature_flags;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO public.feature_flags(key, name, description, category, default_enabled, default_rollout_percent, is_kill_switch)
    VALUES (_key, _name, _description, COALESCE(_category,'general'), COALESCE(_default_enabled,false), COALESCE(_default_rollout_percent,0), COALESCE(_is_kill_switch,false))
    ON CONFLICT (key) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          default_enabled = EXCLUDED.default_enabled,
          default_rollout_percent = EXCLUDED.default_rollout_percent,
          is_kill_switch = EXCLUDED.is_kill_switch,
          updated_at = now()
    RETURNING * INTO r;
  RETURN r;
END; $$;

GRANT EXECUTE ON FUNCTION public.super_upsert_feature_flag(text, text, text, text, boolean, integer, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.super_delete_feature_flag(_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM public.feature_flags WHERE key = _key;
END; $$;

GRANT EXECUTE ON FUNCTION public.super_delete_feature_flag(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.super_set_school_flag(
  _school_id uuid, _key text, _enabled boolean, _rollout_percent integer, _notes text
) RETURNS public.school_feature_flags
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.school_feature_flags;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO public.school_feature_flags(school_id, flag_key, enabled, rollout_percent, notes, updated_by)
    VALUES (_school_id, _key, _enabled, _rollout_percent, _notes, auth.uid())
    ON CONFLICT (school_id, flag_key) DO UPDATE
      SET enabled = EXCLUDED.enabled,
          rollout_percent = EXCLUDED.rollout_percent,
          notes = EXCLUDED.notes,
          updated_by = auth.uid(),
          updated_at = now()
    RETURNING * INTO r;
  RETURN r;
END; $$;

GRANT EXECUTE ON FUNCTION public.super_set_school_flag(uuid, text, boolean, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.super_clear_school_flag(_school_id uuid, _key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM public.school_feature_flags WHERE school_id = _school_id AND flag_key = _key;
END; $$;

GRANT EXECUTE ON FUNCTION public.super_clear_school_flag(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.super_list_school_flags(_school_id uuid)
RETURNS TABLE (
  flag_key text, name text, description text, category text, is_kill_switch boolean,
  default_enabled boolean, default_rollout_percent integer,
  override_enabled boolean, override_rollout_percent integer, notes text, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.key, f.name, f.description, f.category, f.is_kill_switch,
         f.default_enabled, f.default_rollout_percent,
         o.enabled, o.rollout_percent, o.notes, o.updated_at
  FROM public.feature_flags f
  LEFT JOIN public.school_feature_flags o
    ON o.flag_key = f.key AND o.school_id = _school_id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY f.category, f.name;
$$;

GRANT EXECUTE ON FUNCTION public.super_list_school_flags(uuid) TO authenticated;

INSERT INTO public.feature_flags(key, name, description, category, default_enabled, default_rollout_percent, is_kill_switch) VALUES
  ('ai.tutor',              'AI Tutor',                 'Student-facing AI tutor chat',                     'ai',       true,  100, true),
  ('ai.mark_essay',         'AI Essay Marking',         'Teacher AI marking of essay answers',              'ai',       true,  100, true),
  ('ai.lesson_notes',       'AI Lesson Notes',          'Auto-generated lesson notes for teachers',         'ai',       true,  100, true),
  ('ai.report_comments',    'AI Report Comments',       'AI drafted report card comments',                  'ai',       true,  100, true),
  ('ai.principal_copilot',  'Principal Copilot',        'Natural-language analytics for admins',            'ai',       true,  100, true),
  ('transport.bus_tracking','Bus Tracking',             'Real-time school-bus tracking module',             'modules',  true,  100, true),
  ('exams.trad_scratch',    'Traditional Scratch Cards','Scratch-card unlock for external exam results',    'exams',    true,  100, true),
  ('billing.subscriptions', 'Subscriptions',            'Self-serve subscription billing for schools',      'billing',  true,  100, true),
  ('platform.new_dashboard','New Dashboard (beta)',     'Redesigned school dashboard',                      'rollout',  false, 0,   false)
ON CONFLICT (key) DO NOTHING;
