
-- 1. Add scheduling fields to trad_exam_results
ALTER TABLE public.trad_exam_results
  ADD COLUMN IF NOT EXISTS scheduled_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS forwarded_to_admin_at timestamptz,
  ADD COLUMN IF NOT EXISTS forwarded_by uuid;

-- 2. Add CA/Test release gating
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS results_release_at timestamptz;

-- 3. Update student paper list: only release when released_at <= now()
CREATE OR REPLACE FUNCTION public.trad_list_student_papers(_school uuid)
 RETURNS TABLE(exam_id uuid, title text, instructions text, exam_type text, total_marks integer, exam_date date, start_time time without time zone, duration_minutes integer, venue text, status text, attempt_id uuid, attempt_status text, result_released boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT e.id, e.title, e.instructions, e.exam_type::text, e.total_marks,
         t.exam_date, t.start_time, t.duration_minutes, t.venue,
         CASE
           WHEN now() < (t.exam_date::timestamp + t.start_time) THEN 'upcoming'
           WHEN now() < (t.exam_date::timestamp + t.start_time + make_interval(mins => t.duration_minutes)) THEN 'open'
           ELSE 'closed'
         END,
         a.id, a.status,
         (r.released_at IS NOT NULL AND r.released_at <= now())
  FROM public.trad_exams e
  JOIN public.trad_exam_timetable t ON t.id = e.timetable_id
  JOIN public.class_enrollments ce ON ce.class_id = t.class_id
  LEFT JOIN public.trad_exam_attempts a ON a.exam_id = e.id AND a.student_id = auth.uid()
  LEFT JOIN public.trad_exam_results r ON r.attempt_id = a.id
  WHERE e.school_id = _school
    AND e.published_at IS NOT NULL
    AND ce.student_id = auth.uid()
  ORDER BY t.exam_date, t.start_time;
END $function$;

-- 4. Committee forwards a graded/validated result to admin
CREATE OR REPLACE FUNCTION public.trad_committee_forward_result(_attempt_id uuid)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_school uuid;
BEGIN
  SELECT school_id INTO v_school FROM public.trad_exam_results WHERE attempt_id = _attempt_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'result not found'; END IF;
  IF NOT public.is_school_admin(v_school, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.trad_exam_results
     SET status = 'forwarded_admin',
         forwarded_to_admin_at = now(),
         forwarded_by = auth.uid(),
         updated_at = now()
   WHERE attempt_id = _attempt_id;
END $function$;

-- 5. Admin schedules release at a specific time
CREATE OR REPLACE FUNCTION public.trad_admin_schedule_release(_attempt_id uuid, _release_at timestamptz)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_school uuid;
BEGIN
  SELECT school_id INTO v_school FROM public.trad_exam_results WHERE attempt_id = _attempt_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'result not found'; END IF;
  IF NOT public.is_school_admin(v_school, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _release_at IS NULL THEN RAISE EXCEPTION 'release time required'; END IF;
  UPDATE public.trad_exam_results
     SET status = 'validated',
         scheduled_release_at = _release_at,
         released_at = _release_at,
         validated_at = COALESCE(validated_at, now()),
         validated_by = COALESCE(validated_by, auth.uid()),
         updated_at = now()
   WHERE attempt_id = _attempt_id;
END $function$;

-- 6. Gate CA/Test review for students until results_release_at passes
CREATE OR REPLACE FUNCTION public.get_exam_review(_attempt_id uuid)
 RETURNS TABLE(q_id uuid, q_position integer, q_prompt text, q_options jsonb, q_points integer, q_correct_index integer, q_selected_index integer, q_is_correct boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_school uuid; v_student uuid; v_exam uuid; v_submitted timestamptz; v_release timestamptz;
BEGIN
  SELECT a.school_id, a.student_id, a.exam_id, a.submitted_at
    INTO v_school, v_student, v_exam, v_submitted
  FROM public.exam_attempts a WHERE a.id = _attempt_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'attempt not found'; END IF;
  IF v_submitted IS NULL THEN RAISE EXCEPTION 'attempt not submitted'; END IF;

  SELECT results_release_at INTO v_release FROM public.exams WHERE id = v_exam;

  IF v_student = auth.uid() THEN
    -- student can only review once admin-scheduled release time has passed
    IF v_release IS NULL OR v_release > now() THEN
      RAISE EXCEPTION 'results not released yet';
    END IF;
  ELSIF NOT (public.has_school_role(v_school, auth.uid(), 'teacher'::member_role)
             OR public.is_school_admin(v_school, auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT q.id, q.position, q.prompt, q.options, q.points,
         q.correct_index,
         ans.selected_index,
         (ans.selected_index IS NOT NULL AND ans.selected_index = q.correct_index) AS is_correct
  FROM public.exam_questions q
  LEFT JOIN public.exam_answers ans
    ON ans.question_id = q.id AND ans.attempt_id = _attempt_id
  WHERE q.exam_id = v_exam
  ORDER BY q.position;
END $function$;
