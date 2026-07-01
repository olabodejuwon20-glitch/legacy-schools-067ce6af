CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(_school_id uuid, _query_embedding extensions.vector, _match_count integer DEFAULT 6, _class_id uuid DEFAULT NULL::uuid, _student_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(chunk_id uuid, document_id uuid, title text, content text, similarity double precision, visibility text, metadata jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _role text;
  _effective_student uuid := _student_id;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT m.role INTO _role
  FROM public.memberships m
  WHERE m.school_id = _school_id
    AND m.user_id = _caller
    AND m.status = 'active'
  LIMIT 1;

  IF _role IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Students may only pull their own student-scoped documents.
  IF _role = 'student' THEN
    _effective_student := _caller;
  END IF;

  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.document_id,
    d.title,
    c.content,
    1 - (c.embedding <=> _query_embedding) AS similarity,
    d.visibility,
    c.metadata
  FROM public.knowledge_chunks c
  JOIN public.knowledge_documents d ON d.id = c.document_id
  WHERE c.school_id = _school_id
    AND d.status = 'ready'
    AND (
      d.visibility = 'school'
      OR d.visibility = 'public_curriculum'
      OR (d.visibility = 'class'   AND _class_id          IS NOT NULL AND d.class_id   = _class_id)
      OR (d.visibility = 'student' AND _effective_student IS NOT NULL AND d.student_id = _effective_student)
    )
  ORDER BY c.embedding <=> _query_embedding
  LIMIT GREATEST(1, LEAST(_match_count, 20));
END;
$function$;