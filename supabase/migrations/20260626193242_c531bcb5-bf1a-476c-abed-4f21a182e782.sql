
-- 1. New enum value for "changes requested"
ALTER TYPE trad_draft_status ADD VALUE IF NOT EXISTS 'changes_requested';

-- 2. New columns on trad_exams (modern school exam)
ALTER TABLE public.trad_exams
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS published_by uuid,
  ADD COLUMN IF NOT EXISTS review_notes text;

-- 3. New columns on legacy exams (CA/test)
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid,
  ADD COLUMN IF NOT EXISTS review_notes text;

-- 4. Audit log
CREATE TABLE IF NOT EXISTS public.exam_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  exam_kind text NOT NULL CHECK (exam_kind IN ('trad','legacy')),
  exam_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('submitted','changes_requested','approved','published','released','withdrawn')),
  notes text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exam_review_events_exam_idx ON public.exam_review_events(exam_id, created_at DESC);
CREATE INDEX IF NOT EXISTS exam_review_events_school_idx ON public.exam_review_events(school_id, created_at DESC);

GRANT SELECT, INSERT ON public.exam_review_events TO authenticated;
GRANT ALL ON public.exam_review_events TO service_role;

ALTER TABLE public.exam_review_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review events: staff read same school"
  ON public.exam_review_events FOR SELECT TO authenticated
  USING (
    is_school_admin(school_id, auth.uid())
    OR has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );

CREATE POLICY "review events: staff insert"
  ON public.exam_review_events FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      is_school_admin(school_id, auth.uid())
      OR has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    )
  );

-- 5. Tighten legacy `exams` write access:
--    Teachers may only manage their own drafts (status in draft/submitted/changes_requested).
--    Admins keep full control.
DROP POLICY IF EXISTS "Teachers/Admins manage exams" ON public.exams;

CREATE POLICY "Admins manage exams"
  ON public.exams FOR ALL TO authenticated
  USING (is_school_admin(school_id, auth.uid()))
  WITH CHECK (is_school_admin(school_id, auth.uid()));

CREATE POLICY "Teachers draft own exams - insert"
  ON public.exams FOR INSERT TO authenticated
  WITH CHECK (
    has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    AND created_by = auth.uid()
    AND status = 'draft'::exam_status
    AND published_at IS NULL
    AND results_release_at IS NULL
  );

CREATE POLICY "Teachers update own draft exams"
  ON public.exams FOR UPDATE TO authenticated
  USING (
    has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    AND created_by = auth.uid()
    AND status = 'draft'::exam_status
    AND published_at IS NULL
  )
  WITH CHECK (
    has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    AND created_by = auth.uid()
    AND status = 'draft'::exam_status
    AND published_at IS NULL
    AND results_release_at IS NULL
  );

CREATE POLICY "Teachers delete own draft exams"
  ON public.exams FOR DELETE TO authenticated
  USING (
    has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    AND created_by = auth.uid()
    AND status = 'draft'::exam_status
    AND published_at IS NULL
  );

-- 6. Helper: can the caller act as approver for a school?
CREATE OR REPLACE FUNCTION public.can_approve_exams(_school uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_school_admin(_school, _user);
$$;
GRANT EXECUTE ON FUNCTION public.can_approve_exams(uuid, uuid) TO authenticated;
