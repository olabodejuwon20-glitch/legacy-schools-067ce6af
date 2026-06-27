
DROP POLICY IF EXISTS "School staff read audit" ON public.exam_audit_entries;
CREATE POLICY "Admins read audit"
  ON public.exam_audit_entries FOR SELECT
  TO authenticated
  USING (is_school_admin(school_id, auth.uid()));

DROP POLICY IF EXISTS "Staff see same-school memberships" ON public.memberships;
CREATE POLICY "Admins see same-school memberships"
  ON public.memberships FOR SELECT
  USING (is_school_admin(school_id, auth.uid()));

DROP POLICY IF EXISTS "Teachers read school parent links" ON public.parent_links;
CREATE POLICY "Teachers read parent links for their students"
  ON public.parent_links FOR SELECT
  USING (
    has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    AND EXISTS (
      SELECT 1
      FROM public.arm_enrollments ae
      JOIN public.teacher_subject_arm tsa
        ON tsa.arm_id = ae.arm_id
       AND tsa.school_id = ae.school_id
      WHERE ae.student_user_id = parent_links.student_user_id
        AND ae.school_id = parent_links.school_id
        AND tsa.teacher_user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.trad_scratch_batches IS
  'Admin-only. Students/parents access scratch cards via trad_scratch_purchases and trad_scratch_cards; batch metadata is never required client-side.';

DROP POLICY IF EXISTS "tutor-uploads owner read" ON storage.objects;
CREATE POLICY "tutor-uploads owner read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'tutor-uploads'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
    )
  );
