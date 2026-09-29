-- Performance Optimization Indexes (§1.4 #1 & §7.4 #8 of Master Handoff)
-- + Additive Attendance Ecosystem Phase 2-6 columns (§1.4 #3 & docs/ROADMAP.md)

CREATE INDEX IF NOT EXISTS idx_mock_questions_board_subj_topic
  ON public.mock_questions (exam_type, subject, topic);

CREATE INDEX IF NOT EXISTS idx_results_school_student_term
  ON public.results (school_id, student_id, term);

CREATE INDEX IF NOT EXISTS idx_memberships_user_status_school
  ON public.memberships (user_id, status, school_id);

CREATE INDEX IF NOT EXISTS idx_attendance_school_class_date
  ON public.attendance (school_id, class_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_page_views_school_created
  ON public.page_views (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_events_school_created
  ON public.auth_events (school_id, created_at DESC);

-- Additive columns for Attendance Phases 2 & 3 (Excuse workflow + Per-period subject tracking)
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS period_subject text,
  ADD COLUMN IF NOT EXISTS excuse_note text,
  ADD COLUMN IF NOT EXISTS excuse_status text CHECK (excuse_status IN ('pending', 'approved', 'rejected'));

DROP POLICY IF EXISTS "Parents submit excuse on child attendance" ON public.attendance;
CREATE POLICY "Parents submit excuse on child attendance"
  ON public.attendance FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_links pl
      WHERE pl.school_id = attendance.school_id
        AND pl.parent_user_id = auth.uid()
        AND pl.student_user_id = attendance.student_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parent_links pl
      WHERE pl.school_id = attendance.school_id
        AND pl.parent_user_id = auth.uid()
        AND pl.student_user_id = attendance.student_id
    )
  );