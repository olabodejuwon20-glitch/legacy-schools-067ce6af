ALTER TABLE public.trad_exam_timetable
  ADD COLUMN IF NOT EXISTS invigilator_name text,
  ADD COLUMN IF NOT EXISTS coordinator_name text,
  ADD COLUMN IF NOT EXISTS notes text;