
-- 1) Add question_position to audit entries for per-question audit
ALTER TABLE public.exam_audit_entries 
  ADD COLUMN IF NOT EXISTS question_position int;

-- 2) Auto-audit trigger on exam_answers
CREATE OR REPLACE FUNCTION public.tg_exam_answer_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school uuid;
  v_q RECORD;
  v_score numeric := 0;
  v_student_ans jsonb;
  v_correct_ans jsonb;
BEGIN
  SELECT a.school_id INTO v_school FROM public.exam_attempts a WHERE a.id = NEW.attempt_id;
  SELECT q.id, q.position, q.correct_index, q.points, q.options
    INTO v_q FROM public.exam_questions q WHERE q.id = NEW.question_id;
  IF v_q.id IS NULL THEN RETURN NEW; END IF;

  v_student_ans := to_jsonb(NEW.selected_index);
  v_correct_ans := to_jsonb(v_q.correct_index);
  IF NEW.selected_index IS NOT NULL AND NEW.selected_index = v_q.correct_index THEN
    v_score := COALESCE(v_q.points, 1);
  END IF;

  INSERT INTO public.exam_audit_entries
    (school_id, attempt_id, question_id, question_position, student_answer, correct_answer, score_awarded, recorded_at)
  VALUES
    (v_school, NEW.attempt_id, NEW.question_id, v_q.position, v_student_ans, v_correct_ans, v_score, now());
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_exam_answer_audit ON public.exam_answers;
CREATE TRIGGER trg_exam_answer_audit
AFTER INSERT OR UPDATE OF selected_index ON public.exam_answers
FOR EACH ROW EXECUTE FUNCTION public.tg_exam_answer_audit();

-- 3) Auto-snapshot trigger on question_bank: archive OLD into question_bank_versions on UPDATE
CREATE OR REPLACE FUNCTION public.tg_question_bank_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_next int;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- only snapshot when meaningful fields change
    IF NEW.body IS DISTINCT FROM OLD.body
       OR NEW.options IS DISTINCT FROM OLD.options
       OR NEW.answer  IS DISTINCT FROM OLD.answer
       OR NEW.explanation IS DISTINCT FROM OLD.explanation
       OR NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
      SELECT COALESCE(MAX(version), 0) + 1 INTO v_next
        FROM public.question_bank_versions WHERE question_id = OLD.id;
      INSERT INTO public.question_bank_versions
        (question_id, school_id, version, snapshot, edited_by)
      VALUES
        (OLD.id, OLD.school_id, v_next,
         jsonb_build_object(
           'subject', OLD.subject, 'topic', OLD.topic, 'difficulty', OLD.difficulty,
           'type', OLD.type, 'body', OLD.body, 'options', OLD.options,
           'answer', OLD.answer, 'explanation', OLD.explanation,
           'approval_status', OLD.approval_status
         ),
         auth.uid());
      NEW.version := COALESCE(OLD.version, 1) + 1;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_question_bank_version ON public.question_bank;
CREATE TRIGGER trg_question_bank_version
BEFORE UPDATE ON public.question_bank
FOR EACH ROW EXECUTE FUNCTION public.tg_question_bank_version();
