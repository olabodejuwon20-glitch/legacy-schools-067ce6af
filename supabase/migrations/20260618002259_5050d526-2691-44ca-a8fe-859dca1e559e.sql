
-- 1) Idempotency: prevent duplicate classes per school by name (case-insensitive)
--    De-duplicate existing rows first, keeping the oldest.
WITH ranked AS (
  SELECT id, school_id, lower(name) AS lname,
         row_number() OVER (PARTITION BY school_id, lower(name) ORDER BY created_at ASC, id ASC) AS rn
  FROM public.classes
)
DELETE FROM public.classes c
USING ranked r
WHERE c.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS classes_school_name_unique
  ON public.classes (school_id, lower(name));

-- 2) Defense-in-depth: block students from reading answer-key tables.
--    Mirrors the existing trad_exam_questions restriction.
DROP POLICY IF EXISTS mock_questions_restrict_students ON public.mock_questions;
CREATE POLICY mock_questions_restrict_students ON public.mock_questions
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.has_school_role(school_id, auth.uid(), 'student'::member_role));

DROP POLICY IF EXISTS question_bank_restrict_students ON public.question_bank;
CREATE POLICY question_bank_restrict_students ON public.question_bank
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    school_id IS NULL
    OR NOT public.has_school_role(school_id, auth.uid(), 'student'::member_role)
  );

DROP POLICY IF EXISTS questions_v2_restrict_students ON public.questions_v2;
CREATE POLICY questions_v2_restrict_students ON public.questions_v2
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    school_id IS NULL
    OR NOT public.has_school_role(school_id, auth.uid(), 'student'::member_role)
  );

-- 3) Hide scratch-card pin_hash from direct table reads (admins use a controlled RPC if needed).
REVOKE SELECT (pin_hash) ON public.trad_scratch_cards FROM authenticated, anon;
