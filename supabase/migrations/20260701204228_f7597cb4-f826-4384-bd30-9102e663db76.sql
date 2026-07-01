
-- Speed up results lookups by student and by school+published state
CREATE INDEX IF NOT EXISTS results_student_id_idx ON public.results (student_id);
CREATE INDEX IF NOT EXISTS results_school_published_idx ON public.results (school_id, published_at DESC) WHERE published_at IS NOT NULL;

-- Speed up mock_questions RLS + subject scans
CREATE INDEX IF NOT EXISTS mock_questions_school_subject_idx ON public.mock_questions (school_id, subject_id);

-- Analytics tables: bound queries by school+time
CREATE INDEX IF NOT EXISTS page_views_school_created_idx ON public.page_views (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_events_school_created_idx ON public.auth_events (school_id, created_at DESC);
