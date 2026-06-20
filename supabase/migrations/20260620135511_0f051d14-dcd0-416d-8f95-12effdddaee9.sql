
-- Lock down new SECURITY DEFINER functions from Module 1
REVOKE EXECUTE ON FUNCTION public.resolve_academic_policy(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.compute_grade(uuid, numeric) FROM anon;

-- =========================================================================
-- Module 2: Exam approvals + question versioning + scheduling
-- =========================================================================
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS auto_publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_close_at timestamptz,
  ADD COLUMN IF NOT EXISTS class_restrictions uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

ALTER TABLE public.question_bank
  ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_id uuid;

CREATE TABLE public.exam_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL,
  exam_kind text NOT NULL DEFAULT 'trad',
  stage text NOT NULL,
  actor_id uuid,
  status text NOT NULL DEFAULT 'pending',
  note text,
  acted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exam_approvals_exam_idx ON public.exam_approvals(exam_id, stage);
GRANT SELECT, INSERT, UPDATE ON public.exam_approvals TO authenticated;
GRANT ALL ON public.exam_approvals TO service_role;
ALTER TABLE public.exam_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read approvals"
  ON public.exam_approvals FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "Admins/teachers act on approvals"
  ON public.exam_approvals FOR INSERT TO authenticated
  WITH CHECK (
    public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );
CREATE POLICY "Admins/teachers update approvals"
  ON public.exam_approvals FOR UPDATE TO authenticated
  USING (
    public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );

CREATE TABLE public.question_bank_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  edited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX qb_versions_q_idx ON public.question_bank_versions(question_id, version);
GRANT SELECT, INSERT ON public.question_bank_versions TO authenticated;
GRANT ALL ON public.question_bank_versions TO service_role;
ALTER TABLE public.question_bank_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read versions"
  ON public.question_bank_versions FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "School staff write versions"
  ON public.question_bank_versions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );

-- =========================================================================
-- Module 3: Integrity + Appeals + Audit
-- =========================================================================
ALTER TABLE public.exam_violations
  ADD COLUMN IF NOT EXISTS risk_score int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evidence_path text,
  ADD COLUMN IF NOT EXISTS student_explanation jsonb,
  ADD COLUMN IF NOT EXISTS reviewer_decision text,
  ADD COLUMN IF NOT EXISTS reviewer_id uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE TABLE public.exam_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL,
  student_id uuid NOT NULL,
  exam_kind text NOT NULL DEFAULT 'cbt',
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  stage_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  recalculation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exam_appeals_attempt_idx ON public.exam_appeals(attempt_id);
GRANT SELECT, INSERT, UPDATE ON public.exam_appeals TO authenticated;
GRANT ALL ON public.exam_appeals TO service_role;
ALTER TABLE public.exam_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own appeals"
  ON public.exam_appeals FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );
CREATE POLICY "Students create own appeals"
  ON public.exam_appeals FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND public.is_member(school_id, auth.uid()));
CREATE POLICY "Staff update appeals"
  ON public.exam_appeals FOR UPDATE TO authenticated
  USING (
    public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );
CREATE TRIGGER trg_exam_appeals_updated BEFORE UPDATE ON public.exam_appeals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.exam_audit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL,
  question_id uuid NOT NULL,
  student_answer jsonb,
  correct_answer jsonb,
  score_awarded numeric,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exam_audit_attempt_idx ON public.exam_audit_entries(attempt_id);
-- Append-only: only SELECT and INSERT for authenticated; nothing else.
GRANT SELECT, INSERT ON public.exam_audit_entries TO authenticated;
GRANT ALL ON public.exam_audit_entries TO service_role;
ALTER TABLE public.exam_audit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School staff and the student read audit"
  ON public.exam_audit_entries FOR SELECT TO authenticated
  USING (
    public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR EXISTS (
      SELECT 1 FROM public.exam_attempts ea
      WHERE ea.id = attempt_id AND ea.student_id = auth.uid()
    )
  );
CREATE POLICY "School staff write audit"
  ON public.exam_audit_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR EXISTS (
      SELECT 1 FROM public.exam_attempts ea
      WHERE ea.id = attempt_id AND ea.student_id = auth.uid()
    )
  );

-- Realtime for appeals
ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_appeals;
