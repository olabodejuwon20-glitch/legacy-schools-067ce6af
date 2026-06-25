
-- 1) Knowledge chunks: tighten visibility checks
DROP POLICY IF EXISTS "members read chunks" ON public.knowledge_chunks;
CREATE POLICY "members read chunks" ON public.knowledge_chunks
FOR SELECT TO authenticated
USING (
  public.is_member(school_id, auth.uid())
  AND (
    public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::public.member_role)
    OR EXISTS (
      SELECT 1 FROM public.knowledge_documents d
      WHERE d.id = knowledge_chunks.document_id
        AND d.status = 'ready'
        AND (
          COALESCE(d.visibility, 'school') IN ('school','public','public_curriculum')
          OR (d.visibility = 'class' AND d.class_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.class_enrollments ce
                WHERE ce.class_id = d.class_id AND ce.student_id = auth.uid()
              ))
          OR (d.visibility = 'student' AND d.student_id = auth.uid())
        )
    )
  )
);

-- 2) Memberships: restrict broad member visibility to staff only
DROP POLICY IF EXISTS "Members see same-school memberships" ON public.memberships;
CREATE POLICY "Staff see same-school memberships" ON public.memberships
FOR SELECT TO public
USING (
  public.is_school_admin(school_id, auth.uid())
  OR public.has_school_role(school_id, auth.uid(), 'teacher'::public.member_role)
);

-- 3) Profiles: restrict parent visibility to their linked children only
DROP POLICY IF EXISTS "Profiles viewable by parents for linked users" ON public.profiles;
CREATE POLICY "Profiles viewable by parents for linked children" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parent_links pl
    WHERE pl.parent_user_id = auth.uid() AND pl.student_user_id = profiles.id
  )
);

-- 4) Question tags: block students via restrictive policy
DROP POLICY IF EXISTS "Block students from question tags" ON public.question_tags;
CREATE POLICY "Block students from question tags" ON public.question_tags
AS RESTRICTIVE
FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM public.question_bank q
    WHERE q.id = question_tags.question_id
      AND (
        public.is_school_admin(q.school_id, auth.uid())
        OR public.has_school_role(q.school_id, auth.uid(), 'teacher'::public.member_role)
      )
  )
);
