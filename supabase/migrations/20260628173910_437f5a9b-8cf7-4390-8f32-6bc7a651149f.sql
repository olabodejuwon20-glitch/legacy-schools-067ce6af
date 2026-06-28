
-- 1. school_custom_roles: remove public read, restrict to school members
DROP POLICY IF EXISTS "Anyone can read enabled custom roles for onboarding" ON public.school_custom_roles;

REVOKE SELECT ON public.school_custom_roles FROM anon;

CREATE POLICY "Members read their school's custom roles"
  ON public.school_custom_roles FOR SELECT
  TO authenticated
  USING (
    enabled = true
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.school_id = school_custom_roles.school_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

-- Public join page needs the enabled custom roles for a single school before sign-in.
-- Expose a narrow security-definer RPC instead of opening the table to anon.
CREATE OR REPLACE FUNCTION public.get_school_custom_roles(_school_id uuid)
RETURNS TABLE (key text, label text, base_role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT key, label, base_role
  FROM public.school_custom_roles
  WHERE school_id = _school_id
    AND enabled = true
    AND deleted_at IS NULL
  ORDER BY label;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_custom_roles(uuid) TO anon, authenticated;

-- 2. exam_audit_entries: document intentional admin-only read posture
COMMENT ON TABLE public.exam_audit_entries IS
'Stores per-question audit rows including correct_answer and student_answer. Fail-closed: only school admins may SELECT. Students MUST NOT receive a SELECT policy here — correct answers are sensitive. To reveal answers post-exam, gate via exams.show_answers_after_each in grade-exam-attempt.';

COMMENT ON COLUMN public.exam_audit_entries.correct_answer IS
'Sensitive: never expose to students via RLS. Admin-only read.';
