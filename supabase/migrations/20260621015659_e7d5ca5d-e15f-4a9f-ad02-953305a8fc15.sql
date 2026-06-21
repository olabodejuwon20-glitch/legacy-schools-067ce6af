CREATE POLICY "Block students from version snapshots"
  ON public.question_bank_versions
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    NOT public.has_school_role(school_id, auth.uid(), 'student'::member_role)
  );
