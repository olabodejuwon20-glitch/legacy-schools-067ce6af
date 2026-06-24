
-- =========================================================
-- ACADEMIC STRUCTURE ENGINE
-- =========================================================

-- 1) TEMPLATES (global library) ----------------------------
CREATE TABLE public.academic_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  name          text NOT NULL,
  country       text,
  description   text,
  body          jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.academic_templates TO authenticated, anon;
GRANT ALL    ON public.academic_templates TO service_role;
ALTER TABLE public.academic_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates readable by anyone" ON public.academic_templates FOR SELECT USING (true);

-- 2) PER-SCHOOL STRUCTURE LINK -----------------------------
CREATE TABLE public.school_academic_structure (
  school_id     uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  template_code text NOT NULL REFERENCES public.academic_templates(code),
  activated_at  timestamptz NOT NULL DEFAULT now(),
  settings      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_academic_structure TO authenticated;
GRANT ALL ON public.school_academic_structure TO service_role;
ALTER TABLE public.school_academic_structure ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read structure"   ON public.school_academic_structure FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write structure"   ON public.school_academic_structure FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 3) LEVELS ------------------------------------------------
CREATE TABLE public.academic_levels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name        text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0,
  promotion_target_level_id uuid REFERENCES public.academic_levels(id),
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);
CREATE INDEX academic_levels_school_idx ON public.academic_levels(school_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_levels TO authenticated;
GRANT ALL ON public.academic_levels TO service_role;
ALTER TABLE public.academic_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read levels" ON public.academic_levels FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write levels" ON public.academic_levels FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 4) CLASSES (JSS1, SS1, …) --------------------------------
CREATE TABLE public.academic_classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  level_id    uuid NOT NULL REFERENCES public.academic_levels(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name        text NOT NULL,
  category    text,
  capacity    int,
  description text,
  status      text NOT NULL DEFAULT 'active',
  sort_order  int NOT NULL DEFAULT 0,
  promotion_target_class_id uuid REFERENCES public.academic_classes(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);
CREATE INDEX academic_classes_school_idx ON public.academic_classes(school_id, level_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_classes TO authenticated;
GRANT ALL ON public.academic_classes TO service_role;
ALTER TABLE public.academic_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read aclasses" ON public.academic_classes FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write aclasses" ON public.academic_classes FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 5) DEPARTMENTS -------------------------------------------
CREATE TABLE public.academic_departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name        text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);
CREATE INDEX academic_departments_school_idx ON public.academic_departments(school_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_departments TO authenticated;
GRANT ALL ON public.academic_departments TO service_role;
ALTER TABLE public.academic_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read depts" ON public.academic_departments FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write depts" ON public.academic_departments FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 6) ARMS (JSS1 A, SS1 Science, …) -------------------------
CREATE TABLE public.academic_arms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id        uuid NOT NULL REFERENCES public.academic_classes(id) ON DELETE CASCADE,
  department_id   uuid REFERENCES public.academic_departments(id) ON DELETE SET NULL,
  name            text NOT NULL,
  code            text NOT NULL,
  capacity        int,
  class_teacher_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, class_id, code)
);
CREATE INDEX academic_arms_school_idx ON public.academic_arms(school_id, class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_arms TO authenticated;
GRANT ALL ON public.academic_arms TO service_role;
ALTER TABLE public.academic_arms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read arms" ON public.academic_arms FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write arms" ON public.academic_arms FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 7) SUBJECTS ----------------------------------------------
CREATE TABLE public.academic_subjects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code          text NOT NULL,
  name          text NOT NULL,
  department_id uuid REFERENCES public.academic_departments(id) ON DELETE SET NULL,
  category      text NOT NULL DEFAULT 'core', -- core | junior | department | elective | other
  description   text,
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);
CREATE INDEX academic_subjects_school_idx ON public.academic_subjects(school_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_subjects TO authenticated;
GRANT ALL ON public.academic_subjects TO service_role;
ALTER TABLE public.academic_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read asubjects" ON public.academic_subjects FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write asubjects" ON public.academic_subjects FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 8) SUBJECT ↔ ARM (inheritance source) --------------------
CREATE TABLE public.subject_arm_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject_id   uuid NOT NULL REFERENCES public.academic_subjects(id) ON DELETE CASCADE,
  arm_id       uuid NOT NULL REFERENCES public.academic_arms(id) ON DELETE CASCADE,
  is_required  boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, subject_id, arm_id)
);
CREATE INDEX subject_arm_school_idx ON public.subject_arm_assignments(school_id, arm_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_arm_assignments TO authenticated;
GRANT ALL ON public.subject_arm_assignments TO service_role;
ALTER TABLE public.subject_arm_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read saa" ON public.subject_arm_assignments FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write saa" ON public.subject_arm_assignments FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 9) STUDENT ↔ ARM -----------------------------------------
CREATE TABLE public.arm_enrollments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  arm_id           uuid NOT NULL REFERENCES public.academic_arms(id) ON DELETE CASCADE,
  student_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'active',
  joined_at        timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, arm_id, student_user_id)
);
CREATE INDEX arm_enrollments_school_idx ON public.arm_enrollments(school_id, arm_id);
CREATE INDEX arm_enrollments_student_idx ON public.arm_enrollments(school_id, student_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arm_enrollments TO authenticated;
GRANT ALL ON public.arm_enrollments TO service_role;
ALTER TABLE public.arm_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self/admin/teacher read arm_enrollments" ON public.arm_enrollments FOR SELECT USING (
  student_user_id = auth.uid()
  OR public.is_school_admin(school_id, auth.uid())
  OR public.has_school_role(school_id, auth.uid(), 'teacher'::public.member_role)
);
CREATE POLICY "admins write arm_enrollments" ON public.arm_enrollments FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 10) TEACHER ↔ SUBJECT ↔ ARM ------------------------------
CREATE TABLE public.teacher_subject_arm (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id       uuid NOT NULL REFERENCES public.academic_subjects(id) ON DELETE CASCADE,
  arm_id           uuid NOT NULL REFERENCES public.academic_arms(id) ON DELETE CASCADE,
  role             text NOT NULL DEFAULT 'lead',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, teacher_user_id, subject_id, arm_id)
);
CREATE INDEX teacher_subject_arm_school_idx ON public.teacher_subject_arm(school_id, teacher_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_subject_arm TO authenticated;
GRANT ALL ON public.teacher_subject_arm TO service_role;
ALTER TABLE public.teacher_subject_arm ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self/admin read tsa" ON public.teacher_subject_arm FOR SELECT USING (
  teacher_user_id = auth.uid() OR public.is_school_admin(school_id, auth.uid())
);
CREATE POLICY "admins write tsa" ON public.teacher_subject_arm FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 11) PROMOTION RULES --------------------------------------
CREATE TABLE public.academic_promotion_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  from_class_id       uuid REFERENCES public.academic_classes(id) ON DELETE CASCADE,
  to_class_id         uuid REFERENCES public.academic_classes(id) ON DELETE CASCADE,
  min_average         numeric DEFAULT 0,
  min_attendance_pct  numeric DEFAULT 0,
  required_core_pass  jsonb   DEFAULT '[]'::jsonb,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX academic_promotion_rules_school_idx ON public.academic_promotion_rules(school_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_promotion_rules TO authenticated;
GRANT ALL ON public.academic_promotion_rules TO service_role;
ALTER TABLE public.academic_promotion_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read prom rules" ON public.academic_promotion_rules FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write prom rules" ON public.academic_promotion_rules FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 12) UPDATED-AT TRIGGERS ----------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'academic_templates','school_academic_structure','academic_levels',
    'academic_classes','academic_departments','academic_arms','academic_subjects',
    'arm_enrollments','academic_promotion_rules'
  ]) LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t || '_set_updated_at', t);
  END LOOP;
END $$;

-- 13) DERIVED VIEW: student ↔ subject ---------------------
CREATE OR REPLACE VIEW public.student_subjects_v2 WITH (security_invoker = on) AS
  SELECT
    e.school_id,
    e.student_user_id,
    sa.subject_id,
    e.arm_id,
    s.name AS subject_name,
    s.code AS subject_code,
    sa.is_required
  FROM public.arm_enrollments e
  JOIN public.subject_arm_assignments sa
    ON sa.arm_id = e.arm_id AND sa.school_id = e.school_id
  JOIN public.academic_subjects s ON s.id = sa.subject_id
  WHERE e.status = 'active' AND s.status = 'active';

GRANT SELECT ON public.student_subjects_v2 TO authenticated;

-- 14) APPLY TEMPLATE FUNCTION ------------------------------
CREATE OR REPLACE FUNCTION public.apply_academic_template(_school_id uuid, _template_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tpl jsonb;
  v_level jsonb;
  v_class jsonb;
  v_dept_name text;
  v_subj_name text;
  v_level_id uuid;
  v_class_id uuid;
  v_prev_class_id uuid;
  v_dept_id uuid;
  v_subj_id uuid;
  v_chain text[];
  v_idx int;
  v_levels_created int := 0;
  v_classes_created int := 0;
  v_depts_created int := 0;
  v_subjects_created int := 0;
  v_subjects jsonb;
  v_subj jsonb;
  v_sort int;
BEGIN
  IF NOT public.is_school_admin(_school_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT body INTO v_tpl
    FROM public.academic_templates
   WHERE code = _template_code AND is_active = true;
  IF v_tpl IS NULL THEN RAISE EXCEPTION 'template not available'; END IF;

  -- Link/upsert school structure row
  INSERT INTO public.school_academic_structure (school_id, template_code, activated_at)
       VALUES (_school_id, _template_code, now())
       ON CONFLICT (school_id) DO UPDATE
         SET template_code = EXCLUDED.template_code,
             activated_at = COALESCE(public.school_academic_structure.activated_at, now()),
             updated_at = now();

  -- Levels + Classes
  v_sort := 0;
  FOR v_level IN SELECT * FROM jsonb_array_elements(COALESCE(v_tpl->'levels','[]'::jsonb)) LOOP
    INSERT INTO public.academic_levels (school_id, code, name, sort_order)
         VALUES (_school_id, v_level->>'code', v_level->>'name', v_sort)
         ON CONFLICT (school_id, code) DO UPDATE
           SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
         RETURNING id INTO v_level_id;
    v_levels_created := v_levels_created + 1;

    DECLARE
      v_csort int := 0;
    BEGIN
      FOR v_class IN SELECT * FROM jsonb_array_elements(COALESCE(v_level->'classes','[]'::jsonb)) LOOP
        INSERT INTO public.academic_classes (school_id, level_id, code, name, category, sort_order)
             VALUES (_school_id, v_level_id, v_class->>'code',
                     COALESCE(v_class->>'name', v_class->>'code'),
                     v_level->>'name', v_csort)
             ON CONFLICT (school_id, code) DO UPDATE
               SET level_id = EXCLUDED.level_id,
                   name = EXCLUDED.name,
                   category = EXCLUDED.category,
                   sort_order = EXCLUDED.sort_order
             RETURNING id INTO v_class_id;
        v_classes_created := v_classes_created + 1;
        v_csort := v_csort + 1;
      END LOOP;
    END;
    v_sort := v_sort + 1;
  END LOOP;

  -- Promotion chain (code → code)
  v_chain := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_tpl->'promotion_chain','[]'::jsonb)));
  FOR v_idx IN 1 .. GREATEST(0, COALESCE(array_length(v_chain,1),0) - 1) LOOP
    UPDATE public.academic_classes c
       SET promotion_target_class_id = (SELECT id FROM public.academic_classes
                                          WHERE school_id = _school_id AND code = v_chain[v_idx+1])
     WHERE c.school_id = _school_id AND c.code = v_chain[v_idx];
  END LOOP;

  -- Departments
  FOR v_dept_name IN SELECT jsonb_array_elements_text(COALESCE(v_tpl->'departments','[]'::jsonb)) LOOP
    INSERT INTO public.academic_departments (school_id, code, name)
         VALUES (_school_id, lower(regexp_replace(v_dept_name,'\s+','_','g')), v_dept_name)
         ON CONFLICT (school_id, code) DO UPDATE SET name = EXCLUDED.name;
    v_depts_created := v_depts_created + 1;
  END LOOP;

  -- Subjects
  v_subjects := COALESCE(v_tpl->'subjects','{}'::jsonb);
  FOR v_dept_name IN SELECT jsonb_object_keys(v_subjects) LOOP
    SELECT id INTO v_dept_id FROM public.academic_departments
      WHERE school_id = _school_id AND lower(name) = lower(v_dept_name);
    FOR v_subj IN SELECT * FROM jsonb_array_elements(v_subjects->v_dept_name) LOOP
      v_subj_name := CASE jsonb_typeof(v_subj) WHEN 'string' THEN v_subj#>>'{}' ELSE v_subj->>'name' END;
      INSERT INTO public.academic_subjects (school_id, code, name, department_id, category)
           VALUES (_school_id,
                   upper(regexp_replace(v_subj_name,'\s+','_','g')),
                   v_subj_name,
                   v_dept_id,
                   CASE v_dept_name WHEN 'core' THEN 'core'
                                    WHEN 'junior' THEN 'junior'
                                    ELSE 'department' END)
           ON CONFLICT (school_id, code) DO UPDATE
             SET name = EXCLUDED.name,
                 department_id = COALESCE(public.academic_subjects.department_id, EXCLUDED.department_id);
      v_subjects_created := v_subjects_created + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'levels', v_levels_created,
    'classes', v_classes_created,
    'departments', v_depts_created,
    'subjects', v_subjects_created
  );
END $$;

-- 15) PROMOTION FUNCTION -----------------------------------
CREATE OR REPLACE FUNCTION public.promote_arm(_arm_id uuid, _to_arm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_school uuid; v_to_school uuid; v_moved int := 0;
BEGIN
  SELECT school_id INTO v_school FROM public.academic_arms WHERE id = _arm_id;
  SELECT school_id INTO v_to_school FROM public.academic_arms WHERE id = _to_arm_id;
  IF v_school IS NULL OR v_to_school IS NULL OR v_school <> v_to_school THEN
    RAISE EXCEPTION 'invalid arms';
  END IF;
  IF NOT public.is_school_admin(v_school, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH moved AS (
    UPDATE public.arm_enrollments
       SET arm_id = _to_arm_id, updated_at = now()
     WHERE arm_id = _arm_id AND status = 'active'
   RETURNING 1
  )
  SELECT COUNT(*) INTO v_moved FROM moved;
  RETURN jsonb_build_object('ok', true, 'moved', v_moved);
END $$;

-- 16) SEED NIGERIAN SECONDARY TEMPLATE + COMING-SOON --------
INSERT INTO public.academic_templates (code, name, country, description, is_active, body) VALUES
('nigerian_secondary', 'Nigerian Secondary School', 'Nigeria',
 'Junior (JSS1-JSS3) and Senior (SS1-SS3) with Science / Arts / Commercial departments.',
 true,
 jsonb_build_object(
   'levels', jsonb_build_array(
     jsonb_build_object('code','jss','name','Junior Secondary','classes', jsonb_build_array(
       jsonb_build_object('code','JSS1','name','JSS1'),
       jsonb_build_object('code','JSS2','name','JSS2'),
       jsonb_build_object('code','JSS3','name','JSS3'))),
     jsonb_build_object('code','sss','name','Senior Secondary','classes', jsonb_build_array(
       jsonb_build_object('code','SS1','name','SS1'),
       jsonb_build_object('code','SS2','name','SS2'),
       jsonb_build_object('code','SS3','name','SS3')))
   ),
   'promotion_chain', jsonb_build_array('JSS1','JSS2','JSS3','SS1','SS2','SS3'),
   'departments', jsonb_build_array('Science','Arts','Commercial'),
   'subjects', jsonb_build_object(
     'core',    jsonb_build_array('English Language','Mathematics','Civic Education','Computer Studies'),
     'junior',  jsonb_build_array('Basic Science','Basic Technology','Social Studies','Business Studies','Agricultural Science'),
     'Science', jsonb_build_array('Physics','Chemistry','Biology','Further Mathematics'),
     'Commercial', jsonb_build_array('Economics','Commerce','Financial Accounting'),
     'Arts',    jsonb_build_array('Government','Literature','CRS','IRS','History')
   )
 )
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.academic_templates (code, name, country, description, is_active, body) VALUES
('nigerian_primary',  'Nigerian Primary School',  'Nigeria', 'Coming soon.', false, '{}'::jsonb),
('cambridge',         'Cambridge',                'UK',      'Coming soon.', false, '{}'::jsonb),
('montessori',        'Montessori',               NULL,      'Coming soon.', false, '{}'::jsonb),
('american_k12',      'American K-12',            'USA',     'Coming soon.', false, '{}'::jsonb),
('custom',            'Custom Structure',         NULL,      'Coming soon.', false, '{}'::jsonb)
ON CONFLICT (code) DO NOTHING;
