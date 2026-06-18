
-- 1) Hide exam answer keys from direct table reads (match mock_questions pattern).
REVOKE SELECT (correct_index) ON public.exam_questions FROM authenticated;
REVOKE SELECT (correct_index) ON public.exam_questions FROM anon;

-- 2) Hide membership profile_data from co-members.
-- Admin reads go through admin_list_memberships_with_profile (SECURITY DEFINER),
-- self reads go through get_my_membership_profile (SECURITY DEFINER).
REVOKE SELECT (profile_data) ON public.memberships FROM authenticated;
REVOKE SELECT (profile_data) ON public.memberships FROM anon;

-- 3) Defense-in-depth: block any user with a student role at the school
--    from selecting trad_exam_questions directly, even if they also have
--    teacher role (dual-role escalation guard).
DROP POLICY IF EXISTS trad_questions_restrict_students ON public.trad_exam_questions;
CREATE POLICY trad_questions_restrict_students
  ON public.trad_exam_questions
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    NOT public.has_school_role(school_id, auth.uid(), 'student'::public.member_role)
  );
