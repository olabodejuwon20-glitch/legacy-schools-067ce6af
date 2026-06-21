DROP POLICY IF EXISTS "School staff write audit" ON public.exam_audit_entries;

CREATE POLICY "School staff write audit"
ON public.exam_audit_entries
FOR INSERT
TO authenticated
WITH CHECK (
  is_school_admin(school_id, auth.uid())
  OR has_school_role(school_id, auth.uid(), 'teacher'::member_role)
);