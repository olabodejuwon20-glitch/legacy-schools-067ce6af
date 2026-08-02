DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assignment_submissions_assignment_id_fkey'
      AND conrelid = 'public.assignment_submissions'::regclass
  ) THEN
    DELETE FROM public.assignment_submissions s
    WHERE NOT EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = s.assignment_id);

    ALTER TABLE public.assignment_submissions
      ADD CONSTRAINT assignment_submissions_assignment_id_fkey
      FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
  END IF;
END $$;