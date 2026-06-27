
DROP POLICY IF EXISTS "members read documents" ON public.knowledge_documents;
CREATE POLICY "members read documents" ON public.knowledge_documents
FOR SELECT TO authenticated
USING (
  is_member(school_id, auth.uid()) AND (
    is_school_admin(school_id, auth.uid())
    OR has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR COALESCE(visibility,'school') IN ('school','public','public_curriculum')
    OR (visibility = 'class' AND class_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM class_enrollments ce
           WHERE ce.class_id = knowledge_documents.class_id
             AND ce.student_id = auth.uid()))
    OR (visibility = 'student' AND student_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Profiles viewable by staff co-members" ON public.profiles;

CREATE POLICY "Profiles viewable by school admins"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM memberships m1
    JOIN memberships m2 ON m1.school_id = m2.school_id
    WHERE m1.user_id = auth.uid()
      AND m1.status = 'active'
      AND m1.role = 'admin'::member_role
      AND m2.user_id = profiles.id
      AND m2.status = 'active'
  )
);

CREATE POLICY "Staff profiles viewable by staff co-members"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM memberships m1
    JOIN memberships m2 ON m1.school_id = m2.school_id
    WHERE m1.user_id = auth.uid()
      AND m1.status = 'active'
      AND m1.role = ANY (ARRAY['admin'::member_role,'teacher'::member_role])
      AND m2.user_id = profiles.id
      AND m2.status = 'active'
      AND m2.role = ANY (ARRAY['admin'::member_role,'teacher'::member_role])
  )
);

CREATE POLICY "Teachers can view their students' profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM class_subject_teachers cst
    JOIN class_enrollments ce ON ce.class_id = cst.class_id
    WHERE cst.teacher_user_id = auth.uid()
      AND ce.student_id = profiles.id
  )
  OR EXISTS (
    SELECT 1
    FROM teacher_subject_arm tsa
    JOIN arm_enrollments ae ON ae.arm_id = tsa.arm_id
    WHERE tsa.teacher_user_id = auth.uid()
      AND ae.student_user_id = profiles.id
  )
);
