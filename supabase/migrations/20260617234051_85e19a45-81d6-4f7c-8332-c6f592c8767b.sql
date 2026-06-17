ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS channel_type text;

UPDATE public.conversations
   SET channel_type = COALESCE(channel_type, kind::text)
 WHERE channel_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_channel_type
  ON public.conversations(school_id, channel_type);

CREATE TABLE IF NOT EXISTS public.comms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  subject text,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comms_templates TO authenticated;
GRANT ALL ON public.comms_templates TO service_role;
ALTER TABLE public.comms_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tpl_select_members" ON public.comms_templates
  FOR SELECT TO authenticated USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "tpl_write_staff" ON public.comms_templates
  FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid())
         OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role))
  WITH CHECK (public.is_school_admin(school_id, auth.uid())
         OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role));
CREATE TRIGGER comms_templates_set_updated_at BEFORE UPDATE ON public.comms_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.broadcast_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[],
  status text NOT NULL DEFAULT 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  recurrence text,
  template_id uuid REFERENCES public.comms_templates(id) ON DELETE SET NULL,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_jobs_school_status
  ON public.broadcast_jobs(school_id, status, scheduled_for);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_jobs TO authenticated;
GRANT ALL ON public.broadcast_jobs TO service_role;
ALTER TABLE public.broadcast_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bj_admin_all" ON public.broadcast_jobs
  FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE TRIGGER broadcast_jobs_set_updated_at BEFORE UPDATE ON public.broadcast_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.broadcast_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.broadcast_jobs(id) ON DELETE CASCADE,
  school_id uuid NOT NULL,
  user_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'in_app',
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  read_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bd_broadcast ON public.broadcast_deliveries(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_bd_user ON public.broadcast_deliveries(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_deliveries TO authenticated;
GRANT ALL ON public.broadcast_deliveries TO service_role;
ALTER TABLE public.broadcast_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bd_select" ON public.broadcast_deliveries
  FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "bd_update_own" ON public.broadcast_deliveries
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "bd_admin_insert" ON public.broadcast_deliveries
  FOR INSERT TO authenticated WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "bd_admin_delete" ON public.broadcast_deliveries
  FOR DELETE TO authenticated USING (public.is_school_admin(school_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.comms_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  surface text,
  ref_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ce_school_kind_time ON public.comms_events(school_id, kind, created_at DESC);
GRANT SELECT, INSERT ON public.comms_events TO authenticated;
GRANT ALL ON public.comms_events TO service_role;
ALTER TABLE public.comms_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce_insert_self" ON public.comms_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_member(school_id, auth.uid()));
CREATE POLICY "ce_admin_select" ON public.comms_events
  FOR SELECT TO authenticated USING (public.is_school_admin(school_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.inbox_stars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  school_id uuid NOT NULL,
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS idx_inbox_stars_user ON public.inbox_stars(user_id, school_id);
GRANT SELECT, INSERT, DELETE ON public.inbox_stars TO authenticated;
GRANT ALL ON public.inbox_stars TO service_role;
ALTER TABLE public.inbox_stars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "is_own" ON public.inbox_stars
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_member(school_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.support_ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  default_assignee uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_categories TO authenticated;
GRANT ALL ON public.support_ticket_categories TO service_role;
ALTER TABLE public.support_ticket_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stc_select_members" ON public.support_ticket_categories
  FOR SELECT TO authenticated USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "stc_admin_write" ON public.support_ticket_categories
  FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE TRIGGER stc_set_updated_at BEFORE UPDATE ON public.support_ticket_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.support_ticket_categories (school_id, name, slug)
SELECT s.id, c.name, c.slug
FROM public.schools s
CROSS JOIN (VALUES
  ('Academic Issues','academic'),
  ('Result Issues','result'),
  ('Payment Issues','payment'),
  ('Technical Support','technical'),
  ('Admission Requests','admission')
) AS c(name, slug)
ON CONFLICT (school_id, slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.comms_ensure_class_channel(_class_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conv uuid; v_school uuid; v_name text; v_creator uuid;
BEGIN
  SELECT c.school_id, c.name, c.teacher_id INTO v_school, v_name, v_creator
    FROM public.classes c WHERE c.id = _class_id;
  IF v_school IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_conv FROM public.conversations
   WHERE school_id = v_school AND channel_type = 'class'
     AND (metadata->>'class_id')::uuid = _class_id
   LIMIT 1;

  IF v_conv IS NULL THEN
    INSERT INTO public.conversations (school_id, kind, title, created_by, channel_type, metadata)
    VALUES (v_school, 'group', v_name,
            COALESCE(v_creator, '00000000-0000-0000-0000-000000000000'::uuid),
            'class', jsonb_build_object('class_id', _class_id, 'source', 'class'))
    RETURNING id INTO v_conv;
  END IF;
  RETURN v_conv;
END $$;

CREATE OR REPLACE FUNCTION public.comms_sync_class_participants(_class_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conv uuid;
BEGIN
  v_conv := public.comms_ensure_class_channel(_class_id);
  IF v_conv IS NULL THEN RETURN; END IF;

  INSERT INTO public.conversation_participants (conversation_id, user_id, role_at_join)
  SELECT v_conv, ce.student_id, 'student'
    FROM public.class_enrollments ce WHERE ce.class_id = _class_id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.conversation_participants (conversation_id, user_id, role_at_join)
  SELECT v_conv, cst.teacher_user_id, 'teacher'
    FROM public.class_subject_teachers cst WHERE cst.class_id = _class_id
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.tg_comms_class_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.comms_ensure_class_channel(NEW.id); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS comms_class_after_insert ON public.classes;
CREATE TRIGGER comms_class_after_insert
  AFTER INSERT ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.tg_comms_class_after_insert();

CREATE OR REPLACE FUNCTION public.tg_comms_enrollment_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.comms_sync_class_participants(COALESCE(NEW.class_id, OLD.class_id));
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS comms_enrollment_sync ON public.class_enrollments;
CREATE TRIGGER comms_enrollment_sync
  AFTER INSERT OR DELETE ON public.class_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.tg_comms_enrollment_sync();

DROP TRIGGER IF EXISTS comms_teacher_sync ON public.class_subject_teachers;
CREATE TRIGGER comms_teacher_sync
  AFTER INSERT OR DELETE ON public.class_subject_teachers
  FOR EACH ROW EXECUTE FUNCTION public.tg_comms_enrollment_sync();

CREATE OR REPLACE FUNCTION public.comms_backfill_channels()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id FROM public.classes LOOP
    PERFORM public.comms_sync_class_participants(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

SELECT public.comms_backfill_channels();
