
CREATE TABLE public.ai_model_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  task_kind text NOT NULL,
  role text NOT NULL DEFAULT 'default',
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, task_kind, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_model_routing TO authenticated;
GRANT ALL ON public.ai_model_routing TO service_role;

ALTER TABLE public.ai_model_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage model routing"
ON public.ai_model_routing FOR ALL
USING (public.is_school_admin(school_id, auth.uid()))
WITH CHECK (public.is_school_admin(school_id, auth.uid()));

CREATE INDEX ai_model_routing_lookup
  ON public.ai_model_routing (school_id, task_kind, role);
