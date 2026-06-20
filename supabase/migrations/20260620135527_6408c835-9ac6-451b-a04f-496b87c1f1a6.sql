
CREATE POLICY "Students upload to their school folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'proctor-evidence'
    AND public.is_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "School staff read evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'proctor-evidence'
    AND (
      public.is_school_admin((storage.foldername(name))[1]::uuid, auth.uid())
      OR public.has_school_role((storage.foldername(name))[1]::uuid, auth.uid(), 'teacher'::member_role)
    )
  );
-- No UPDATE or DELETE policies → bucket is append-only (immutable evidence locker).
