ALTER TABLE public.mock_questions ADD COLUMN IF NOT EXISTS topic text;

CREATE OR REPLACE FUNCTION public.get_mock_practice_questions(_subject_id uuid, _limit integer DEFAULT 20)
RETURNS TABLE (q_id uuid, q_prompt text, q_options jsonb, q_topic text, q_position integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.prompt, q.options, q.topic, q.position
  FROM public.mock_questions q
  WHERE q.subject_id = _subject_id
    AND public.is_member(q.school_id, auth.uid())
  ORDER BY q.position
  LIMIT greatest(1, least(coalesce(_limit, 20), 100));
$$;

CREATE OR REPLACE FUNCTION public.check_mock_answer(_question_id uuid, _selected integer)
RETURNS TABLE (is_correct boolean, correct_index integer, explanation text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (_selected IS NOT NULL AND _selected = q.correct_index), q.correct_index, q.explanation
  FROM public.mock_questions q
  WHERE q.id = _question_id
    AND public.is_member(q.school_id, auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_mock_practice_questions(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_mock_answer(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mock_practice_questions(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_mock_answer(uuid, integer) TO authenticated;