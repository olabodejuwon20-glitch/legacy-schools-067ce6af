-- Proctoring configuration on exams
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS proctor_action text NOT NULL DEFAULT 'auto_submit'
    CHECK (proctor_action IN ('warn','auto_submit')),
  ADD COLUMN IF NOT EXISTS proctor_snapshot_interval_sec integer NOT NULL DEFAULT 60
    CHECK (proctor_snapshot_interval_sec BETWEEN 10 AND 600);

-- Realtime for live admin proctoring feed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='exam_violations'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_violations';
  END IF;
END $$;

ALTER TABLE public.exam_violations REPLICA IDENTITY FULL;