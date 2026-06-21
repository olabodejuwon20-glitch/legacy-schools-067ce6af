DROP POLICY IF EXISTS "Students upload to their school folder" ON storage.objects;

CREATE POLICY "Students upload to their active attempt folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'proctor-evidence'
    AND public.is_member((storage.foldername(name))[1]::uuid, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.exam_attempts a
      WHERE a.id = (storage.foldername(name))[2]::uuid
        AND a.student_id = auth.uid()
        AND a.school_id = (storage.foldername(name))[1]::uuid
        AND a.submitted_at IS NULL
    )
  );
