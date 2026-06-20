
-- =========================================================================
-- Module 1: Academic Configuration Engine
-- =========================================================================

-- Platform-wide defaults (super admin)
CREATE TABLE public.academic_policy_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_kind text NOT NULL UNIQUE,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.academic_policy_defaults TO authenticated;
GRANT ALL ON public.academic_policy_defaults TO service_role;
ALTER TABLE public.academic_policy_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can read defaults"
  ON public.academic_policy_defaults FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage defaults"
  ON public.academic_policy_defaults FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Per-school policy overrides
CREATE TABLE public.academic_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  policy_kind text NOT NULL,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, policy_kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_policies TO authenticated;
GRANT ALL ON public.academic_policies TO service_role;
ALTER TABLE public.academic_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read policies"
  ON public.academic_policies FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "School admins manage policies"
  ON public.academic_policies FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()) OR public.is_super_admin(auth.uid()));

-- Academic calendar (terms / semesters / custom periods)
CREATE TABLE public.academic_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  session text NOT NULL,
  kind text NOT NULL DEFAULT 'term',
  periods jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, session)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_calendar TO authenticated;
GRANT ALL ON public.academic_calendar TO service_role;
ALTER TABLE public.academic_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read calendar"
  ON public.academic_calendar FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "School admins manage calendar"
  ON public.academic_calendar FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- Grading scales
CREATE TABLE public.grading_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  bands jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX grading_scales_one_default ON public.grading_scales(school_id) WHERE is_default;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grading_scales TO authenticated;
GRANT ALL ON public.grading_scales TO service_role;
ALTER TABLE public.grading_scales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read grading scales"
  ON public.grading_scales FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "School admins manage grading scales"
  ON public.grading_scales FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- Assessment structures (component weights)
CREATE TABLE public.assessment_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX assessment_structures_one_default ON public.assessment_structures(school_id) WHERE is_default;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_structures TO authenticated;
GRANT ALL ON public.assessment_structures TO service_role;
ALTER TABLE public.assessment_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read assessment structures"
  ON public.assessment_structures FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "School admins manage assessment structures"
  ON public.assessment_structures FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- Validate weights sum to 100 via trigger (not CHECK, since jsonb math)
CREATE OR REPLACE FUNCTION public.tg_validate_assessment_weights()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_sum numeric;
BEGIN
  SELECT COALESCE(SUM((c->>'weight')::numeric), 0) INTO v_sum
  FROM jsonb_array_elements(NEW.components) c;
  IF jsonb_array_length(NEW.components) > 0 AND ROUND(v_sum)::int <> 100 THEN
    RAISE EXCEPTION 'Assessment weights must sum to 100 (got %)', v_sum;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_assessment_weights
  BEFORE INSERT OR UPDATE ON public.assessment_structures
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_assessment_weights();

-- Promotion rules
CREATE TABLE public.promotion_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  min_average numeric NOT NULL DEFAULT 50,
  core_subjects text[] NOT NULL DEFAULT ARRAY[]::text[],
  min_attendance_pct numeric NOT NULL DEFAULT 75,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotion_rules TO authenticated;
GRANT ALL ON public.promotion_rules TO service_role;
ALTER TABLE public.promotion_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read promotion rules"
  ON public.promotion_rules FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "School admins manage promotion rules"
  ON public.promotion_rules FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- Result release rules
CREATE TABLE public.result_release_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  auto_release_at timestamptz,
  requires_approval boolean NOT NULL DEFAULT true,
  approval_chain text[] NOT NULL DEFAULT ARRAY['teacher','admin']::text[],
  pin_required boolean NOT NULL DEFAULT false,
  pin_price_kobo bigint NOT NULL DEFAULT 0,
  template_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.result_release_rules TO authenticated;
GRANT ALL ON public.result_release_rules TO service_role;
ALTER TABLE public.result_release_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read result release rules"
  ON public.result_release_rules FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "School admins manage result release rules"
  ON public.result_release_rules FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- Updated_at triggers
CREATE TRIGGER trg_acad_policy_defaults_updated BEFORE UPDATE ON public.academic_policy_defaults
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_acad_policies_updated BEFORE UPDATE ON public.academic_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_acad_calendar_updated BEFORE UPDATE ON public.academic_calendar
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_grading_scales_updated BEFORE UPDATE ON public.grading_scales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_promotion_rules_updated BEFORE UPDATE ON public.promotion_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_result_release_rules_updated BEFORE UPDATE ON public.result_release_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- Helper functions
-- =========================================================================

-- Resolve policy: school override > super default > empty
CREATE OR REPLACE FUNCTION public.resolve_academic_policy(_school uuid, _kind text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_body jsonb;
BEGIN
  SELECT body INTO v_body FROM public.academic_policies
   WHERE school_id = _school AND policy_kind = _kind;
  IF v_body IS NOT NULL AND v_body <> '{}'::jsonb THEN RETURN v_body; END IF;
  SELECT body INTO v_body FROM public.academic_policy_defaults
   WHERE policy_kind = _kind;
  RETURN COALESCE(v_body, '{}'::jsonb);
END $$;

-- Compute grade + remark for a score using the school's default grading scale
CREATE OR REPLACE FUNCTION public.compute_grade(_school uuid, _score numeric)
RETURNS TABLE(grade text, remark text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bands jsonb; v_band jsonb;
BEGIN
  SELECT bands INTO v_bands FROM public.grading_scales
   WHERE school_id = _school AND is_default = true LIMIT 1;

  IF v_bands IS NULL OR jsonb_array_length(v_bands) = 0 THEN
    -- fallback to platform default grading
    SELECT body->'bands' INTO v_bands FROM public.academic_policy_defaults
     WHERE policy_kind = 'grading';
  END IF;

  IF v_bands IS NULL OR jsonb_array_length(v_bands) = 0 THEN
    -- hard fallback
    v_bands := '[
      {"min":70,"max":100,"grade":"A","remark":"Excellent"},
      {"min":60,"max":69,"grade":"B","remark":"Very Good"},
      {"min":50,"max":59,"grade":"C","remark":"Good"},
      {"min":45,"max":49,"grade":"D","remark":"Pass"},
      {"min":0,"max":44,"grade":"F","remark":"Fail"}
    ]'::jsonb;
  END IF;

  FOR v_band IN SELECT * FROM jsonb_array_elements(v_bands) LOOP
    IF _score >= (v_band->>'min')::numeric AND _score <= (v_band->>'max')::numeric THEN
      grade := v_band->>'grade';
      remark := v_band->>'remark';
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;

  grade := 'F'; remark := 'Fail'; RETURN NEXT;
END $$;

-- Seed platform defaults
INSERT INTO public.academic_policy_defaults (policy_kind, body) VALUES
  ('grading', '{
    "bands":[
      {"min":70,"max":100,"grade":"A","remark":"Excellent"},
      {"min":60,"max":69,"grade":"B","remark":"Very Good"},
      {"min":50,"max":59,"grade":"C","remark":"Good"},
      {"min":45,"max":49,"grade":"D","remark":"Pass"},
      {"min":0,"max":44,"grade":"F","remark":"Fail"}
    ]
  }'::jsonb),
  ('assessment', '{
    "components":[
      {"key":"attendance","label":"Attendance","weight":5},
      {"key":"assignment","label":"Assignment","weight":10},
      {"key":"test","label":"Test","weight":25},
      {"key":"examination","label":"Examination","weight":60}
    ]
  }'::jsonb),
  ('calendar', '{"kind":"term","periods":["First Term","Second Term","Third Term"]}'::jsonb),
  ('promotion', '{"min_average":50,"min_attendance_pct":75,"core_subjects":["Mathematics","English"]}'::jsonb),
  ('result', '{"requires_approval":true,"approval_chain":["teacher","admin"],"pin_required":false}'::jsonb),
  ('risk_scoring', '{
    "rules":{
      "tab_switch":10,"fullscreen_exit":10,"copy_attempt":5,"paste_attempt":5,
      "context_menu":3,"devtools":20,"no_face_detected":15,"multiple_faces_detected":30,
      "camera_off":30
    },
    "levels":{"normal":20,"review":50,"high":80}
  }'::jsonb)
ON CONFLICT (policy_kind) DO NOTHING;
