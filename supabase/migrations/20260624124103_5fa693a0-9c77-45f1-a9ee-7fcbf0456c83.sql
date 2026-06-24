
-- 1. exam_audit_entries: remove student read access (was exposing correct_answer)
DROP POLICY IF EXISTS "School staff and the student read audit" ON public.exam_audit_entries;
CREATE POLICY "School staff read audit"
ON public.exam_audit_entries
FOR SELECT
TO authenticated
USING (
  is_school_admin(school_id, auth.uid())
  OR has_school_role(school_id, auth.uid(), 'teacher'::member_role)
);

-- 2. knowledge_documents: students only see non-staff visibility
DROP POLICY IF EXISTS "members read documents" ON public.knowledge_documents;
CREATE POLICY "members read documents"
ON public.knowledge_documents
FOR SELECT
TO authenticated
USING (
  is_member(school_id, auth.uid())
  AND (
    -- staff (admin/teacher) see everything in their school
    is_school_admin(school_id, auth.uid())
    OR has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    -- students/parents only see non-restricted visibility
    OR COALESCE(visibility, 'school') IN ('school', 'public', 'class', 'student')
  )
);

-- 3. knowledge_chunks: gate by parent document visibility
DROP POLICY IF EXISTS "members read chunks" ON public.knowledge_chunks;
CREATE POLICY "members read chunks"
ON public.knowledge_chunks
FOR SELECT
TO authenticated
USING (
  is_member(school_id, auth.uid())
  AND (
    is_school_admin(school_id, auth.uid())
    OR has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR EXISTS (
      SELECT 1 FROM public.knowledge_documents d
      WHERE d.id = knowledge_chunks.document_id
        AND COALESCE(d.visibility, 'school') IN ('school', 'public', 'class', 'student')
    )
  )
);
